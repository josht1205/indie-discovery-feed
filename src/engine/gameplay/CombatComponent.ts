// CombatComponent — handles attacks, hit detection, and status effects
import { Component }     from '../ecs/Component';
import { Vec2 }          from '../math/Vec2';

export type DamageType = 'physical' | 'fire' | 'ice' | 'poison' | 'true';

export interface AttackData {
  damage:     number;
  type:       DamageType;
  knockback:  Vec2;
  hitRadius:  number;    // world units
  duration:   number;    // seconds the hitbox is active
  cooldown:   number;    // seconds before next attack
  comboIndex: number;
}

export type StatusEffect = 'burning' | 'frozen' | 'poisoned' | 'stunned';

export interface ActiveStatus {
  effect:   StatusEffect;
  duration: number;
  dps?:     number;
}

export class CombatComponent extends Component {
  static readonly TYPE = 'CombatComponent';

  team: number = 0;         // collision group: 0 = player, 1 = enemy
  baseDamage = 10;
  attackSpeed = 1;          // multiplier

  isAttacking = false;
  attackTimer = 0;
  cooldownTimer = 0;
  comboStep   = 0;
  comboWindow = 0.4;        // seconds to chain a combo
  private _comboTimer = 0;

  statuses: ActiveStatus[] = [];

  attacks: AttackData[] = [];

  canAttack(): boolean { return !this.isAttacking && this.cooldownTimer <= 0; }

  startAttack(idx = 0): AttackData | null {
    const atk = this.attacks[idx];
    if (!atk || !this.canAttack()) return null;
    this.isAttacking    = true;
    this.attackTimer    = atk.duration;
    this.cooldownTimer  = atk.cooldown / this.attackSpeed;
    this._comboTimer    = this.comboWindow;
    this.comboStep      = (this.comboStep + 1) % Math.max(1, this.attacks.length);
    return atk;
  }

  update(dt: number): void {
    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) this.isAttacking = false;
    }
    if (this.cooldownTimer > 0) this.cooldownTimer -= dt;
    if (this._comboTimer  > 0) {
      this._comboTimer -= dt;
      if (this._comboTimer <= 0) this.comboStep = 0;
    }

    // Status effects
    for (const s of this.statuses) s.duration -= dt;
    this.statuses = this.statuses.filter((s) => s.duration > 0);
  }

  addStatus(effect: StatusEffect, duration: number, dps?: number): void {
    const existing = this.statuses.find((s) => s.effect === effect);
    if (existing) { existing.duration = Math.max(existing.duration, duration); return; }
    this.statuses.push({ effect, duration, dps });
  }

  hasStatus(effect: StatusEffect): boolean {
    return this.statuses.some((s) => s.effect === effect);
  }

  getDamageMultiplier(): number {
    let m = 1;
    if (this.hasStatus('frozen'))  m *= 0.5;
    if (this.hasStatus('burning')) m *= 1.2;
    return m;
  }
}
