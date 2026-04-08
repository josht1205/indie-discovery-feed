// ParkourComponent.cpp
// Unreal Engine 5.3 — First Person Template (C++)
//
// IMPORTANT: Replace "YOURPROJECT" in the #include below with your actual
// project module name (the name shown in your .uproject file, all caps).
//
// Example: if your project is "MyGame", use:
//   #include "MyGame.h"   <-- only needed if your project has a PCH
//   and change YOURPROJECT_API -> MYGAME_API in the header.

#include "ParkourComponent.h"

#include "GameFramework/Character.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/CapsuleComponent.h"
#include "Animation/AnimInstance.h"
#include "Animation/AnimMontage.h"
#include "TimerManager.h"
#include "Engine/World.h"
#include "Math/UnrealMathUtility.h"
// Uncomment to visualize traces in PIE:
// #include "DrawDebugHelpers.h"

// ============================================================
// Construction
// ============================================================

UParkourComponent::UParkourComponent()
{
    PrimaryComponentTick.bCanEverTick = true;

    // --- Default tunable settings ---
    MoveToInterpSpeed              = 10.0f;
    GroundCheckDistance            = 100.0f;
    GroundAfterObjectForwardOffset = 150.0f;
    ForwardNotifyPushDistance      = 50.0f;
    MontageBlendOutTime            = 0.25f;

    // --- State flags ---
    bIsParkourActive   = false;
    bGroundBeforeObject = false;
    bGroundAfterObject  = false;
    bIsLedgeHolding    = false;
    bIsMontagePlayig   = false;

    // --- Target points ---
    FirstOffsetPoint    = FVector::ZeroVector;
    FirstTargetPoint    = FVector::ZeroVector;
    MiddleTargetPoint   = FVector::ZeroVector;
    LastTargetPoint     = FVector::ZeroVector;
    LedgeDropPoint      = FVector::ZeroVector;
    LedgeHoldBeginPoint = FVector::ZeroVector;
    LedgeHoldLastPoint  = FVector::ZeroVector;

    // --- Montage refs (assigned in Blueprint) ---
    ParkourMontage   = nullptr;
    LedgeDropMontage = nullptr;
    LedgeHoldMontage = nullptr;

    // --- Cached refs (filled in Initialize) ---
    OwnerCharacter    = nullptr;
    MovementComponent = nullptr;
    CharacterMesh     = nullptr;
    CapsuleComponent  = nullptr;
}

// ============================================================
// UActorComponent overrides
// ============================================================

void UParkourComponent::BeginPlay()
{
    Super::BeginPlay();
    Initialize();
}

void UParkourComponent::TickComponent(float DeltaTime, ELevelTick TickType,
                                      FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
    // Tick is enabled by default. Disable via PrimaryComponentTick.bCanEverTick = false
    // in the constructor once all per-frame work is driven by timers / notify states.
}

// ============================================================
// Private Helpers
// ============================================================

void UParkourComponent::ResetParkourState()
{
    bIsParkourActive    = false;
    bIsLedgeHolding     = false;
    bIsMontagePlayig    = false;
    bGroundBeforeObject = false;
    bGroundAfterObject  = false;

    if (MovementComponent)
    {
        MovementComponent->SetMovementMode(MOVE_Walking);
    }
}

bool UParkourComponent::PerformGroundLineTrace(const FVector& StartLocation,
                                               bool& bHitGround) const
{
    const UWorld* World = GetWorld();
    if (!World || !OwnerCharacter)
    {
        bHitGround = false;
        return false;
    }

    FHitResult HitResult;
    const FVector EndLocation = StartLocation - FVector(0.f, 0.f, GroundCheckDistance);

    FCollisionQueryParams QueryParams;
    QueryParams.AddIgnoredActor(OwnerCharacter);

    bHitGround = World->LineTraceSingleByChannel(
        HitResult,
        StartLocation,
        EndLocation,
        ECC_Visibility,
        QueryParams
    );

    // Uncomment for debug visualization in PIE:
    // DrawDebugLine(World, StartLocation, EndLocation,
    //               bHitGround ? FColor::Green : FColor::Red, false, 1.f);

    return bHitGround;
}

