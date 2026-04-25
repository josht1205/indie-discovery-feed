#include "MoverParkourComponent.h"

#include "ParkourParameters.h"
#include "LayeredMove_WallRun.h"
#include "LayeredMove_LedgeHang.h"
#include "LayeredMove_Mantle.h"

#include "Components/CapsuleComponent.h"
#include "Engine/World.h"
#include "GameFramework/Pawn.h"
#include "MoverComponent.h"
#include "MoveLibrary/BasedMovementUtils.h"
#include "DrawDebugHelpers.h"

namespace
{
	constexpr float kSmallNumber = 1e-3f;

	// Visualization toggle. Wire to a CVar in shipping if you want it runtime-toggle.
#if !UE_BUILD_SHIPPING
	static bool bDebugDrawParkour = false;
	static FAutoConsoleVariableRef CVarDebugDrawParkour(
		TEXT("parkour.DebugDraw"),
		bDebugDrawParkour,
		TEXT("Draw parkour detection traces."),
		ECVF_Cheat);
#endif
}

UMoverParkourComponent::UMoverParkourComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	// Tick after movement so detection sees the post-step capsule location.
	PrimaryComponentTick.TickGroup = TG_PostPhysics;
}

void UMoverParkourComponent::BeginPlay()
{
	Super::BeginPlay();

	if (AActor* Owner = GetOwner())
	{
		MoverComponent = Owner->FindComponentByClass<UMoverComponent>();
	}

	ensureMsgf(MoverComponent != nullptr,
		TEXT("UMoverParkourComponent on %s requires a UMoverComponent on the same actor."),
		*GetNameSafe(GetOwner()));

	ensureMsgf(Parameters != nullptr,
		TEXT("UMoverParkourComponent on %s has no UParkourParameters assigned. Component will be inert."),
		*GetNameSafe(GetOwner()));
}

void UMoverParkourComponent::TickComponent(float DeltaSeconds, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaSeconds, TickType, ThisTickFunction);

	if (!Parameters || !MoverComponent)
	{
		return;
	}

	// === Update local feel timers ===
	if (IsGrounded())
	{
		TimeSinceGrounded = 0.f;
	}
	else
	{
		TimeSinceGrounded += DeltaSeconds;
	}

	if (JumpBufferRemaining > 0.f)
	{
		JumpBufferRemaining = FMath::Max(0.f, JumpBufferRemaining - DeltaSeconds);
	}

	// === If a parkour state is already active, the layered move owns the frame. ===
	if (CurrentStateTag.IsValid())
	{
		return;
	}

	// === Buffered jump while airborne attempts wall-run / ledge first ===
	if (JumpBufferRemaining > 0.f)
	{
		if (TryStartWallRun() || TryStartLedgeHang())
		{
			JumpBufferRemaining = 0.f;
			return;
		}
	}

	// Mantle is request-driven; check it whenever the player is approaching geometry.
	// (Caller sets bJumpHeld through RequestMantle which sets a one-shot intent —
	// a forward-momentum check is sufficient here.)
	if (GetOwnerVelocityWS().Size2D() > kSmallNumber)
	{
		TryStartSlide(); // cheap; bails out internally if angle too low
	}
}

// =============================================================================
// Input intent
// =============================================================================

void UMoverParkourComponent::RequestJump()
{
	bJumpHeld = true;
	if (!Parameters)
	{
		return;
	}
	JumpBufferRemaining = Parameters->JumpBufferTime;

	// While in a parkour state, the layered move handles jump itself
	// (e.g. wall-jump). We just record intent.
	if (CurrentStateTag.IsValid())
	{
		return;
	}

	// Coyote-time grace counts as grounded for jump purposes.
	const bool bGroundedOrCoyote = IsGrounded() || (TimeSinceGrounded < Parameters->CoyoteTime);
	if (bGroundedOrCoyote)
	{
		// Default Mover walking mode handles standard jumps. We do not duplicate
		// it here — only consume the buffer so it doesn't fire again next frame.
		JumpBufferRemaining = 0.f;
		return;
	}

	// Airborne: try latching to a wall or ledge first; otherwise let the buffer expire.
	if (TryStartWallRun() || TryStartLedgeHang() || TryStartMantle())
	{
		JumpBufferRemaining = 0.f;
	}
}

void UMoverParkourComponent::ReleaseJump()
{
	bJumpHeld = false;
}

