// Copyright (c) Indie Discovery. Licensed under MIT.

#include "MCPCommon.h"

#include "Misc/App.h"
#include "Misc/EngineVersion.h"
#include "Misc/Paths.h"
#include "Misc/FileHelper.h"
#include "HAL/FileManager.h"
#include "Modules/ModuleManager.h"
#include "Editor.h"
#include "Engine/World.h"
#include "Engine/Engine.h"
#include "GameFramework/WorldSettings.h"

namespace
{
	void GetSourceTreeRecursive(const FString& Root, const FString& Current, TArray<FString>& Out)
	{
		IFileManager& FM = IFileManager::Get();
		TArray<FString> Files;
		FM.FindFiles(Files, *(Current / TEXT("*.h")), true, false);
		for (const FString& F : Files)
		{
			Out.Add(FPaths::Combine(Current, F).RightChop(Root.Len() + 1));
		}
		Files.Reset();
		FM.FindFiles(Files, *(Current / TEXT("*.cpp")), true, false);
		for (const FString& F : Files)
		{
			Out.Add(FPaths::Combine(Current, F).RightChop(Root.Len() + 1));
		}

		TArray<FString> Subdirs;
		FM.FindFiles(Subdirs, *(Current / TEXT("*")), false, true);
		for (const FString& Sub : Subdirs)
		{
			GetSourceTreeRecursive(Root, Current / Sub, Out);
		}
	}
}

namespace UnrealMCPHandlers
{
	static FHttpRequestHandler MakeProjectInfo()
	{
		return FHttpRequestHandler::CreateLambda(
			[](const FHttpServerRequest& Req, const FHttpResultCallback& OnComplete) -> bool
			{
				UnrealMCP::RunOnGameThread(OnComplete, []() -> TUniquePtr<FHttpServerResponse>
				{
					TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
					Result->SetStringField(TEXT("project_name"), FApp::GetProjectName());
					Result->SetStringField(TEXT("project_dir"), FPaths::ConvertRelativePathToFull(FPaths::ProjectDir()));
					Result->SetStringField(TEXT("engine_version"), FEngineVersion::Current().ToString());

					// Active map
					FString MapName = TEXT("");
					if (GEditor)
					{
						if (UWorld* World = GEditor->GetEditorWorldContext().World())
						{
							MapName = World->GetMapName();
						}
					}
					Result->SetStringField(TEXT("active_map"), MapName);

					// Loaded modules
					TArray<TSharedPtr<FJsonValue>> Modules;
					TArray<FModuleStatus> Status;
					FModuleManager::Get().QueryModules(Status);
					for (const FModuleStatus& M : Status)
					{
						if (!M.bIsLoaded) continue;
						TSharedRef<FJsonObject> ModObj = MakeShared<FJsonObject>();
						ModObj->SetStringField(TEXT("name"), M.Name);
						ModObj->SetStringField(TEXT("file_path"), M.FilePath);
						ModObj->SetBoolField(TEXT("game_module"), M.bIsGameModule);
						Modules.Add(MakeShared<FJsonValueObject>(ModObj));
					}
					Result->SetArrayField(TEXT("loaded_modules"), Modules);
					Result->SetNumberField(TEXT("loaded_module_count"), Modules.Num());
					return UnrealMCP::Success(Result);
				});
				return true;
			});
	}

	static FHttpRequestHandler MakeProjectStructure()
	{
		return FHttpRequestHandler::CreateLambda(
			[](const FHttpServerRequest& Req, const FHttpResultCallback& OnComplete) -> bool
			{
				UnrealMCP::RunOnGameThread(OnComplete, []() -> TUniquePtr<FHttpServerResponse>
				{
					const FString SourceRoot = FPaths::ConvertRelativePathToFull(FPaths::ProjectDir() / TEXT("Source"));
					TArray<FString> Files;
					if (IFileManager::Get().DirectoryExists(*SourceRoot))
					{
						GetSourceTreeRecursive(SourceRoot, SourceRoot, Files);
					}

					TArray<TSharedPtr<FJsonValue>> Out;
					for (const FString& F : Files)
					{
						Out.Add(MakeShared<FJsonValueString>(F));
					}

					TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
					Result->SetStringField(TEXT("source_root"), SourceRoot);
					Result->SetArrayField(TEXT("files"), Out);
					Result->SetNumberField(TEXT("count"), Out.Num());
					return UnrealMCP::Success(Result);
				});
				return true;
			});
	}

	static FHttpRequestHandler MakeProjectLog()
	{
		return FHttpRequestHandler::CreateLambda(
			[](const FHttpServerRequest& Req, const FHttpResultCallback& OnComplete) -> bool
			{
				TSharedPtr<FJsonObject> Body = UnrealMCP::ParseBody(Req);
				UnrealMCP::RunOnGameThread(OnComplete, [Body]() -> TUniquePtr<FHttpServerResponse>
				{
					int32 LineCount = 100;
					double NumberValue = 0;
					if (Body->TryGetNumberField(TEXT("lines"), NumberValue))
					{
						LineCount = FMath::Max(1, FMath::Min(2000, FMath::FloorToInt(NumberValue)));
					}

					const FString LogPath = FPaths::ConvertRelativePathToFull(FPaths::ProjectLogDir() / FString::Printf(TEXT("%s.log"), FApp::GetProjectName()));

					FString FullLog;
					if (!FFileHelper::LoadFileToString(FullLog, *LogPath))
					{
						// Try Engine log file
						const FString EngineLog = FPaths::ConvertRelativePathToFull(FPaths::ProjectLogDir() / TEXT("UnrealEditor.log"));
						FFileHelper::LoadFileToString(FullLog, *EngineLog);
					}

					TArray<FString> AllLines;
					FullLog.ParseIntoArray(AllLines, TEXT("\n"), false);

					const int32 Start = FMath::Max(0, AllLines.Num() - LineCount);
					TArray<TSharedPtr<FJsonValue>> Out;
					for (int32 i = Start; i < AllLines.Num(); ++i)
					{
						Out.Add(MakeShared<FJsonValueString>(AllLines[i]));
					}

					TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
					Result->SetStringField(TEXT("log_path"), LogPath);
					Result->SetNumberField(TEXT("requested_lines"), LineCount);
					Result->SetNumberField(TEXT("returned_lines"), Out.Num());
					Result->SetArrayField(TEXT("lines"), Out);
					return UnrealMCP::Success(Result);
				});
				return true;
			});
	}

	TArray<FRouteSpec> GetProjectRoutes()
	{
		return {
			{ TEXT("/project/info"), EHttpServerRequestVerbs::VERB_GET, MakeProjectInfo() },
			{ TEXT("/project/structure"), EHttpServerRequestVerbs::VERB_GET, MakeProjectStructure() },
			{ TEXT("/project/log"), EHttpServerRequestVerbs::VERB_GET | EHttpServerRequestVerbs::VERB_POST, MakeProjectLog() },
		};
	}
}
