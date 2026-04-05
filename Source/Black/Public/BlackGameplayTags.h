// Copyright (c) BLACK Game. All Rights Reserved.
#pragma once

#include "NativeGameplayTags.h"

/**
 * Centralized native Gameplay Tag declarations for BLACK.
 * Tags are defined in BlackGameplayTags.cpp.
 * Blueprint-only tags (ability, effect tags, etc.) live in the Project Settings tag table.
 */
namespace BlackGameplayTags
{
    // ---------------------------------------------------------------------------
    // Character State Tags
    // ---------------------------------------------------------------------------

    /** Character is currently performing an attack */
    BLACK_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(State_Attacking);

    /** Character is currently dodging / flickering */
    BLACK_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(State_Dodging);

    /** Character is dead */
    BLACK_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(State_Dead);

    /** Character is sprinting */
    BLACK_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(State_Sprinting);

    /** Character is sliding */
    BLACK_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(State_Sliding);

    /** Character is performing the Flicker ability */
    BLACK_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(State_Flickering);

    /** Character has activated BLACK State (super mode) */
    BLACK_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(State_InBlackState);

    /** Character is locked onto a target */
    BLACK_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(State_LockedOn);

    // ---------------------------------------------------------------------------
    // Ability Input Tags  (matches Enhanced Input action names)
    // ---------------------------------------------------------------------------

    BLACK_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(InputTag_LightAttack);
    BLACK_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(InputTag_HeavyAttack);
    BLACK_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(InputTag_Flicker);
    BLACK_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(InputTag_Ability1);
    BLACK_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(InputTag_Ability2);
    BLACK_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(InputTag_Ability3);
    BLACK_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(InputTag_Ability4);
    BLACK_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(InputTag_BlackState);
}
