extends Node

## Central signal hub. All cross-system events are declared here.
## Emit via EventBus.signal_name.emit(...). Never connect inside EventBus itself.

# -- Player --
signal player_state_changed(new_state: String, old_state: String)
signal player_damaged(amount: int, source: Node)
signal player_died()
signal player_respawned()
signal player_shards_changed(new_total: int, delta: int)

# -- Terrakinesis --
signal terra_pound_landed(position: Vector2)
signal terra_shield_activated()
signal terra_shield_broken()
signal terra_shape_placed(coord: Vector2i)
signal terra_shape_cleared(coord: Vector2i)

# -- World / Level --
signal checkpoint_hit(position: Vector2)
signal act_complete(zone: int, act: int, time: float)
signal zone_complete(zone: int)
signal boss_defeated(boss_id: String)
signal destructible_broken(coord: Vector2i, layer_node: Node)

# -- Camera --
signal camera_shake(amount: float, duration: float)

# -- UI / Flow --
signal pause_requested()
signal cutscene_started(cutscene_id: String)
signal cutscene_ended(cutscene_id: String)
signal scene_transition_started(target: String)
signal scene_transition_finished()