void UMoverParkourComponent::SetSprintHeld(bool bHeld)
{
	bSprintHeld = bHeld;
}

void UMoverParkourComponent::SetCrouchHeld(bool bHeld)
{
	bCrouchHeld = bHeld;
}

void UMoverParkourComponent::RequestMantle()
{
	TryStartMantle();
}

// =============================================================================
// State publishing
// =============================================================================

void UMoverParkourComponent::SetParkourState(FGameplayTag NewState)
{
	if (NewState == CurrentStateTag)
	{
		return;
	}
	CurrentStateTag = NewState;
	OnParkourStateChanged.Broadcast(NewState);

	if (!NewState.IsValid())
	{
		// Stamp the cooldown anchor on wall-run exit specifically.
		LastWallRunEndTime = GetWorld() ? GetWorld()->GetTimeSeconds() : LastWallRunEndTime;
	}
}

bool UMoverParkourComponent::IsWallRunning() const
{
	return CurrentStateTag == ParkourTags::State_WallRun_Left
		|| CurrentStateTag == ParkourTags::State_WallRun_Right;
}

// =============================================================================
// Detection
// =============================================================================

FWallRunHit UMoverParkourComponent::FindRunnableWall() const
{
	FWallRunHit Result;
	if (!Parameters || !GetOwner())
	{
		return Result;
	}

	const FVector Center  = GetOwner()->GetActorLocation();
	const FVector Forward = GetOwnerForward2D();
	const FVector Right   = FVector::CrossProduct(FVector::UpVector, Forward).GetSafeNormal();
	const float   TraceLen = Parameters->WallRunTraceDistance;

	FCollisionQueryParams Params(SCENE_QUERY_STAT(ParkourWallTrace), /*bTraceComplex=*/false, GetOwner());
	const ECollisionChannel Channel = GetParkourTraceChannel();

	auto TraceSide = [&](int32 Side) -> FHitResult
	{
		const FVector End = Center + Right * (TraceLen * Side);
		FHitResult Hit;
		GetWorld()->LineTraceSingleByChannel(Hit, Center, End, Channel, Params);

#if !UE_BUILD_SHIPPING
		if (bDebugDrawParkour)
		{
			DrawDebugLine(GetWorld(), Center, End, Hit.bBlockingHit ? FColor::Green : FColor::Red, false, 0.f, 0, 1.f);
		}
#endif
		return Hit;
	};

	const FHitResult HitR = TraceSide(+1);
	const FHitResult HitL = TraceSide(-1);

	auto QualifiesAsWall = [](const FHitResult& Hit) -> bool
	{
		if (!Hit.bBlockingHit)
		{
			return false;
		}
		// Require near-vertical surface (within ~25 deg of vertical).
		const float Vert = FMath::Abs(FVector::DotProduct(Hit.ImpactNormal, FVector::UpVector));
		return Vert < 0.4f;
	};

	const bool bRightOK = QualifiesAsWall(HitR);
	const bool bLeftOK  = QualifiesAsWall(HitL);

	// Pick the closer of the two if both qualify.
	const FHitResult* Pick = nullptr;
	int32 PickSide = 0;
	if (bRightOK && bLeftOK)
	{
		const bool bRightCloser = HitR.Distance < HitL.Distance;
		Pick = bRightCloser ? &HitR : &HitL;
		PickSide = bRightCloser ? +1 : -1;
	}
	else if (bRightOK) { Pick = &HitR; PickSide = +1; }
	else if (bLeftOK)  { Pick = &HitL; PickSide = -1; }

	if (Pick)
	{
		Result.bFound       = true;
		Result.ImpactPoint  = Pick->ImpactPoint;
		Result.WallNormal   = Pick->ImpactNormal;
		Result.Side         = PickSide;
		Result.HitComponent = Pick->GetComponent();
	}
	return Result;
}

