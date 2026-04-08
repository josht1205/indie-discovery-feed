// ParkourComponent.h
// Unreal Engine 5.3 — First Person Template (C++)
// Attach to BP_FirstPersonCharacter as an Actor Component.
//
// IMPORTANT: Replace "YOURPROJECT" with your actual project module name
// (the name in your .uproject file, all caps) throughout this file.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "ParkourComponent.generated.h"

/**
 * UParkourComponent
 *
 * Actor Component that provides a full parkour movement system for an ACharacter.
 * Attach to BP_FirstPersonCharacter in Blueprint or via C++.
 *
 * Workflow overview:
 *  1. BeginPlay calls Initialize() to cache all required character references.
 *  2. External code (input, traces) sets the target point vectors and calls the
 *     appropriate movement function to begin the parkour sequence.
 *  3. Anim Notify / Anim Notify State hooks drive per-frame position corrections
 *     during the montage.
 *  4. AnimNotify_ResetVariables() is called at the end of the montage to clean up.
 */
UCLASS(ClassGroup = (Custom), meta = (BlueprintSpawnableComponent))
class YOURPROJECT_API UParkourComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UParkourComponent();

protected:
    virtual void BeginPlay() override;

public:
    virtual void TickComponent(float DeltaTime, ELevelTick TickType,
                               FActorComponentTickFunction* ThisTickFunction) override;

    // ----------------------------------------------------------------
    // Initialization
    // ----------------------------------------------------------------

    /** Cache character references. Called automatically on BeginPlay. */
    UFUNCTION(BlueprintCallable, Category = "Parkour|Init")
    void Initialize();

    // ----------------------------------------------------------------
    // Movement Systems
    // ----------------------------------------------------------------

    /**
     * Moves the player to a first offset/alignment point before the parkour
     * action begins. Sets movement mode to Flying and interpolates the actor
     * toward FirstOffsetPoint.
     */
    UFUNCTION(BlueprintCallable, Category = "Parkour|Movement")
    void FirstOffset_Point_MoveTo();

    /**
     * Initiates movement toward the first parkour interaction point
     * (e.g., the near edge of a vault object).
     */
    UFUNCTION(BlueprintCallable, Category = "Parkour|Movement")
    void FirstMoveToPoint();

    /**
     * Moves the character to the intermediate/middle waypoint during a
     * multi-stage parkour sequence (e.g., mid-vault position).
     */
    UFUNCTION(BlueprintCallable, Category = "Parkour|Movement")
    void MoveMiddlePoint();

    /**
     * Moves the character toward the final destination point of the sequence
     * (e.g., the far side of the vault object). Uses interpolation.
     */
    UFUNCTION(BlueprintCallable, Category = "Parkour|Movement")
    void MoveLastPoint();

    /**
     * Teleports (physics-safe) the character to the absolute last point and
     * restores Walking movement mode. Use at the tail end of a sequence.
     */
    UFUNCTION(BlueprintCallable, Category = "Parkour|Movement")
    void LastPointMoveTo();

    /**
     * Handles player repositioning after the character has fully cleared a
     * parkour object. Restores walking and slowly interpolates to landing spot.
     */
    UFUNCTION(BlueprintCallable, Category = "Parkour|Movement")
    void After_Object_Move_To();

    /**
     * Moves the character to LastTargetPoint driven by an Anim Notify State.
     * No engine interpolation — position is set directly each tick using the
     * normalized notify state progress value (0..1).
     *
     * @param NotifyStateSize  Normalized progress from the Anim Notify State (0=start, 1=end).
     */
    UFUNCTION(BlueprintCallable, Category = "Parkour|Movement")
    void Move_Last_Point_Location_With_Notify_State(float NotifyStateSize);

    // ----------------------------------------------------------------
    // Ground Checking
    // ----------------------------------------------------------------

    /** Runs both Before and After ground checks in sequence. */
    UFUNCTION(BlueprintCallable, Category = "Parkour|Ground")
    void Check_Ground();

    /**
     * Line-traces downward from the character's current position to check
     * whether there is solid ground before the parkour object.
     * Result stored in bGroundBeforeObject.
     */
    UFUNCTION(BlueprintCallable, Category = "Parkour|Ground")
    void Checking_Ground_Before_Object();

    /**
     * Line-traces downward from a forward-projected position to check whether
     * there is solid ground on the far side of the parkour object.
     * Result stored in bGroundAfterObject.
     */
    UFUNCTION(BlueprintCallable, Category = "Parkour|Ground")
    void Checking_Ground_After_Object();

    // ----------------------------------------------------------------
    // Ledge Systems
    // ----------------------------------------------------------------

    /**
     * Initiates a ledge drop. Enables falling movement and repositions the
     * character to LedgeDropPoint.
     */
    UFUNCTION(BlueprintCallable, Category = "Parkour|Ledge")
    void Ledge_Drop_MoveTo();

    /**
     * Snaps the character to the initial ledge-hang position.
     * Disables gravity (Flying mode) and sets bIsLedgeHolding = true.
     */
    UFUNCTION(BlueprintCallable, Category = "Parkour|Ledge")
    void Ledge_Hold_Begin_Position();

    /**
     * Sets the final holding position while the character hangs on the ledge,
     * waiting for a climb-up or drop-down input decision.
     */
    UFUNCTION(BlueprintCallable, Category = "Parkour|Ledge")
    void Ledge_Hold_Last_Position();

    // ----------------------------------------------------------------
    // Timer Utilities
    // ----------------------------------------------------------------

    /**
     * Polls whether an anim montage is still playing (0.1 s interval).
     * When the montage ends, calls AnimNotify_ResetVariables automatically.
     * Start this timer after playing a parkour montage.
     */
    UFUNCTION(BlueprintCallable, Category = "Parkour|Utility")
    void Timer_Check_Playing_Montage();

    // ----------------------------------------------------------------
    // Tic-Tac / Wall Run
    // ----------------------------------------------------------------

    /**
     * Sets up the pre-wall-run alignment offset point and begins interpolating
     * the character to that position (first phase of a tic-tac).
     */
    UFUNCTION(BlueprintCallable, Category = "Parkour|TicTac")
    void Tic_Tac_First_Offset();

    /**
     * Executes the main wall-run movement, interpolating the character
     * to FirstTargetPoint at an accelerated speed.
     */
    UFUNCTION(BlueprintCallable, Category = "Parkour|TicTac")
    void Tic_Tac_Main_Move_To();

    // ----------------------------------------------------------------
    // Anim Notify Hooks
    // (Call these from your AnimNotify / AnimNotifyState classes)
    // ----------------------------------------------------------------

    /**
     * Blends out the currently playing montage with a short blend time.
     * Bind to an Anim Notify at the point where the montage should fade.
     */
    UFUNCTION(BlueprintCallable, Category = "Parkour|AnimNotify")
    void AnimNotify_BlendOutMontage();

    /**
     * Pushes the player a short distance forward along their facing direction.
     * Bind to an Anim Notify to sync forward momentum with a key animation frame.
     */
    UFUNCTION(BlueprintCallable, Category = "Parkour|AnimNotify")
    void AnimNotify_MoveForwardToPoint();

    /**
     * Corrects/snaps the player position using Anim Notify State progress.
     * Delegates to Move_Last_Point_Location_With_Notify_State.
     *
     * @param StateSize  Normalized progress value supplied by the Notify State (0..1).
     */
    UFUNCTION(BlueprintCallable, Category = "Parkour|AnimNotify")
    void AnimNotify_CorrectPositionState(float StateSize);

    /**
     * Resets all parkour state variables and clears timers.
     * Bind to an Anim Notify at the very end of every parkour montage.
     */
    UFUNCTION(BlueprintCallable, Category = "Parkour|AnimNotify")
    void AnimNotify_ResetVariables();

    // ----------------------------------------------------------------
    // Target Point Setters (call from Blueprint before triggering parkour)
    // ----------------------------------------------------------------

    UFUNCTION(BlueprintCallable, Category = "Parkour|Points")
    void SetFirstOffsetPoint(FVector Point)   { FirstOffsetPoint   = Point; }

    UFUNCTION(BlueprintCallable, Category = "Parkour|Points")
    void SetFirstTargetPoint(FVector Point)   { FirstTargetPoint   = Point; }

    UFUNCTION(BlueprintCallable, Category = "Parkour|Points")
    void SetMiddleTargetPoint(FVector Point)  { MiddleTargetPoint  = Point; }

    UFUNCTION(BlueprintCallable, Category = "Parkour|Points")
    void SetLastTargetPoint(FVector Point)    { LastTargetPoint    = Point; }

    UFUNCTION(BlueprintCallable, Category = "Parkour|Points")
    void SetLedgeDropPoint(FVector Point)     { LedgeDropPoint     = Point; }

    UFUNCTION(BlueprintCallable, Category = "Parkour|Points")
    void SetLedgeHoldBeginPoint(FVector Point){ LedgeHoldBeginPoint = Point; }

    UFUNCTION(BlueprintCallable, Category = "Parkour|Points")
    void SetLedgeHoldLastPoint(FVector Point) { LedgeHoldLastPoint  = Point; }

    // ----------------------------------------------------------------
    // Read-only State (Blueprint-readable)
    // ----------------------------------------------------------------

    UFUNCTION(BlueprintPure, Category = "Parkour|State")
    bool IsParkourActive()    const { return bIsParkourActive;    }

    UFUNCTION(BlueprintPure, Category = "Parkour|State")
    bool IsLedgeHolding()     const { return bIsLedgeHolding;     }

    UFUNCTION(BlueprintPure, Category = "Parkour|State")
    bool IsMontageStillPlaying() const { return bIsMontagePlayig; }

