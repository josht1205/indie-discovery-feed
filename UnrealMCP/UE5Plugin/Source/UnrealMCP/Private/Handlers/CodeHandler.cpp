// Copyright (c) Indie Discovery. Licensed under MIT.

#include "MCPCommon.h"

#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "HAL/FileManager.h"
#include "Misc/App.h"

#if WITH_LIVE_CODING
#include "ILiveCodingModule.h"
#endif

namespace
{
	FString SourceDir()
	{
		return FPaths::ConvertRelativePathToFull(FPaths::ProjectDir() / TEXT("Source"));
	}

	bool ResolveSafePath(const FString& Relative, FString& OutAbsolute, FString& OutError)
	{
		const FString Base = SourceDir();
		FString Combined = FPaths::Combine(Base, Relative);
		FPaths::NormalizeFilename(Combined);
		FPaths::CollapseRelativeDirectories(Combined);

		if (!Combined.StartsWith(Base))
		{
			OutError = TEXT("Path escapes Source/ directory");
			return false;
		}
		OutAbsolute = Combined;
		return true;
	}
}

namespace UnrealMCPHandlers
{
	static FHttpRequestHandler MakeCodeRead()
	{
		return FHttpRequestHandler::CreateLambda(
			[](const FHttpServerRequest& Req, const FHttpResultCallback& OnComplete) -> bool
			{
				TSharedPtr<FJsonObject> Body = UnrealMCP::ParseBody(Req);
				UnrealMCP::RunOnGameThread(OnComplete, [Body]() -> TUniquePtr<FHttpServerResponse>
				{
					FString Rel;
					Body->TryGetStringField(TEXT("relative_path"), Rel);
					if (Rel.IsEmpty()) return UnrealMCP::Error(TEXT("'relative_path' required"));

					FString Abs, Err;
					if (!ResolveSafePath(Rel, Abs, Err)) return UnrealMCP::Error(Err);

					FString Content;
					if (!FFileHelper::LoadFileToString(Content, *Abs))
					{
						return UnrealMCP::Error(FString::Printf(TEXT("Could not read: %s"), *Abs));
					}

					TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
					Result->SetStringField(TEXT("relative_path"), Rel);
					Result->SetStringField(TEXT("absolute_path"), Abs);
					Result->SetStringField(TEXT("content"), Content);
					Result->SetNumberField(TEXT("bytes"), Content.Len());
					return UnrealMCP::Success(Result);
				});
				return true;
			});
	}

	static FHttpRequestHandler MakeCodeWrite()
	{
		return FHttpRequestHandler::CreateLambda(
			[](const FHttpServerRequest& Req, const FHttpResultCallback& OnComplete) -> bool
			{
				TSharedPtr<FJsonObject> Body = UnrealMCP::ParseBody(Req);
				UnrealMCP::RunOnGameThread(OnComplete, [Body]() -> TUniquePtr<FHttpServerResponse>
				{
					FString Rel, Content;
					Body->TryGetStringField(TEXT("relative_path"), Rel);
					Body->TryGetStringField(TEXT("content"), Content);
					if (Rel.IsEmpty()) return UnrealMCP::Error(TEXT("'relative_path' required"));

					FString Abs, Err;
					if (!ResolveSafePath(Rel, Abs, Err)) return UnrealMCP::Error(Err);

					// Ensure parent dir exists
					const FString Dir = FPaths::GetPath(Abs);
					IFileManager::Get().MakeDirectory(*Dir, /*Tree*/ true);

					if (!FFileHelper::SaveStringToFile(Content, *Abs, FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM))
					{
						return UnrealMCP::Error(FString::Printf(TEXT("Failed to write: %s"), *Abs));
					}

					TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
					Result->SetStringField(TEXT("relative_path"), Rel);
					Result->SetStringField(TEXT("absolute_path"), Abs);
					Result->SetNumberField(TEXT("bytes"), Content.Len());
					return UnrealMCP::Success(Result);
				});
				return true;
			});
	}

	static FHttpRequestHandler MakeCodeCompile()
	{
		return FHttpRequestHandler::CreateLambda(
			[](const FHttpServerRequest& Req, const FHttpResultCallback& OnComplete) -> bool
			{
				UnrealMCP::RunOnGameThread(OnComplete, []() -> TUniquePtr<FHttpServerResponse>
				{
					TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
#if WITH_LIVE_CODING
					ILiveCodingModule* LiveCoding = FModuleManager::LoadModulePtr<ILiveCodingModule>("LiveCoding");
					if (LiveCoding && LiveCoding->IsEnabledForSession())
					{
						LiveCoding->Compile();
						Result->SetStringField(TEXT("method"), TEXT("live_coding"));
						Result->SetBoolField(TEXT("triggered"), true);
						Result->SetStringField(TEXT("note"), TEXT("Live Coding compile triggered. Check Output Log for results."));
						return UnrealMCP::Success(Result);
					}
#endif
					Result->SetStringField(TEXT("method"), TEXT("none"));
					Result->SetBoolField(TEXT("triggered"), false);
					Result->SetStringField(TEXT("note"), TEXT("Live Coding not enabled. Recompile manually or restart the editor."));
					return UnrealMCP::Success(Result);
				});
				return true;
			});
	}

	TArray<FRouteSpec> GetCodeRoutes()
	{
		return {
			{ TEXT("/code/read"), EHttpServerRequestVerbs::VERB_GET | EHttpServerRequestVerbs::VERB_POST, MakeCodeRead() },
			{ TEXT("/code/write"), EHttpServerRequestVerbs::VERB_POST, MakeCodeWrite() },
			{ TEXT("/code/compile"), EHttpServerRequestVerbs::VERB_POST, MakeCodeCompile() },
		};
	}
}