FLedgeHit UMoverParkourComponent::FindLedge() const
{
	FLedgeHit Result;
	if (!Parameters || !GetOwner())
	{
		return Result;
	}

	const FVector Origin   = GetOwner()->GetActorLocation();
	const FVector Forward  = GetOwnerForward2D();
	const float   ForwardLen = Parameters->LedgeForwardTrace;
	const float   MaxH     = Parameters->LedgeMaxHeight;
	const float   MinH     = Parameters->LedgeMinHeight;
	const float   Radius   = GetCapsuleRadius();

	FCollisionQueryParams Params(SCENE_QUERY_STAT(ParkourLedgeTrace), false, GetOwner());
	const ECollisionChannel Channel = GetParkourTraceChannel();

	// (1) Forward trace at chest height to find a wall.
	const FVector ChestStart = Origin;
	const FVector ChestEnd   = Origin + Forward * ForwardLen;
	FHitResult ChestHit;
	if (!GetWorld()->LineTraceSingleByChannel(ChestHit, ChestStart, ChestEnd, Channel, Params))
	{
		return Result;
	}

	// (2) Down trace from above the wall to locate the top edge.
	const FVector ProbeStart = ChestHit.ImpactPoint + Forward * (Radius * 0.5f) + FVector(0, 0, MaxH);
	const FVector ProbeEnd   = ChestHit.ImpactPoint + Forward * (Radius * 0.5f) + FVector(0, 0, MinH * 0.5f);
	FHitResult TopHit;
	if (!GetWorld()->LineTraceSingleByChannel(TopHit, ProbeStart, ProbeEnd, Channel, Params))
	{
		return Result;
	}

	// (3) Reject sloped tops (we only hang on near-flat ledges).
	if (FVector::DotProduct(TopHit.ImpactNormal, FVector::UpVector) < 0.7f)
	{
		return Result;
	}

	const float WallH = TopHit.ImpactPoint.Z - GetCapsuleFeetLocation().Z;
	if (WallH < MinH || WallH > MaxH)
	{
		return Result;
	}

	Result.bFound        = true;
	Result.LedgeLocation = TopHit.ImpactPoint;
	Result.LedgeNormal   = -ChestHit.ImpactNormal; // outward-facing wall normal
	Result.WallHeight    = WallH;
	Result.HitComponent  = TopHit.GetComponent();

#if !UE_BUILD_SHIPPING
	if (bDebugDrawParkour)
	{
		DrawDebugSphere(GetWorld(), TopHit.ImpactPoint, 8.f, 12, FColor::Cyan, false, 0.f);
	}
#endif
	return Result;
}

FMantleHit UMoverParkourComponent::FindMantleTarget() const
{
	FMantleHit Result;
	if (!Parameters || !GetOwner())
	{
		return Result;
	}

	const FVector Origin    = GetOwner()->GetActorLocation();
	const FVector Forward   = GetOwnerForward2D();
	const float   FwdLen    = Parameters->MantleForwardTrace;
	const float   Radius    = GetCapsuleRadius();
	const float   MaxH      = Parameters->MantleMaxHeight;

	FCollisionQueryParams Params(SCENE_QUERY_STAT(ParkourMantleTrace), false, GetOwner());
	const ECollisionChannel Channel = GetParkourTraceChannel();

	// Forward trace for an obstacle face.
	FHitResult FaceHit;
	if (!GetWorld()->LineTraceSingleByChannel(FaceHit, Origin, Origin + Forward * FwdLen, Channel, Params))
	{
		return Result;
	}

	// Top trace from above the face to find landing surface.
	const FVector AbovePoint = FaceHit.ImpactPoint + Forward * (Radius * 0.6f) + FVector(0, 0, MaxH);
	const FVector BelowPoint = FaceHit.ImpactPoint + Forward * (Radius * 0.6f);
	FHitResult TopHit;
	if (!GetWorld()->LineTraceSingleByChannel(TopHit, AbovePoint, BelowPoint, Channel, Params))
	{
		return Result;
	}

	if (FVector::DotProduct(TopHit.ImpactNormal, FVector::UpVector) < 0.7f)
	{
		return Result;
	}

	// Depth probe: cast forward from just above the landing point to find
	// either thin geometry (vault) or thick geometry (mantle/mount).
	const FVector DepthStart = TopHit.ImpactPoint + FVector(0, 0, 5.f);
	const FVector DepthEnd   = DepthStart + Forward * Parameters->VaultMaxDepth;
	FHitResult DepthHit;
	const bool bThick = GetWorld()->LineTraceSingleByChannel(DepthHit, DepthStart, DepthEnd, Channel, Params);

	const float ObstacleHeight = TopHit.ImpactPoint.Z - GetCapsuleFeetLocation().Z;
	const float ObstacleDepth  = bThick ? (DepthHit.Distance) : Parameters->VaultMaxDepth + 1.f;

	Result.bFound          = true;
	Result.StartLocation   = Origin;
	Result.LandLocation    = TopHit.ImpactPoint + Forward * Radius;
	Result.WallNormal      = -FaceHit.ImpactNormal;
	Result.ObstacleHeight  = ObstacleHeight;
	Result.ObstacleDepth   = ObstacleDepth;

	// Classify: vault if low + thin; pull-up if high; mount if mid + windowed.
	if (ObstacleHeight <= Parameters->VaultMaxHeight && ObstacleDepth <= Parameters->VaultMaxDepth)
	{
		Result.MantleType = ParkourTags::State_Mantle_Vault;
	}
	else if (ObstacleHeight >= Parameters->VaultMaxHeight && ObstacleHeight <= Parameters->MantleMaxHeight)
	{
		Result.MantleType = ParkourTags::State_Mantle_PullUp;
	}
	else
	{
		Result.bFound = false; // out of range
	}
	return Result;
}

