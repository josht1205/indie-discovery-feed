#include "LayeredMove_WallRun.h"
#include "ParkourParameters.h"
#include "Curves/CurveFloat.h"

FLayeredMove_WallRun::FLayeredMove_WallRun() = default;

bool FLayeredMove_WallRun::GenerateMove(const FMoverTickStartData& StartState,
                                        const FMoverTimeStep& TimeStep,
                                        FProposedMove& OutProposedMove) const
{
	if (!Parameters)
	{
		return false;
	}

	const float DeltaSeconds = TimeStep.StepMs * 0.001f;

	// === Pull current sync state ===
	// API binding: in Mover 2.0 the input/sync state is read out of StartState.
	// The default sync state struct is FMoverDefaultSyncState which exposes
	// GetVelocity_WorldSpace / GetLocation_WorldSpace. If your engine version
	// renamed these, update the two reads below — the rest is pure math.
	FVector CurrentVelocity = FVector::ZeroVector;
	FVector CurrentLocation = FVector::ZeroVector;

	if (const FMoverDefaultSyncState* Sync = StartState.SyncState.SyncStateCollection.FindDataByType<FMoverDefaultSyncState>())
	{
		CurrentVelocity = Sync->GetVelocity_WorldSpace();
		CurrentLocation = Sync->GetLocation_WorldSpace();
	}

	// === Wall-tangent forward direction ===
	// The tangent runs along the wall surface, perpendicular to the wall normal,
	// chosen to align with the player's existing forward velocity so they keep
	// moving the way they were going.
	const FVector WallTangent = FVector::CrossProduct(WallNormal, FVector::UpVector).GetSafeNormal();
	const float TangentSign = FMath::Sign(FVector::DotProduct(CurrentVelocity, WallTangent));
	const FVector AlignedTangent = WallTangent * (TangentSign != 0.f ? TangentSign : 1.f);

	// === Speed scaling over normalized time ===
	const float NormalizedT = (Parameters->WallRunMaxDuration > 0.f)
		? FMath::Clamp(ElapsedSeconds / Parameters->WallRunMaxDuration, 0.f, 1.f)
		: 0.f;

	float SpeedScale = 1.f;
	if (Parameters->WallRunSpeedCurve)
	{
		SpeedScale = Parameters->WallRunSpeedCurve->GetFloatValue(NormalizedT);
	}
	const float ForwardSpeed = Parameters->WallRunForwardSpeed * SpeedScale;

	// === Compose target velocity ===
	// Tangential component holds forward speed, lateral component sticks to wall,
	// vertical component decays toward zero under reduced gravity.
	const FVector TangentialComponent = AlignedTangent * ForwardSpeed;
	const FVector StickComponent      = -WallNormal * Parameters->WallRunStickForce * DeltaSeconds;
	const float ScaledGravityZ = -980.f * Parameters->WallRunGravityScale; // cm/s^2
	const float NewVerticalSpeed = CurrentVelocity.Z + ScaledGravityZ * DeltaSeconds;

	const FVector TargetVelocity(
		TangentialComponent.X + StickComponent.X,
		TangentialComponent.Y + StickComponent.Y,
		NewVerticalSpeed);

	// === Fill the proposed move ===
	// API binding: FProposedMove fields are stable but additive across versions.
	// The two we always write are the linear velocity and the angular target;
	// any extras (accel, friction overrides) are project preference.
	OutProposedMove.LinearVelocity = TargetVelocity;

	// Face along the wall tangent, slight inward lean implemented via a yaw target.
	const FRotator FaceRot = AlignedTangent.Rotation();
	OutProposedMove.AngularVelocity = FRotator(0.f, FaceRot.Yaw, 0.f).Quaternion().Rotator();

	// Mutable elapsed-time bookkeeping. We store it in a const method by const_cast
	// because the simulation expects layered-move const-ness; the field is part of
	// the prediction-serialized payload (see NetSerialize below).
	const_cast<FLayeredMove_WallRun*>(this)->ElapsedSeconds += DeltaSeconds;

	// === End conditions ===
	if (ElapsedSeconds >= Parameters->WallRunMaxDuration)
	{
		return false; // returning false signals "I am done" to the simulation
	}
	if (CurrentVelocity.Size2D() < Parameters->WallRunMinEntrySpeed * 0.5f)
	{
		return false;
	}
	return true;
}

FLayeredMoveBase* FLayeredMove_WallRun::Clone() const
{
	return new FLayeredMove_WallRun(*this);
}

void FLayeredMove_WallRun::NetSerialize(FArchive& Ar)
{
	Super::NetSerialize(Ar);
	Ar << WallNormal;
	Ar << Side;
	Ar << ElapsedSeconds;
	// Parameters intentionally not serialized — it is a shared asset reference
	// resolvable on both ends through UMoverParkourComponent::Parameters.
}

UScriptStruct* FLayeredMove_WallRun::GetScriptStruct() const
{
	return FLayeredMove_WallRun::StaticStruct();
}

FString FLayeredMove_WallRun::ToSimpleString() const
{
	return FString::Printf(TEXT("WallRun(side=%d, t=%.2fs)"), Side, ElapsedSeconds);
}
