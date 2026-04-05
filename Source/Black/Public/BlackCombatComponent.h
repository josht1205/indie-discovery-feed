// Copyright (c) BLACK Game. All Rights Reserved.
#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "GameplayTagContainer.h"
#include "BlackCombatComponent.generated.h"

class ABlackCharacterBase;

/**
 * EComboAttackType
 * Distinguishes light and heavy attacks within the combo state machine.
 */
UENUM(BlueprintType)
enum class EComboAttackType : uint8
{
    Light  UMETA(DisplayName = "Light"),
    Heavy  UMETA(DisplayName = "Heavy"),
};

/**
 * UBlackCombatComponent
 *
 * Combo state machine for BLACK characters.
 * Manages attack chaining, combo windows, and hit detection via sphere traces.
 *
 * Attach to ABlackPlayerCharacter (and optionally enemies).
 * Blueprint subclasses should:
 *  - Override OnLightAttackCommitted / OnHeavyAttackCommitted to play montages.
 *  - Call OpenComboWindow / CloseComboWindow from AnimNotifies.
 *  - Override OnHitConfirmed to apply damage Game Effects.
 */
UCLASS(ClassGroup = "Black|Combat", BlueprintType, Blueprintable,
       meta = (BlueprintSpawnableComponent))
class BLACK_API UBlackCombatComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UBlackCombatComponent();

    // ------------------------------------------------------------------
    // Public API  (called by ABlackPlayerCharacter input handlers)
    // ------------------------------------------------------------------

    /**
     * Request a light attack. Starts the combo or advances the chain
     * if we are inside a valid combo window.
     */
    UFUNCTION(BlueprintCallable, Category = "Black|Combat")
    void RequestLightAttack();

    /**
     * Request a heavy attack. Can be buffered during a combo window.
     */
    UFUNCTION(BlueprintCallable, Category = "Black|Combat")
    void RequestHeavyAttack();

    /**
     * Open the window during which the next attack input is accepted.
     * Call from an AnimNotify at the appropriate frame in the attack montage.
     */
    UFUNCTION(BlueprintCallable, Category = "Black|Combat")
    void OpenComboWindow();

    /**
     * Close the combo window. If no input was buffered, start the reset timer.
     * Call from an AnimNotify at the end of the attack montage's "bufferable" frames.
     */
    UFUNCTION(BlueprintCallable, Category = "Black|Combat")
    void CloseComboWindow();

    /**
     * Immediately reset the combo to idle. Called by the reset timer or
     * externally (e.g. on hit-stun, dodge, death).
     */
    UFUNCTION(BlueprintCallable, Category = "Black|Combat")
    void ResetCombo();

    /**
     * Perform a sphere-trace hit-detection sweep at the weapon socket.
     * Call this from an AnimNotify during the active hit frames.
     * Fires OnHitConfirmed for each new actor hit.
     */
    UFUNCTION(BlueprintCallable, Category = "Black|Combat")
    void PerformHitDetection();

    // ------------------------------------------------------------------
    // Blueprint events (override in Blueprint to respond to state changes)
    // ------------------------------------------------------------------

    /** Fired when a light attack has been committed (montage should play). */
    UFUNCTION(BlueprintNativeEvent, Category = "Black|Combat")
    void OnLightAttackCommitted(int32 ComboIndex);
    virtual void OnLightAttackCommitted_Implementation(int32 ComboIndex) {}

    /** Fired when a heavy attack has been committed (montage should play). */
    UFUNCTION(BlueprintNativeEvent, Category = "Black|Combat")
    void OnHeavyAttackCommitted(int32 ComboIndex);
    virtual void OnHeavyAttackCommitted_Implementation(int32 ComboIndex) {}

    /** Fired for each actor hit during PerformHitDetection. Apply damage here. */
    UFUNCTION(BlueprintNativeEvent, Category = "Black|Combat")
    void OnHitConfirmed(AActor* HitActor, const FHitResult& HitResult, EComboAttackType AttackType);
    virtual void OnHitConfirmed_Implementation(AActor* HitActor, const FHitResult& HitResult, EComboAttackType AttackType) {}

    /** Fired when the combo resets to idle. */
    UFUNCTION(BlueprintNativeEvent, Category = "Black|Combat")
    void OnComboReset();
    virtual void OnComboReset_Implementation() {}

    // ------------------------------------------------------------------
    // State accessors
    // ------------------------------------------------------------------

    UFUNCTION(BlueprintPure, Category = "Black|Combat")
    int32 GetCurrentComboIndex() const { return CurrentComboIndex; }

    UFUNCTION(BlueprintPure, Category = "Black|Combat")
    bool IsAttacking() const { return bIsAttacking; }

    UFUNCTION(BlueprintPure, Category = "Black|Combat")
    bool CanCombo() const { return bCanCombo; }

    // ------------------------------------------------------------------
    // Configuration (tweak in Blueprint class defaults)
    // ------------------------------------------------------------------

    /** Maximum number of hits in the light attack chain before forced reset. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|Combat|Config")
    int32 MaxComboCount = 4;

    /** Radius of the sphere trace used for hit detection (in cm). */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|Combat|Config")
    float HitDetectionRadius = 40.f;

    /** Reach of the sphere trace (distance from weapon socket forward, in cm). */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|Combat|Config")
    float HitDetectionReach = 80.f;

    /** Socket name on the character mesh used as the weapon / fist origin. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|Combat|Config")
    FName WeaponSocketName = TEXT("weapon_r");

    /**
     * Seconds after CloseComboWindow before the combo auto-resets.
     * Set to 0 to reset immediately on window close if nothing was buffered.
     */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|Combat|Config")
    float ComboResetDelay = 0.5f;

    /** Object types checked by the hit-detection sphere trace. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|Combat|Config")
    TArray<TEnumAsByte<EObjectTypeQuery>> HitObjectTypes;

protected:
    virtual void BeginPlay() override;

private:
    // ------------------------------------------------------------------
    // Internal state
    // ------------------------------------------------------------------

    /** Current position in the combo chain (0 = idle, 1 = first hit, etc.). */
    int32 CurrentComboIndex = 0;

    /** Whether the player is currently inside an active attack. */
    bool bIsAttacking = false;

    /** Whether the combo window is open and a new attack can be chained. */
    bool bCanCombo = false;

    /** Buffered attack type pressed during a combo window. */
    bool bAttackBuffered  = false;
    EComboAttackType BufferedAttackType = EComboAttackType::Light;

    /** Most recent attack type (used by OnHitConfirmed). */
    EComboAttackType CurrentAttackType = EComboAttackType::Light;

    /** Timer handle for the post-window combo reset. */
    FTimerHandle ComboResetTimerHandle;

    /** Actors already hit in this attack swing (prevents multi-hit per swing). */
    TArray<TObjectPtr<AActor>> HitActorsThisSwing;

    /** Cached owning character. */
    UPROPERTY()
    TObjectPtr<ABlackCharacterBase> OwnerCharacter;

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------
    void CommitAttack(EComboAttackType AttackType);
    void ClearHitActors();
};