void UParkourComponent::InterpCharacterToLocation(const FVector& TargetLocation,
                                                   float InterpSpeed)
{
    if (!OwnerCharacter || !GetWorld()) return;

    const FVector CurrentLocation = OwnerCharacter->GetActorLocation();
    const FVector NewLocation = FMath::VInterpTo(
        CurrentLocation,
        TargetLocation,
        GetWorld()->GetDeltaSeconds(),
        InterpSpeed
    );

    OwnerCharacter->SetActorLocation(NewLocation, false, nullptr, ETeleportType::None);
}

// ============================================================
// Initialization
// ============================================================

void UParkourComponent::Initialize()
{
    OwnerCharacter = Cast<ACharacter>(GetOwner());

    if (!OwnerCharacter)
    {
        UE_LOG(LogTemp, Warning,
               TEXT("ParkourComponent [%s]: Owner is not an ACharacter. "
                    "Attach this component to an ACharacter-derived actor."),
               *GetName());
        return;
    }

    MovementComponent = OwnerCharacter->GetCharacterMovement();
    CharacterMesh     = OwnerCharacter->GetMesh();
    CapsuleComponent  = OwnerCharacter->GetCapsuleComponent();

    UE_LOG(LogTemp, Log,
           TEXT("ParkourComponent: Successfully initialized on '%s'."),
           *OwnerCharacter->GetName());
}

// ============================================================
// Movement Systems
// ============================================================

void UParkourComponent::FirstOffset_Point_MoveTo()
{
    if (!OwnerCharacter) return;

    // Lock movement control so the parkour sequence drives the character.
    bIsParkourActive = true;

    if (MovementComponent)
    {
        // Flying disables gravity so the character can be freely translated.
        MovementComponent->SetMovementMode(MOVE_Flying);
        MovementComponent->StopMovementImmediately();
    }

    // Interpolate toward the pre-vault alignment point this frame.
    // (Call this every tick until the character is close enough, then advance
    //  the sequence by calling FirstMoveToPoint.)
    InterpCharacterToLocation(FirstOffsetPoint, MoveToInterpSpeed);

    UE_LOG(LogTemp, Verbose,
           TEXT("ParkourComponent: FirstOffset_Point_MoveTo -> %s"),
           *FirstOffsetPoint.ToString());
}

void UParkourComponent::FirstMoveToPoint()
{
    if (!OwnerCharacter) return;

    InterpCharacterToLocation(FirstTargetPoint, MoveToInterpSpeed);

    UE_LOG(LogTemp, Verbose,
           TEXT("ParkourComponent: FirstMoveToPoint -> %s"),
           *FirstTargetPoint.ToString());
}

void UParkourComponent::MoveMiddlePoint()
{
    if (!OwnerCharacter) return;

    InterpCharacterToLocation(MiddleTargetPoint, MoveToInterpSpeed);

    UE_LOG(LogTemp, Verbose,
           TEXT("ParkourComponent: MoveMiddlePoint -> %s"),
           *MiddleTargetPoint.ToString());
}

void UParkourComponent::MoveLastPoint()
{
    if (!OwnerCharacter) return;

    InterpCharacterToLocation(LastTargetPoint, MoveToInterpSpeed);

    UE_LOG(LogTemp, Verbose,
           TEXT("ParkourComponent: MoveLastPoint -> %s"),
           *LastTargetPoint.ToString());
}

void UParkourComponent::LastPointMoveTo()
{
    if (!OwnerCharacter) return;

    // Use TeleportPhysics to avoid sweep collisions at the final snap point.
    OwnerCharacter->SetActorLocation(
        LastTargetPoint,
        false,
        nullptr,
        ETeleportType::TeleportPhysics
    );

    if (MovementComponent)
    {
        MovementComponent->SetMovementMode(MOVE_Walking);
    }

    UE_LOG(LogTemp, Verbose,
           TEXT("ParkourComponent: LastPointMoveTo -> %s"),
           *LastTargetPoint.ToString());
}

void UParkourComponent::After_Object_Move_To()
{
    if (!OwnerCharacter) return;

    // Restore normal locomotion after clearing the object.
    if (MovementComponent)
    {
        MovementComponent->SetMovementMode(MOVE_Walking);
    }

    // Gentle interp to the landing point — half speed for a softer settle.
    InterpCharacterToLocation(LastTargetPoint, MoveToInterpSpeed * 0.5f);

    UE_LOG(LogTemp, Verbose, TEXT("ParkourComponent: After_Object_Move_To"));
}

