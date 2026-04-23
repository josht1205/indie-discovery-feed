extends Node2D

## Module 01 smoke test.
## Verifies: InputBuffer auto-buffers jump/action, is_buffered() reads correctly,
## consume() clears the buffer, and state changes emit through EventBus.

@onready var _label: Label = $Label


func _ready() -> void:
	print("=== INPUT SMOKE TEST STARTED ===")
	print("Keys: SPACE = jump   Z/C = action   ESC = quit")

	if not is_instance_valid(InputBuffer):
		push_error("InputBuffer autoload not found — check Project > Autoloads")
		return

	if not is_instance_valid(EventBus):
		push_error("EventBus autoload not found — check Project > Autoloads")
		return

	print("✅ InputBuffer autoload OK")
	print("✅ EventBus autoload OK")

	EventBus.player_state_changed.connect(_on_state_changed)
	EventBus.player_state_changed.emit("Idle", "SmokeTestStarted")


func _physics_process(_delta: float) -> void:
	if not is_instance_valid(InputBuffer):
		return

	var status: Array[String] = []

	for action: String in ["jump", "action"]:
		if InputBuffer.is_buffered(action):
			status.append("%s: BUFFERED" % action)
			InputBuffer.consume(action)
			print("✅ %s consumed from buffer" % action)
			EventBus.player_state_changed.emit("Consumed", action)

	if _label != null:
		_label.text = "\n".join(status) if not status.is_empty() else "Waiting for input…"


func _on_state_changed(new_state: String, old_state: String) -> void:
	print("[EventBus] player_state_changed: %s → %s" % [old_state, new_state])
