#pragma once

#include "CoreMinimal.h"
#include "MoverTypes.h"
#include "MoveLibrary/LayeredMoveBase.h"
#include "LayeredMove_WallRun.generated.h"

class UParkourParameters;

/**
 * Layered move that holds the pawn against a wall, projects forward velocity
 * along the wall tangent, and applies a reduced-gravity vertical decay. Ends
 * when:
 *   - duration exceeds Parameters->WallRunMaxDuration
 *   - the wall is no longer in contact (lateral re-trace fails)
 *   - the player presses jump (handled by component → wall-jump impulse)
 *   - planar speed drops below half of WallRunMinEntrySpeed
 *
 * The struct is a USTRUCT (not UCLASS) following the Mover 2.0 layered-move
 * convention. Lifetime is owned by the simulation state, which serializes
 * the relevant fields for client prediction.
 */
USTRUCT(BlueprintType)
struct PARKOURSYSTEM_API FLayeredMove_WallRun : public FLayeredMoveBase
{
	GENERATED_BODY()

	FLayeredMove_WallRun();

	/** Outward-facing wall normal (world space) at entry. */
	UPROPERTY(BlueprintReadWrite)
	FVector WallNormal = FVector::ZeroVector;

	/** +1 right, -1 left. */
	UPROPERTY(BlueprintReadWrite)
	int32 Side = 0;

	/** Cached parameter asset. Held by raw ptr; the move's lifetime is shorter than the component. */
	UPROPERTY()
	TObjectPtr<const UParkourParameters> Parameters = nullptr;

	/** Elapsed sim time inside the move. */
	float ElapsedSeconds = 0.f;

	// === FLayeredMoveBase contract ====================================================
	// Mover 2.0 layered moves expose a GenerateMove (or equivalent) callback that
	// turns sim state + delta time into a proposed translation/rotation. The exact
	// signature has varied between engine versions; see the .cpp for the binding
	// seam. Treat the body of GenerateMove there as authoritative for the math —
	// only the parameter list may need to be re-typed.
	// ===================================================================================
	virtual bool GenerateMove(const FMoverTickStartData& StartState,
	                          const FMoverTimeStep& TimeStep,
	                          FProposedMove& OutProposedMove) const override;

	virtual FLayeredMoveBase* Clone() const override;
	virtual void NetSerialize(FArchive& Ar) override;
	virtual UScriptStruct* GetScriptStruct() const override;
	virtual FString ToSimpleString() const override;
};

template<>
struct TStructOpsTypeTraits<FLayeredMove_WallRun> : public TStructOpsTypeTraitsBase2<FLayeredMove_WallRun>
{
	enum { WithNetSerializer = true, WithCopy = true };
};
