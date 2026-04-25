#pragma once

#include "CoreMinimal.h"
#include "MoverTypes.h"
#include "MoveLibrary/LayeredMoveBase.h"
#include "LayeredMove_LedgeHang.generated.h"

class UParkourParameters;

/**
 * Layered move that pins the pawn to a ledge edge, supports lateral shimmy
 * along the edge axis, and exits via:
 *   - Climb-up (jump pressed while no shimmy input)  -> swap to mantle move
 *   - Drop     (crouch / S held)                     -> end the move
 *   - Stamina  (optional, gated by external systems)
 *
 * The shimmy direction is the wall tangent (perpendicular to the ledge wall
 * normal, in the horizontal plane). Input is read from the latest input cmd
 * inside GenerateMove.
 */
USTRUCT(BlueprintType)
struct PARKOURSYSTEM_API FLayeredMove_LedgeHang : public FLayeredMoveBase
{
	GENERATED_BODY()

	FLayeredMove_LedgeHang();

	UPROPERTY(BlueprintReadWrite)
	FVector LedgeLocation = FVector::ZeroVector;

	UPROPERTY(BlueprintReadWrite)
	FVector LedgeNormal = FVector::ZeroVector;

	UPROPERTY()
	TObjectPtr<const UParkourParameters> Parameters = nullptr;

	float ElapsedSeconds = 0.f;

	virtual bool GenerateMove(const FMoverTickStartData& StartState,
	                          const FMoverTimeStep& TimeStep,
	                          FProposedMove& OutProposedMove) const override;

	virtual FLayeredMoveBase* Clone() const override;
	virtual void NetSerialize(FArchive& Ar) override;
	virtual UScriptStruct* GetScriptStruct() const override;
	virtual FString ToSimpleString() const override;
};

template<>
struct TStructOpsTypeTraits<FLayeredMove_LedgeHang> : public TStructOpsTypeTraitsBase2<FLayeredMove_LedgeHang>
{
	enum { WithNetSerializer = true, WithCopy = true };
};
