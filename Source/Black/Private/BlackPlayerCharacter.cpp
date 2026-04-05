// Copyright (c) BLACK Game. All Rights Reserved.

#include "BlackPlayerCharacter.h"
#include "BlackCombatComponent.h"
#include "BlackGameplayTags.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "EnhancedInputComponent.h"
#include "InputActionValue.h"
#include "AbilitySystemComponent.h"

ABlackPlayerCharacter::ABlackPlayerCharacter()
{
    // ------------------------------------------------------------------
    // Camera rig
    // ------------------------------------------------------------------
    SpringArm = CreateDefaultSubobject<USpringArmComponent>(TEXT("SpringArm"));
    SpringArm->SetupAttachment(GetRootComponent());
    SpringArm->TargetArmLength         = 400.f;
    SpringArm->bUsePawnControlRotation = true; // arm rotates with controller
    SpringArm->bEnableCameraLag        = true;
    SpringArm->CameraLagSpeed          = 10.f;

    FollowCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FollowCamera"));
    FollowCamera->SetupAttachment(SpringArm, USpringArmComponent::SocketName);
    FollowCamera->bUsePawnControlRotation = false; // camera inherits arm rotation

    // ------------------------------------------------------------------
    // Movement defaults  (Lyra-style: character faces movement direction)
    // ------------------------------------------------------------------
    bUseControllerRotationPitch = false;
    bUseControllerRotationYaw   = false;
    bUseControllerRotationRoll  = false;

    GetCharacterMovement()->bOrientRotationToMovement = true;
    GetCharacterMovement()->RotationRate               = FRotator(0.f, 500.f, 0.f);
    GetCharacterMovement()->JumpZVelocity              = 700.f;
    GetCharacterMovement()->AirControl                 = 0.35f;
    GetCharacterMovement()->MaxWalkSpeed               = 600.f;
    GetCharacterMovement()->MinAnalogWalkSpeed         = 20.f;
    GetCharacterMovement()->BrakingDecelerationWalking = 2000.f;

    // ------------------------------------------------------------------
    // Combat Component
    // ------------------------------------------------------------------
    CombatComponent = CreateDefaultSubobject<UBlackCombatComponent>(TEXT("CombatComponent"));
}

void ABlackPlayerCharacter::BeginPlay()
{
    Super::BeginPlay();
    // Note: the Input Mapping Context is added by ABlackPlayerController::BeginPlay
    // via the Enhanced Input Local Player Subsystem, not here.
}

// ---------------------------------------------------------------------------
// SetupPlayerInputComponent
// ---------------------------------------------------------------------------

void ABlackPlayerCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);

    UEnhancedInputComponent* EIC = CastChecked<UEnhancedInputComponent>(PlayerInputComponent);

    // Movement / Camera
    if (IA_Move)
    {
        EIC->BindAction(IA_Move, ETriggerEvent::Triggered, this, &ABlackPlayerCharacter::Input_Move);
    }
    if (IA_Look)
    {
        EIC->BindAction(IA_Look, ETriggerEvent::Triggered, this, &ABlackPlayerCharacter::Input_Look);
    }

    // Jump
    if (IA_Jump)
    {
        EIC->BindAction(IA_Jump, ETriggerEvent::Started,   this, &ABlackPlayerCharacter::Input_Jump);
        EIC->BindAction(IA_Jump, ETriggerEvent::Completed, this, &ABlackPlayerCharacter::Input_StopJumping);
    }

    // Flicker (directional dodge)
    if (IA_Flicker)
    {
        EIC->BindAction(IA_Flicker, ETriggerEvent::Started, this, &ABlackPlayerCharacter::Input_Flicker);
    }

    // Combat
    if (IA_LightAttack)
    {
        EIC->BindAction(IA_LightAttack, ETriggerEvent::Started, this, &ABlackPlayerCharacter::Input_LightAttack);
    }
    if (IA_HeavyAttack)
    {
        EIC->BindAction(IA_HeavyAttack, ETriggerEvent::Started, this, &ABlackPlayerCharacter::Input_HeavyAttack);
    }

    // Lock-On
    if (IA_LockOn)
    {
        EIC->BindAction(IA_LockOn, ETriggerEvent::Started, this, &ABlackPlayerCharacter::Input_LockOn);
    }

    // Ability slots
    if (IA_Ability1)
    {
        EIC->BindAction(IA_Ability1, ETriggerEvent::Started, this, &ABlackPlayerCharacter::Input_Ability1);
    }
    if (IA_Ability2)
    {
        EIC->BindAction(IA_Ability2, ETriggerEvent::Started, this, &ABlackPlayerCharacter::Input_Ability2);
    }
    if (IA_Ability3)
    {
        EIC->BindAction(IA_Ability3, ETriggerEvent::Started, this, &ABlackPlayerCharacter::Input_Ability3);
    }
    if (IA_Ability4)
    {
        EIC->BindAction(IA_Ability4, ETriggerEvent::Started, this, &ABlackPlayerCharacter::Input_Ability4);
    }

    // BLACK State (hold to charge, release to activate in Blueprint)
    if (IA_BlackState)
    {
        EIC->BindAction(IA_BlackState, ETriggerEvent::Started,   this, &ABlackPlayerCharacter::Input_BlackState_Pressed);
        EIC->BindAction(IA_BlackState, ETriggerEvent::Completed, this, &ABlackPlayerCharacter::Input_BlackState_Released);
    }

    // Sprint
    if (IA_Sprint)
    {
        EIC->BindAction(IA_Sprint, ETriggerEvent::Started,   this, &ABlackPlayerCharacter::Input_Sprint_Pressed);
        EIC->BindAction(IA_Sprint, ETriggerEvent::Completed, this, &ABlackPlayerCharacter::Input_Sprint_Released);
    }

    // Slide
    if (IA_Slide)
    {
        EIC->BindAction(IA_Slide, ETriggerEvent::Started, this, &ABlackPlayerCharacter::Input_Slide);
    }
}

// ---------------------------------------------------------------------------
// Input handlers
// ---------------------------------------------------------------------------

void ABlackPlayerCharacter::Input_Move(const FInputActionValue& Value)
{
    const FVector2D MovementVector = Value.Get<FVector2D>();

    if (!Controller)
    {
        return;
    }

    // Project movement onto the camera's yaw plane so the character always moves
    // relative to where the camera is pointing (standard third-person convention).
    const FRotator ControllerYaw(0.f, Controller->GetControlRotation().Yaw, 0.f);

    const FVector ForwardDirection = FRotationMatrix(ControllerYaw).GetUnitAxis(EAxis::X);
    const FVector RightDirection   = FRotationMatrix(ControllerYaw).GetUnitAxis(EAxis::Y);

    AddMovementInput(ForwardDirection, MovementVector.Y);
    AddMovementInput(RightDirection,   MovementVector.X);
}

void ABlackPlayerCharacter::Input_Look(const FInputActionValue& Value)
{
    const FVector2D LookAxisVector = Value.Get<FVector2D>();
    AddControllerYawInput(LookAxisVector.X);
    AddControllerPitchInput(LookAxisVector.Y);
}

void ABlackPlayerCharacter::Input_Jump(const FInputActionValue& Value)
{
    Jump();
}

void ABlackPlayerCharacter::Input_StopJumping(const FInputActionValue& Value)
{
    StopJumping();
}

void ABlackPlayerCharacter::Input_Flicker(const FInputActionValue& Value)
{
    if (AbilitySystemComponent)
    {
        // The Flicker ability is tagged with InputTag.Flicker.
        // GAS will find and activate the first ability that matches.
        FGameplayTagContainer FlickerTag;
        FlickerTag.AddTag(BlackGameplayTags::InputTag_Flicker);
        AbilitySystemComponent->TryActivateAbilitiesByTag(FlickerTag);
    }
}

