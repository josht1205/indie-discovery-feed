// Copyright (c) BLACK Game. All Rights Reserved.
#pragma once

#include "CoreMinimal.h"
#include "BlackCharacterBase.h"
#include "InputActionValue.h"
#include "BlackPlayerCharacter.generated.h"

class USpringArmComponent;
class UCameraComponent;
class UInputMappingContext;
class UInputAction;
class UBlackCombatComponent;

/**
 * ABlackPlayerCharacter
 *
 * The player-controlled character for BLACK.
 * C++ owns: camera rig, Enhanced Input bindings, movement maths.
 * Blueprint owns: meshes, montages, VFX, specific ability classes.
 *
 * Input architecture:
 *   ABlackPlayerController adds IMC_Hikari to the local player subsystem.
 *   Each UInputAction UPROPERTY here is assigned in the character Blueprint's
 *   class defaults so designers can remap without recompiling.
 *
 * Movement:
 *   Move() projects the 2-D stick input onto the camera's yaw plane so the
 *   character always moves relative to where the camera is looking.
 */
UCLASS(BlueprintType, Blueprintable)
class BLACK_API ABlackPlayerCharacter : public ABlackCharacterBase
{
    GENERATED_BODY()

public:
    ABlackPlayerCharacter();

    // ------------------------------------------------------------------
    // ACharacter / AActor overrides
    // ------------------------------------------------------------------
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
    virtual void BeginPlay() override;

    // ------------------------------------------------------------------
    // Camera rig
    // ------------------------------------------------------------------

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Black|Camera", meta = (AllowPrivateAccess = "true"))
    TObjectPtr<USpringArmComponent> SpringArm;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Black|Camera", meta = (AllowPrivateAccess = "true"))
    TObjectPtr<UCameraComponent> FollowCamera;

    // ------------------------------------------------------------------
    // Components
    // ------------------------------------------------------------------

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Black|Combat", meta = (AllowPrivateAccess = "true"))
    TObjectPtr<UBlackCombatComponent> CombatComponent;

    // ------------------------------------------------------------------
    // Enhanced Input: Mapping Context
    // (Actual add is done by ABlackPlayerController, but we keep a ref
    //  here so Blueprint can override if needed.)
    // ------------------------------------------------------------------

    /** Primary mapping context – assigned in Blueprint class defaults. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|Input")
    TObjectPtr<UInputMappingContext> DefaultMappingContext;

    // ------------------------------------------------------------------
    // Enhanced Input: Action References
    // All assigned in the Blueprint class defaults (EditDefaultsOnly).
    // ------------------------------------------------------------------

    /** 2-axis movement (WASD / left stick). */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|Input|Actions")
    TObjectPtr<UInputAction> IA_Move;

    /** 2-axis camera look (mouse / right stick). */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|Input|Actions")
    TObjectPtr<UInputAction> IA_Look;

    /** Jump / double-jump. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|Input|Actions")
    TObjectPtr<UInputAction> IA_Jump;

    /** Flicker dash (directional teleport). */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|Input|Actions")
    TObjectPtr<UInputAction> IA_Flicker;

    /** Light attack chain. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|Input|Actions")
    TObjectPtr<UInputAction> IA_LightAttack;

    /** Heavy / charged attack. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|Input|Actions")
    TObjectPtr<UInputAction> IA_HeavyAttack;

    /** Lock-on / target cycling. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|Input|Actions")
    TObjectPtr<UInputAction> IA_LockOn;

    /** Mapped ability slot 1. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|Input|Actions")
    TObjectPtr<UInputAction> IA_Ability1;

    /** Mapped ability slot 2. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|Input|Actions")
    TObjectPtr<UInputAction> IA_Ability2;

    /** Mapped ability slot 3. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|Input|Actions")
    TObjectPtr<UInputAction> IA_Ability3;

    /** Mapped ability slot 4. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|Input|Actions")
    TObjectPtr<UInputAction> IA_Ability4;

    /** Activate BLACK State (ultimate). */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|Input|Actions")
    TObjectPtr<UInputAction> IA_BlackState;

    /** Sprint modifier. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|Input|Actions")
    TObjectPtr<UInputAction> IA_Sprint;

    /** Slide. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Black|Input|Actions")
    TObjectPtr<UInputAction> IA_Slide;

protected:
    // ------------------------------------------------------------------
    // Input handlers – all called by Enhanced Input bindings
    // ------------------------------------------------------------------
    void Input_Move(const FInputActionValue& Value);
    void Input_Look(const FInputActionValue& Value);
    void Input_Jump(const FInputActionValue& Value);
    void Input_StopJumping(const FInputActionValue& Value);

    void Input_Flicker(const FInputActionValue& Value);

    void Input_LightAttack(const FInputActionValue& Value);
    void Input_HeavyAttack(const FInputActionValue& Value);

    void Input_LockOn(const FInputActionValue& Value);

    void Input_Ability1(const FInputActionValue& Value);
    void Input_Ability2(const FInputActionValue& Value);
    void Input_Ability3(const FInputActionValue& Value);
    void Input_Ability4(const FInputActionValue& Value);

    void Input_BlackState_Pressed(const FInputActionValue& Value);
    void Input_BlackState_Released(const FInputActionValue& Value);

    void Input_Sprint_Pressed(const FInputActionValue& Value);
    void Input_Sprint_Released(const FInputActionValue& Value);

    void Input_Slide(const FInputActionValue& Value);
};
