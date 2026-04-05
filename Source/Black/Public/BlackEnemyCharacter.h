// Copyright (c) BLACK Game. All Rights Reserved.
#pragma once

#include "CoreMinimal.h"
#include "BlackCharacterBase.h"
#include "BlackEnemyCharacter.generated.h"

class UBehaviorTree;
class UAIPerceptionComponent;

/**
 * ABlackEnemyCharacter
 *
 * Base class for all enemies in BLACK.
 * C++ owns: ASC setup (inherited), Behavior Tree pointer, AI possession hook.
 * Blueprint owns: meshes, animations, specific BT assets, perception config.
 *
 * Each enemy Blueprint (BP_Enemy_Grunt, BP_Enemy_Boss, etc.) sets
 * BehaviorTree to the BT asset designed for that enemy type.
 */
UCLASS(BlueprintType, Blueprintable)
class BLACK_API ABlackEnemyCharacter : public ABlackCharacterBase
{
    GENERATED_BODY()

public:
    ABlackEnemyCharacter();

    // ------------------------------------------------------------------
    // AI Configuration
    // ------------------------------------------------------------------

    /**
     * The Behavior Tree to run when this enemy is possessed by an AI Controller.
     * Assign the BT_* asset in the enemy Blueprint's class defaults.
     */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|AI")
    TObjectPtr<UBehaviorTree> BehaviorTree;

    /**
     * Optional: perception component for sight / hearing / damage sensing.
     * Populated in Blueprint if a specific enemy needs custom perception config.
     */
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Black|AI", meta = (AllowPrivateAccess = "true"))
    TObjectPtr<UAIPerceptionComponent> AIPerception;

    // ------------------------------------------------------------------
    // ACharacter overrides
    // ------------------------------------------------------------------
    virtual void PossessedBy(AController* NewController) override;

    // ------------------------------------------------------------------
    // ABlackCharacterBase overrides
    // ------------------------------------------------------------------
    virtual void HandleDeath_Implementation() override;
};