// =============================================================================
// Layered-move dispatch
// =============================================================================

bool UMoverParkourComponent::TryStartWallRun()
{
	if (!Parameters || !MoverComponent)
	{
		return false;
	}
	if (GetWorld()->GetTimeSeconds() - LastWallRunEndTime < Parameters->WallRunCooldown)
	{
		return false;
	}
	if (GetOwnerVelocityWS().Size2D() < Parameters->WallRunMinEntrySpeed)
	{
		return false;
	}

	const FWallRunHit Wall = FindRunnableWall();
	if (!Wall.bFound)
	{
		return false;
	}

	TSharedRef<FLayeredMove_WallRun> Move = MakeShared<FLayeredMove_WallRun>();
	Move->WallNormal = Wall.WallNormal;
	Move->Side = Wall.Side;
	Move->Parameters = Parameters;
	EnqueueLayeredMove(Move);

	SetParkourState(Wall.Side > 0 ? ParkourTags::State_WallRun_Right : ParkourTags::State_WallRun_Left);
	return true;
}

bool UMoverParkourComponent::TryStartLedgeHang()
{
	if (!Parameters || !MoverComponent)
	{
		return false;
	}

	const FLedgeHit Ledge = FindLedge();
	if (!Ledge.bFound)
	{
		return false;
	}

	TSharedRef<FLayeredMove_LedgeHang> Move = MakeShared<FLayeredMove_LedgeHang>();
	Move->LedgeLocation = Ledge.LedgeLocation;
	Move->LedgeNormal   = Ledge.LedgeNormal;
	Move->Parameters    = Parameters;
	EnqueueLayeredMove(Move);

	SetParkourState(ParkourTags::State_LedgeHang);
	return true;
}

bool UMoverParkourComponent::TryStartMantle()
{
	if (!Parameters || !MoverComponent)
	{
		return false;
	}

	const FMantleHit Mantle = FindMantleTarget();
	if (!Mantle.bFound)
	{
		return false;
	}

	TSharedRef<FLayeredMove_Mantle> Move = MakeShared<FLayeredMove_Mantle>();
	Move->LandLocation = Mantle.LandLocation;
	Move->WallNormal   = Mantle.WallNormal;
	Move->MantleType   = Mantle.MantleType;
	Move->Parameters   = Parameters;
	EnqueueLayeredMove(Move);

	SetParkourState(Mantle.MantleType);
	return true;
}

bool UMoverParkourComponent::TryStartSlide()
{
	// Slide enters the default Mover slide mode if the floor angle exceeds threshold.
	// Implementation deferred to Mover's built-in slide; this hook is left as the
	// place to add per-game gating (stamina, equipped weapon, etc.).
	return false;
}

