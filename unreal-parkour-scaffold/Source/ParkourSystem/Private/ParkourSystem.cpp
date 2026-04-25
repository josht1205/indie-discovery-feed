#include "ParkourSystem.h"
#include "ParkourTypes.h"

IMPLEMENT_MODULE(FParkourSystemModule, ParkourSystem)

namespace ParkourTags
{
	UE_DEFINE_GAMEPLAY_TAG(State_WallRun_Left,    "Parkour.State.WallRun.Left");
	UE_DEFINE_GAMEPLAY_TAG(State_WallRun_Right,   "Parkour.State.WallRun.Right");
	UE_DEFINE_GAMEPLAY_TAG(State_LedgeHang,       "Parkour.State.LedgeHang");
	UE_DEFINE_GAMEPLAY_TAG(State_Mantle_Vault,    "Parkour.State.Mantle.Vault");
	UE_DEFINE_GAMEPLAY_TAG(State_Mantle_PullUp,   "Parkour.State.Mantle.PullUp");
	UE_DEFINE_GAMEPLAY_TAG(State_Mantle_Mount,    "Parkour.State.Mantle.Mount");
	UE_DEFINE_GAMEPLAY_TAG(State_Slide,           "Parkour.State.Slide");
}

void FParkourSystemModule::StartupModule() {}
void FParkourSystemModule::ShutdownModule() {}
