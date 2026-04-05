// Copyright (c) BLACK Game. All Rights Reserved.
#pragma once

#include "CoreMinimal.h"
#include "AttributeSet.h"
#include "AbilitySystemComponent.h"
#include "BlackAttributeSet.generated.h"

/**
 * Helper macro – generates Get/Set/Init accessors for a GAS attribute.
 * Matches the pattern used in Lyra / ShooterGame.
 */
#define ATTRIBUTE_ACCESSORS(ClassName, PropertyName)           \
    GAMEPLAYATTRIBUTE_PROPERTY_GETTER(ClassName, PropertyName) \
    GAMEPLAYATTRIBUTE_VALUE_GETTER(PropertyName)               \
    GAMEPLAYATTRIBUTE_VALUE_SETTER(PropertyName)               \
    GAMEPLAYATTRIBUTE_VALUE_INITTER(PropertyName)

/**
 * UBlackAttributeSet
 *
 * Core attributes for every character in BLACK.
 * Blueprint subclasses should NOT replicate additional attributes here;
 * create a separate AttributeSet subclass instead so the base remains clean.
 */
UCLASS()
class BLACK_API UBlackAttributeSet : public UAttributeSet
{
    GENERATED_BODY()

public:
    UBlackAttributeSet();

    // ------------------------------------------------------------------
    // UAttributeSet interface
    // ------------------------------------------------------------------
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
    virtual void PreAttributeChange(const FGameplayAttribute& Attribute, float& NewValue) override;
    virtual void PostGameplayEffectExecute(const FGameplayEffectModCallbackData& Data) override;

    // ------------------------------------------------------------------
    // Health
    // ------------------------------------------------------------------

    /** Current health. Hits zero → death. */
    UPROPERTY(BlueprintReadOnly, Category = "Black|Attributes|Vitals", ReplicatedUsing = OnRep_Health)
    FGameplayAttributeData Health;
    ATTRIBUTE_ACCESSORS(UBlackAttributeSet, Health)

    UPROPERTY(BlueprintReadOnly, Category = "Black|Attributes|Vitals", ReplicatedUsing = OnRep_MaxHealth)
    FGameplayAttributeData MaxHealth;
    ATTRIBUTE_ACCESSORS(UBlackAttributeSet, MaxHealth)

    // ------------------------------------------------------------------
    // Shadow Meter  (parry / counter resource)
    // ------------------------------------------------------------------

    UPROPERTY(BlueprintReadOnly, Category = "Black|Attributes|Shadow", ReplicatedUsing = OnRep_ShadowMeter)
    FGameplayAttributeData ShadowMeter;
    ATTRIBUTE_ACCESSORS(UBlackAttributeSet, ShadowMeter)

    UPROPERTY(BlueprintReadOnly, Category = "Black|Attributes|Shadow", ReplicatedUsing = OnRep_MaxShadowMeter)
    FGameplayAttributeData MaxShadowMeter;
    ATTRIBUTE_ACCESSORS(UBlackAttributeSet, MaxShadowMeter)

    // ------------------------------------------------------------------
    // Black Meter  (ultimate / BLACK State resource)
    // ------------------------------------------------------------------

    UPROPERTY(BlueprintReadOnly, Category = "Black|Attributes|BlackMeter", ReplicatedUsing = OnRep_BlackMeter)
    FGameplayAttributeData BlackMeter;
    ATTRIBUTE_ACCESSORS(UBlackAttributeSet, BlackMeter)

    UPROPERTY(BlueprintReadOnly, Category = "Black|Attributes|BlackMeter", ReplicatedUsing = OnRep_MaxBlackMeter)
    FGameplayAttributeData MaxBlackMeter;
    ATTRIBUTE_ACCESSORS(UBlackAttributeSet, MaxBlackMeter)

    // ------------------------------------------------------------------
    // Combat Stats
    // ------------------------------------------------------------------

    UPROPERTY(BlueprintReadOnly, Category = "Black|Attributes|Combat", ReplicatedUsing = OnRep_AttackPower)
    FGameplayAttributeData AttackPower;
    ATTRIBUTE_ACCESSORS(UBlackAttributeSet, AttackPower)

    UPROPERTY(BlueprintReadOnly, Category = "Black|Attributes|Combat", ReplicatedUsing = OnRep_Defense)
    FGameplayAttributeData Defense;
    ATTRIBUTE_ACCESSORS(UBlackAttributeSet, Defense)

    // ------------------------------------------------------------------
    // Meta-attribute: incoming damage (never replicated, consumed on apply)
    // ------------------------------------------------------------------

    /** Transient damage container. Set by a GE, consumed in PostGameplayEffectExecute. */
    UPROPERTY(BlueprintReadOnly, Category = "Black|Attributes|Meta")
    FGameplayAttributeData IncomingDamage;
    ATTRIBUTE_ACCESSORS(UBlackAttributeSet, IncomingDamage)

protected:
    // ------------------------------------------------------------------
    // Rep notifiers
    // ------------------------------------------------------------------
    UFUNCTION()
    void OnRep_Health(const FGameplayAttributeData& OldHealth);

    UFUNCTION()
    void OnRep_MaxHealth(const FGameplayAttributeData& OldMaxHealth);

    UFUNCTION()
    void OnRep_ShadowMeter(const FGameplayAttributeData& OldShadowMeter);

    UFUNCTION()
    void OnRep_MaxShadowMeter(const FGameplayAttributeData& OldMaxShadowMeter);

    UFUNCTION()
    void OnRep_BlackMeter(const FGameplayAttributeData& OldBlackMeter);

    UFUNCTION()
    void OnRep_MaxBlackMeter(const FGameplayAttributeData& OldMaxBlackMeter);

    UFUNCTION()
    void OnRep_AttackPower(const FGameplayAttributeData& OldAttackPower);

    UFUNCTION()
    void OnRep_Defense(const FGameplayAttributeData& OldDefense);
};
