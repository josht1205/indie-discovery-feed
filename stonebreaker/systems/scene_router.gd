extends Node

## Async scene transitions with a loading card.
## Call transition_to(path) from anywhere; SceneRouter handles fade + load.

const LOADING_CARD_SCENE: String = "res://ui/loading_card.tscn"

var _is_transitioning: bool = false


func transition_to(scene_path: String, data: Dictionary = {}) -> void:
	if _is_transitioning:
		return
	_is_transitioning = true
	EventBus.scene_transition_started.emit(scene_path)
	# Stub: loading card and ResourceLoader.load_threaded_* added in Module 12.
	_do_transition(scene_path, data)


func _do_transition(scene_path: String, _data: Dictionary) -> void:
	await get_tree().process_frame
	var packed: PackedScene = load(scene_path)
	if packed == null:
		push_error("SceneRouter: could not load scene: " + scene_path)
		_is_transitioning = false
		return
	get_tree().change_scene_to_packed(packed)
	_is_transitioning = false
	EventBus.scene_transition_finished.emit()


func reload_current() -> void:
	if _is_transitioning:
		return
	_is_transitioning = true
	await get_tree().process_frame
	get_tree().reload_current_scene()
	_is_transitioning = false
	EventBus.scene_transition_finished.emit()
