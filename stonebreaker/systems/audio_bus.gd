extends Node

## SFX / music router with per-bus ducking.
## All AudioStream assignment is handled via @export slots on individual nodes.
## This autoload manages bus volumes and crossfading only.

const BUS_MASTER: StringName = &"Master"
const BUS_MUSIC: StringName = &"Music"
const BUS_SFX: StringName = &"SFX"
const BUS_VOICE: StringName = &"Voice"

# Active duck tweens keyed by bus name.
var _duck_tweens: Dictionary = {}


func play_sfx(stream: AudioStream, pitch_variance: float = 0.0) -> void:
	if stream == null:
		return
	var player := AudioStreamPlayer.new()
	add_child(player)
	player.stream = stream
	player.bus = BUS_SFX
	if pitch_variance > 0.0:
		player.pitch_scale = 1.0 + randf_range(-pitch_variance, pitch_variance)
	player.play()
	player.finished.connect(player.queue_free)


func play_music(stream: AudioStream, fade_time: float = 1.0) -> void:
	if stream == null:
		return
	# Stub: full crossfade implemented in Module 13.
	pass


func duck(bus: StringName, amount: float, duration: float) -> void:
	var bus_idx: int = AudioServer.get_bus_index(bus)
	if bus_idx < 0:
		return
	var tween: Tween = create_tween()
	_duck_tweens[bus] = tween
	var current_db: float = AudioServer.get_bus_volume_db(bus_idx)
	tween.tween_method(
		func(v: float) -> void: AudioServer.set_bus_volume_db(bus_idx, v),
		current_db,
		current_db - amount,
		duration * 0.3
	)
	tween.tween_method(
		func(v: float) -> void: AudioServer.set_bus_volume_db(bus_idx, v),
		current_db - amount,
		current_db,
		duration * 0.7
	)
