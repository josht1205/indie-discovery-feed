// Copyright (c) Indie Discovery. Licensed under MIT.

#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"
#include "HttpServerModule.h"
#include "IHttpRouter.h"
#include "HttpResultCallback.h"
#include "HttpRouteHandle.h"

class FUnrealMCPModule : public IModuleInterface
{
public:
	virtual void StartupModule() override;
	virtual void ShutdownModule() override;

	/** Bound port (default 9877). */
	static constexpr uint32 DefaultPort = 9877;

private:
	void StartHttpServer();
	void StopHttpServer();

	void RegisterRoutes();

	/** Helper that wraps a handler in a try/catch and JSON envelope. */
	template <typename HandlerFn>
	FHttpRequestHandler MakeHandler(HandlerFn Fn);

	void HandleEditorExit();

	TSharedPtr<IHttpRouter> Router;
	TArray<FHttpRouteHandle> RouteHandles;
	bool bServerStarted = false;
	uint32 BoundPort = DefaultPort;

	FDelegateHandle OnExitHandle;
};