void UMoverParkourComponent::EnqueueLayeredMove(TSharedRef<FLayeredMoveBase> Move)
{
	if (!MoverComponent)
	{
		return;
	}

	// === API BINDING POINT ============================================================
	// Mover 2.0 exposes layered-move queueing through the input/sync collection
	// pipeline. The exact entry point has shifted between engine versions:
	//   - Some versions:  MoverComponent->QueueLayeredMove(Move);
	//   - Some versions:  the move is added to FMoverInputCmdContext::AdditionalInputs
	//                     during ProduceInput, then read by the simulation step.
	// Treat this single function as the binding seam — replace its body with the
	// call your installed engine version requires and the rest of the system is
	// version-agnostic.
	// ===================================================================================

	// Best-effort default: if the component exposes a public QueueLayeredMove,
	// prefer it. Otherwise this is a no-op and the binding seam above must be filled.
	#if defined(MOVER_HAS_PUBLIC_QUEUE_LAYERED_MOVE)
	MoverComponent->QueueLayeredMove(Move);
	#else
	// Fallback: route through a UFunction shim if present (allows BP/Engine indirection
	// during the period where the C++ entry point is private).
	if (UFunction* Fn = MoverComponent->FindFunction(TEXT("QueueLayeredMove")))
	{
		struct { TSharedRef<FLayeredMoveBase> M; } Args{ Move };
		MoverComponent->ProcessEvent(Fn, &Args);
	}
	else
	{
		UE_LOG(LogTemp, Warning,
			TEXT("UMoverParkourComponent::EnqueueLayeredMove: no Mover queueing entry point bound. ")
			TEXT("See API BINDING POINT in MoverParkourComponent.cpp."));
	}
	#endif
}

// =============================================================================
// Helpers
// =============================================================================

ECollisionChannel UMoverParkourComponent::GetParkourTraceChannel() const
{
	// Default to Pawn channel; promote to a project-defined channel
	// (e.g. ECC_GameTraceChannel1 / "Parkour") if you need to filter geometry.
	return ECC_Pawn;
}

FVector UMoverParkourComponent::GetOwnerForward2D() const
{
	if (const APawn* P = Cast<APawn>(GetOwner()))
	{
		FVector Fwd = P->GetControlRotation().Vector();
		Fwd.Z = 0.f;
		return Fwd.GetSafeNormal();
	}
	if (const AActor* A = GetOwner())
	{
		FVector Fwd = A->GetActorForwardVector();
		Fwd.Z = 0.f;
		return Fwd.GetSafeNormal();
	}
	return FVector::ForwardVector;
}

FVector UMoverParkourComponent::GetOwnerVelocityWS() const
{
	// Mover writes velocity into FMoverDefaultSyncState every step; for sidecar
	// detection this read of the actor velocity is sufficient.
	return GetOwner() ? GetOwner()->GetVelocity() : FVector::ZeroVector;
}

FVector UMoverParkourComponent::GetCapsuleFeetLocation() const
{
	if (const AActor* Owner = GetOwner())
	{
		if (const UCapsuleComponent* Capsule = Owner->FindComponentByClass<UCapsuleComponent>())
		{
			return Capsule->GetComponentLocation() - FVector(0, 0, Capsule->GetScaledCapsuleHalfHeight());
		}
		return Owner->GetActorLocation();
	}
	return FVector::ZeroVector;
}

float UMoverParkourComponent::GetCapsuleHalfHeight() const
{
	if (const AActor* Owner = GetOwner())
	{
		if (const UCapsuleComponent* Capsule = Owner->FindComponentByClass<UCapsuleComponent>())
		{
			return Capsule->GetScaledCapsuleHalfHeight();
		}
	}
	return 90.f;
}

float UMoverParkourComponent::GetCapsuleRadius() const
{
	if (const AActor* Owner = GetOwner())
	{
		if (const UCapsuleComponent* Capsule = Owner->FindComponentByClass<UCapsuleComponent>())
		{
			return Capsule->GetScaledCapsuleRadius();
		}
	}
	return 34.f;
}

bool UMoverParkourComponent::IsGrounded() const
{
	// === API BINDING POINT ============================================================
	// In Mover 2.0 the canonical grounded check reads the current movement-mode
	// name from the component (e.g. "Walking" / "Falling"). The exact accessor
	// has varied between releases:
	//    - MoverComponent->GetMovementModeName() == NAME_Walking
	//    - MoverComponent->IsOnGround()
	// Re-bind here if your version differs.
	// ===================================================================================
	if (!MoverComponent)
	{
		return false;
	}

	if (UFunction* Fn = MoverComponent->FindFunction(TEXT("IsOnGround")))
	{
		bool bOut = false;
		MoverComponent->ProcessEvent(Fn, &bOut);
		return bOut;
	}
	// Fallback: actor-velocity Z sniff. Imperfect but never wrong-direction.
	return FMath::Abs(GetOwnerVelocityWS().Z) < 5.f;
}
