// Copyright (c) project owner. Scaffold module — see unreal-parkour-scaffold/README.md.

using UnrealBuildTool;

public class ParkourSystem : ModuleRules
{
	public ParkourSystem(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		IWYUSupport = IWYUSupport.Full;

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"InputCore",
			"EnhancedInput",
			"GameplayTags",
			"MotionWarping",
			// Mover 2.0 plugin. Enable the "Mover" plugin in the .uproject.
			// The module name is "Mover".
			"Mover",
		});

		PrivateDependencyModuleNames.AddRange(new string[]
		{
			"AnimationCore",
			"Slate",
			"SlateCore",
		});
	}
}