void UParkourComponent::Move_Last_Point_Location_With_Notify_State(float NotifyStateSize)
{
    if (!OwnerCharacter) return;

    // Direct lerp between current location and LastTargetPoint, driven by the
    // normalized Anim Notify State progress value (0 = begin, 1 = end).
    // No engine-side interpolation — the animation drives the blending.
    const FVector InterpLocation = FMath::Lerp(
        OwnerCharacter->GetActorLocation(),
        LastTargetPoint,
        FMath::Clamp(NotifyStateSize, 0.f, 1.f)
    );

    OwnerCharacter->SetActorLocation(
        InterpLocation,
        false,
        nullptr,
        ETeleportType::None
    );

    UE_LOG(LogTemp, Verbose,
           TEXT("ParkourComponent: Move_Last_Point_Location_With_Notify_State (size=%.3f)"),
           NotifyStateSize);
}

// ============================================================
// Ground Checking
// ============================================================

void UParkourComponent::Check_Ground()
{
    Checking_Ground_Before_Object();
    Checking_Ground_After_Object();
}

void UParkourComponent::Checking_Ground_Before_Object()
{
    if (!OwnerCharacter) return;

    const FVector TraceStart = OwnerCharacter->GetActorLocation();
    PerformGroundLineTrace(TraceStart, bGroundBeforeObject);

    UE_LOG(LogTemp, Verbose,
           TEXT("ParkourComponent: Ground BEFORE object = %s"),
           bGroundBeforeObject ? TEXT("true") : TEXT("false"));
}

void UParkourComponent::Checking_Ground_After_Object()
{
    if (!OwnerCharacter) return;

    // Project forward beyond the obstacle to check the landing zone.
    const FVector ForwardOffset =
        OwnerCharacter->GetActorForwardVector() * GroundAfterObjectForwardOffset;
    const FVector TraceStart = OwnerCharacter->GetActorLocation() + ForwardOffset;

    PerformGroundLineTrace(TraceStart, bGroundAfterObject);

    UE_LOG(LogTemp, Verbose,
           TEXT("ParkourComponent: Ground AFTER object = %s"),
           bGroundAfterObject ? TEXT("true") : TEXT("false"));
}

// ============================================================
// Ledge Systems
// ============================================================

void UParkourComponent::Ledge_Drop_MoveTo()
{
    if (!OwnerCharacter || !MovementComponent) return;

    bIsLedgeHolding = false;

    // Re-enable gravity so the character falls naturally from the ledge.
    MovementComponent->SetMovementMode(MOVE_Falling);

    OwnerCharacter->SetActorLocation(
        LedgeDropPoint,
        false,
        nullptr,
        ETeleportType::None
    );

    UE_LOG(LogTemp, Verbose,
           TEXT("ParkourComponent: Ledge_Drop_MoveTo -> %s"),
           *LedgeDropPoint.ToString());
}

void UParkourComponent::Ledge_Hold_Begin_Position()
{
    if (!OwnerCharacter || !MovementComponent) return;

    bIsLedgeHolding = true;

    // Disable gravity while hanging.
    MovementComponent->SetMovementMode(MOVE_Flying);
    MovementComponent->StopMovementImmediately();

    // Teleport to the hang start position.
    OwnerCharacter->SetActorLocation(
        LedgeHoldBeginPoint,
        false,
        nullptr,
        ETeleportType::TeleportPhysics
    );

    UE_LOG(LogTemp, Verbose,
           TEXT("ParkourComponent: Ledge_Hold_Begin_Position -> %s"),
           *LedgeHoldBeginPoint.ToString());
}

void UParkourComponent::Ledge_Hold_Last_Position()
{
    if (!OwnerCharacter) return;

    // Reposition within the ledge hang (e.g. shimmy to corner or adjust grip).
    OwnerCharacter->SetActorLocation(
        LedgeHoldLastPoint,
        false,
        nullptr,
        ETeleportType::TeleportPhysics
    );

    UE_LOG(LogTemp, Verbose,
           TEXT("ParkourComponent: Ledge_Hold_Last_Position -> %s"),
           *LedgeHoldLastPoint.ToString());
}

// ============================================================
// Timer Utilities
// ============================================================

