// HealthComponent — tracks HP, damage, invincibility frames, and death
import { Component } from '../ecs/Component';

export class HealthComponent extends Component {
  static readonly TYPE = 'HealthComponent';

  maxHP:  number;
  hp:     number;

  // Invincibility frames after being hit (seconds)
  iframes:      number = 0;
  iframesMax:   number = 0.5;
  isInvincible  = false;

  isDead = false;

  // Optional regen (HP/s)
  regenRate     = 0;
  regenDelay    = 3;   // seconds after last damage
  private _regenTimer = 0;

  constructor(maxHP = 100) {
    super();
    this.maxHP = maxHP;
    this.hp    = maxHP;
  }

  takeDamage(amount: number): number {
    if (this.isInvincible || this.isDead) return 0;
    const actual = Math.min(amount, this.hp);
    this.hp -= actual;
    this.iframes = this.iframesMax;
    this.isInvincible = true;
    this._regenTimer = this.regenDelay;
    if (this.hp <= 0) {
      this.hp    = 0;
      this.isDead = true;
    }
    return actual;
  }

  heal(amount: number): void {
    this.hp = Math.min(this.hp + amount, this.maxHP);
    if (this.isDead && this.hp > 0) this.isDead = false;
  }

  update(dt: number): void {
    // Tick iframes
    if (this.iframes > 0) {
      this.iframes -= dt;
      if (this.iframes <= 0) {
        this.iframes = 0;
        this.isInvincible = false;
      }
    }
    // Regen
    if (this.regenRate > 0 && !this.isDead) {
      if (this._regenTimer > 0) {
        this._regenTimer -= dt;
      } else {
        this.heal(this.regenRate * dt);
      }
    }
  }

  get percent(): number { return this.hp / this.maxHP; }
  get isMissing(): boolean { return this.hp < this.maxHP; }
}
