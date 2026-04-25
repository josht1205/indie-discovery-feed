#include "LayeredMove_Mantle.h"
#include "ParkourParameters.h"
#include "ParkourTypes.h"

namespace
{
	// Smoothstep / cubic ease-in-out on [0,1].
	FORCEINLINE float EaseInOut(float T)
	{
		T = FMath::Clamp(T, 0.f, 1.f);
		return T * T * (3.f - 2.f * T);
	}
}

FLayeredMove_Mantle::FLayeredMove_Mantle() = default;

float FLayeredMove_Mantle::GetDuration() const
{
	if (MantleType == ParkourTags::State_Mantle_Vault)   return 0.55f;
	if (MantleType == ParkourTags::State_Mantle_PullUp)  return 0.95f;
	if (MantleType == ParkourTags::State_Mantle_Mount)   return 1.10f;
	return 0.75f;
}

bool FLayeredMove_Mantle::GenerateMove(const FMoverTickStartData& StartState,
                                       const FMoverTimeStep& TimeStep,
                                       FProposedMove& OutProposedMove) const
{
	if (!Parameters)
	{
		return false;
	}

	const float DeltaSeconds = TimeStep.StepMs * 0.001f;
	const float Duration = GetDuration();

	if (!bStartCaptured)
	{
		if (const FMoverDefaultSyncState* Sync = StartState.SyncState.SyncStateCollection.FindDataByType<FMoverDefaultSyncState>())
		{
			StartLocation = Sync->GetLocation_WorldSpace();
		}
		bStartCaptured = true;
	}

	const float NormalizedT = (Duration > 0.f) ? FMath::Clamp(ElapsedSeconds / Duration, 0.f, 1.f) : 1.f;
	const float Eased = EaseInOut(NormalizedT);
	const float NextEased = EaseInOut(FMath::Clamp((ElapsedSeconds + DeltaSeconds) / Duration, 0.f, 1.f));

	const FVector PosNow  = FMath::Lerp(StartLocation, LandLocation, Eased);
	const FVector PosNext = FMath::Lerp(StartLocation, LandLocation, NextEased);

	// Velocity is the discrete derivative — the simulation will integrate this
	// over the step. Doing it from the eased curve avoids a separate position
	// authority field on the proposed move.
	const FVector RequiredVelocity = (DeltaSeconds > KINDA_SMALL_NUMBER)
		? (PosNext - PosNow) / DeltaSeconds
		: FVector::ZeroVector;

	OutProposedMove.LinearVelocity = RequiredVelocity;

	// Face the wall: yaw aligned to -WallNormal.
	const FVector FaceDir = (-WallNormal).GetSafeNormal2D();
	if (!FaceDir.IsNearlyZero())
	{
		OutProposedMove.AngularVelocity = FaceDir.Rotation();
	}

	const_cast<FLayeredMove_Mantle*>(this)->ElapsedSeconds += DeltaSeconds;

	return ElapsedSeconds < Duration;
}

FLayeredMoveBase* FLayeredMove_Mantle::Clone() const
{
	return new FLayeredMove_Mantle(*this);
}

void FLayeredMove_Mantle::NetSerialize(FArchive& Ar)
{
	Super::NetSerialize(Ar);
	Ar << LandLocation;
	Ar << WallNormal;
	Ar << StartLocation;
	Ar << bStartCaptured;
	Ar << ElapsedSeconds;
	bool bTagOk = true;
	MantleType.NetSerialize(Ar, /*Map=*/nullptr, bTagOk);
}

UScriptStruct* FLayeredMove_Mantle::GetScriptStruct() const
{
	return FLayeredMove_Mantle::StaticStruct();
}

FString FLayeredMove_Mantle::ToSimpleString() const
{
	return FString::Printf(TEXT("Mantle(%s, t=%.2fs)"), *MantleType.ToString(), ElapsedSeconds);
}
