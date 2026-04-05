// Copyright (c) BLACK Game. All Rights Reserved.

#include "BlackCharacterBase.h"
#include "BlackAttributeSet.h"
#include "BlackGameplayTags.h"
#include "AbilitySystemComponent.h"
#include "GameplayAbilitySpec.h"
#include "GameplayEffect.h"

ABlackCharacterBase::ABlackCharacterBase()
{
    // Create the ASC here; for enemies the ASC lives on the character itself.
    // For the player character we use the same topology (no player-state ASC)
    // to keep things simple. Upgrade to player-state if you need persistence.
    AbilitySystemComponent = CreateDefaultSubobject<UAbilitySystemComponent>(TEXT("AbilitySystemComponent"));
    AbilitySystemComponent->SetIsReplicated(true);
    AbilitySystemComponent->SetReplicationMode(EGameplayEffectReplicationMode::Mixed);

    AttributeSet = CreateDefaultSubobject<UBlackAttributeSet>(TEXT("AttributeSet"));
}

// ---------------------------------------------------------------------------
// IAbilitySystemInterface
// ---------------------------------------------------------------------------

UAbilitySystemComponent* ABlackCharacterBase::GetAbilitySystemComponent() const
{
    return AbilitySystemComponent;
}

// ---------------------------------------------------------------------------
// ACharacter overrides
// ---------------------------------------------------------------------------

void ABlackCharacterBase::BeginPlay()
{
    Super::BeginPlay();
}

void ABlackCharacterBase::PossessedBy(AController* NewController)
{
    Super::PossessedBy(NewController);

    // Server: initialise GAS
    InitAbilitySystem();
    InitDefaultAttributes();
}

void ABlackCharacterBase::OnRep_PlayerState()
{
    Super::OnRep_PlayerState();

    // Client: the ASC proxy must also be initialised after replication
    InitAbilitySystem();
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

void ABlackCharacterBase::InitAbilitySystem()
{
    if (!AbilitySystemComponent)
    {
        return;
    }

    // For the character-owned topology, Owner = Avatar = this character.
    AbilitySystemComponent->InitAbilityActorInfo(this, this);
}

void ABlackCharacterBase::InitDefaultAttributes()
{
    if (!AbilitySystemComponent || !HasAuthority())
    {
        return;
    }

    // Apply the initialisation Gameplay Effect (sets base attribute values).
    if (DefaultAttributeEffect)
    {
        ApplyEffectToSelf(DefaultAttributeEffect, 1.f);
    }

    // Grant default abilities.
    for (const TSubclassOf<UGameplayAbility>& AbilityClass : DefaultAbilities)
    {
        GrantAbility(AbilityClass, 1);
    }
}

// ---------------------------------------------------------------------------
// Public ability helpers
// ---------------------------------------------------------------------------

void ABlackCharacterBase::GrantAbility(TSubclassOf<UGameplayAbility> AbilityClass, int32 Level)
{
    if (!AbilitySystemComponent || !AbilityClass || !HasAuthority())
    {
        return;
    }

    FGameplayAbilitySpec Spec(AbilityClass, Level, INDEX_NONE, this);
    AbilitySystemComponent->GiveAbility(Spec);
}

bool ABlackCharacterBase::ActivateAbilityByClass(TSubclassOf<UGameplayAbility> AbilityClass)
{
    if (!AbilitySystemComponent || !AbilityClass)
    {
        return false;
    }

    return AbilitySystemComponent->TryActivateAbilityByClass(AbilityClass);
}

void ABlackCharacterBase::ApplyEffectToSelf(TSubclassOf<UGameplayEffect> EffectClass, float Level)
{
    if (!AbilitySystemComponent || !EffectClass)
    {
        return;
    }

    FGameplayEffectContextHandle ContextHandle = AbilitySystemComponent->MakeEffectContext();
    ContextHandle.AddSourceObject(this);

    const FGameplayEffectSpecHandle SpecHandle =
        AbilitySystemComponent->MakeOutgoingSpec(EffectClass, Level, ContextHandle);

    if (SpecHandle.IsValid())
    {
        AbilitySystemComponent->ApplyGameplayEffectSpecToSelf(*SpecHandle.Data.Get());
    }
}

// ---------------------------------------------------------------------------
// Death
// ---------------------------------------------------------------------------

void ABlackCharacterBase::HandleDeath_Implementation()
{
    if (bIsDead)
    {
        return;
    }

    bIsDead = true;

    // Add the Dead tag so ability activations are blocked by default.
    if (AbilitySystemComponent)
    {
        AbilitySystemComponent->AddLooseGameplayTag(BlackGameplayTags::State_Dead);
        AbilitySystemComponent->CancelAllAbilities();
    }

    // Disable collision and physics so the corpse doesn't block movement.
    GetCapsuleComponent()->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    GetCharacterMovement()->GravityScale = 0.f;
    GetCharacterMovement()->Velocity      = FVector::ZeroVector;

    // Blueprint_HandleDeath is called by Blueprintable NativeEvent above.
    // Subclasses author the death montage / ragdoll / loot there.
}

// ---------------------------------------------------------------------------
// Attribute convenience accessors
// ---------------------------------------------------------------------------

float ABlackCharacterBase::GetHealth() const
{
    return AttributeSet ? AttributeSet->GetHealth() : 0.f;
}

float ABlackCharacterBase::GetMaxHealth() const
{
    return AttributeSet ? AttributeSet->GetMaxHealth() : 0.f;
}

float ABlackCharacterBase::GetBlackMeter() const
{
    return AttributeSet ? AttributeSet->GetBlackMeter() : 0.f;
}
