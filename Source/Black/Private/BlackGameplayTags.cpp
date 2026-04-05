// Copyright (c) BLACK Game. All Rights Reserved.

#include "BlackGameplayTags.h"

namespace BlackGameplayTags
{
    // Character State Tags
    UE_DEFINE_GAMEPLAY_TAG(State_Attacking,    "State.Attacking");
    UE_DEFINE_GAMEPLAY_TAG(State_Dodging,      "State.Dodging");
    UE_DEFINE_GAMEPLAY_TAG(State_Dead,         "State.Dead");
    UE_DEFINE_GAMEPLAY_TAG(State_Sprinting,    "State.Sprinting");
    UE_DEFINE_GAMEPLAY_TAG(State_Sliding,      "State.Sliding");
    UE_DEFINE_GAMEPLAY_TAG(State_Flickering,   "State.Flickering");
    UE_DEFINE_GAMEPLAY_TAG(State_InBlackState, "State.InBlackState");
    UE_DEFINE_GAMEPLAY_TAG(State_LockedOn,     "State.LockedOn");

    // Ability Input Tags
    UE_DEFINE_GAMEPLAY_TAG(InputTag_LightAttack, "InputTag.LightAttack");
    UE_DEFINE_GAMEPLAY_TAG(InputTag_HeavyAttack, "InputTag.HeavyAttack");
    UE_DEFINE_GAMEPLAY_TAG(InputTag_Flicker,     "InputTag.Flicker");
    UE_DEFINE_GAMEPLAY_TAG(InputTag_Ability1,    "InputTag.Ability1");
    UE_DEFINE_GAMEPLAY_TAG(InputTag_Ability2,    "InputTag.Ability2");
    UE_DEFINE_GAMEPLAY_TAG(InputTag_Ability3,    "InputTag.Ability3");
    UE_DEFINE_GAMEPLAY_TAG(InputTag_Ability4,    "InputTag.Ability4");
    UE_DEFINE_GAMEPLAY_TAG(InputTag_BlackState,  "InputTag.BlackState");
}
