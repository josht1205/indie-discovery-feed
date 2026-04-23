extends Node

## Run-scope game data. Persisted to disk by SaveManager.
## All fields are the canonical save schema — do not add fields without
## updating SaveManager.serialize() / deserialize().

# -- Collectibles --
var shards: int = 0
var lives: int = 3

# -- Progress --
var current_zone: int = 1
var current_act: int = 1
var checkpoint_pos: Vector2 = Vector2.ZERO

# -- Unlocks (set true on boss defeat) --
var unlocks: Dictionary = {
	"terra_pound": true,
	"terra_throw": false,
	"terra_shield": false,
	"terrain_shaping": false,
}

# -- Boss defeats (boss_id strings) --
var boss_defeats: Array[String] = []

# -- Timing --
var total_playtime: float = 0.0
var best_times: Dictionary = {}   # key: "zone_X_act_Y" -> float seconds

# -- Internal session state (not saved) --
var _act_timer: float = 0.0


func _process(delta: float) -> void:
	total_playtime += delta
	_act_timer += delta


func reset_act_timer() -> void:
	_act_timer = 0.0


func get_act_timer() -> float:
	return _act_timer


func record_best_time(zone: int, act: int, time: float) -> void:
	var key: String = "zone_%d_act_%d" % [zone, act]
	if not best_times.has(key) or time < best_times[key]:
		best_times[key] = time


func add_shards(amount: int) -> void:
	shards += amount
	EventBus.player_shards_changed.emit(shards, amount)


func remove_shards(amount: int) -> void:
	var removed: int = mini(amount, shards)
	shards -= removed
	EventBus.player_shards_changed.emit(shards, -removed)


func mark_boss_defeated(boss_id: String) -> void:
	if boss_id not in boss_defeats:
		boss_defeats.append(boss_id)
		EventBus.boss_defeated.emit(boss_id)
