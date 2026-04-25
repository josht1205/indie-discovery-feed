#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "MoverTypes.h"
#include "MoveLibrary/LayeredMoveBase.h"
#include "LayeredMove_Mantle.generated.h"

class UParkourParameters;

/**
 * Time-warped translation that drives the pawn from its entry pose to the
 * landing point on top of an obstacle. Intended to run *with* a montage
 * playing on the mesh — Motion Warping aligns the visual to the same
 * LandLocation through a named warp target.
 *
 * Curve shape: cubic ease-in-out so feet leave the ground softly and plant
 * at the top without pop. Duration is type-driven (vault < pull-up < mount).
 */
USTRUCT(BlueprintType)
struct PARKOURSYSTEM_API FLayeredMove_Mantle : public FLayeredMoveBase
{
	GENERATED_BODY()

	FLayeredMove_Mantle();

	UPROPERTY(BlueprintReadWrite)
	FVector LandLocation = FVector::ZeroVector;

	UPROPERTY(BlueprintReadWrite)
	FVector WallNormal = FVector::ZeroVector;

	UPROPERTY(BlueprintReadWrite)
	FGameplayTag MantleType;

	UPROPERTY()
	TObjectPtr<const UParkourParameters> Parameters = nullptr;

	/** Captured at first GenerateMove call. */
	mutable FVector StartLocation = FVector::ZeroVector;
	mutable bool bStartCaptured = false;

	float ElapsedSeconds = 0.f;

	/** Returns the total duration for the current MantleType. */
	float GetDuration() const;

	virtual bool GenerateMove(const FMoverTickStartData& StartState,
	                          const FMoverTimeStep& TimeStep,
	                          FProposedMove& OutProposedMove) const override;

	virtual FLayeredMoveBase* Clone() const override;
	virtual void NetSerialize(FArchive& Ar) override;
	virtual UScriptStruct* GetScriptStruct() const override;
	virtual FString ToSimpleString() const override;
};

template<>
struct TStructOpsTypeTraits<FLayeredMove_Mantle> : public TStructOpsTypeTraitsBase2<FLayeredMove_Mantle>
{
	enum { WithNetSerializer = true, WithCopy = true };
};
