#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "ParkourTypes.generated.h"

class UPrimitiveComponent;

/**
 * Result of a wall-side trace. Populated by UMoverParkourComponent::FindRunnableWall.
 * Side encodes which body side the wall sits on so the wall-run layered move can
 * pick the correct rotation and lean direction without re-tracing.
 */
USTRUCT(BlueprintType)
struct PARKOURSYSTEM_API FWallRunHit
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category="Parkour")
	bool bFound = false;

	UPROPERTY(BlueprintReadOnly, Category="Parkour")
	FVector ImpactPoint = FVector::ZeroVector;

	UPROPERTY(BlueprintReadOnly, Category="Parkour")
	FVector WallNormal = FVector::ZeroVector;

	/** +1 = right of pawn, -1 = left of pawn, 0 = none. */
	UPROPERTY(BlueprintReadOnly, Category="Parkour")
	int32 Side = 0;

	UPROPERTY(BlueprintReadOnly, Category="Parkour")
	TWeakObjectPtr<UPrimitiveComponent> HitComponent;
};

/**
 * Result of a ledge probe. LedgeLocation is the top-edge point at which the
 * shimmy/hang root should be aligned. LedgeNormal is the outward-facing wall
 * normal (used for hand IK and facing).
 */
USTRUCT(BlueprintType)
struct PARKOURSYSTEM_API FLedgeHit
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category="Parkour")
	bool bFound = false;

	UPROPERTY(BlueprintReadOnly, Category="Parkour")
	FVector LedgeLocation = FVector::ZeroVector;

	UPROPERTY(BlueprintReadOnly, Category="Parkour")
	FVector LedgeNormal = FVector::ZeroVector;

	UPROPERTY(BlueprintReadOnly, Category="Parkour")
	float WallHeight = 0.f;

	UPROPERTY(BlueprintReadOnly, Category="Parkour")
	TWeakObjectPtr<UPrimitiveComponent> HitComponent;
};

/**
 * Result of a mantle/vault probe. MantleType is one of the
 * Parkour.State.Mantle.* gameplay tags so the layered move and animation
 * chooser can branch without sharing a hard enum.
 */
USTRUCT(BlueprintType)
struct PARKOURSYSTEM_API FMantleHit
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category="Parkour")
	bool bFound = false;

	UPROPERTY(BlueprintReadOnly, Category="Parkour")
	FVector StartLocation = FVector::ZeroVector;

	UPROPERTY(BlueprintReadOnly, Category="Parkour")
	FVector LandLocation = FVector::ZeroVector;

	UPROPERTY(BlueprintReadOnly, Category="Parkour")
	FVector WallNormal = FVector::ZeroVector;

	UPROPERTY(BlueprintReadOnly, Category="Parkour")
	FGameplayTag MantleType;

	UPROPERTY(BlueprintReadOnly, Category="Parkour")
	float ObstacleHeight = 0.f;

	UPROPERTY(BlueprintReadOnly, Category="Parkour")
	float ObstacleDepth = 0.f;
};

/** Native gameplay tags exposed to BP via GameplayTagContainer. */
namespace ParkourTags
{
	UE_DECLARE_GAMEPLAY_TAG_EXTERN(State_WallRun_Left);
	UE_DECLARE_GAMEPLAY_TAG_EXTERN(State_WallRun_Right);
	UE_DECLARE_GAMEPLAY_TAG_EXTERN(State_LedgeHang);
	UE_DECLARE_GAMEPLAY_TAG_EXTERN(State_Mantle_Vault);
	UE_DECLARE_GAMEPLAY_TAG_EXTERN(State_Mantle_PullUp);
	UE_DECLARE_GAMEPLAY_TAG_EXTERN(State_Mantle_Mount);
	UE_DECLARE_GAMEPLAY_TAG_EXTERN(State_Slide);
}