protected:
    // ----------------------------------------------------------------
    // Cached References (populated in Initialize)
    // ----------------------------------------------------------------

    UPROPERTY()
    class ACharacter* OwnerCharacter;

    UPROPERTY()
    class UCharacterMovementComponent* MovementComponent;

    UPROPERTY()
    class USkeletalMeshComponent* CharacterMesh;

    UPROPERTY()
    class UCapsuleComponent* CapsuleComponent;

    // ----------------------------------------------------------------
    // Parkour Target Points
    // ----------------------------------------------------------------

    /** Alignment/offset point the character moves to before the parkour action. */
    UPROPERTY(BlueprintReadWrite, Category = "Parkour|Points")
    FVector FirstOffsetPoint;

    /** Near-edge point of the parkour object. */
    UPROPERTY(BlueprintReadWrite, Category = "Parkour|Points")
    FVector FirstTargetPoint;

    /** Mid-vault/intermediate waypoint. */
    UPROPERTY(BlueprintReadWrite, Category = "Parkour|Points")
    FVector MiddleTargetPoint;

    /** Far-side landing point after clearing the object. */
    UPROPERTY(BlueprintReadWrite, Category = "Parkour|Points")
    FVector LastTargetPoint;

    /** Drop-target point when falling from a ledge. */
    UPROPERTY(BlueprintReadWrite, Category = "Parkour|Points")
    FVector LedgeDropPoint;

    /** Initial hang position on a ledge. */
    UPROPERTY(BlueprintReadWrite, Category = "Parkour|Points")
    FVector LedgeHoldBeginPoint;

    /** Final hang position while waiting on a ledge. */
    UPROPERTY(BlueprintReadWrite, Category = "Parkour|Points")
    FVector LedgeHoldLastPoint;

    // ----------------------------------------------------------------
    // State Flags
    // ----------------------------------------------------------------

    UPROPERTY(BlueprintReadWrite, Category = "Parkour|State")
    bool bIsParkourActive;

    /** True when solid ground was detected before the parkour object. */
    UPROPERTY(BlueprintReadWrite, Category = "Parkour|State")
    bool bGroundBeforeObject;

    /** True when solid ground was detected after (beyond) the parkour object. */
    UPROPERTY(BlueprintReadWrite, Category = "Parkour|State")
    bool bGroundAfterObject;

    /** True while the character is hanging on a ledge. */
    UPROPERTY(BlueprintReadWrite, Category = "Parkour|State")
    bool bIsLedgeHolding;

    /** True while a parkour anim montage is actively playing. */
    UPROPERTY(BlueprintReadWrite, Category = "Parkour|State")
    bool bIsMontagePlayig;

    // ----------------------------------------------------------------
    // Tunable Settings
    // ----------------------------------------------------------------

    /** VInterp speed used for smooth movement-to-point functions. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Parkour|Settings")
    float MoveToInterpSpeed;

    /** How far downward to line-trace for ground detection (cm). */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Parkour|Settings")
    float GroundCheckDistance;

    /**
     * Forward distance (cm) used by Checking_Ground_After_Object to project
     * the ground-check trace beyond the parkour obstacle.
     */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Parkour|Settings")
    float GroundAfterObjectForwardOffset;

    /**
     * Distance (cm) pushed forward during AnimNotify_MoveForwardToPoint.
     * Tune to match the speed feel of your parkour montages.
     */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Parkour|Settings")
    float ForwardNotifyPushDistance;

    /** Blend-out time (seconds) used when stopping a montage early. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Parkour|Settings")
    float MontageBlendOutTime;

    // ----------------------------------------------------------------
    // Anim Montages (assign in Blueprint or child C++ class)
    // ----------------------------------------------------------------

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Parkour|Animation")
    class UAnimMontage* ParkourMontage;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Parkour|Animation")
    class UAnimMontage* LedgeDropMontage;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Parkour|Animation")
    class UAnimMontage* LedgeHoldMontage;

    // ----------------------------------------------------------------
    // Timer Handles
    // ----------------------------------------------------------------

    FTimerHandle MontageCheckTimerHandle;
    FTimerHandle ParkourSequenceTimerHandle;

private:
    /** Zeros all state flags and restores Walking movement mode. */
    void ResetParkourState();

    /**
     * Performs a downward line trace from StartLocation.
     * @param StartLocation  World-space origin of the trace.
     * @param bHitGround     [out] True if the trace hit a surface.
     * @return Same value as bHitGround.
     */
    bool PerformGroundLineTrace(const FVector& StartLocation, bool& bHitGround) const;

    /**
     * VInterpTo the character's actor location toward TargetLocation this frame.
     * Uses GetWorld()->GetDeltaSeconds() internally.
     */
    void InterpCharacterToLocation(const FVector& TargetLocation, float InterpSpeed);
};
