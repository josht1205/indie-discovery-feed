// Copyright (c) Indie Discovery. Licensed under MIT.

#include "MCPCommon.h"

#include "Editor.h"
#include "Editor/EditorEngine.h"
#include "EditorActorFolders.h"
#include "EngineUtils.h"
#include "GameFramework/Actor.h"
#include "Selection.h"
#include "UObject/UObjectIterator.h"
#include "UObject/Class.h"
#include "Engine/World.h"
#include "Engine/Selection.h"

namespace
{
	UWorld* GetEditorWorld()
	{
		if (GEditor)
		{
			return GEditor->GetEditorWorldContext().World();
		}
		return nullptr;
	}

	TSharedRef<FJsonObject> ActorToJson(AActor* Actor)
	{
		TSharedRef<FJsonObject> Obj = MakeShared<FJsonObject>();
		Obj->SetStringField(TEXT("name"), Actor->GetActorLabel());
		Obj->SetStringField(TEXT("internal_name"), Actor->GetName());
		Obj->SetStringField(TEXT("class"), Actor->GetClass()->GetName());
		Obj->SetStringField(TEXT("class_path"), Actor->GetClass()->GetPathName());
		Obj->SetObjectField(TEXT("transform"), UnrealMCP::WriteTransform(Actor->GetActorTransform()));

		TArray<TSharedPtr<FJsonValue>> TagArr;
		for (const FName& Tag : Actor->Tags)
		{
			TagArr.Add(MakeShared<FJsonValueString>(Tag.ToString()));
		}
		Obj->SetArrayField(TEXT("tags"), TagArr);
		return Obj;
	}

	UClass* ResolveActorClass(const FString& ClassName)
	{
		if (ClassName.IsEmpty())
		{
			return nullptr;
		}

		// Try direct path or short name
		if (UClass* Found = FindObject<UClass>(nullptr, *ClassName))
		{
			return Found;
		}
		if (UClass* Found = LoadObject<UClass>(nullptr, *ClassName))
		{
			return Found;
		}

		// Walk all UClass instances looking for case-insensitive name match.
		for (TObjectIterator<UClass> It; It; ++It)
		{
			if (It->IsChildOf(AActor::StaticClass()) && It->GetName().Equals(ClassName, ESearchCase::IgnoreCase))
			{
				return *It;
			}
		}
		return nullptr;
	}

	AActor* FindActorByLabel(UWorld* World, const FString& Label)
	{
		if (!World) return nullptr;
		for (TActorIterator<AActor> It(World); It; ++It)
		{
			if (It->GetActorLabel().Equals(Label, ESearchCase::IgnoreCase) ||
			    It->GetName().Equals(Label, ESearchCase::IgnoreCase))
			{
				return *It;
			}
		}
		return nullptr;
	}
}

namespace UnrealMCPHandlers
{
	static FHttpRequestHandler MakeSceneActors()
	{
		return FHttpRequestHandler::CreateLambda(
			[](const FHttpServerRequest& Req, const FHttpResultCallback& OnComplete) -> bool
			{
				UnrealMCP::RunOnGameThread(OnComplete, []() -> TUniquePtr<FHttpServerResponse>
				{
					UWorld* World = GetEditorWorld();
					if (!World) return UnrealMCP::Error(TEXT("No editor world available"));

					TArray<TSharedPtr<FJsonValue>> Actors;
					for (TActorIterator<AActor> It(World); It; ++It)
					{
						Actors.Add(MakeShared<FJsonValueObject>(ActorToJson(*It)));
					}
					TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
					Result->SetArrayField(TEXT("actors"), Actors);
					Result->SetNumberField(TEXT("count"), Actors.Num());
					return UnrealMCP::Success(Result);
				});
				return true;
			});
	}

	static FHttpRequestHandler MakeSceneSpawn()
	{
		return FHttpRequestHandler::CreateLambda(
			[](const FHttpServerRequest& Req, const FHttpResultCallback& OnComplete) -> bool
			{
				TSharedPtr<FJsonObject> Body = UnrealMCP::ParseBody(Req);
				UnrealMCP::RunOnGameThread(OnComplete, [Body]() -> TUniquePtr<FHttpServerResponse>
				{
					UWorld* World = GetEditorWorld();
					if (!World) return UnrealMCP::Error(TEXT("No editor world available"));

					FString ClassName;
					Body->TryGetStringField(TEXT("class"), ClassName);
					UClass* ActorClass = ResolveActorClass(ClassName);
					if (!ActorClass)
					{
						return UnrealMCP::Error(FString::Printf(TEXT("Could not resolve actor class: %s"), *ClassName));
					}

					FVector Location = UnrealMCP::ReadVector(Body, TEXT("location"));
					FRotator Rotation = UnrealMCP::ReadRotator(Body, TEXT("rotation"));
					FVector Scale = UnrealMCP::ReadVector(Body, TEXT("scale"), FVector(1.0));

					FActorSpawnParameters Params;
					Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

					AActor* Spawned = World->SpawnActor<AActor>(ActorClass, Location, Rotation, Params);
					if (!Spawned) return UnrealMCP::Error(TEXT("Failed to spawn actor"));

					Spawned->SetActorScale3D(Scale);

					FString DesiredName;
					if (Body->TryGetStringField(TEXT("name"), DesiredName) && !DesiredName.IsEmpty())
					{
						Spawned->SetActorLabel(DesiredName);
					}

					return UnrealMCP::Success(MakeShared<FJsonValueObject>(ActorToJson(Spawned)));
				});
				return true;
			});
	}