void UParkourComponent::Timer_Check_Playing_Montage()
{
    if (!OwnerCharacter || !CharacterMesh) return;

    UAnimInstance* AnimInstance = CharacterMesh->GetAnimInstance();
    if (!AnimInstance) return;

    if (AnimInstance->IsAnyMontagePlaying())
    {
        bIsMontagePlayig = true;

        // Re-arm the timer to check again in 0.1 s.
        GetWorld()->GetTimerManager().SetTimer(
            MontageCheckTimerHandle,
            this,
            &UParkourComponent::Timer_Check_Playing_Montage,
            0.1f,
            false   // single-shot; we re-arm manually so the interval stays consistent
        );
    }
    else
    {
        bIsMontagePlayig = false;

        // The montage finished naturally — clean up parkour state.
        AnimNotify_ResetVariables();
    }
}

// ============================================================
// Tic-Tac / Wall Run
// ============================================================

void UParkourComponent::Tic_Tac_First_Offset()
{
    if (!OwnerCharacter) return;

    // Same pre-action setup as FirstOffset_Point_MoveTo but scoped to tic-tac.
    bIsParkourActive = true;

    if (MovementComponent)
    {
        MovementComponent->SetMovementMode(MOVE_Flying);
        MovementComponent->StopMovementImmediately();
    }

    InterpCharacterToLocation(FirstOffsetPoint, MoveToInterpSpeed);

    UE_LOG(LogTemp, Verbose,
           TEXT("ParkourComponent: Tic_Tac_First_Offset -> %s"),
           *FirstOffsetPoint.ToString());
}

void UParkourComponent::Tic_Tac_Main_Move_To()
{
    if (!OwnerCharacter) return;

    // Move faster than a normal vault to convey the wall-kick snappiness.
    InterpCharacterToLocation(FirstTargetPoint, MoveToInterpSpeed * 1.5f);

    UE_LOG(LogTemp, Verbose,
           TEXT("ParkourComponent: Tic_Tac_Main_Move_To -> %s"),
           *FirstTargetPoint.ToString());
}

// ============================================================
// Anim Notify Hooks
// ============================================================

void UParkourComponent::AnimNotify_BlendOutMontage()
{
    if (!OwnerCharacter || !CharacterMesh) return;

    UAnimInstance* AnimInstance = CharacterMesh->GetAnimInstance();
    if (!AnimInstance) return;

    UAnimMontage* CurrentMontage = AnimInstance->GetCurrentActiveMontage();
    if (CurrentMontage)
    {
        AnimInstance->Montage_Stop(MontageBlendOutTime, CurrentMontage);
    }

    UE_LOG(LogTemp, Verbose, TEXT("ParkourComponent: AnimNotify_BlendOutMontage"));
}

void UParkourComponent::AnimNotify_MoveForwardToPoint()
{
    if (!OwnerCharacter) return;

    // Push the character forward along their facing direction by a fixed distance.
    // Used in Anim Notifies to sync a burst of movement with a specific animation frame.
    const FVector ForwardTarget =
        OwnerCharacter->GetActorLocation()
        + OwnerCharacter->GetActorForwardVector() * ForwardNotifyPushDistance;

    InterpCharacterToLocation(ForwardTarget, MoveToInterpSpeed);

    UE_LOG(LogTemp, Verbose, TEXT("ParkourComponent: AnimNotify_MoveForwardToPoint"));
}

void UParkourComponent::AnimNotify_CorrectPositionState(float StateSize)
{
    // Delegate to the notify-state movement function.
    Move_Last_Point_Location_With_Notify_State(StateSize);

    UE_LOG(LogTemp, Verbose,
           TEXT("ParkourComponent: AnimNotify_CorrectPositionState (size=%.3f)"),
           StateSize);
}

void UParkourComponent::AnimNotify_ResetVariables()
{
    ResetParkourState();

    // Cancel any pending parkour timers.
    if (GetWorld())
    {
        GetWorld()->GetTimerManager().ClearTimer(MontageCheckTimerHandle);
        GetWorld()->GetTimerManager().ClearTimer(ParkourSequenceTimerHandle);
    }

    UE_LOG(LogTemp, Log,
           TEXT("ParkourComponent: AnimNotify_ResetVariables — all parkour state cleared."));
}
