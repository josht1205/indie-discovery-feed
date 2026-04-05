// Copyright (c) BLACK Game. All Rights Reserved.

#include "BlackEnemyCharacter.h"
#include "BehaviorTree/BehaviorTree.h"
#include "AIController.h"
#include "Perception/AIPerceptionComponent.h"
#include "GameFramework/CharacterMovementComponent.h"

ABlackEnemyCharacter::ABlackEnemyCharacter()
{
    // Enemy AI rotation is driven by the movement component, not the controller yaw.
    bUseControllerRotationYaw = false;
    GetCharacterMovement()->bOrientRotationToMovement = true;
    GetCharacterMovement()->RotationRate               = FRotator(0.f, 360.f, 0.f);

    // Perception component – blueprint can add senses via AIPerceptionComponent settings.
    AIPerception = CreateDefaultSubobject<UAIPerceptionComponent>(TEXT("AIPerception"));
}

void ABlackEnemyCharacter::PossessedBy(AController* NewController)
{
    // Let the base class initialise GAS before we run the BT.
    Super::PossessedBy(NewController);

    // Only run the Behavior Tree on the server with a valid AI controller.
    if (!HasAuthority())
    {
        return;
    }

    AAIController* AIController = Cast<AAIController>(NewController);
    if (!AIController)
    {
        return;
    }

    if (!BehaviorTree)
    {
        UE_LOG(LogTemp, Warning,
               TEXT("ABlackEnemyCharacter [%s]: No BehaviorTree assigned. "
                    "Set one in the enemy Blueprint class defaults."),
               *GetName());
        return;
    }

    AIController->RunBehaviorTree(BehaviorTree);
}

void ABlackEnemyCharacter::HandleDeath_Implementation()
{
    // Call base behaviour (add Dead tag, cancel abilities, disable collision).
    Super::HandleDeath_Implementation();

    // Stop the Behavior Tree so the AI controller stops issuing commands.
    if (AAIController* AIController = Cast<AAIController>(GetController()))
    {
        AIController->StopMovement();
        AIController->BrainComponent->StopLogic(TEXT("Character is dead"));
    }

    // Blueprint's implementation of HandleDeath (via NativeEvent) will handle
    // death montage, loot spawning, and eventual actor destruction.
}
