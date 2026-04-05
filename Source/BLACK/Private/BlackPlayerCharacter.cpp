// Copyright BLACK. All Rights Reserved.
#include "BlackPlayerCharacter.h"

#include "Camera/CameraComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "InputActionValue.h"

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------
ABlackPlayerCharacter::ABlackPlayerCharacter()
{
	PrimaryActorTick.bCanEverTick = true;

	// ------------------------------------------------------------------
	// Character rotation – orient to movement, NOT locked to camera yaw
	// ------------------------------------------------------------------
	bUseControllerRotationYaw   = false;
	bUseControllerRotationPitch = false;
	bUseControllerRotationRoll  = false;

	// ------------------------------------------------------------------
	// CharacterMovementComponent
	// ------------------------------------------------------------------
	UCharacterMovementComponent* CMC = GetCharacterMovement();

	CMC->MaxWalkSpeed                 = WalkSpeed;
	CMC->MaxAcceleration              = MaxAcceleration;
	CMC->BrakingDecelerationWalking   = BrakingDecelerationWalking;
	CMC->AirControl                   = AirControl;
	CMC->GravityScale                 = GravityScale;
	CMC->RotationRate                 = FRotator(0.f, RotationRateYaw, 0.f);
	CMC->bOrientRotationToMovement    = true;
	CMC->bUseControllerDesiredRotation = false;

	// ------------------------------------------------------------------
	// Spring Arm
	// ------------------------------------------------------------------
	SpringArm = CreateDefaultSubobject<USpringArmComponent>(TEXT("SpringArm"));
	SpringArm->SetupAttachment(RootComponent);
	SpringArm->TargetArmLength        = SpringArmLength;
	SpringArm->SocketOffset           = SpringArmSocketOffset;
	SpringArm->bUsePawnControlRotation = true;
	SpringArm->bEnableCameraLag       = true;
	SpringArm->CameraLagSpeed         = CameraLagSpeed;

	// ------------------------------------------------------------------
	// Camera
	// ------------------------------------------------------------------
	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
	Camera->SetupAttachment(SpringArm, USpringArmComponent::SocketName);
	Camera->bUsePawnControlRotation = false;   // spring arm handles it
	Camera->FieldOfView             = CameraFOV;

	// ------------------------------------------------------------------
	// Jump defaults
	// ------------------------------------------------------------------
	JumpMaxCount          = 1; // we manage second jump manually
	GetCharacterMovement()->JumpZVelocity = FirstJumpVelocity;
}

// ---------------------------------------------------------------------------
// BeginPlay – register Enhanced Input mapping context
// ---------------------------------------------------------------------------
void ABlackPlayerCharacter::BeginPlay()
{
	Super::BeginPlay();

	if (APlayerController* PC = Cast<APlayerController>(Controller))
	{
		if (UEnhancedInputLocalPlayerSubsystem* Subsystem =
			ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()))
		{
			if (DefaultMappingContext)
			{
				Subsystem->AddMappingContext(DefaultMappingContext, 0);
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Input binding
// ---------------------------------------------------------------------------
void ABlackPlayerCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);

	if (UEnhancedInputComponent* EIC = Cast<UEnhancedInputComponent>(PlayerInputComponent))
	{
		if (IA_Move)
		{
			EIC->BindAction(IA_Move, ETriggerEvent::Triggered, this, &ABlackPlayerCharacter::Move);
		}
		if (IA_Look)
		{
			EIC->BindAction(IA_Look, ETriggerEvent::Triggered, this, &ABlackPlayerCharacter::Look);
		}
		if (IA_Jump)
		{
			EIC->BindAction(IA_Jump, ETriggerEvent::Started, this, &ABlackPlayerCharacter::Jump);
		}
		if (IA_Sprint)
		{
			EIC->BindAction(IA_Sprint, ETriggerEvent::Started,   this, &ABlackPlayerCharacter::SprintStart);
			EIC->BindAction(IA_Sprint, ETriggerEvent::Completed, this, &ABlackPlayerCharacter::SprintEnd);
		}
	}
}

// ---------------------------------------------------------------------------
// Move – camera-relative movement
// ---------------------------------------------------------------------------
void ABlackPlayerCharacter::Move(const FInputActionValue& Value)
{
	const FVector2D AxisValue = Value.Get<FVector2D>();
	if (!Controller || AxisValue.IsNearlyZero())
	{
		return;
	}

	// Use only the controller's yaw so the direction is camera-relative
	// but not pitched (stays on the horizontal plane).
	const FRotator YawRotation(0.f, Controller->GetControlRotation().Yaw, 0.f);
	const FRotationMatrix RotMatrix(YawRotation);

	const FVector ForwardDir = RotMatrix.GetUnitAxis(EAxis::X);
	const FVector RightDir   = RotMatrix.GetUnitAxis(EAxis::Y);

	// AxisValue.Y = forward/back, AxisValue.X = left/right
	AddMovementInput(ForwardDir, AxisValue.Y);
	AddMovementInput(RightDir,   AxisValue.X);
}

// ---------------------------------------------------------------------------
// Look
// ---------------------------------------------------------------------------
void ABlackPlayerCharacter::Look(const FInputActionValue& Value)
{
	const FVector2D AxisValue = Value.Get<FVector2D>();
	AddControllerYawInput(AxisValue.X);
	AddControllerPitchInput(AxisValue.Y);
}

// ---------------------------------------------------------------------------
// Sprint
// ---------------------------------------------------------------------------
void ABlackPlayerCharacter::SprintStart(const FInputActionValue& /*Value*/)
{
	GetCharacterMovement()->MaxWalkSpeed = SprintSpeed;
}

void ABlackPlayerCharacter::SprintEnd(const FInputActionValue& /*Value*/)
{
	GetCharacterMovement()->MaxWalkSpeed = WalkSpeed;
}

// ---------------------------------------------------------------------------
// Double Jump
// ---------------------------------------------------------------------------
void ABlackPlayerCharacter::Jump()
{
	if (!GetCharacterMovement()->IsFalling())
	{
		// On ground – normal first jump
		JumpCount = 1;
		GetCharacterMovement()->JumpZVelocity = FirstJumpVelocity;
		Super::Jump();
	}
	else if (JumpCount < 2)
	{
		// In air – second jump: directly set vertical velocity
		JumpCount = 2;

		FVector Velocity = GetCharacterMovement()->Velocity;
		Velocity.Z = DoubleJumpVelocity;
		GetCharacterMovement()->Velocity = Velocity;

		// Play front-flip montage if one is assigned
		if (DoubleJumpMontage)
		{
			if (UAnimInstance* AnimInstance = GetMesh()->GetAnimInstance())
			{
				AnimInstance->Montage_Play(DoubleJumpMontage);
			}
		}
	}
}

void ABlackPlayerCharacter::Landed(const FHitResult& Hit)
{
	Super::Landed(Hit);
	JumpCount = 0;
	// Restore JumpZVelocity in case it was altered
	GetCharacterMovement()->JumpZVelocity = FirstJumpVelocity;
}
