// Copyright (c) BLACK Game. All Rights Reserved.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "AbilitySystemInterface.h"
#include "GameplayTagContainer.h"
#include "BlackCharacterBase.generated.h"

class UAbilitySystemComponent;
class UBlackAttributeSet;
class UGameplayAbility;
class UGameplayEffect;

/**
 * ABlackCharacterBase
 *
 * Root C++ class for every character in BLACK (player, enemy, boss).
 * Implements IAbilitySystemInterface so GAS can locate the ASC on any character
 * without a cast. Blueprint subclasses should override HandleDeath to author
 * death montages, ragdoll, loot, etc.
 *
 * Design: follows the "Owner = Avatar = Character" GAS topology, matching the
 * pattern used in Lyra for non-player-state-owned ASCs.
 */
UCLASS(Abstract, BlueprintType, Blueprintable)
class BLACK_API ABlackCharacterBase : public ACharacter, public IAbilitySystemInterface
{
    GENERATED_BODY()

public:
    ABlackCharacterBase();

    // ------------------------------------------------------------------
    // IAbilitySystemInterface
    // ------------------------------------------------------------------
    virtual UAbilitySystemComponent* GetAbilitySystemComponent() const override;

    // ------------------------------------------------------------------
    // Ability helpers (callable from Blueprint subclasses)
    // ------------------------------------------------------------------

    /**
     * Grant a Gameplay Ability to this character's ASC.
     * Safe to call from BeginPlay on both client and server;
     * internally guards against duplicate grants and non-authority calls.
     *
     * @param AbilityClass   The ability class to grant.
     * @param Level          Ability level (default 1).
     * @param InputTag       Optional input tag used by the player character to trigger the ability.
     */
    UFUNCTION(BlueprintCallable, Category = "Black|Abilities")
    void GrantAbility(TSubclassOf<UGameplayAbility> AbilityClass, int32 Level = 1);

    /**
     * Attempt to activate an ability by class.
     * Returns true if the activation was attempted (not necessarily successful).
     */
    UFUNCTION(BlueprintCallable, Category = "Black|Abilities")
    bool ActivateAbilityByClass(TSubclassOf<UGameplayAbility> AbilityClass);

    /**
     * Apply a Gameplay Effect to self (useful for initialising stats on BeginPlay).
     */
    UFUNCTION(BlueprintCallable, Category = "Black|Abilities")
    void ApplyEffectToSelf(TSubclassOf<UGameplayEffect> EffectClass, float Level = 1.f);

    // ------------------------------------------------------------------
    // Death
    // ------------------------------------------------------------------

    /**
     * Called by UBlackAttributeSet when Health reaches 0.
     * Server-authoritative. Override in Blueprint or child C++ classes to
     * trigger death animations, ragdoll, destruction timers, etc.
     */
    UFUNCTION(BlueprintNativeEvent, Category = "Black|Character")
    void HandleDeath();
    virtual void HandleDeath_Implementation();

    /** True once HandleDeath has been called. Prevents double-death. */
    UFUNCTION(BlueprintPure, Category = "Black|Character")
    bool IsDead() const { return bIsDead; }

    // ------------------------------------------------------------------
    // Attribute convenience accessors (Blueprint-friendly)
    // ------------------------------------------------------------------

    UFUNCTION(BlueprintPure, Category = "Black|Attributes")
    float GetHealth() const;

    UFUNCTION(BlueprintPure, Category = "Black|Attributes")
    float GetMaxHealth() const;

    UFUNCTION(BlueprintPure, Category = "Black|Attributes")
    float GetBlackMeter() const;

protected:
    // ------------------------------------------------------------------
    // Components
    // ------------------------------------------------------------------

    /** GAS Ability System Component. */
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Black|GAS", meta = (AllowPrivateAccess = "true"))
    TObjectPtr<UAbilitySystemComponent> AbilitySystemComponent;

    /** Default attribute set. Subclasses can add additional sets. */
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Black|GAS", meta = (AllowPrivateAccess = "true"))
    TObjectPtr<UBlackAttributeSet> AttributeSet;

    // ------------------------------------------------------------------
    // Configuration (set in derived Blueprint defaults)
    // ------------------------------------------------------------------

    /**
     * Gameplay Effect used to initialise base attribute values on BeginPlay.
     * Create a GE_CharacterBase_Init Instant GE that sets Health=MaxHealth, etc.
     */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|GAS")
    TSubclassOf<UGameplayEffect> DefaultAttributeEffect;

    /** Abilities granted to every character of this class at spawn. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|GAS")
    TArray<TSubclassOf<UGameplayAbility>> DefaultAbilities;

    // ------------------------------------------------------------------
    // ACharacter overrides
    // ------------------------------------------------------------------
    virtual void BeginPlay() override;
    virtual void PossessedBy(AController* NewController) override;
    virtual void OnRep_PlayerState() override;

private:
    /** Initialise the ASC (register with player state if needed, add attribute sets). */
    void InitAbilitySystem();

    /** Apply DefaultAttributeEffect and grant DefaultAbilities. */
    void InitDefaultAttributes();

    bool bIsDead = false;
};
