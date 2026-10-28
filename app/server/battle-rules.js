/**
 * Rules transcribed from supplied booklet photos 04/06/07/08/09 and
 * reviewed-combat-spec.md; no deck quantities or unreviewed card effects.
 *
 * Pure queries: roleDeck(count), maxHp(creature,catalogue), currentHp(...),
 * computeDamage(source,target,base,catalogue,{command=true,powerBoost=0}),
 * eligibleTargetIds(players,actorId,{ignoreDistance=false}), evaluateVictory(players).
 * Explicit mutations: heal(creature,amount,catalogue) -> {healed,hp,rescued};
 * applyDamage(creature,amount,catalogue) -> {damage,hp,fainting};
 * beginCommand(source) -> 0|1 (consume effective power; retain result per card);
 * ordinarySwitch(player,catalogue) swaps zones, discards outgoing reinforcement.
 *
 * Damage calculation is for moves by active Pokémon. Store the beginCommand
 * boost on the card use and pass it to every settlement until that card ends.
 * computeDamage never consumes markers. Defense is removed by the caller only
 * AFTER the entire card ends, if that card actually caused damage. Rescue must
 * finish before after-damage effects; applyDamage does not declare defeat.
 * Reserve statuses/traits are inactive; callers must not use reserves as sources.
 */

function integer(value, label, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) throw new RangeError(`${label} must be an integer >= ${minimum}.`);
  return value;
}

function injuries(creature) { return integer(creature.damage ?? 0, 'Damage'); }

function reviewedFace(creature, catalogue) {
  const entry = catalogue?.entries?.find(row => row.id === creature.catalogueId);
  const face = entry?.levels?.find(row => row.level === creature.level);
  if (face?.hpStatus !== 'photo-reviewed' || !Number.isSafeInteger(face.hp) || face.hp < 1) {
    throw new Error(`No photo-reviewed HP for ${creature.catalogueId} level ${creature.level}.`);
  }
  return face;
}

// Photo 04 p.02: one leader/rocket, one gym from four players onward.
export function roleDeck(count) {
  integer(count, 'Player count', 3);
  if (count > 6) throw new RangeError('Player count must be 3–6.');
  return ['leader', ...(count >= 4 ? ['gym'] : []), ...Array(count - (count >= 4 ? 3 : 2)).fill('challenger'), 'rocket'];
}

export function maxHp(creature, catalogue) {
  const bonus = creature.hpBonus ?? 0;
  if (!Number.isSafeInteger(bonus)) throw new RangeError('HP bonus must be an integer.');
  return integer(reviewedFace(creature, catalogue).hp + bonus, 'Maximum HP', 1);
}

export function currentHp(creature, catalogue) { return maxHp(creature, catalogue) - injuries(creature); }

export function heal(creature, amount, catalogue) {
  integer(amount, 'Healing');
  const before = currentHp(creature, catalogue);
  const healed = Math.min(injuries(creature), amount);
  creature.damage = injuries(creature) - healed;
  const hp = currentHp(creature, catalogue);
  return { healed, hp, rescued: before < 1 && hp >= 1 };
}

export function applyDamage(creature, amount, catalogue) {
  integer(amount, 'Damage amount');
  // Validate the face before modifying state. Preserve negative HP for rescue.
  const before = currentHp(creature, catalogue);
  creature.damage = integer(injuries(creature) + amount, 'Damage');
  return { damage: amount, hp: before - amount, fainting: before - amount <= 0 };
}

export function reinforcementEffective(creature, kind) {
  return creature?.status !== 'paralysis' && (creature?.reinforcements ?? []).includes(kind);
}

export function beginCommand(source) {
  if (!reinforcementEffective(source, 'power')) return 0;
  source.reinforcements = source.reinforcements.filter(kind => kind !== 'power');
  return 1;
}

export function computeDamage(source, target, base, catalogue, { command = true, powerBoost = 0, channel = 'move', reinforcements = true, receiving = true } = {}) {
  integer(base, 'Base damage');
  integer(powerBoost, 'Power boost');
  // Dealing-damage changes precede receiving-damage changes (photo 08 p.11).
  let damage = base;
  const guts = source?.catalogueId === 'machop';
  if (source?.status === 'burn' && !guts && channel === 'move') {
    damage = Math.min(damage, 1);
  } else {
    if (source?.catalogueId === 'charmander' && currentHp(source, catalogue) * 2 <= maxHp(source, catalogue)) damage += 2;
    if (command && reinforcements) damage += powerBoost;
    if (guts && source.status) damage += 1;
  }
  if(!receiving)return damage;
  // Multiscale is compulsory and uses injuries, not a record of prior hits.
  if (damage > 1 && target?.catalogueId === 'dratini' && target.level === 3 && injuries(target) === 0) damage = 1;
  if (damage > 1 && reinforcements && reinforcementEffective(target, 'defense')) damage = 1;
  return damage;
}

// Photo 07 p.08: preserve injuries/status/items across evolution or switching;
// photo 08 p.11: discard reinforcement when active becomes reserve.
export function ordinarySwitch(player, catalogue) {
  const { active, reserve } = player;
  if (!active || !reserve || active.defeated || reserve.defeated || currentHp(active, catalogue) < 1 || currentHp(reserve, catalogue) < 1) {
    throw new Error('Ordinary switching requires two undefeated Pokémon.');
  }
  active.reinforcements = [];
  reserve.revealed = true;
  player.active = reserve;
  player.reserve = active;
  return player;
}

// IDs name trainers; only their ACTIVE Pokémon are default direct targets.
// Ignore distance only after a reviewed effect grants that permission.
export function eligibleTargetIds(players, actorId, { ignoreDistance = false } = {}) {
  const seats = players.filter(player => !player.spectator && !player.eliminated);
  const index = seats.findIndex(player => player.id === actorId);
  if (index < 0) return [];
  const allowed = ignoreDistance ? seats : [seats[index], seats[(index + 1) % seats.length], seats[(index + seats.length - 1) % seats.length]];
  return [...new Set(allowed.filter(player => player.active && !player.active.defeated).map(player => player.id))];
}

export function evaluateVictory(players) {
  const trainers = players.filter(player => !player.spectator);
  // Unassigned/setup and old foundation rooms have no source-backed role game.
  if (trainers.some(player => !['leader', 'gym', 'challenger', 'rocket'].includes(player.role))) return null;
  const leader = trainers.find(player => player.role === 'leader');
  if (!leader) return null;
  const living = trainers.filter(player => !player.eliminated);
  let winner;
  if (leader.eliminated) winner = living.length === 1 && living[0].role === 'rocket' ? 'rocket' : 'challengers';
  else if (!living.some(player => player.role === 'challenger' || player.role === 'rocket')) winner = 'leader-team';
  else return null;
  const winningRoles = winner === 'leader-team' ? ['leader', 'gym'] : winner === 'rocket' ? ['rocket'] : ['challenger'];
  return { winner, winnerIds: trainers.filter(player => winningRoles.includes(player.role)).map(player => player.id) };
}
