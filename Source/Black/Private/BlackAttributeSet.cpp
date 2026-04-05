// Copyright (c) BLACK Game. All Rights Reserved.

#include "BlackAttributeSet.h"
#include "BlackCharacterBase.h"
#include "GameplayEffectExtension.h"
#include "Net/UnrealNetwork.h"

UBlackAttributeSet::UBlackAttributeSet()
{
    // Set sensible defaults. These are overridden by the character's startup GE.
    InitHealth(100.f);
    InitMaxHealth(100.f);
    InitShadowMeter(0.f);
    InitMaxShadowMeter(100.f);
    InitBlackMeter(0.f);
    InitMaxBlackMeter(100.f);
    InitAttackPower(10.f);
    InitDefense(5.f);
    InitIncomingDamage(0.f);
}

void UBlackAttributeSet::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);

    DOREPLIFETIME_CONDITION_NOTIFY(UBlackAttributeSet, Health,         COND_None, REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UBlackAttributeSet, MaxHealth,      COND_None, REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UBlackAttributeSet, ShadowMeter,    COND_None, REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UBlackAttributeSet, MaxShadowMeter, COND_None, REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UBlackAttributeSet, BlackMeter,     COND_None, REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UBlackAttributeSet, MaxBlackMeter,  COND_None, REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UBlackAttributeSet, AttackPower,    COND_None, REPNOTIFY_Always);
    DOREPLIFETIME_CONDITION_NOTIFY(UBlackAttributeSet, Defense,        COND_None, REPNOTIFY_Always);
    // IncomingDamage is intentionally NOT replicated – server-only meta attribute.
}

void UBlackAttributeSet::PreAttributeChange(const FGameplayAttribute& Attribute, float& NewValue)
{
    Super::PreAttributeChange(Attribute, NewValue);

    // Clamp before any modifier is applied so we never store out-of-range values.
    if (Attribute == GetHealthAttribute())
    {
        NewValue = FMath::Clamp(NewValue, 0.f, GetMaxHealth());
    }
    else if (Attribute == GetShadowMeterAttribute())
    {
        NewValue = FMath::Clamp(NewValue, 0.f, GetMaxShadowMeter());
    }
    else if (Attribute == GetBlackMeterAttribute())
    {
        NewValue = FMath::Clamp(NewValue, 0.f, GetMaxBlackMeter());
    }
    else if (Attribute == GetAttackPowerAttribute() || Attribute == GetDefenseAttribute())
    {
        NewValue = FMath::Max(NewValue, 0.f);
    }
}

void UBlackAttributeSet::PostGameplayEffectExecute(const FGameplayEffectModCallbackData& Data)
{
    Super::PostGameplayEffectExecute(Data);

    const FGameplayEffectContextHandle& EffectContext = Data.EffectSpec.GetEffectContext();
    AActor* SourceActor  = EffectContext.GetOriginalInstigator();
    AActor* TargetActor  = Data.Target.GetAvatarActor();

    // ------------------------------------------------------------------
    // Consume IncomingDamage and apply to Health
    // ------------------------------------------------------------------
    if (Data.EvaluatedData.Attribute == GetIncomingDamageAttribute())
    {
        const float LocalDamage = GetIncomingDamage();
        SetIncomingDamage(0.f); // consume

        if (LocalDamage > 0.f)
        {
            const float NewHealth = FMath::Clamp(GetHealth() - LocalDamage, 0.f, GetMaxHealth());
            SetHealth(NewHealth);

            if (NewHealth <= 0.f)
            {
                if (ABlackCharacterBase* TargetCharacter = Cast<ABlackCharacterBase>(TargetActor))
                {
                    TargetCharacter->HandleDeath();
                }
            }
        }
    }

    // ------------------------------------------------------------------
    // Hard-clamp Health after any direct modification
    // ------------------------------------------------------------------
    if (Data.EvaluatedData.Attribute == GetHealthAttribute())
    {
        SetHealth(FMath::Clamp(GetHealth(), 0.f, GetMaxHealth()));
    }

    // ------------------------------------------------------------------
    // Hard-clamp meters
    // ------------------------------------------------------------------
    if (Data.EvaluatedData.Attribute == GetShadowMeterAttribute())
    {
        SetShadowMeter(FMath::Clamp(GetShadowMeter(), 0.f, GetMaxShadowMeter()));
    }

    if (Data.EvaluatedData.Attribute == GetBlackMeterAttribute())
    {
        SetBlackMeter(FMath::Clamp(GetBlackMeter(), 0.f, GetMaxBlackMeter()));
    }
}

// ---------------------------------------------------------------------------
// Rep Notifiers
// ---------------------------------------------------------------------------

void UBlackAttributeSet::OnRep_Health(const FGameplayAttributeData& OldHealth)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UBlackAttributeSet, Health, OldHealth);
}

void UBlackAttributeSet::OnRep_MaxHealth(const FGameplayAttributeData& OldMaxHealth)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UBlackAttributeSet, MaxHealth, OldMaxHealth);
}

void UBlackAttributeSet::OnRep_ShadowMeter(const FGameplayAttributeData& OldShadowMeter)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UBlackAttributeSet, ShadowMeter, OldShadowMeter);
}

void UBlackAttributeSet::OnRep_MaxShadowMeter(const FGameplayAttributeData& OldMaxShadowMeter)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UBlackAttributeSet, MaxShadowMeter, OldMaxShadowMeter);
}

void UBlackAttributeSet::OnRep_BlackMeter(const FGameplayAttributeData& OldBlackMeter)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UBlackAttributeSet, BlackMeter, OldBlackMeter);
}

void UBlackAttributeSet::OnRep_MaxBlackMeter(const FGameplayAttributeData& OldMaxBlackMeter)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UBlackAttributeSet, MaxBlackMeter, OldMaxBlackMeter);
}

void UBlackAttributeSet::OnRep_AttackPower(const FGameplayAttributeData& OldAttackPower)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UBlackAttributeSet, AttackPower, OldAttackPower);
}

void UBlackAttributeSet::OnRep_Defense(const FGameplayAttributeData& OldDefense)
{
    GAMEPLAYATTRIBUTE_REPNOTIFY(UBlackAttributeSet, Defense, OldDefense);
}
