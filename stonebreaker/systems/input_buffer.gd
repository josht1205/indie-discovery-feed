extends Node

## 6-frame input buffer for jump and action inputs.
## Detection is event-driven via _input(); countdown runs in _process().
## API: is_buffered(action) -> bool, consume(action) -> void.

const BUFFER_FRAMES: int = 6
const BUFFERED_ACTIONS: Array[String] = ["jump", "action"]

# Maps action name -> display frames remaining (0 = not buffered).
var _buffer: Dictionary = {}


func _ready() -> void:
	for action: String in BUFFERED_ACTIONS:
		_buffer[action] = 0


func _input(event: InputEvent) -> void:
	for action: String in BUFFERED_ACTIONS:
		# echo:false guard prevents held-key repeats from refreshing the buffer.
		if event.is_action_pressed(action, false):
			_buffer[action] = BUFFER_FRAMES


func _process(_delta: float) -> void:
	for action: String in BUFFERED_ACTIONS:
		if _buffer[action] > 0:
			_buffer[action] -= 1


func is_buffered(action: String) -> bool:
	return _buffer.get(action, 0) > 0


func consume(action: String) -> void:
	if _buffer.has(action):
		_buffer[action] = 0
