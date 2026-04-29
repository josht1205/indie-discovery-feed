// Copyright (c) Indie Discovery. Licensed under MIT.

#include "MCPCommon.h"

#include "AssetRegistry/AssetRegistryModule.h"
#include "AssetRegistry/IAssetRegistry.h"
#include "AssetToolsModule.h"
#include "IAssetTools.h"
#include "Factories/BlueprintFactory.h"
#include "Factories/MaterialFactoryNew.h"
#include "Engine/Blueprint.h"
#include "Materials/Material.h"
#include "ObjectTools.h"
#include "FileHelpers.h"
#include "PackageTools.h"
#include "UObject/SavePackage.h"

namespace
{
	IAssetRegistry& GetAssetRegistry()
	{
		FAssetRegistryModule& Module = FModuleManager::LoadModuleChecked<FAssetRegistryModule>(TEXT("AssetRegistry"));
		return Module.Get();
	}

	IAssetTools& GetAssetTools()
	{
		return FModuleManager::LoadModuleChecked<FAssetToolsModule>(TEXT("AssetTools")).Get();
	}

	FString NormalizeContentPath(FString In)
	{
		if (In.IsEmpty()) In = TEXT("/Game");
		if (!In.StartsWith(TEXT("/"))) In = TEXT("/Game/") + In;
		// Remove trailing slash for asset registry queries
		while (In.Len() > 1 && In.EndsWith(TEXT("/")))
		{
			In.LeftChopInline(1);
		}
		return In;
	}

	UClass* ResolveClassByName(const FString& Name)
	{
		if (Name.IsEmpty()) return nullptr;
		if (UClass* Found = FindObject<UClass>(nullptr, *Name)) return Found;
		if (UClass* Found = LoadObject<UClass>(nullptr, *Name)) return Found;
		for (TObjectIterator<UClass> It; It; ++It)
		{
			if (It->GetName().Equals(Name, ESearchCase::IgnoreCase)) return *It;
		}
		return nullptr;
	}
}

namespace UnrealMCPHandlers
{
	static FHttpRequestHandler MakeAssetsList()
	{
		return FHttpRequestHandler::CreateLambda(
			[](const FHttpServerRequest& Req, const FHttpResultCallback& OnComplete) -> bool
			{
				TSharedPtr<FJsonObject> Body = UnrealMCP::ParseBody(Req);
				UnrealMCP::RunOnGameThread(OnComplete, [Body]() -> TUniquePtr<FHttpServerResponse>
				{
					IAssetRegistry& AR = GetAssetRegistry();

					FString Path;
					Body->TryGetStringField(TEXT("path"), Path);
					Path = NormalizeContentPath(Path);

					bool bRecursive = false;
					Body->TryGetBoolField(TEXT("recursive"), bRecursive);

					FString Filter;
					Body->TryGetStringField(TEXT("filter"), Filter);

					TArray<FAssetData> AssetData;
					AR.GetAssetsByPath(FName(*Path), AssetData, bRecursive);

					TArray<TSharedPtr<FJsonValue>> Out;
					for (const FAssetData& A : AssetData)
					{
						if (!Filter.IsEmpty() && !A.AssetName.ToString().Contains(Filter, ESearchCase::IgnoreCase))
						{
							continue;
						}
						TSharedRef<FJsonObject> Entry = MakeShared<FJsonObject>();
						Entry->SetStringField(TEXT("name"), A.AssetName.ToString());
						Entry->SetStringField(TEXT("class"), A.AssetClassPath.ToString());
						Entry->SetStringField(TEXT("package_path"), A.PackagePath.ToString());
						Entry->SetStringField(TEXT("object_path"), A.GetObjectPathString());
						Out.Add(MakeShared<FJsonValueObject>(Entry));
					}

					TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
					Result->SetStringField(TEXT("path"), Path);
					Result->SetBoolField(TEXT("recursive"), bRecursive);
					Result->SetArrayField(TEXT("assets"), Out);
					Result->SetNumberField(TEXT("count"), Out.Num());
					return UnrealMCP::Success(Result);
				});
				return true;
			});
	}