	static FHttpRequestHandler MakeSceneDelete()
	{
		return FHttpRequestHandler::CreateLambda(
			[](const FHttpServerRequest& Req, const FHttpResultCallback& OnComplete) -> bool
			{
				TSharedPtr<FJsonObject> Body = UnrealMCP::ParseBody(Req);
				UnrealMCP::RunOnGameThread(OnComplete, [Body]() -> TUniquePtr<FHttpServerResponse>
				{
					UWorld* World = GetEditorWorld();
					if (!World) return UnrealMCP::Error(TEXT("No editor world available"));

					FString Name;
					Body->TryGetStringField(TEXT("name"), Name);
					AActor* Target = FindActorByLabel(World, Name);
					if (!Target) return UnrealMCP::Error(FString::Printf(TEXT("Actor not found: %s"), *Name));

					const bool bDestroyed = World->EditorDestroyActor(Target, true);
					TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
					Result->SetBoolField(TEXT("destroyed"), bDestroyed);
					Result->SetStringField(TEXT("name"), Name);
					return UnrealMCP::Success(Result);
				});
				return true;
			});
	}

	static FHttpRequestHandler MakeSceneSetTransform()
	{
		return FHttpRequestHandler::CreateLambda(
			[](const FHttpServerRequest& Req, const FHttpResultCallback& OnComplete) -> bool
			{
				TSharedPtr<FJsonObject> Body = UnrealMCP::ParseBody(Req);
				UnrealMCP::RunOnGameThread(OnComplete, [Body]() -> TUniquePtr<FHttpServerResponse>
				{
					UWorld* World = GetEditorWorld();
					if (!World) return UnrealMCP::Error(TEXT("No editor world available"));

					FString Name;
					Body->TryGetStringField(TEXT("name"), Name);
					AActor* Target = FindActorByLabel(World, Name);
					if (!Target) return UnrealMCP::Error(FString::Printf(TEXT("Actor not found: %s"), *Name));

					if (Body->HasField(TEXT("location")))
					{
						Target->SetActorLocation(UnrealMCP::ReadVector(Body, TEXT("location"), Target->GetActorLocation()));
					}
					if (Body->HasField(TEXT("rotation")))
					{
						Target->SetActorRotation(UnrealMCP::ReadRotator(Body, TEXT("rotation"), Target->GetActorRotation()));
					}
					if (Body->HasField(TEXT("scale")))
					{
						Target->SetActorScale3D(UnrealMCP::ReadVector(Body, TEXT("scale"), Target->GetActorScale3D()));
					}

					return UnrealMCP::Success(MakeShared<FJsonValueObject>(ActorToJson(Target)));
				});
				return true;
			});
	}

	static FHttpRequestHandler MakeSceneSelected()
	{
		return FHttpRequestHandler::CreateLambda(
			[](const FHttpServerRequest& Req, const FHttpResultCallback& OnComplete) -> bool
			{
				UnrealMCP::RunOnGameThread(OnComplete, []() -> TUniquePtr<FHttpServerResponse>
				{
					if (!GEditor) return UnrealMCP::Error(TEXT("GEditor unavailable"));

					USelection* Selection = GEditor->GetSelectedActors();
					TArray<TSharedPtr<FJsonValue>> Out;
					if (Selection)
					{
						for (FSelectionIterator It(*Selection); It; ++It)
						{
							if (AActor* A = Cast<AActor>(*It))
							{
								Out.Add(MakeShared<FJsonValueObject>(ActorToJson(A)));
							}
						}
					}
					TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
					Result->SetArrayField(TEXT("selected"), Out);
					Result->SetNumberField(TEXT("count"), Out.Num());
					return UnrealMCP::Success(Result);
				});
				return true;
			});
	}

	TArray<FRouteSpec> GetSceneRoutes()
	{
		return {
			{ TEXT("/scene/actors"), EHttpServerRequestVerbs::VERB_GET, MakeSceneActors() },
			{ TEXT("/scene/spawn"), EHttpServerRequestVerbs::VERB_POST, MakeSceneSpawn() },
			{ TEXT("/scene/delete"), EHttpServerRequestVerbs::VERB_POST, MakeSceneDelete() },
			{ TEXT("/scene/set_transform"), EHttpServerRequestVerbs::VERB_POST, MakeSceneSetTransform() },
			{ TEXT("/scene/selected"), EHttpServerRequestVerbs::VERB_GET, MakeSceneSelected() },
		};
	}
}
