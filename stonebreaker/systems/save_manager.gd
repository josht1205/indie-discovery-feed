extends Node

## JSON save / load with three slots and atomic writes.
## Reads from / writes to GameState. Call save(slot) / load_slot(slot).

const SAVE_DIR: String = "user://"
const SLOT_COUNT: int = 3


func get_save_path(slot: int) -> String:
	return SAVE_DIR + "save_slot_%d.json" % slot


func save(slot: int) -> void:
	if slot < 0 or slot >= SLOT_COUNT:
		push_error("SaveManager: invalid slot %d" % slot)
		return
	var data: Dictionary = _serialize()
	var json_text: String = JSON.stringify(data, "\t")
	var tmp_path: String = get_save_path(slot) + ".tmp"
	var file := FileAccess.open(tmp_path, FileAccess.WRITE)
	if file == null:
		push_error("SaveManager: could not open tmp file for writing.")
		return
	file.store_string(json_text)
	file.close()
	# Atomic rename: replace target with temp to avoid corruption on crash.
	DirAccess.rename_absolute(tmp_path, get_save_path(slot))


func load_slot(slot: int) -> bool:
	if slot < 0 or slot >= SLOT_COUNT:
		push_error("SaveManager: invalid slot %d" % slot)
		return false
	var path: String = get_save_path(slot)
	if not FileAccess.file_exists(path):
		return false
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return false
	var json_text: String = file.get_as_text()
	file.close()
	var parsed = JSON.parse_string(json_text)
	if parsed == null or not parsed is Dictionary:
		push_error("SaveManager: corrupt save at slot %d — starting fresh." % slot)
		return false
	_deserialize(parsed)
	return true


func slot_exists(slot: int) -> bool:
	return FileAccess.file_exists(get_save_path(slot))


func delete_slot(slot: int) -> void:
	var path: String = get_save_path(slot)
	if FileAccess.file_exists(path):
		DirAccess.remove_absolute(path)


func _serialize() -> Dictionary:
	return {
		"shards": GameState.shards,
		"lives": GameState.lives,
		"current_zone": GameState.current_zone,
		"current_act": GameState.current_act,
		"checkpoint_pos": {"x": GameState.checkpoint_pos.x, "y": GameState.checkpoint_pos.y},
		"unlocks": GameState.unlocks.duplicate(),
		"boss_defeats": GameState.boss_defeats.duplicate(),
		"total_playtime": GameState.total_playtime,
		"best_times": GameState.best_times.duplicate(),
	}


func _deserialize(data: Dictionary) -> void:
	GameState.shards = data.get("shards", 0)
	GameState.lives = data.get("lives", 3)
	GameState.current_zone = data.get("current_zone", 1)
	GameState.current_act = data.get("current_act", 1)
	var cp: Dictionary = data.get("checkpoint_pos", {"x": 0.0, "y": 0.0})
	GameState.checkpoint_pos = Vector2(cp.get("x", 0.0), cp.get("y", 0.0))
	GameState.unlocks = data.get("unlocks", GameState.unlocks.duplicate())
	var defeats = data.get("boss_defeats", [])
	GameState.boss_defeats.clear()
	for d in defeats:
		GameState.boss_defeats.append(str(d))
	GameState.total_playtime = data.get("total_playtime", 0.0)
	GameState.best_times = data.get("best_times", {})
