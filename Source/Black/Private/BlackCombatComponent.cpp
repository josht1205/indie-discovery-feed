// Copyright (c) BLACK Game. All Rights Reserved.

#include "BlackCombatComponent.h"
#include "BlackCharacterBase.h"
#include "BlackGameplayTags.h"
#include "AbilitySystemComponent.h"
#include "Engine/World.h"
#include "DrawDebugHelpers.h"
#include "CollisionQueryParams.h"
#include "GameFramework/Character.h"

UBlackCombatComponent::UBlackCombatComponent()
{
    PrimaryComponentTick.bCanEverTick = false;

    // Default hit object types: Pawn and PhysicsBody.
    HitObjectTypes.Add(UEngineTypes::ConvertToObjectType(ECC_Pawn));
}

void UBlackCombatComponent::BeginPlay()
{
    Super::BeginPlay();

    OwnerCharacter = Cast<ABlackCharacterBase>(GetOwner());
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

void UBlackCombatComponent::RequestLightAttack()
{
    if (!OwnerCharacter)
    {
        return;
    }

    // If we are inside a combo window, buffer the attack.
    if (bIsAttacking && bCanCombo)
    {
        bAttackBuffered   = true;
        BufferedAttackType = EComboAttackType::Light;
        return;
    }

    // If we are already attacking but the window isn't open, ignore.
    if (bIsAttacking)
    {
        return;
    }

    CommitAttack(EComboAttackType::Light);
}

void UBlackCombatComponent::RequestHeavyAttack()
{
    if (!OwnerCharacter)
    {
        return;
    }

    if (bIsAttacking && bCanCombo)
    {
        bAttackBuffered   = true;
        BufferedAttackType = EComboAttackType::Heavy;
        return;
    }

    if (bIsAttacking)
    {
        return;
    }

    CommitAttack(EComboAttackType::Heavy);
}

void UBlackCombatComponent::OpenComboWindow()
{
    bCanCombo = true;

    // Cancel any pending reset timer while the window is open.
    if (GetWorld())
    {
        GetWorld()->GetTimerManager().ClearTimer(ComboResetTimerHandle);
    }

    // If an attack was buffered before the window opened, fire it immediately.
    if (bAttackBuffered)
    {
        bAttackBuffered = false;
        EComboAttackType BufferedType = BufferedAttackType;

        // Close the window before committing so we don't double-buffer.
        bCanCombo = false;
        CommitAttack(BufferedType);
    }
}

void UBlackCombatComponent::CloseComboWindow()
{
    bCanCombo = false;

    if (!bAttackBuffered)
    {
        // Nothing was buffered – schedule the reset.
        if (GetWorld() && ComboResetDelay > 0.f)
        {
            GetWorld()->GetTimerManager().SetTimer(
                ComboResetTimerHandle,
                this,
                &UBlackCombatComponent::ResetCombo,
                ComboResetDelay,
                false);
        }
        else
        {
            ResetCombo();
        }
    }
}

void UBlackCombatComponent::ResetCombo()
{
    if (GetWorld())
    {
        GetWorld()->GetTimerManager().ClearTimer(ComboResetTimerHandle);
    }

    CurrentComboIndex  = 0;
    bIsAttacking       = false;
    bCanCombo          = false;
    bAttackBuffered    = false;

    ClearHitActors();

    // Remove the attacking gameplay tag.
    if (OwnerCharacter && OwnerCharacter->GetAbilitySystemComponent())
    {
        OwnerCharacter->GetAbilitySystemComponent()->RemoveLooseGameplayTag(
            BlackGameplayTags::State_Attacking);
    }

    OnComboReset();
}

void UBlackCombatComponent::PerformHitDetection()
{
    if (!OwnerCharacter)
    {
        return;
    }

    ACharacter* OwnerAsCharacter = Cast<ACharacter>(OwnerCharacter);
    if (!OwnerAsCharacter || !OwnerAsCharacter->GetMesh())
    {
        return;
    }

    const FVector TraceOrigin =
        OwnerAsCharacter->GetMesh()->GetSocketLocation(WeaponSocketName);

    const FVector TraceEnd =
        TraceOrigin + OwnerAsCharacter->GetActorForwardVector() * HitDetectionReach;

    FCollisionQueryParams QueryParams;
    QueryParams.AddIgnoredActor(OwnerCharacter.Get());
    QueryParams.bTraceComplex = false;

    TArray<FHitResult> HitResults;
    GetWorld()->SweepMultiByObjectType(
        HitResults,
        TraceOrigin,
        TraceEnd,
        FQuat::Identity,
        FCollisionObjectQueryParams(HitObjectTypes),
        FCollisionShape::MakeSphere(HitDetectionRadius),
        QueryParams);

#if WITH_EDITOR
    DrawDebugSphere(GetWorld(), TraceOrigin, HitDetectionRadius, 8,
                    FColor::Red, false, 0.2f);
    DrawDebugSphere(GetWorld(), TraceEnd,    HitDetectionRadius, 8,
                    FColor::Orange, false, 0.2f);
#endif

    for (const FHitResult& Hit : HitResults)
    {
        AActor* HitActor = Hit.GetActor();
        if (!HitActor || HitActorsThisSwing.Contains(HitActor))
        {
            continue; // already hit this actor in this swing
        }

        HitActorsThisSwing.Add(HitActor);
        OnHitConfirmed(HitActor, Hit, CurrentAttackType);
    }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

void UBlackCombatComponent::CommitAttack(EComboAttackType AttackType)
{
    // Cap combo at MaxComboCount; wrap or reset.
    CurrentComboIndex = (CurrentComboIndex >= MaxComboCount) ? 1 : CurrentComboIndex + 1;
    bIsAttacking      = true;
    bCanCombo         = false;
    CurrentAttackType = AttackType;

    ClearHitActors();

    // Tag the ASC so abilities can query state.
    if (OwnerCharacter && OwnerCharacter->GetAbilitySystemComponent())
    {
        OwnerCharacter->GetAbilitySystemComponent()->AddLooseGameplayTag(
            BlackGameplayTags::State_Attacking);
    }

    // Notify Blueprint to play the appropriate montage.
    if (AttackType == EComboAttackType::Light)
    {
        OnLightAttackCommitted(CurrentComboIndex);
    }
    else
    {
        OnHeavyAttackCommitted(CurrentComboIndex);
    }
}

void UBlackCombatComponent::ClearHitActors()
{
    HitActorsThisSwing.Reset();
}
