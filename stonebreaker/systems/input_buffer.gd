extends Node

## 6-frame input buffer for jump and action inputs.
## Call is_buffered(action) to check; consume(action) to clear.
## Other systems poll this; they do not connect to input events directly.

const BUFFER_FRAMES: int = 6
const BUFFERED_ACTIONS: Array[String] = ["jump", "action"]

# Maps action name -> frames remaining in buffer (0 = not buffered).
var _buffer: Dictionary = {}


func _ready() -> void:
	for action in BUFFERED_ACTIONS:
		_buffer[action] = 0


func _process(_delta: float) -> void:
	for action in BUFFERED_ACTIONS:
		if Input.is_action_just_pressed(action):
			_buffer[action] = BUFFER_FRAMES
		elif _buffer[action] > 0:
			_buffer[action] -= 1


func is_buffered(action: String) -> bool:
	return _buffer.get(action, 0) > 0


func consume(action: String) -> void:
	if _buffer.has(action):
		_buffer[action] = 0
