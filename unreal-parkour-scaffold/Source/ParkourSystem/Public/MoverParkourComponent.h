#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "GameplayTagContainer.h"
#include "ParkourTypes.h"
#include "MoverParkourComponent.generated.h"

class UMoverComponent;
class UParkourParameters;
struct FLayeredMoveBase;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnParkourStateChanged, FGameplayTag, NewState);

/**
 * Sidecar component that lives on a Mover-driven character (e.g. the GASP
 * SandboxCharacterMover BP) and orchestrates parkour:
 *
 *   - Owns the FParkourParameters reference (designer-tunable values).
 *   - Runs detection (FindRunnableWall / FindLedge / FindMantleTarget).
 *   - Translates Enhanced Input intents into Mover layered-move queues.
 *   - Tracks local feel timers (coyote, jump-buffer, last-wall-run cooldown).
 *
 * Replication note: this component intentionally does NOT use DOREPLIFETIME
 * on its movement state. Mover 2.0 owns its own client-prediction pipeline
 * and rolls back via FMoverDefaultSyncState. Per-frame parkour state is
 * authored as data tags on the sync state by the layered moves themselves;
 * this component only holds *intent* and *cooldown* fields, which are
 * locally rebuilt during rollback.
 */
UCLASS(ClassGroup=(Parkour), meta=(BlueprintSpawnableComponent))
class PARKOURSYSTEM_API UMoverParkourComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UMoverParkourComponent();

	virtual void BeginPlay() override;
	virtual void TickComponent(float DeltaSeconds, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	/** Designer-tweakable values. Required — component is inert without one. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Parkour")
	TObjectPtr<UParkourParameters> Parameters;

	/** Broadcast when the parkour state tag changes (UI, audio, vfx hooks). */
	UPROPERTY(BlueprintAssignable, Category="Parkour")
	FOnParkourStateChanged OnParkourStateChanged;

	// =============================================================================
	// Input intent — call from Enhanced Input handlers (BP or C++).
	// These do NOT immediately drive movement; they set intent flags consumed by
	// TickComponent so behavior remains predictable under rollback.
	// =============================================================================

	UFUNCTION(BlueprintCallable, Category="Parkour|Input")
	void RequestJump();

	UFUNCTION(BlueprintCallable, Category="Parkour|Input")
	void ReleaseJump();

	UFUNCTION(BlueprintCallable, Category="Parkour|Input")
	void SetSprintHeld(bool bHeld);

	UFUNCTION(BlueprintCallable, Category="Parkour|Input")
	void SetCrouchHeld(bool bHeld);

	UFUNCTION(BlueprintCallable, Category="Parkour|Input")
	void RequestMantle();

	// =============================================================================
	// Detection — pure helpers; safe to call from Animation Blueprints and AI.
	// =============================================================================

	UFUNCTION(BlueprintCallable, BlueprintPure=false, Category="Parkour|Detection")
	FWallRunHit FindRunnableWall() const;

	UFUNCTION(BlueprintCallable, BlueprintPure=false, Category="Parkour|Detection")
	FLedgeHit FindLedge() const;

	UFUNCTION(BlueprintCallable, BlueprintPure=false, Category="Parkour|Detection")
	FMantleHit FindMantleTarget() const;

	// =============================================================================
	// State queries
	// =============================================================================

	UFUNCTION(BlueprintCallable, BlueprintPure, Category="Parkour|State")
	FGameplayTag GetParkourState() const { return CurrentStateTag; }

	UFUNCTION(BlueprintCallable, BlueprintPure, Category="Parkour|State")
	bool IsWallRunning() const;

	UFUNCTION(BlueprintCallable, BlueprintPure, Category="Parkour|State")
	bool IsHangingOnLedge() const { return CurrentStateTag == ParkourTags::State_LedgeHang; }

	/**
	 * Used by layered moves to publish their state back to the component so
	 * gameplay tags / animation queries / UI all see a single source of truth.
	 */
	void SetParkourState(FGameplayTag NewState);

protected:
	/** Cached on BeginPlay. Owned by the same actor. */
	UPROPERTY(Transient)
	TObjectPtr<UMoverComponent> MoverComponent;

	/** Authoritative-feeling state tag, mirrored into Mover sync state by layered moves. */
	UPROPERTY(Transient, BlueprintReadOnly, Category="Parkour")
	FGameplayTag CurrentStateTag;

	// === Local feel timers (regenerated on rollback — do not replicate) ===
	float TimeSinceGrounded = 1e6f;
	float JumpBufferRemaining = 0.f;
	float LastWallRunEndTime = -1e6f;
	bool bJumpHeld = false;
	bool bSprintHeld = false;
	bool bCrouchHeld = false;

private:
	bool TryStartWallRun();
	bool TryStartLedgeHang();
	bool TryStartMantle();
	bool TryStartSlide();

	/** Push a layered move onto the Mover simulation. See .cpp for binding notes. */
	void EnqueueLayeredMove(TSharedRef<FLayeredMoveBase> Move);

	/** Trace channel used by all parkour probes. Override per project as needed. */
	ECollisionChannel GetParkourTraceChannel() const;

	FVector GetOwnerForward2D() const;
	FVector GetOwnerVelocityWS() const;
	FVector GetCapsuleFeetLocation() const;
	float   GetCapsuleHalfHeight() const;
	float   GetCapsuleRadius() const;
	bool    IsGrounded() const;
};
