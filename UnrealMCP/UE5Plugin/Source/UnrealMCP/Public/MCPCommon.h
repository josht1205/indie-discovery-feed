// Copyright (c) Indie Discovery. Licensed under MIT.

#pragma once

#include "CoreMinimal.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "HttpServerResponse.h"
#include "HttpServerRequest.h"
#include "HttpResultCallback.h"
#include "Async/Async.h"

DECLARE_LOG_CATEGORY_EXTERN(LogUnrealMCP, Log, All);

namespace UnrealMCP
{
	/** Parse the request body into a JsonObject. Returns empty object on failure. */
	inline TSharedPtr<FJsonObject> ParseBody(const FHttpServerRequest& Request)
	{
		TSharedPtr<FJsonObject> Result;
		if (Request.Body.Num() == 0)
		{
			return MakeShared<FJsonObject>();
		}

		const FUTF8ToTCHAR Converted(reinterpret_cast<const ANSICHAR*>(Request.Body.GetData()), Request.Body.Num());
		const FString BodyStr(Converted.Length(), Converted.Get());

		TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(BodyStr);
		if (!FJsonSerializer::Deserialize(Reader, Result) || !Result.IsValid())
		{
			return MakeShared<FJsonObject>();
		}
		return Result;
	}

	/** Serialize a json object into an HTTP 200 application/json response. */
	inline TUniquePtr<FHttpServerResponse> JsonResponse(const TSharedRef<FJsonObject>& Obj, int32 StatusCode = 200)
	{
		FString OutString;
		TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&OutString);
		FJsonSerializer::Serialize(Obj, Writer);

		TUniquePtr<FHttpServerResponse> Response = FHttpServerResponse::Create(OutString, TEXT("application/json"));
		Response->Code = static_cast<EHttpServerResponseCodes>(StatusCode);
		return Response;
	}

	/** Build the standard envelope { success, result, error }. */
	inline TUniquePtr<FHttpServerResponse> Success(const TSharedPtr<FJsonValue>& Result)
	{
		TSharedRef<FJsonObject> Obj = MakeShared<FJsonObject>();
		Obj->SetBoolField(TEXT("success"), true);
		Obj->SetField(TEXT("result"), Result.IsValid() ? Result : MakeShared<FJsonValueNull>());
		Obj->SetField(TEXT("error"), MakeShared<FJsonValueNull>());
		return JsonResponse(Obj, 200);
	}

	inline TUniquePtr<FHttpServerResponse> Success(const TSharedRef<FJsonObject>& Obj)
	{
		return Success(MakeShared<FJsonValueObject>(Obj));
	}

	inline TUniquePtr<FHttpServerResponse> Error(const FString& Message, int32 StatusCode = 400)
	{
		TSharedRef<FJsonObject> Obj = MakeShared<FJsonObject>();
		Obj->SetBoolField(TEXT("success"), false);
		Obj->SetField(TEXT("result"), MakeShared<FJsonValueNull>());
		Obj->SetStringField(TEXT("error"), Message);
		return JsonResponse(Obj, StatusCode);
	}

	/**
	 * Run a function on the game thread and respond once it completes. The lambda must
	 * return TSharedPtr<FJsonValue>.
	 */
	template <typename Fn>
	void RunOnGameThread(const FHttpResultCallback& OnComplete, Fn&& Body)
	{
		AsyncTask(ENamedThreads::GameThread, [Cb = OnComplete, Work = MoveTemp(Body)]() mutable
		{
			TUniquePtr<FHttpServerResponse> Response;
			try
			{
				Response = Work();
			}
			catch (...)
			{
				Response = Error(TEXT("Unhandled exception in handler"), 500);
			}
			if (!Response.IsValid())
			{
				Response = Error(TEXT("Handler returned no response"), 500);
			}
			Cb(MoveTemp(Response));
		});
	}

	/** Helpers for vector / rotator parsing. */
	inline FVector ReadVector(const TSharedPtr<FJsonObject>& Obj, const FString& Field, const FVector& Default = FVector::ZeroVector)
	{
		const TArray<TSharedPtr<FJsonValue>>* Arr = nullptr;
		if (Obj.IsValid() && Obj->TryGetArrayField(Field, Arr) && Arr && Arr->Num() >= 3)
		{
			return FVector((*Arr)[0]->AsNumber(), (*Arr)[1]->AsNumber(), (*Arr)[2]->AsNumber());
		}
		return Default;
	}

	inline FRotator ReadRotator(const TSharedPtr<FJsonObject>& Obj, const FString& Field, const FRotator& Default = FRotator::ZeroRotator)
	{
		const TArray<TSharedPtr<FJsonValue>>* Arr = nullptr;
		if (Obj.IsValid() && Obj->TryGetArrayField(Field, Arr) && Arr && Arr->Num() >= 3)
		{
			// stored as [pitch, yaw, roll]
			return FRotator((*Arr)[0]->AsNumber(), (*Arr)[1]->AsNumber(), (*Arr)[2]->AsNumber());
		}
		return Default;
	}

	inline TSharedRef<FJsonObject> WriteTransform(const FTransform& T)
	{
		TSharedRef<FJsonObject> Obj = MakeShared<FJsonObject>();
		const FVector L = T.GetLocation();
		const FRotator R = T.GetRotation().Rotator();
		const FVector S = T.GetScale3D();
		auto Vec = [](double X, double Y, double Z)
		{
			TArray<TSharedPtr<FJsonValue>> Arr;
			Arr.Add(MakeShared<FJsonValueNumber>(X));
			Arr.Add(MakeShared<FJsonValueNumber>(Y));
			Arr.Add(MakeShared<FJsonValueNumber>(Z));
			return Arr;
		};
		Obj->SetArrayField(TEXT("location"), Vec(L.X, L.Y, L.Z));
		Obj->SetArrayField(TEXT("rotation"), Vec(R.Pitch, R.Yaw, R.Roll));
		Obj->SetArrayField(TEXT("scale"), Vec(S.X, S.Y, S.Z));
		return Obj;
	}
}

/** Each handler module exposes a static Register() that adds routes to the router. */
namespace UnrealMCPHandlers
{
	struct FRouteSpec
	{
		FString Path;
		EHttpServerRequestVerbs Verb;
		FHttpRequestHandler Handler;
	};

	TArray<FRouteSpec> GetSceneRoutes();
	TArray<FRouteSpec> GetAssetRoutes();
	TArray<FRouteSpec> GetBlueprintRoutes();
	TArray<FRouteSpec> GetCodeRoutes();
	TArray<FRouteSpec> GetProjectRoutes();
}
