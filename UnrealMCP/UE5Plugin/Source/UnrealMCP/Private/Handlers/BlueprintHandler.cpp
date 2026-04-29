// Copyright (c) Indie Discovery. Licensed under MIT.

#include "MCPCommon.h"

#include "Engine/Blueprint.h"
#include "Kismet2/BlueprintEditorUtils.h"
#include "Kismet2/KismetEditorUtilities.h"
#include "Kismet2/CompilerResultsLog.h"
#include "EdGraph/EdGraph.h"
#include "EdGraph/EdGraphNode.h"
#include "EdGraph/EdGraphPin.h"
#include "EdGraphSchema_K2.h"
#include "K2Node.h"
#include "AssetRegistry/AssetRegistryModule.h"

namespace
{
	UBlueprint* LoadBlueprintByPath(const FString& Path)
	{
		if (Path.IsEmpty()) return nullptr;
		// Try direct load
		if (UBlueprint* BP = LoadObject<UBlueprint>(nullptr, *Path)) return BP;
		// Try via asset registry
		FAssetRegistryModule& Module = FModuleManager::LoadModuleChecked<FAssetRegistryModule>(TEXT("AssetRegistry"));
		FAssetData Data = Module.Get().GetAssetByObjectPath(FSoftObjectPath(Path));
		if (Data.IsValid())
		{
			return Cast<UBlueprint>(Data.GetAsset());
		}
		return nullptr;
	}

	FEdGraphPinType ResolvePinType(const FString& TypeStr)
	{
		FEdGraphPinType PinType;
		PinType.ContainerType = EPinContainerType::None;

		const FString T = TypeStr.ToLower();
		if (T == TEXT("bool") || T == TEXT("boolean"))
		{
			PinType.PinCategory = UEdGraphSchema_K2::PC_Boolean;
		}
		else if (T == TEXT("int") || T == TEXT("integer") || T == TEXT("int32"))
		{
			PinType.PinCategory = UEdGraphSchema_K2::PC_Int;
		}
		else if (T == TEXT("float") || T == TEXT("real") || T == TEXT("double"))
		{
			PinType.PinCategory = UEdGraphSchema_K2::PC_Real;
			PinType.PinSubCategory = UEdGraphSchema_K2::PC_Double;
		}
		else if (T == TEXT("string"))
		{
			PinType.PinCategory = UEdGraphSchema_K2::PC_String;
		}
		else if (T == TEXT("name"))
		{
			PinType.PinCategory = UEdGraphSchema_K2::PC_Name;
		}
		else if (T == TEXT("text"))
		{
			PinType.PinCategory = UEdGraphSchema_K2::PC_Text;
		}
		else if (T == TEXT("vector"))
		{
			PinType.PinCategory = UEdGraphSchema_K2::PC_Struct;
			PinType.PinSubCategoryObject = TBaseStructure<FVector>::Get();
		}
		else if (T == TEXT("rotator"))
		{
			PinType.PinCategory = UEdGraphSchema_K2::PC_Struct;
			PinType.PinSubCategoryObject = TBaseStructure<FRotator>::Get();
		}
		else if (T == TEXT("transform"))
		{
			PinType.PinCategory = UEdGraphSchema_K2::PC_Struct;
			PinType.PinSubCategoryObject = TBaseStructure<FTransform>::Get();
		}
		else
		{
			// Object reference fallback by name lookup
			UClass* Cls = FindObject<UClass>(nullptr, *TypeStr);
			if (!Cls) Cls = LoadObject<UClass>(nullptr, *TypeStr);
			if (Cls)
			{
				PinType.PinCategory = UEdGraphSchema_K2::PC_Object;
				PinType.PinSubCategoryObject = Cls;
			}
			else
			{
				// default to string if unknown
				PinType.PinCategory = UEdGraphSchema_K2::PC_String;
			}
		}
		return PinType;
	}
}

