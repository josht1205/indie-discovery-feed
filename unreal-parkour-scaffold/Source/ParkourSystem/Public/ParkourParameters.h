#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "ParkourParameters.generated.h"

class UAnimMontage;
class UCurveFloat;

/**
 * Single source of truth for designer-tweakable parkour values.
 * Keeping this in a UPrimaryDataAsset lets you ship multiple variants (e.g. an
 * "Athletic" preset and a "Heavy" preset) and swap them at runtime via
 * UMoverParkourComponent::Parameters without recompiling.
 *
 * IMPORTANT: do not move per-instance state (cooldown timers, current side,
 * etc.) into this asset — DataAssets are shared across actors.
 */
UCLASS(BlueprintType)
class PARKOURSYSTEM_API UParkourParameters : public UPrimaryDataAsset
{
	GENERATED_BODY()

public:
	// =============================================================================
	// Wall Run
	// =============================================================================

	/** Lateral trace distance from the capsule center for runnable-wall detection. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="WallRun", meta=(ClampMin="10.0", Units="cm"))
	float WallRunTraceDistance = 75.f;

	/** Minimum planar speed required to enter wall-run. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="WallRun", meta=(ClampMin="0.0", Units="cm/s"))
	float WallRunMinEntrySpeed = 350.f;

	/** Maximum continuous wall-run duration before the layered move ends itself. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="WallRun", meta=(ClampMin="0.1", Units="s"))
	float WallRunMaxDuration = 2.5f;

	/** Gravity scalar while wall-running (0 = none, 1 = full). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="WallRun", meta=(ClampMin="0.0", ClampMax="1.0"))
	float WallRunGravityScale = 0.25f;

	/** Forward target speed projected along the wall tangent. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="WallRun", meta=(ClampMin="0.0", Units="cm/s"))
	float WallRunForwardSpeed = 700.f;

	/** Force pulling the pawn toward the wall plane to keep contact. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="WallRun", meta=(ClampMin="0.0"))
	float WallRunStickForce = 800.f;

	/** Wall-jump impulse in wall-local space: X=away from wall, Y=along wall, Z=up. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="WallRun")
	FVector WallJumpImpulse = FVector(550.f, 0.f, 500.f);

	/** Cooldown after wall-run end before another wall-run can begin (prevents flicker). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="WallRun", meta=(ClampMin="0.0", Units="s"))
	float WallRunCooldown = 0.35f;

	/**
	 * Optional curve scaling forward speed over normalized run time [0..1].
	 * If null the system uses a constant WallRunForwardSpeed.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="WallRun")
	TObjectPtr<UCurveFloat> WallRunSpeedCurve;

	// =============================================================================
	// Ledge Hang
	// =============================================================================

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ledge", meta=(ClampMin="10.0", Units="cm"))
	float LedgeForwardTrace = 60.f;

	/** Minimum wall height (from feet) to qualify as a hangable ledge. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ledge", meta=(ClampMin="0.0", Units="cm"))
	float LedgeMinHeight = 110.f;

	/** Maximum reach height; anything taller is treated as un-grabbable. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ledge", meta=(ClampMin="0.0", Units="cm"))
	float LedgeMaxHeight = 240.f;

	/** Lateral shimmy speed while hanging. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ledge", meta=(ClampMin="0.0", Units="cm/s"))
	float ShimmySpeed = 90.f;

	/** Time the system continues to accept ledge grabs after leaving ground (forgiveness). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ledge", meta=(ClampMin="0.0", Units="s"))
	float LedgeForgiveness = 0.18f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ledge")
	TObjectPtr<UAnimMontage> ClimbUpMontage;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ledge")
	TObjectPtr<UAnimMontage> ShimmyLeftMontage;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ledge")
	TObjectPtr<UAnimMontage> ShimmyRightMontage;

	// =============================================================================
	// Mantle / Vault / Mount
	// =============================================================================

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Mantle", meta=(ClampMin="10.0", Units="cm"))
	float MantleForwardTrace = 80.f;

	/** Heights above this are pull-up; below are vault-class. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Mantle", meta=(ClampMin="0.0", Units="cm"))
	float VaultMaxHeight = 110.f;

	/** Depths above this disqualify a vault (treated as a pull-up onto the surface). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Mantle", meta=(ClampMin="0.0", Units="cm"))
	float VaultMaxDepth = 90.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Mantle", meta=(ClampMin="0.0", Units="cm"))
	float MantleMaxHeight = 230.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Mantle")
	TObjectPtr<UAnimMontage> VaultMontage;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Mantle")
	TObjectPtr<UAnimMontage> MantlePullUpMontage;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Mantle")
	TObjectPtr<UAnimMontage> MountMontage;

	/** Motion-warping target name used by the mantle montages. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Mantle")
	FName MantleWarpTargetName = TEXT("MantleTarget");

	// =============================================================================
	// Slide
	// =============================================================================

	/** Minimum slope angle (deg) for automatic slide engagement. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Slide", meta=(ClampMin="0.0", ClampMax="89.0", Units="deg"))
	float SlideMinSlopeAngle = 28.f;

	/** Below this speed the slide releases back to walk. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Slide", meta=(ClampMin="0.0", Units="cm/s"))
	float SlideExitSpeed = 250.f;

	// =============================================================================
	// Forgiveness / feel
	// =============================================================================

	/** Window after leaving ground where jump still triggers. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Forgiveness", meta=(ClampMin="0.0", Units="s"))
	float CoyoteTime = 0.12f;

	/** Window before landing where a buffered jump fires automatically. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Forgiveness", meta=(ClampMin="0.0", Units="s"))
	float JumpBufferTime = 0.15f;

	/** Hard cap for fall damage suppression while any parkour state is active. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Forgiveness")
	bool bSuppressFallDamageDuringParkour = true;
};
