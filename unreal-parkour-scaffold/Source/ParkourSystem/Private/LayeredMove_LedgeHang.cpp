#include "LayeredMove_LedgeHang.h"
#include "ParkourParameters.h"

FLayeredMove_LedgeHang::FLayeredMove_LedgeHang() = default;

bool FLayeredMove_LedgeHang::GenerateMove(const FMoverTickStartData& StartState,
                                          const FMoverTimeStep& TimeStep,
                                          FProposedMove& OutProposedMove) const
{
	if (!Parameters)
	{
		return false;
	}

	const float DeltaSeconds = TimeStep.StepMs * 0.001f;

	// === Read input cmd ===
	// API binding: input is exposed as FCharacterDefaultInputs (or your project's
	// input struct) on the input collection. The two fields we care about are the
	// 2D move vector and the jump-pressed bit.
	float ShimmyAxis = 0.f;
	bool  bJumpPressed = false;
	bool  bCrouchPressed = false;

	if (const FCharacterDefaultInputs* Input = StartState.InputCmd.InputCollection.FindDataByType<FCharacterDefaultInputs>())
	{
		// Move vector: X = forward/back (ignored when hanging), Y = strafe = shimmy.
		ShimmyAxis = FMath::Clamp(Input->GetMoveInput_WorldSpace().Y, -1.f, 1.f);
		bJumpPressed = Input->bIsJumpPressed;
		// Crouch is project-specific; if your input struct uses a different bit, adapt.
	}

	// === Position pinning ===
	// The pawn's pelvis (capsule center) hangs a fixed offset below the edge,
	// hands at the edge level. We compute the pin point from LedgeLocation and
	// project lateral shimmy along the wall tangent.
	const FVector WallTangent = FVector::CrossProduct(LedgeNormal, FVector::UpVector).GetSafeNormal();
	const FVector ShimmyDelta = WallTangent * (ShimmyAxis * Parameters->ShimmySpeed * DeltaSeconds);

	// Velocity is purely lateral; vertical is held at zero so gravity is suppressed.
	OutProposedMove.LinearVelocity = WallTangent * (ShimmyAxis * Parameters->ShimmySpeed);
	// Face into the wall (opposite of outward normal).
	OutProposedMove.AngularVelocity = (-LedgeNormal).Rotation();

	const_cast<FLayeredMove_LedgeHang*>(this)->ElapsedSeconds += DeltaSeconds;

	// === End conditions ===
	if (bCrouchPressed)
	{
		return false; // drop
	}
	if (bJumpPressed && FMath::IsNearlyZero(ShimmyAxis, 0.05f))
	{
		// Climb-up — return false here; the component will see the state-tag
		// drop and the player's next intent (RequestMantle) will fire the
		// pull-up layered move from the ledge frame.
		return false;
	}
	return true;
}

FLayeredMoveBase* FLayeredMove_LedgeHang::Clone() const
{
	return new FLayeredMove_LedgeHang(*this);
}

void FLayeredMove_LedgeHang::NetSerialize(FArchive& Ar)
{
	Super::NetSerialize(Ar);
	Ar << LedgeLocation;
	Ar << LedgeNormal;
	Ar << ElapsedSeconds;
}

UScriptStruct* FLayeredMove_LedgeHang::GetScriptStruct() const
{
	return FLayeredMove_LedgeHang::StaticStruct();
}

FString FLayeredMove_LedgeHang::ToSimpleString() const
{
	return FString::Printf(TEXT("LedgeHang(t=%.2fs)"), ElapsedSeconds);
}