namespace UnrealMCPHandlers
{
	static FHttpRequestHandler MakeAddVariable()
	{
		return FHttpRequestHandler::CreateLambda(
			[](const FHttpServerRequest& Req, const FHttpResultCallback& OnComplete) -> bool
			{
				TSharedPtr<FJsonObject> Body = UnrealMCP::ParseBody(Req);
				UnrealMCP::RunOnGameThread(OnComplete, [Body]() -> TUniquePtr<FHttpServerResponse>
				{
					FString BPPath, VarName, VarType, DefaultValue;
					Body->TryGetStringField(TEXT("blueprint_path"), BPPath);
					Body->TryGetStringField(TEXT("name"), VarName);
					Body->TryGetStringField(TEXT("type"), VarType);
					Body->TryGetStringField(TEXT("default_value"), DefaultValue);

					UBlueprint* BP = LoadBlueprintByPath(BPPath);
					if (!BP) return UnrealMCP::Error(FString::Printf(TEXT("Blueprint not found: %s"), *BPPath));
					if (VarName.IsEmpty()) return UnrealMCP::Error(TEXT("'name' is required"));

					FEdGraphPinType PinType = ResolvePinType(VarType);
					const bool bAdded = FBlueprintEditorUtils::AddMemberVariable(BP, FName(*VarName), PinType, DefaultValue);
					if (!bAdded) return UnrealMCP::Error(TEXT("AddMemberVariable failed (name conflict?)"));

					FBlueprintEditorUtils::MarkBlueprintAsModified(BP);

					TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
					Result->SetStringField(TEXT("blueprint_path"), BPPath);
					Result->SetStringField(TEXT("variable"), VarName);
					Result->SetStringField(TEXT("type"), VarType);
					return UnrealMCP::Success(Result);
				});
				return true;
			});
	}

	static FHttpRequestHandler MakeAddFunction()
	{
		return FHttpRequestHandler::CreateLambda(
			[](const FHttpServerRequest& Req, const FHttpResultCallback& OnComplete) -> bool
			{
				TSharedPtr<FJsonObject> Body = UnrealMCP::ParseBody(Req);
				UnrealMCP::RunOnGameThread(OnComplete, [Body]() -> TUniquePtr<FHttpServerResponse>
				{
					FString BPPath, FunctionName;
					Body->TryGetStringField(TEXT("blueprint_path"), BPPath);
					Body->TryGetStringField(TEXT("function_name"), FunctionName);

					UBlueprint* BP = LoadBlueprintByPath(BPPath);
					if (!BP) return UnrealMCP::Error(FString::Printf(TEXT("Blueprint not found: %s"), *BPPath));
					if (FunctionName.IsEmpty()) return UnrealMCP::Error(TEXT("'function_name' required"));

					UEdGraph* NewGraph = FBlueprintEditorUtils::CreateNewGraph(
						BP,
						FName(*FunctionName),
						UEdGraph::StaticClass(),
						UEdGraphSchema_K2::StaticClass());

					if (!NewGraph) return UnrealMCP::Error(TEXT("CreateNewGraph failed"));

					FBlueprintEditorUtils::AddFunctionGraph(BP, NewGraph, /*bIsUserCreated*/ true, UObject::StaticClass());
					FBlueprintEditorUtils::MarkBlueprintAsModified(BP);

					TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
					Result->SetStringField(TEXT("blueprint_path"), BPPath);
					Result->SetStringField(TEXT("function"), FunctionName);
					return UnrealMCP::Success(Result);
				});
				return true;
			});
	}

	static FHttpRequestHandler MakeCompile()
	{
		return FHttpRequestHandler::CreateLambda(
			[](const FHttpServerRequest& Req, const FHttpResultCallback& OnComplete) -> bool
			{
				TSharedPtr<FJsonObject> Body = UnrealMCP::ParseBody(Req);
				UnrealMCP::RunOnGameThread(OnComplete, [Body]() -> TUniquePtr<FHttpServerResponse>
				{
					FString BPPath;
					Body->TryGetStringField(TEXT("blueprint_path"), BPPath);
					UBlueprint* BP = LoadBlueprintByPath(BPPath);
					if (!BP) return UnrealMCP::Error(FString::Printf(TEXT("Blueprint not found: %s"), *BPPath));

					FCompilerResultsLog Results;
					FKismetEditorUtilities::CompileBlueprint(BP, EBlueprintCompileOptions::None, &Results);

					TArray<TSharedPtr<FJsonValue>> Errors, Warnings;
					for (const TSharedRef<FTokenizedMessage>& Msg : Results.Messages)
					{
						const FString Text = Msg->ToText().ToString();
						if (Msg->GetSeverity() == EMessageSeverity::Error)
						{
							Errors.Add(MakeShared<FJsonValueString>(Text));
						}
						else if (Msg->GetSeverity() == EMessageSeverity::Warning)
						{
							Warnings.Add(MakeShared<FJsonValueString>(Text));
						}
					}

					TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
					Result->SetStringField(TEXT("blueprint_path"), BPPath);
					Result->SetNumberField(TEXT("error_count"), Results.NumErrors);
					Result->SetNumberField(TEXT("warning_count"), Results.NumWarnings);
					Result->SetArrayField(TEXT("errors"), Errors);
					Result->SetArrayField(TEXT("warnings"), Warnings);
					Result->SetBoolField(TEXT("compiled"), Results.NumErrors == 0);
					return UnrealMCP::Success(Result);
				});
				return true;
			});
	}