	static FHttpRequestHandler MakeAssetsCreateBlueprint()
	{
		return FHttpRequestHandler::CreateLambda(
			[](const FHttpServerRequest& Req, const FHttpResultCallback& OnComplete) -> bool
			{
				TSharedPtr<FJsonObject> Body = UnrealMCP::ParseBody(Req);
				UnrealMCP::RunOnGameThread(OnComplete, [Body]() -> TUniquePtr<FHttpServerResponse>
				{
					FString Name, ParentClassName, Path;
					Body->TryGetStringField(TEXT("name"), Name);
					Body->TryGetStringField(TEXT("parent_class"), ParentClassName);
					Body->TryGetStringField(TEXT("path"), Path);
					Path = NormalizeContentPath(Path);

					if (Name.IsEmpty()) return UnrealMCP::Error(TEXT("'name' is required"));

					UClass* ParentClass = ResolveClassByName(ParentClassName);
					if (!ParentClass) ParentClass = AActor::StaticClass();

					IAssetTools& AssetTools = GetAssetTools();
					UBlueprintFactory* Factory = NewObject<UBlueprintFactory>();
					Factory->ParentClass = ParentClass;

					UObject* NewAsset = AssetTools.CreateAsset(Name, Path, UBlueprint::StaticClass(), Factory);
					if (!NewAsset) return UnrealMCP::Error(TEXT("Failed to create blueprint"));

					// Save the package immediately
					UPackage* Package = NewAsset->GetOutermost();
					Package->MarkPackageDirty();
					FEditorFileUtils::PromptForCheckoutAndSave({ Package }, /*bCheckDirty*/ false, /*bPromptToSave*/ false);

					TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
					Result->SetStringField(TEXT("name"), NewAsset->GetName());
					Result->SetStringField(TEXT("path"), NewAsset->GetPathName());
					Result->SetStringField(TEXT("parent_class"), ParentClass->GetPathName());
					return UnrealMCP::Success(Result);
				});
				return true;
			});
	}

	static FHttpRequestHandler MakeAssetsCreateMaterial()
	{
		return FHttpRequestHandler::CreateLambda(
			[](const FHttpServerRequest& Req, const FHttpResultCallback& OnComplete) -> bool
			{
				TSharedPtr<FJsonObject> Body = UnrealMCP::ParseBody(Req);
				UnrealMCP::RunOnGameThread(OnComplete, [Body]() -> TUniquePtr<FHttpServerResponse>
				{
					FString Name, Path;
					Body->TryGetStringField(TEXT("name"), Name);
					Body->TryGetStringField(TEXT("path"), Path);
					Path = NormalizeContentPath(Path);
					if (Name.IsEmpty()) return UnrealMCP::Error(TEXT("'name' is required"));

					IAssetTools& AssetTools = GetAssetTools();
					UMaterialFactoryNew* Factory = NewObject<UMaterialFactoryNew>();
					UObject* NewAsset = AssetTools.CreateAsset(Name, Path, UMaterial::StaticClass(), Factory);
					if (!NewAsset) return UnrealMCP::Error(TEXT("Failed to create material"));

					UPackage* Package = NewAsset->GetOutermost();
					Package->MarkPackageDirty();
					FEditorFileUtils::PromptForCheckoutAndSave({ Package }, false, false);

					TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
					Result->SetStringField(TEXT("name"), NewAsset->GetName());
					Result->SetStringField(TEXT("path"), NewAsset->GetPathName());
					return UnrealMCP::Success(Result);
				});
				return true;
			});
	}

	static FHttpRequestHandler MakeAssetsDelete()
	{
		return FHttpRequestHandler::CreateLambda(
			[](const FHttpServerRequest& Req, const FHttpResultCallback& OnComplete) -> bool
			{
				TSharedPtr<FJsonObject> Body = UnrealMCP::ParseBody(Req);
				UnrealMCP::RunOnGameThread(OnComplete, [Body]() -> TUniquePtr<FHttpServerResponse>
				{
					FString AssetPath;
					Body->TryGetStringField(TEXT("asset_path"), AssetPath);
					if (AssetPath.IsEmpty()) return UnrealMCP::Error(TEXT("'asset_path' required"));

					IAssetRegistry& AR = GetAssetRegistry();
					FAssetData Data = AR.GetAssetByObjectPath(FSoftObjectPath(AssetPath));
					if (!Data.IsValid()) return UnrealMCP::Error(FString::Printf(TEXT("Asset not found: %s"), *AssetPath));

					UObject* Object = Data.GetAsset();
					if (!Object) return UnrealMCP::Error(TEXT("Failed to load asset"));

					TArray<UObject*> ToDelete;
					ToDelete.Add(Object);
					int32 NumDeleted = ObjectTools::DeleteObjects(ToDelete, false);

					TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
					Result->SetStringField(TEXT("asset_path"), AssetPath);
					Result->SetNumberField(TEXT("deleted_count"), NumDeleted);
					return UnrealMCP::Success(Result);
				});
				return true;
			});
	}

	TArray<FRouteSpec> GetAssetRoutes()
	{
		return {
			{ TEXT("/assets/list"), EHttpServerRequestVerbs::VERB_GET | EHttpServerRequestVerbs::VERB_POST, MakeAssetsList() },
			{ TEXT("/assets/create_blueprint"), EHttpServerRequestVerbs::VERB_POST, MakeAssetsCreateBlueprint() },
			{ TEXT("/assets/create_material"), EHttpServerRequestVerbs::VERB_POST, MakeAssetsCreateMaterial() },
			{ TEXT("/assets/delete"), EHttpServerRequestVerbs::VERB_POST, MakeAssetsDelete() },
		};
	}
}
