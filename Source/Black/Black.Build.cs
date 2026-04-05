// Copyright (c) BLACK Game. All Rights Reserved.

using UnrealBuildTool;

public class Black : ModuleRules
{
    public Black(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "InputCore",
            "EnhancedInput",
            "GameplayAbilities",
            "GameplayTags",
            "GameplayTasks",
            "AIModule",
            "NavigationSystem",
        });

        PrivateDependencyModuleNames.AddRange(new string[]
        {
            "NetCore",
        });

        // Allow Blueprint access to GAS types
        PublicIncludePaths.AddRange(new string[]
        {
            "Black/Public",
        });
    }
}
