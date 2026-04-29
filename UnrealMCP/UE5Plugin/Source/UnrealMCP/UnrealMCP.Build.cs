// Copyright (c) Indie Discovery. Licensed under MIT.

using UnrealBuildTool;

public class UnrealMCP : ModuleRules
{
	public UnrealMCP(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;
		bUseUnity = false;

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"HTTP",
			"HTTPServer",
			"Json",
			"JsonUtilities"
		});

		PrivateDependencyModuleNames.AddRange(new string[]
		{
			"Slate",
			"SlateCore",
			"InputCore",
			"UnrealEd",
			"EditorSubsystem",
			"EditorScriptingUtilities",
			"AssetRegistry",
			"AssetTools",
			"ContentBrowser",
			"ContentBrowserData",
			"BlueprintGraph",
			"Kismet",
			"KismetCompiler",
			"LevelEditor",
			"Projects",
			"DesktopPlatform",
			"OutputLog",
			"ToolMenus",
			"HotReload"
		});

		// Live Coding integration is optional; only available when target supports it.
		if (Target.Type == TargetType.Editor)
		{
			PrivateDependencyModuleNames.Add("LiveCoding");
		}
	}
}
