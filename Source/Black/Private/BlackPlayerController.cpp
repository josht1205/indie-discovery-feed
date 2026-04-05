// Copyright (c) BLACK Game. All Rights Reserved.

#include "BlackPlayerController.h"
#include "EnhancedInputSubsystems.h"
#include "InputMappingContext.h"

ABlackPlayerController::ABlackPlayerController()
{
}

void ABlackPlayerController::BeginPlay()
{
    Super::BeginPlay();

    // Only the local player needs to set up the input subsystem.
    if (!IsLocalController())
    {
        return;
    }

    if (UEnhancedInputLocalPlayerSubsystem* Subsystem =
            ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(GetLocalPlayer()))
    {
        if (IMC_Hikari)
        {
            Subsystem->AddMappingContext(IMC_Hikari, IMC_HikariPriority);
        }
        else
        {
            UE_LOG(LogTemp, Warning,
                   TEXT("ABlackPlayerController: IMC_Hikari is not assigned. "
                        "Assign it in the Blueprint class defaults."));
        }
    }
}

void ABlackPlayerController::AddMappingContext(UInputMappingContext* MappingContext, int32 Priority)
{
    if (!MappingContext || !IsLocalController())
    {
        return;
    }

    if (UEnhancedInputLocalPlayerSubsystem* Subsystem =
            ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(GetLocalPlayer()))
    {
        Subsystem->AddMappingContext(MappingContext, Priority);
    }
}

void ABlackPlayerController::RemoveMappingContext(UInputMappingContext* MappingContext)
{
    if (!MappingContext || !IsLocalController())
    {
        return;
    }

    if (UEnhancedInputLocalPlayerSubsystem* Subsystem =
            ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(GetLocalPlayer()))
    {
        Subsystem->RemoveMappingContext(MappingContext);
    }
}
