// CombatSystem — resolves hit detection, applies damage, fires events
import { System }          from '../ecs/System';
import { CombatComponent } from './CombatComponent';
import { HealthComponent } from './HealthComponent';
import { Transform }       from '../math/Transform';
import { Vec2 }            from '../math/Vec2';
import { RigidBody }       from '../physics/RigidBody';

export interface DamageEvent {
  attacker:  number;  // entity id
  defender:  number;
  damage:    number;
  knockback: Vec2;
}

export class CombatSystem extends System {
  priority = 20;

  override fixedUpdate(dt: number): void {
    const combatants = this.world.query(CombatComponent, Transform, HealthComponent);

    // Tick cooldowns / statuses
    for (const e of combatants) {
      const combat = e.requireComponent(CombatComponent);
      const health = e.requireComponent(HealthComponent);
      combat.update(dt);
      health.update(dt);

      // Apply poison/burning DoT
      for (const s of combat.statuses) {
        if (s.dps) health.takeDamage(s.dps * dt);
      }
    }

    // Hit detection
    for (const attacker of combatants) {
      const aCombat = attacker.requireComponent(CombatComponent);
      if (!aCombat.isAttacking) continue;
      const aTf = attacker.requireComponent(Transform);

      for (const defender of combatants) {
        if (attacker === defender) continue;
        const dCombat = defender.requireComponent(CombatComponent);
        if (aCombat.team === dCombat.team) continue;  // friendly fire off

        const dHealth = defender.requireComponent(HealthComponent);
        if (dHealth.isInvincible || dHealth.isDead) continue;

        const dTf = defender.requireComponent(Transform);
        const atk = aCombat.attacks[aCombat.comboStep] ?? aCombat.attacks[0];
        if (!atk) continue;

        const dist = aTf.position.distanceTo(dTf.position);
        if (dist > atk.hitRadius) continue;

        // Apply damage
        const finalDamage = atk.damage * aCombat.baseDamage / 10 * aCombat.getDamageMultiplier();
        const dealt = dHealth.takeDamage(finalDamage);

        // Apply knockback
        if (dealt > 0) {
          const dir = dTf.position.sub(aTf.position).normalize();
          const kb  = dir.mul(atk.knockback.length());

          const dBody = defender.getComponent(RigidBody);
          if (dBody) dBody.applyImpulse(kb.x, kb.y);

          this.world.events.emit<DamageEvent>('damage', {
            attacker: attacker.id, defender: defender.id,
            damage: dealt, knockback: kb,
          });

          if (dHealth.isDead) {
            this.world.events.emit('entity:killed', { killer: attacker.id, victim: defender.id });
          }
        }
      }
    }
  }
}