	static FHttpRequestHandler MakeGetGraph()
	{
		return FHttpRequestHandler::CreateLambda(
			[](const FHttpServerRequest& Req, const FHttpResultCallback& OnComplete) -> bool
			{
				TSharedPtr<FJsonObject> Body = UnrealMCP::ParseBody(Req);
				UnrealMCP::RunOnGameThread(OnComplete, [Body]() -> TUniquePtr<FHttpServerResponse>
				{
					FString BPPath;
					Body->TryGetStringField(TEXT("blueprint_path"), BPPath);
					UBlueprint* BP = LoadBlueprintByPath(BPPath);
					if (!BP) return UnrealMCP::Error(FString::Printf(TEXT("Blueprint not found: %s"), *BPPath));

					TArray<TSharedPtr<FJsonValue>> GraphsArr;
					TArray<UEdGraph*> AllGraphs;
					BP->GetAllGraphs(AllGraphs);

					for (UEdGraph* Graph : AllGraphs)
					{
						if (!Graph) continue;
						TSharedRef<FJsonObject> GObj = MakeShared<FJsonObject>();
						GObj->SetStringField(TEXT("name"), Graph->GetName());

						TArray<TSharedPtr<FJsonValue>> Nodes;
						TArray<TSharedPtr<FJsonValue>> Connections;

						for (UEdGraphNode* Node : Graph->Nodes)
						{
							if (!Node) continue;
							TSharedRef<FJsonObject> NObj = MakeShared<FJsonObject>();
							NObj->SetStringField(TEXT("guid"), Node->NodeGuid.ToString());
							NObj->SetStringField(TEXT("class"), Node->GetClass()->GetName());
							NObj->SetStringField(TEXT("title"), Node->GetNodeTitle(ENodeTitleType::FullTitle).ToString());
							NObj->SetNumberField(TEXT("pos_x"), Node->NodePosX);
							NObj->SetNumberField(TEXT("pos_y"), Node->NodePosY);

							TArray<TSharedPtr<FJsonValue>> PinsArr;
							for (UEdGraphPin* Pin : Node->Pins)
							{
								if (!Pin) continue;
								TSharedRef<FJsonObject> PObj = MakeShared<FJsonObject>();
								PObj->SetStringField(TEXT("name"), Pin->PinName.ToString());
								PObj->SetStringField(TEXT("direction"), Pin->Direction == EGPD_Input ? TEXT("input") : TEXT("output"));
								PObj->SetStringField(TEXT("category"), Pin->PinType.PinCategory.ToString());
								PinsArr.Add(MakeShared<FJsonValueObject>(PObj));

								// Outgoing connections only, to avoid duplicates
								if (Pin->Direction == EGPD_Output)
								{
									for (UEdGraphPin* Linked : Pin->LinkedTo)
									{
										if (!Linked || !Linked->GetOwningNode()) continue;
										TSharedRef<FJsonObject> CObj = MakeShared<FJsonObject>();
										CObj->SetStringField(TEXT("from_node"), Node->NodeGuid.ToString());
										CObj->SetStringField(TEXT("from_pin"), Pin->PinName.ToString());
										CObj->SetStringField(TEXT("to_node"), Linked->GetOwningNode()->NodeGuid.ToString());
										CObj->SetStringField(TEXT("to_pin"), Linked->PinName.ToString());
										Connections.Add(MakeShared<FJsonValueObject>(CObj));
									}
								}
							}
							NObj->SetArrayField(TEXT("pins"), PinsArr);
							Nodes.Add(MakeShared<FJsonValueObject>(NObj));
						}

						GObj->SetArrayField(TEXT("nodes"), Nodes);
						GObj->SetArrayField(TEXT("connections"), Connections);
						GraphsArr.Add(MakeShared<FJsonValueObject>(GObj));
					}

					TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
					Result->SetStringField(TEXT("blueprint_path"), BPPath);
					Result->SetArrayField(TEXT("graphs"), GraphsArr);
					return UnrealMCP::Success(Result);
				});
				return true;
			});
	}

	TArray<FRouteSpec> GetBlueprintRoutes()
	{
		return {
			{ TEXT("/blueprint/add_variable"), EHttpServerRequestVerbs::VERB_POST, MakeAddVariable() },
			{ TEXT("/blueprint/add_function"), EHttpServerRequestVerbs::VERB_POST, MakeAddFunction() },
			{ TEXT("/blueprint/compile"), EHttpServerRequestVerbs::VERB_POST, MakeCompile() },
			{ TEXT("/blueprint/get_graph"), EHttpServerRequestVerbs::VERB_GET | EHttpServerRequestVerbs::VERB_POST, MakeGetGraph() },
		};
	}
}
