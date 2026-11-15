import { isTeamRole } from './match-mode.js';

const disabled = active => ['sleep', 'flinch'].includes(active.status);
const allies = (a, b) => isTeamRole(a.role) ? a.role === b.role : (['leader', 'gym'].includes(a.role) && ['leader', 'gym'].includes(b.role)) ||
  (a.role === 'challenger' && b.role === 'challenger');

function attackValue(active) {
  if (disabled(active)) return 0;
  if (active.status === 'burn' && active.catalogueId !== 'machop') return 1;
  const blaze = active.catalogueId === 'charmander' && active.hp * 2 <= active.maxHp ? 2 : 0;
  return active.level + active.power + blaze;
}

function estimateHit(attacker, target) {
  const amount = attackValue(attacker);
  const multiscale = target.catalogueId === 'dratini' && target.level === 3 && target.hp === target.maxHp;
  return target.defense || multiscale ? Math.min(amount, 1) : amount;
}

function inReach(seats, attacker, recipient) {
  if (attacker.active.item === 'quick-claw' || attacker.active.speed) return true;
  const distance = Math.abs(seats.indexOf(attacker) - seats.indexOf(recipient));
  return Math.min(distance, seats.length - distance) <= 1;
}

// Estimate the strongest reply before our next turn. Unknown hands and reserves
// contribute probabilities instead of guessed cards or identities.
function replyRisk(seats, actor, hitTarget, damage) {
  const index = seats.indexOf(actor);
  const order = [...seats.slice(index + 1), ...seats.slice(0, index)];
  let worstReply = 0;
  for (const opponent of order) {
    if (allies(actor, opponent) || !inReach(seats, opponent, actor)) continue;
    const knockedOut = opponent === hitTarget && damage >= opponent.active.hp;
    if (knockedOut && !opponent.hasReserve) continue;
    const hit = knockedOut ? 1 : estimateHit(opponent.active, actor.active);
    // Someone with an empty hand still draws before acting.
    const canAttack = Math.min(0.9, 0.4 + opponent.handCount * 0.11);
    const risk = canAttack * (hit + (hit >= actor.active.hp ? 5 : 0));
    worstReply = Math.max(worstReply, risk);
  }
  return worstReply;
}

export function choosePublicStrategy({ actorId, players, difficulty }) {
  const seats = players.filter(player => !player.eliminated && player.active);
  const actor = seats.find(player => player.id === actorId);
  if (!actor) return { targetIds: [], focus: 'attack' };
  const opponents = seats.filter(player => player !== actor && (!isTeamRole(actor.role) || !allies(actor, player)));
  const immediateRisk = replyRisk(seats, actor);
  const focus = actor.active.hp <= 2 || ['sleep', 'burn', 'poison'].includes(actor.active.status) ||
    (difficulty === 'hard' && immediateRisk >= 4) ? 'recover' : 'attack';
  const score = opponent => {
    const { role, active, handCount } = opponent;
    if (difficulty === 'easy') return active.level;
    if (active.damageProtected) return -20;
    const leader = role === 'leader' && actor.role !== 'leader' && actor.role !== 'gym';
    if (difficulty === 'hard') {
      const damage = estimateHit(actor.active, active);
      const knockout = damage >= active.hp;
      const connects = Math.max(0.4, 0.95 - handCount * 0.1);
      const remainingSeats = knockout && !opponent.hasReserve ? seats.filter(seat => seat !== opponent) : seats;
      const riskAfterHit = knockout && leader && !opponent.hasReserve ? 0 : replyRisk(remainingSeats, actor, opponent, damage);
      const dangerRemoved = immediateRisk - riskAfterHit;
      return connects * (Math.min(damage, active.hp) * 2 + (knockout ? opponent.hasReserve ? 4 : 8 : 0) +
        dangerRemoved * 2) + (leader ? 3 : 0);
    }
    return 10 / Math.max(1, active.hp) + attackValue(active) - (active.defense ? 4 : 0) + (leader ? 3 : 0);
  };
  return { targetIds: opponents.toSorted((a, b) => score(b) - score(a)).map(player => player.id), focus };
}

if (typeof self !== 'undefined') {
  self.onmessage = ({ data }) => self.postMessage(choosePublicStrategy(data));
}
