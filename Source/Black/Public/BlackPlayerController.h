// Copyright (c) BLACK Game. All Rights Reserved.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "BlackPlayerController.generated.h"

class UInputMappingContext;

/**
 * ABlackPlayerController
 *
 * Owns the Enhanced Input subsystem setup for the local player.
 * Adds IMC_Hikari (the primary mapping context) with priority 0 on BeginPlay
 * so all input actions defined in the mapping context become active.
 *
 * Blueprint subclass (BP_BlackPlayerController) can:
 *  - Add/remove additional mapping contexts (e.g. IMC_UI, IMC_Vehicle).
 *  - Implement UI input handling (pause menu, inventory).
 *  - Override OnPossess for game-mode-specific setup.
 */
UCLASS(BlueprintType, Blueprintable)
class BLACK_API ABlackPlayerController : public APlayerController
{
    GENERATED_BODY()

public:
    ABlackPlayerController();

    // ------------------------------------------------------------------
    // Input Mapping Context
    // ------------------------------------------------------------------

    /**
     * The primary Input Mapping Context for Hikari's move set.
     * Assign IMC_Hikari in the Blueprint class defaults.
     */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|Input")
    TObjectPtr<UInputMappingContext> IMC_Hikari;

    /**
     * Priority at which IMC_Hikari is added to the local subsystem.
     * Higher priority overrides lower-priority contexts.
     */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|Input")
    int32 IMC_HikariPriority = 0;

    // ------------------------------------------------------------------
    // Utility: add / remove mapping contexts at runtime
    // (e.g. open inventory → disable character input)
    // ------------------------------------------------------------------

    UFUNCTION(BlueprintCallable, Category = "Black|Input")
    void AddMappingContext(UInputMappingContext* MappingContext, int32 Priority);

    UFUNCTION(BlueprintCallable, Category = "Black|Input")
    void RemoveMappingContext(UInputMappingContext* MappingContext);

protected:
    virtual void BeginPlay() override;
};
