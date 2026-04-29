// Copyright (c) Indie Discovery. Licensed under MIT.

#include "UnrealMCPModule.h"
#include "MCPCommon.h"

#include "HttpServerModule.h"
#include "HttpServerRequest.h"
#include "HttpServerResponse.h"
#include "IHttpRouter.h"
#include "Misc/CoreDelegates.h"
#include "Modules/ModuleManager.h"

DEFINE_LOG_CATEGORY(LogUnrealMCP);

#define LOCTEXT_NAMESPACE "FUnrealMCPModule"

void FUnrealMCPModule::StartupModule()
{
	UE_LOG(LogUnrealMCP, Log, TEXT("UnrealMCP starting up"));

	StartHttpServer();

	OnExitHandle = FCoreDelegates::OnExit.AddRaw(this, &FUnrealMCPModule::HandleEditorExit);
}

void FUnrealMCPModule::ShutdownModule()
{
	if (OnExitHandle.IsValid())
	{
		FCoreDelegates::OnExit.Remove(OnExitHandle);
		OnExitHandle.Reset();
	}
	StopHttpServer();
}

void FUnrealMCPModule::HandleEditorExit()
{
	StopHttpServer();
}

void FUnrealMCPModule::StartHttpServer()
{
	if (bServerStarted)
	{
		return;
	}

	FHttpServerModule& HttpServerModule = FHttpServerModule::Get();
	Router = HttpServerModule.GetHttpRouter(BoundPort);
	if (!Router.IsValid())
	{
		UE_LOG(LogUnrealMCP, Error, TEXT("UnrealMCP: failed to obtain HTTP router on port %u"), BoundPort);
		return;
	}

	RegisterRoutes();

	HttpServerModule.StartAllListeners();
	bServerStarted = true;

	UE_LOG(LogUnrealMCP, Log, TEXT("UnrealMCP listening on http://localhost:%u"), BoundPort);
}

void FUnrealMCPModule::StopHttpServer()
{
	if (!bServerStarted)
	{
		return;
	}

	if (Router.IsValid())
	{
		for (FHttpRouteHandle& Handle : RouteHandles)
		{
			if (Handle.IsValid())
			{
				Router->UnbindRoute(Handle);
			}
		}
	}
	RouteHandles.Reset();
	Router.Reset();

	if (FHttpServerModule::IsAvailable())
	{
		FHttpServerModule::Get().StopAllListeners();
	}

	bServerStarted = false;
	UE_LOG(LogUnrealMCP, Log, TEXT("UnrealMCP stopped"));
}

void FUnrealMCPModule::RegisterRoutes()
{
	using namespace UnrealMCPHandlers;

	auto AddRoutes = [this](const TArray<FRouteSpec>& Specs)
	{
		for (const FRouteSpec& Spec : Specs)
		{
			FHttpRouteHandle Handle = Router->BindRoute(
				FHttpPath(Spec.Path),
				Spec.Verb,
				FHttpRequestHandler::CreateLambda(
					[Inner = Spec.Handler](const FHttpServerRequest& Request, const FHttpResultCallback& OnComplete) -> bool
					{
						return Inner.Execute(Request, OnComplete);
					}));
			if (Handle.IsValid())
			{
				RouteHandles.Add(Handle);
			}
			else
			{
				UE_LOG(LogUnrealMCP, Warning, TEXT("Failed to bind route %s"), *Spec.Path);
			}
		}
	};

	AddRoutes(GetSceneRoutes());
	AddRoutes(GetAssetRoutes());
	AddRoutes(GetBlueprintRoutes());
	AddRoutes(GetCodeRoutes());
	AddRoutes(GetProjectRoutes());

	// Health check
	FHttpRouteHandle HealthHandle = Router->BindRoute(
		FHttpPath(TEXT("/health")),
		EHttpServerRequestVerbs::VERB_GET,
		FHttpRequestHandler::CreateLambda(
			[](const FHttpServerRequest&, const FHttpResultCallback& OnComplete) -> bool
			{
				TSharedRef<FJsonObject> Obj = MakeShared<FJsonObject>();
				Obj->SetStringField(TEXT("status"), TEXT("ok"));
				OnComplete(UnrealMCP::Success(Obj));
				return true;
			}));
	if (HealthHandle.IsValid())
	{
		RouteHandles.Add(HealthHandle);
	}
}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(FUnrealMCPModule, UnrealMCP)