void ABlackPlayerCharacter::Input_LightAttack(const FInputActionValue& Value)
{
    if (CombatComponent)
    {
        CombatComponent->RequestLightAttack();
    }
}

void ABlackPlayerCharacter::Input_HeavyAttack(const FInputActionValue& Value)
{
    if (CombatComponent)
    {
        CombatComponent->RequestHeavyAttack();
    }
}

void ABlackPlayerCharacter::Input_LockOn(const FInputActionValue& Value)
{
    if (AbilitySystemComponent)
    {
        FGameplayTagContainer LockOnTag;
        LockOnTag.AddTag(BlackGameplayTags::State_LockedOn);
        // Toggle: if already locked on, cancel; otherwise try to activate.
        if (AbilitySystemComponent->HasMatchingGameplayTag(BlackGameplayTags::State_LockedOn))
        {
            AbilitySystemComponent->RemoveLooseGameplayTag(BlackGameplayTags::State_LockedOn);
        }
        else
        {
            AbilitySystemComponent->AddLooseGameplayTag(BlackGameplayTags::State_LockedOn);
        }
    }
}

void ABlackPlayerCharacter::Input_Ability1(const FInputActionValue& Value)
{
    if (AbilitySystemComponent)
    {
        FGameplayTagContainer Tag;
        Tag.AddTag(BlackGameplayTags::InputTag_Ability1);
        AbilitySystemComponent->TryActivateAbilitiesByTag(Tag);
    }
}

void ABlackPlayerCharacter::Input_Ability2(const FInputActionValue& Value)
{
    if (AbilitySystemComponent)
    {
        FGameplayTagContainer Tag;
        Tag.AddTag(BlackGameplayTags::InputTag_Ability2);
        AbilitySystemComponent->TryActivateAbilitiesByTag(Tag);
    }
}

void ABlackPlayerCharacter::Input_Ability3(const FInputActionValue& Value)
{
    if (AbilitySystemComponent)
    {
        FGameplayTagContainer Tag;
        Tag.AddTag(BlackGameplayTags::InputTag_Ability3);
        AbilitySystemComponent->TryActivateAbilitiesByTag(Tag);
    }
}

void ABlackPlayerCharacter::Input_Ability4(const FInputActionValue& Value)
{
    if (AbilitySystemComponent)
    {
        FGameplayTagContainer Tag;
        Tag.AddTag(BlackGameplayTags::InputTag_Ability4);
        AbilitySystemComponent->TryActivateAbilitiesByTag(Tag);
    }
}

void ABlackPlayerCharacter::Input_BlackState_Pressed(const FInputActionValue& Value)
{
    if (AbilitySystemComponent)
    {
        FGameplayTagContainer Tag;
        Tag.AddTag(BlackGameplayTags::InputTag_BlackState);
        AbilitySystemComponent->TryActivateAbilitiesByTag(Tag);
    }
}

void ABlackPlayerCharacter::Input_BlackState_Released(const FInputActionValue& Value)
{
    // Blueprint ability can listen for the State_InBlackState tag removal.
}

void ABlackPlayerCharacter::Input_Sprint_Pressed(const FInputActionValue& Value)
{
    if (AbilitySystemComponent)
    {
        AbilitySystemComponent->AddLooseGameplayTag(BlackGameplayTags::State_Sprinting);
    }
    GetCharacterMovement()->MaxWalkSpeed = 900.f;
}

void ABlackPlayerCharacter::Input_Sprint_Released(const FInputActionValue& Value)
{
    if (AbilitySystemComponent)
    {
        AbilitySystemComponent->RemoveLooseGameplayTag(BlackGameplayTags::State_Sprinting);
    }
    GetCharacterMovement()->MaxWalkSpeed = 600.f;
}

void ABlackPlayerCharacter::Input_Slide(const FInputActionValue& Value)
{
    if (AbilitySystemComponent)
    {
        AbilitySystemComponent->AddLooseGameplayTag(BlackGameplayTags::State_Sliding);
        // Blueprint ability removes this tag when the slide montage ends.
    }
}
