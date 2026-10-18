// Tombstone refactor: this file used to contain all weapon classes and logic.
// removed class Weapon {}
// removed class NoWeapon {}
// removed class Basic {}
// removed class Unarmed {}
// removed class Sword {}
// removed class Dagger {}
// removed class Spear {}
// removed class Bow {}

// This file is now a lightweight barrel that re-exports from modularized files.
import { Weapon, NoWeapon, Basic } from './weapons/base.js';
import { Unarmed } from './weapons/unarmed.js';
import { Sword } from './weapons/sword.js';
import { Dagger } from './weapons/dagger.js';
import { Spear } from './weapons/spear.js';
import { Bow } from './weapons/bow.js';
import { Shuriken } from './weapons/shuriken.js';
import { Scythe } from './weapons/scythe.js';
import { Shield } from './weapons/shield.js';
import { Wrench } from './weapons/wrench.js';
import { Hammer } from './weapons/hammer.js';
import { Scepter } from './weapons/scepter.js';
import { Staff } from './weapons/staff.js';
import { Katana } from './weapons/katana.js';
import { Pickaxe } from './weapons/pickaxe.js';
import { Bomb } from './weapons/bomb.js';
import { Bat } from './weapons/bat.js';

export {
  Weapon,
  NoWeapon,
  Basic,
  Unarmed,
  Sword,
  Dagger,
  Spear,
  Bow,
  Shuriken,
  Scythe,
  Shield,
  Wrench,
  Hammer,
  Scepter,
  Staff,
  Katana,
  Pickaxe,
  Bomb,
  Bat
};