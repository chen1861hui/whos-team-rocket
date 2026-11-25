import { publicBattleDecision, publicBattlePokemon, previewActions, battleTraitsEffective, battleReinforcementEffective, estimateCommandDamage, intactDisguise, activeFieldWeather } from './combat.js';
import { hoennEvents, canCoordinateCommand, emergencyRetreat, showdownWeatherRank, MIMIKYU_ID } from '../public/expansion-content.js';
import { isTeamRole, openingGymAce } from '../public/match-mode.js';
import { trainerProfessionIds } from '../public/trainer-professions.js';
import { sandstormAffects } from '../public/pokemon-types.js';
import { currentHp, rocketPartnerFor } from './battle-rules.js';

export const aiDifficulties = ['easy', 'normal', 'hard'];
export const aiDifficulty = player => aiDifficulties.includes(player.aiDifficulty) ? player.aiDifficulty : 'normal';
const targetDecisions = new Set(['intimidate', 'download']);
export const needsAiStrategy = room => room.status === 'playing' &&
  (room.pendingBattle ? targetDecisions.has(room.pendingBattle.kind) : room.turn?.phase === 'play');

const sunny = card => ['clear', 'intense-sun'].includes(card.weather);
const potion = card => card.kind === 'tool' && ['potion-full-heal', 'potion-revive'].includes(card.toolType);
const cardValue = card => (potion(card) ? 5 : { dodge: 4, command: 4, tool: 3, event: 2, 'held-item': 1 }[card.kind] ?? 0);
const cheapestFirst = cards => cards.toSorted((a, b) => cardValue(a) - cardValue(b));
const injuries = pokemon => pokemon.damage ?? 0;
const statusCost = { sleep: 4, paralysis: 3, burn: 3, flinch: 2, poison: 2, confusion: 1 };
const itemValue = { leftovers: 7, 'kings-rock': 7, 'rocky-helmet': 6, 'bright-powder': 6,
  'quick-claw': 6, 'muscle-band': 5, 'flame-orb': 5, 'poison-barb': 4, 'life-orb': 4,
  'blunder-policy': 3, 'light-ball':3, 'tour-protect':6,'tour-scarf':5,'tour-eject':4,'tour-red-card':4,'heat-rock':2,'damp-rock':2,'icy-rock':2,'smooth-rock':2,'light-clay':3,'power-herb':3 };
const itemScore = pokemon => itemValue[pokemon.item?.itemType] ?? 0;
const moveFace = (pokemon, catalogue) => catalogue.entries.find(entry => entry.id === pokemon.catalogueId)
  ?.levels.find(face => face.level === pokemon.level);
const heldItemScore = (card, pokemon) => card ? (pokemon.catalogueId === 'snorlax' ? 7 : itemValue[card.itemType] ?? 0) : 0;

function betterReserve(player, catalogue) {
  return player.reserve && !player.reserve.defeated &&
    currentHp(player.reserve, catalogue) >= currentHp(player.active, catalogue) + 2;
}

export function aiActor(room) {
  if (room.pendingVote || room.gameMode !== 'combat-preview') return null;
  if (room.status === 'identity' || room.status === 'setup') {
    return room.players.filter(player => player.ai && (room.status === 'identity'
      ? !player.identityAcknowledged : !player.setupComplete))
      .sort((a, b) => a.seatNumber - b.seatNumber)[0] ?? null;
  }
  if (room.status !== 'playing') return null;
  const actor = room.players.find(player => player.id === (room.pendingBattle?.actorId ?? room.turn?.playerId));
  return actor?.ai && !actor.eliminated ? actor : null;
}

export function publicAiTable(room, catalogue) {
  const viridian = room.scenario?.viridian;
  const leaderPublic = !viridian && room.players.some(player => player.role === 'leader' && player.identityAcknowledged);
  return room.players.filter(player => !player.spectator).map(player => {
    const pokemon = publicBattlePokemon(player.active, catalogue, room);
    return {
      id: player.id,
      role: (player.role === 'leader' && leaderPublic) || player.identityPublic || player.eliminated ? player.role
        : viridian?.clues[player.id] === true ? 'challenger' : null,
      eliminated: Boolean(player.eliminated),
      handCount: player.hand.length,
      hasReserve: Boolean(player.reserve && !(player.reserve.revealed && player.reserve.defeated)),
      active: pokemon && {
        catalogueId: pokemon.catalogueId,
        level: pokemon.level,
        hp: pokemon.hp,
        maxHp: pokemon.maxHp,
        power: pokemon.reinforcementsSuppressed || pokemon.status === 'paralysis' ? 0
          : pokemon.reinforcements.filter(marker => marker === 'power').length,
        speed: !pokemon.reinforcementsSuppressed && pokemon.status !== 'paralysis' && pokemon.reinforcements.includes('speed'),
        item: pokemon.itemSuppressed ? null : pokemon.item?.itemType ?? null,
        damageProtected: pokemon.damageProtected,
        ...(pokemon.catalogueId === MIMIKYU_ID && !pokemon.traitsSuppressed && pokemon.fieldForm !== 'busted' ? { disguise: true } : {}),
        ...(pokemon.fieldForm ? {fieldForm:pokemon.fieldForm} : {}),
        status: pokemon.status,
        defense: Number(!pokemon.reinforcementsSuppressed && pokemon.status !== 'paralysis' && pokemon.reinforcements.includes('defense')),
      },
    };
  });
}

// Use only our own role and already-revealed roles to refine public preferences.
function ally(player, target) {
  if (isTeamRole(player.role)) return player.role === target?.role;
  return player.id === target?.id || (['leader', 'gym'].includes(player.role) && ['leader', 'gym'].includes(target?.role))
    || (player.role === 'challenger' && target?.role === 'challenger') || target?.rocketPartner === true;
}

// Use recent, attributed public hits as clues, with revealed roles taking precedence.
function factionRead(room, player, table) {
  const gymRoles = ['leader', 'gym'];
  const gymSide = gymRoles.includes(player.role);
  const gymIds = new Set(table.filter(seat => gymRoles.includes(seat.role)).map(seat => seat.id));
  if (gymSide) gymIds.add(player.id);
  const publicOpponents = new Set(table.filter(seat => ['challenger', 'rocket', 'infiltrator'].includes(seat.role)).map(seat => seat.id));
  const hitGym = new Set();
  const hitOpponents = new Set();
  const hitSelf = new Set();
  for (const cue of room.visualEvents ?? []) {
    if (cue.kind !== 'hit' || !cue.sourceId || !cue.amount) continue;
    const targets = cue.targetIds.filter(id => id !== cue.sourceId);
    if (targets.some(id => gymIds.has(id))) hitGym.add(cue.sourceId);
    if (targets.some(id => publicOpponents.has(id))) hitOpponents.add(cue.sourceId);
    if (targets.includes(player.id)) hitSelf.add(cue.sourceId);
  }

  const hiddenGymTrainer = player.role === 'leader' && table.length >= 4 && !table.some(seat => seat.role === 'gym');
  const leader = table.find(seat => seat.role === 'leader' && !seat.eliminated);
  const needsRivalsGone = ['rocket','infiltrator'].includes(player.role) && leader && table.some(seat=>
    !seat.eliminated && seat.id!==player.id && seat.id!==leader.id && !seat.rocketPartner);
  const protectLeader = needsRivalsGone && !leader.hasReserve;
  const friendly = target => ally(player, target) || Boolean(hiddenGymTrainer && target && !target.role &&
    hitOpponents.has(target.id) && !hitGym.has(target.id));
  const canTarget = target => {
    if (!target || friendly(target) || (protectLeader && target.id === leader.id)) return false;
    if (target.role) return true;
    if (player.role === 'challenger') return hitSelf.has(target.id) && !hitGym.has(target.id);
    return !hiddenGymTrainer || hitGym.has(target.id);
  };
  const pressure = target => {
    if (!target) return 0;
    if (gymSide && hitGym.has(target.id)) return 4;
    if (needsRivalsGone && target.id !== leader.id) return hitGym.has(target.id) ? 5 : 2;
    return 0;
  };
  return { friendly, canTarget, pressure, protectedLeaderId: protectLeader ? leader.id : null };
}

function rankTargets(ids, player, table, preferences, read) {
  const ranked = preferences?.targetIds ?? [];
  const difficulty = aiDifficulty(player);
  const score = id => {
    const target = table.find(seat => seat.id === id);
    if (read.friendly(target)) return -100;
    const pressure = read.pressure(target);
    if (difficulty === 'easy') return pressure + (ranked.includes(id) ? -ranked.indexOf(id) : -ranked.length);
    const faction = target?.role === 'leader' ? (player.role === 'challenger' ? 6 : -4) : 0;
    const rank = ranked.indexOf(id);
    const defense = difficulty === 'hard' ? (target?.active?.defense ?? 0) * 2 : 0;
    const protectedTarget = difficulty === 'hard' && target?.active?.damageProtected ? 12 : 0;
    return faction + pressure + (rank < 0 ? 0 : (ranked.length - rank) * 2) - (target?.active?.hp ?? 0) - defense - protectedTarget;
  };
  return ids.toSorted((a, b) => score(b) - score(a));
}

function response(room, player, catalogue, table, preferences) {
  const pending = publicBattleDecision(room, player);
  const act = (choice, fields = {}) => ({ type: 'respondBattle', decisionId: pending.id, choice, ...fields });
  const pay = (choice, card) => card ? act(choice, { cardId: card.id }) : act('pass');
  const pass = () => act('pass');
  const cards = cheapestFirst(player.hand);
  const target = table.find(seat => seat.id === pending.targetId);
  const read = factionRead(room, player, table);
  const seat = id => table.find(entry => entry.id === id);
  const friendly = read.friendly(target);
  const ownHp = currentHp(player.active, catalogue);
  const tactical = aiDifficulty(player) !== 'easy';
  const source = room.players.find(seat => seat.id === room.resolution?.sourcePlayerId);
  const recipient = room.players.find(seat => seat.id === pending.targetId);
  const incomingHit = () => source?.active && room.resolution?.kind === 'move'
    ? estimateCommandDamage(room, source.active, player.active, null, catalogue) : null;
  const targets = () => {
    const ranked = rankTargets(pending.legalTargetIds, player, table, preferences, read);
    const opponents = ranked.filter(id => read.canTarget(seat(id)));
    return opponents.length ? opponents : ranked;
  };
  const usableDodge = card => !pending.blockedDodgeWeathers?.includes(card.weather) &&
    (card.kind === 'dodge' || (player.active.catalogueId === 'gastly' && player.active.level <= 2 &&
      battleTraitsEffective(room, player.active) && ['rain', 'thunderstorm'].includes(card.weather)));

  switch (pending.kind) {
    case 'expansion': {
      const options = pending.options || [];
      let best = options[0];
      const continuation = room.pendingBattle.continuation;
      if (continuation.kind === 'rocket-pledge') {
        const rockets = (room.settings.rocketPartners ? 2 : 1) - table.filter(seat=>seat.role==='rocket'&&seat.eliminated).length;
        const opponents = table.filter(seat=>seat.id!==player.id&&!seat.eliminated).length;
        return act('choose',{effect:rockets>0 && opponents>1 ? 'rocket' : 'independent'});
      }
      if (continuation.kind === 'gym-guard') {
        const hit = incomingHit() ?? 1;
        const canAvoid = intactDisguise(room,player.active) ||
          (!room.resolution.ignoresReinforcements && cards.some(usableDodge));
        const protectsLeader = target?.role === 'leader' && target.active?.hp <= Math.max(1,hit);
        return protectsLeader || (canAvoid && target?.active?.hp <= ownHp) ? act('choose',{effect:'guard'}) : pass();
      }
      if (continuation.kind === 'follow-me') {
        const payment = cheapestFirst(options.map(option=>option.card))[0];
        const hit = incomingHit() ?? 0;
        const canAvoid = cards.some(card=>card.id!==payment?.id && card.kind==='dodge') ||
          intactDisguise(room,player.active);
        return payment && friendly && target?.active?.hp<=Math.max(hit,1) && (canAvoid || ownHp>hit)
          ? act('choose',{effect:payment.id}) : pass();
      }
      if (continuation.kind === 'radio-first' || continuation.kind === 'radio-second') {
        const lowestMatch = candidate => cards.find(card=>card.weather!==candidate.weather);
        const fee = card => cardValue(card) + (continuation.kind==='radio-first' ? cardValue(lowestMatch(card)) : 0);
        best = options.toSorted((a,b)=>fee(a.card)-fee(b.card))[0];
      }
      if (['dex','oak-order','bug-prize'].includes(continuation.kind)) best = options.toSorted((a,b)=>cardValue(b.card)-cardValue(a.card))[0];
      if (continuation.kind === 'disguise-target') {
        best = options.find(option=>read.friendly(seat(option.value))) ?? best;
      }
      if (continuation.kind==='objective-payment') {
        best = options.toSorted((a,b)=>cardValue(player.hand.find(card=>card.id===a.value))-
          cardValue(player.hand.find(card=>card.id===b.value)))[0];
      }
      if (continuation.kind === 'disguise-offer') {
        best = options.find(option=>option.value===cards[0]?.id);
      }
      if (continuation.kind === 'disguise-reply') {
        const match = cards.find(card=>options.some(option=>option.value===card.id));
        best = match && cardValue(match)<=3 ? options.find(option=>option.value===match.id) :
          options.find(option=>option.value==='decline');
      }
      if (continuation.kind === 'looker-target') {
        best = options.find(option=>read.canTarget(seat(option.value))) ?? best;
      }
      if (continuation.kind === 'looker-reply' && player.reserve?.item && !player.reserve.revealed && cards.length) {
        best = options.find(option=>option.value===cards[0].id);
      }
      if (continuation.kind === 'bird-recipient' && player.hand.length>=4) {
        best = options.find(option=>option.value!==player.id && read.friendly(seat(option.value)) &&
          seat(option.value).handCount<player.hand.length) ?? best;
      }
      if (continuation.kind === 'researcher-forecast') {
        const weather=room.drawPile.at(-1)?.weather;
        const judgment=room.judgment.continuation;
        const hits=judgment.weathers ? judgment.weathers.includes(weather) :
          (weather===judgment.weather)!==(judgment.comparison==='not');
        const affected=room.players.find(seat=>seat.active?.instanceId===judgment.targetId);
        const harmful=judgment.kind==='weather-lab' ? weather==='clear' :
          judgment.kind==='status' && affected && read.friendly(seat(affected.id))===hits;
        if (!harmful || !cards.length || cardValue(cards[0])>3) return pass();
        best = options.find(option=>option.value===cards[0].id);
      }
      if (continuation.kind === 'showdown-target') {
        const opponent = targetsForShowdown(options.map(option => option.value), table, read)[0];
        return opponent ? act('choose', { effect: opponent.id }) : pass();
      }
      if (['showdown-commit','showdown-reveal'].includes(continuation.kind)) {
        best = options.toSorted((a,b) => showdownWeatherRank[b.card.weather] - showdownWeatherRank[a.card.weather] ||
          cardValue(a.card) - cardValue(b.card))[0];
      }
      if (continuation.kind === 'air-lock' && source?.active &&
          estimateCommandDamage(room,source.active,player.active,null,catalogue) <= 1) return pass();
      if (continuation.kind === 'wobbuffet-counter' && (!source || read.friendly(seat(source.id)))) return pass();
      if (continuation.kind === 'light-clay' && room.turn.playerId === player.id) return pass();
      if (continuation.kind === 'future-sight-event') {
        const judgment = room.judgment?.continuation;
        const weather = pending.judgmentCard?.weather;
        let harmful;
        if (judgment?.kind === 'zapdos') harmful = weather === 'thunderstorm';
        if (judgment?.kind === 'hoenn-delayed') harmful = room.resolution?.eventType === 'hoenn-raikou' ? weather === 'thunderstorm' : weather !== 'clear';
        if (judgment?.kind === 'status') harmful = judgment.weathers ? judgment.weathers.includes(weather)
          : (weather === judgment.weather) !== (judgment.comparison === 'not');
        const affected = judgment?.kind === 'status' && room.players.find(seat => seat.active?.instanceId === judgment.targetId);
        const friendlyToAffected = affected ? read.friendly(table.find(seat => seat.id === affected.id)) : friendly;
        if (harmful === undefined || friendlyToAffected !== harmful) return pass();
      }
      if (['gear','action','gift','roadblock-switch','future-sight-payment','wobbuffet-counter','illusion-decoy','viridian-investigate-payment'].includes(continuation.kind)) {
        best = options.toSorted((a,b)=>cardValue(a.card||{})-cardValue(b.card||{}))[0];
      }
      if (continuation.kind === 'emergency-retreat' && !betterReserve(player,catalogue)) return pass();
      if (continuation.kind === 'post-switch' && pending.allowPass) {
        const event=room.tourAfterSwitches,entry=event.entries[event.index-1];
        const switching=table.find(seat=>seat.id===entry.playerId);
        if (entry.itemType==='tour-red-card' && read.friendly(switching)) return pass();
      }
      return best ? act('choose',{effect:best.value}) : pass();
    }
    case 'reveal-judgment': return act('reveal');
    case 'hand':
    case 'event-hand':
    case 'download-hand':
    case 'intimidate-hand': return act('card', { handIndex: 0 });
    case 'berry-pick': {
      const best = pending.berryCards.toSorted((a, b) => cardValue(b) - cardValue(a))[0];
      return act('card', { handIndex: best.index });
    }
    case 'mew-blessing': return act(pending.choices.includes('heal') && (target?.active?.hp <= 2 || !pending.choices.includes('evolve')) ? 'heal' : 'evolve');
    case 'sweet-kiss': return act('discard', { cardIds: cards.slice(0, pending.requiredCards).map(card => card.id) });
    case 'download': return act('targets', { targetIds: targets().slice(0, pending.maxTargets) });
    case 'vital-spirit': return act('gain', { order: pending.cards.toSorted((a, b) => cardValue(b) - cardValue(a)).slice(0, pending.requiredCards).map(card => card.index) });
    case 'forewarn-order': return act('order', {
      topOrder: pending.cards.toSorted((a, b) => cardValue(b) - cardValue(a)).map(card => card.index), bottomOrder: [],
    });
    case 'reorder': {
      const turnIndex = table.findIndex(seat => seat.id === room.turn.playerId);
      const nextSeat = [...table.slice(turnIndex + 1), ...table.slice(0, turnIndex + 1)].find(seat => !seat.eliminated);
      const direction = ally(player, nextSeat) ? -1 : 1;
      return act('order', { order: pending.cards.toSorted((a, b) => direction * (cardValue(a) - cardValue(b))).map(card => card.index) });
    }
    case 'intimidate': return act('target', { targetId: targets()[0] });
    case 'distribute': return act('distribute', { allocations: pending.cards.map(({ index }) => ({ index, recipientId: player.id })) });
    case 'reinforcement': return act('reinforcement', { reinforcement: pending.reinforcements[0] });
    case 'damage-order': {
      // Cap first, then reduce the smaller hit. Leave paid mitigation until last.
      const effect = ['defense', 'multiscale', 'dodge', 'marvel-scale', 'shed-skin'].find(effect => pending.effects.includes(effect));
      return act('damage-effect', { effect: effect ?? pending.effects[0] });
    }
    case 'turn-start-order': return act('start-effect', { effect: pending.effects[0] });
    case 'effects':
    case 'source-effect-order': return act('effect', { effect: pending.effects[0] });
    case 'rescue': {
      if (!friendly && (!target || target.id !== read.protectedLeaderId)) return pass();
      const possibleHeals = pending.potionCards.length + pending.healerCards.filter(
        card => !pending.potionCards.some(potion => potion.id === card.id)).length;
      const lastRescuer = room.resolution?.rescueIndex === room.resolution?.rescueActors?.length - 1;
      const joy = pending.joyItems?.[0];
      if (lastRescuer && target?.active && target.active.hp + 2 * possibleHeals + Number(Boolean(joy)) <= 0) return pass();
      if (pending.potionCards.length) return pay('potion',pending.potionCards[0]);
      if (pending.healerCards.length) return pay('healer',cheapestFirst(pending.healerCards)[0]);
      return pay('joy',joy);
    }
    case 'event-dodge': return pay('dodge', cards.find(card => card.kind === 'dodge'));
    case 'event-command':
    case 'rival-command': return pay('command', cards.find(card => card.kind === 'command'));
    case 'defense': {
      if (pending.cannotDodge) return pass();
      const statusMove = room.resolution.statusMove || ['lock-on', 'sweet-kiss', 'temporary-hand-exile', 'discard-other-hand'].includes(room.resolution.effectKind);
      const damageLeft = Math.max(0, (incomingHit() ?? 1) - (pending.damageReduction ?? 0));
      if (tactical && !statusMove && damageLeft === 0) return pass();
      if (pending.canTourProtect) return act('tour-protect');
      if (pending.canBrightPowder) return act('bright-powder');
      if (pending.canTrait && !pending.traitAttempted) return act('trait');
      const dodges = cards.filter(usableDodge);
      const needed = pending.dodgeReducesDamage ? 1 : (pending.dodgesRequired ?? 1) - (pending.dodgesPlayed ?? 0);
      const retreat = needed === 1 && !pending.dodgeReducesDamage && !player.emergencyRetreatDebt && betterReserve(player,catalogue);
      return dodges.length >= needed ? pay('dodge',
        dodges.find(card => (card.variant === emergencyRetreat.variant) === Boolean(retreat)) ?? dodges[0]) : pass();
    }
    case 'quick-claw': {
      const move = pending.moves.filter(option => option.canUse && option.printedValue > 0)
        .map(option => ({ option, damage: estimateCommandDamage(room, player.active, recipient.active, option, catalogue) }))
        .toSorted((a, b) => b.damage - a.damage)[0];
      if (move?.damage === 0) return pass();
      if (read.canTarget(target) && move && pending.commandCards.length) {
        return act('command', { cardId: pending.commandCards[0].id, moveIndex: move.option.index });
      }
      return pass();
    }
    case 'arena-trap': return friendly ? pass() : act('trait');
    case 'forewarn':
    case 'foresee':
    case 'pay-day':
    case 'synchronize':
    case 'static':
    case 'poison-point':
    case 'poison-touch':
    case 'scales':
    case 'defiant': return act('trait');
    case 'cursed-body': return pending.choices.length ? act('trait', { handIndex: 0 }) : pass();
    case 'exile': return act('exile', { handIndices: pending.choices.slice(0, pending.maxCards).map(card => card.index) });
    case 'battle-armor': return ['turn-start','turn-end'].includes(room.resolution?.kind) && !player.active.reinforcements.includes('defense')
      ? pay('armor', cards[0]) : pass();
    case 'bonemerang': return friendly ? pass() : pay('repeat', cards[0]);
    case 'switch-payment': return pay('discard', cards[0]);
    case 'life-orb':
    case 'double-edge': {
      if (friendly || ownHp <= 1 || !recipient?.active) return pass();
      const damage = pending.damage ?? estimateCommandDamage(room, player.active, recipient.active, null, catalogue);
      const hasCap = battleReinforcementEffective(room, recipient.active, 'defense') && !room.resolution.ignoresReinforcements
        || (recipient.active.catalogueId === 'dratini' && recipient.active.level === 3 &&
          !injuries(recipient.active) && battleTraitsEffective(room, recipient.active));
      const lethal = target.active.hp === damage + 1;
      return !hasCap && (lethal || ownHp >= 4 && target.active.hp > damage) ? act('boost') : pass();
    }
    case 'articuno': {
      const eventType = room.resolution?.eventType;
      if (!pending.protectionCards.length) return pass();
      if (hoennEvents[eventType]?.field) {
        return !friendly && recipient?.active?.catalogueId === 'hoenn-castform' && !pending.counterProtection
          ? pay('protect', pending.protectionCards[0]) : pass();
      }
      const protects = pending.mode === 'cure-status' ||
        (eventType === 'berry-harvest' ? pending.counterProtection === true :
          !['mew-blessing', 'rival-challenge'].includes(eventType) || target?.active?.hp <= 2);
      return friendly === protects && (friendly || eventType === 'berry-harvest')
        ? pay('protect', pending.protectionCards[0]) : pass();
    }
    case 'power-herb': return tactical && target && !friendly && target.active.hp===1 && cards.length>=2
      ? act('discard',{cardIds:cards.slice(0,2).map(card=>card.id)}) : pass();
    case 'blunder-policy': {
      const damage = recipient?.active && estimateCommandDamage(room, player.active, recipient.active, null, catalogue);
      return tactical && !friendly && damage >= target?.active?.hp && cards.length >= 2
        ? act('discard', { cardIds: cards.slice(0, 2).map(card => card.id) }) : pass();
    }
    case 'pressure':
      return tactical && (incomingHit() ?? 0) >= ownHp ? pay('discard', cards[0]) : pass();
    case 'pressure-payment': {
      const damage = recipient?.active && estimateCommandDamage(room, player.active, recipient.active, null, catalogue);
      return tactical && !friendly && damage >= target?.active?.hp ? pay('discard', cards[0]) : pass();
    }
    case 'u-turn': return tactical && betterReserve(player, catalogue) ? act('switch') : pass();
    case 'neutralizing-gas': {
      const opponent = room.players.find(seat => seat.id === room.turn.playerId);
      const disruptive = ['staryu', 'porygon', 'electabuzz', 'charmander', 'machop', 'jynx', 'scyther'];
      return tactical && cards[0] && cardValue(cards[0]) <= 2 && pending.legalTargetIds.includes(opponent?.id) &&
        read.canTarget(seat(opponent.id)) && disruptive.includes(opponent.active?.catalogueId)
        ? act('suppress', { cardId: cards[0].id, targetId: opponent.id }) : pass();
    }
    case 'cute-charm': {
      const redirect = targets().find(id => read.canTarget(seat(id)));
      return tactical && redirect && pending.paymentCards.length && incomingHit() >= 1
        ? act('redirect', { cardId: cheapestFirst(pending.paymentCards)[0].id, targetId: redirect }) : pass();
    }
    case 'shed-skin': {
      const needed = Math.max(0, pending.damage - ownHp + 1);
      const payment = needed > 0 && needed <= cards.length ? cards.slice(0, needed)
        : tactical && pending.damage > 0 && ownHp <= 3 && cards[0] && cardValue(cards[0]) <= 2 ? cards.slice(0, 1) : [];
      return payment.length ? act('shed', { cardIds: payment.map(card => card.id) }) : pass();
    }
    case 'judgment': {
      const judgment = room.judgment?.continuation;
      const weather = pending.judgmentCard.weather;
      const preference = card => {
        if (['sand-veil', 'bright-powder'].includes(judgment?.kind)) return friendly && sunny(card);
        if (['poison-point', 'static'].includes(judgment?.kind)) {
          const affected = room.players.find(seat => seat.active?.instanceId === judgment.sourceId);
          return ally(player, table.find(seat => seat.id === affected?.id)) === (card.weather === 'intense-sun');
        }
        if (judgment?.kind === 'status') {
          const affected = room.players.find(seat => seat.active?.instanceId === judgment.targetId);
          const inflicts = judgment.weathers ? judgment.weathers.includes(card.weather)
            : (card.weather === judgment.weather) !== (judgment.comparison === 'not');
          return Boolean(affected && ally(player, table.find(seat => seat.id === affected.id)) !== inflicts);
        }
        return false;
      };
      const replacement = tactical && !preference({ weather }) && cheapestFirst(pending.replacementCards).find(preference);
      return pay('replace', replacement);
    }
    case 'cycle': return tactical && cards[0] && cardValue(cards[0]) <= 2 ? pay('cycle', cards[0]) : pass();
    default: return null;
  }
}

function choosePartners(room, player, catalogue) {
  const score = (id, level) => {
    const face = catalogue.entries.find(entry => entry.id === id)?.levels.find(entry => entry.level === level);
    const damage = Math.max(0, ...(face?.moves ?? []).map(move => move.printedValue ?? 0));
    return (face?.hp ?? 0) + damage * 2;
  };
  const level = openingGymAce(room,player) ? 2 : 1;
  const ordered = player.candidates.toSorted((a, b) => score(b, level) - score(a, level));
  const profession = room.settings?.trainerProfessions && trainerProfessionIds[((player.seatNumber ?? 1)-1)%trainerProfessionIds.length];
  return { type:'selectPokemon',activeId:ordered[0],reserveId:ordered[1],...(profession?{profession}:{}) };
}

function targetsForShowdown(ids, table, read) {
  return table.filter(seat => ids.includes(seat.id) && seat.handCount > 0 && read.canTarget(seat))
    .toSorted((a,b) => a.handCount - b.handCount);
}

function play(room, player, catalogue, table, preferences, legal) {
  const candidates = [];
  const add = (score, type, payload = {}, hostileIds = []) => {
    if (score > 0) candidates.push({ score, action: { type, ...payload }, hostileIds });
  };
  const cards = cheapestFirst(player.hand);
  const read = factionRead(room, player, table);
  const targetOrder = ids => rankTargets(ids, player, table, preferences, read);
  const publicSeats = new Map(table.map(seat => [seat.id, seat]));
  const seats = new Map(room.players.map(seat => {
    const visible = publicSeats.get(seat.id)?.active;
    if (seat.id===player.id || !visible || visible.catalogueId===seat.active?.catalogueId) return [seat.id,seat];
    return [seat.id,{...seat,active:{...seat.active,catalogueId:visible.catalogueId,level:visible.level}}];
  }));
  const active = player.active;
  const activeHP = currentHp(active, catalogue);
  const difficulty = aiDifficulty(player);
  const tactical = difficulty !== 'easy';
  const hard = difficulty === 'hard';
  const attackBonus = preferences?.focus === 'attack' ? 1 : 0;
  const recoveryBonus = preferences?.focus === 'recover' ? (hard ? 3 : 1) : 0;
  const isAlly = id => read.friendly(publicSeats.get(id));
  const isEnemy = id => read.canTarget(publicSeats.get(id));
  const leaderId = player.role === 'challenger'
    ? table.find(seat => seat.role === 'leader' && !seat.eliminated)?.id : null;
  const hostile = ids => ids.filter(id => id !== player.id);
  const hasCommand = cards.some(card => card.kind === 'command' && (active.status !== 'paralysis' || sunny(card)));
  const freeCommand = !room.turn.commandCreatureId || room.turn.commandCreatureId === active.instanceId;
  const canAttack = hasCommand && freeCommand && legal.moves.some(move => move.canUse && move.condition.kind === 'command' &&
    move.printedValue > 0 && move.legalTargetIds.some(id => isEnemy(id) && (!leaderId || id === leaderId)));
  const validReserve = player.reserve && !player.reserve.defeated;

  for (const move of legal.moves.filter(move => move.canUse)) {
    const command = move.condition.kind === 'command';
    const payment = cards.find(card => command ? (card.kind==='command'||(move.printedValue>0&&card.id===legal.illusionDecoyId)) && (active.status !== 'paralysis' || sunny(card))
      : move.condition.weatherIconsInCondition.includes(card.weather));
    if (!payment && !(command && legal.muscleBand)) continue;
    const available = targetOrder(move.legalTargetIds);
    const damageMove = command && move.printedValue > 0;
    const keepsCommand = cards.some(card => card !== payment && card.kind === 'command' &&
      (active.status !== 'paralysis' || sunny(card)));
    const recoverMove = ['life-dew', 'moonlight'].includes(move.effectKind);
    const effectScore = id => {
      const target = seats.get(id).active;
      if (recoverMove) return isAlly(id) ? Math.min(injuries(target), 2) * 4 : 0;
      if (id !== player.id && !isEnemy(id)) return 0;
      if (id === player.id) {
        const teleport = active.catalogueId === 'abra' && active.level === 1;
        if (teleport) return betterReserve(player, catalogue) && room.drawPile?.length + room.discardPile?.length > 0 ? 6 : 0;
        if (move.effectKind === 'swords-dance') return canAttack && keepsCommand && !battleReinforcementEffective(room, active, 'power') ? 10 : 0;
        if (['self-defense', 'light-screen'].includes(move.effectKind)) return (active.reinforcements ?? []).includes('defense') ? 0 : 4;
        return 0;
      }
      if (move.effectKind === 'lock-on') {
        return tactical && canAttack && keepsCommand && !(room.turn.dodgeBlockedCreatureIds ?? []).includes(target.instanceId) &&
          publicSeats.get(id).handCount ? 11 : 0;
      }
      if (['temporary-hand-exile', 'discard-other-hand', 'sweet-kiss'].includes(move.effectKind))
        return publicSeats.get(id).handCount > 0 ? 5 : 0;
      if (move.effectKind === 'forced-switch') {
        const reserve = seats.get(id).reserve;
        return reserve?.revealed && !reserve.defeated && currentHp(reserve, catalogue) < target.level ? 6 : 0;
      }
      return target.status ? 0 : move.effectKind === 'sleep-judgment' ? 7 : 4;
    };
    const options = available.map((id, rank) => {
      const target = seats.get(id).active;
      const targetHp = publicSeats.get(id).active.hp;
      if (!damageMove) {
        const score = effectScore(id);
        return { id, score: score > 0 && !recoverMove ? score + read.pressure(publicSeats.get(id)) : score, boost: null };
      }
      if (!isEnemy(id)) return { id, score: 0 };
      const damage = estimateCommandDamage(room, active, target, move, catalogue);
      if (damage > 0 && publicSeats.get(id).active.disguise) return { id, score: 4, boost: null };
      const boost = hard && move.effectKind === 'hyper-beam' && payment && damage < targetHp &&
        estimateCommandDamage(room, active, target, move, catalogue, 1) >= targetHp
        ? cards.find(card => card.id !== payment.id && cardValue(card) <= 3) : null;
      const effective = damage + Number(Boolean(boost));
      const finish = effective >= targetHp;
      const targetReserve = seats.get(id).reserve;
      const revealedDefeat = targetReserve?.revealed && targetReserve.defeated;
      const winPressure = finish && revealedDefeat && (publicSeats.get(id).role === 'leader' || hard) ? 8 : 0;
      const publicRank = preferences?.targetIds?.indexOf(id) ?? -1;
      const strategyBonus = hard && publicRank >= 0 ? 3 / (publicRank + 1) : (available.length - rank) * 0.2;
      const score = effective > 0 ? 5 + 2 * Math.min(effective, targetHp) +
        (tactical && finish ? 6 + winPressure : 0) + attackBonus + strategyBonus + read.pressure(publicSeats.get(id)) : 0;
      return { id, score, boost };
    }).filter(option => option.score > 0);
    const leaderOption = !recoverMove && leaderId && options.find(option => option.id === leaderId);
    const targets = leaderOption ? [leaderOption]
      : (tactical ? options.toSorted((a, b) => b.score - a.score) : options).slice(0, move.maxTargets);
    if (!targets.length) continue;
    const score = targets.reduce((sum, option, index) => sum + option.score * (index ? 0.45 : 1), 0);
    const primaryId = targets[0].id;
    const primary = seats.get(primaryId).active;
    const doubleDodge = hard && move.effectKind === 'x-scissor' &&
      battleReinforcementEffective(room, active, 'power') && publicSeats.get(primaryId).handCount > 0 &&
      !(room.turn.dodgeBlockedCreatureIds ?? []).includes(primary.instanceId) && move.printedValue >= publicSeats.get(primaryId).active.hp;
    add(score + (recoverMove ? recoveryBonus : 0) - (payment ? 0 : 2), 'attack', {
      moveIndex: move.index, targetIds: targets.map(option => option.id),
      ...(payment ? { cardId: payment.id } : { cardIds: cards.slice(0, 2).map(card => card.id) }),
      ...(targets[0].boost ? { boostCardId: targets[0].boost.id } : {}),
      ...(move.effectKind === 'moonlight' ? { effectChoice: 'heal' } : {}),
      ...(doubleDodge ? { effectChoice: 'double-dodge' } : {}),
    }, recoverMove ? [] : hostile(targets.map(option => option.id)));
    const coordinated = tactical && cards.find(card => canCoordinateCommand(move,card) && (active.status!=='paralysis'||sunny(card)));
    if (coordinated && options.length > move.maxTargets) {
      const fees = cards.filter(card=>card!==coordinated);
      const second = fees.find(card=>card.weather!==fees[0]?.weather);
      const expanded = options.toSorted((a,b)=>b.score-a.score).slice(0,move.maxTargets+1);
      if (second && (!leaderId || expanded.some(option=>option.id===leaderId))) {
        const ids = expanded.map(option=>option.id);
        add(expanded.reduce((total,option,index)=>total+option.score*(index ? 0.45 : 1),0)-4,
          'attack',{moveIndex:move.index,cardId:coordinated.id,targetIds:ids,coordinationCardIds:[fees[0].id,second.id]},hostile(ids));
      }
    }
  }

  for (const tool of legal.tools) {
    const card = cards.find(card => card.kind === 'tool' && card.toolType === tool.toolType && (!tool.cardId || tool.cardId === card.id));
    for (const choice of tool.choices) {
      if (choice.unavailableReason) continue;
      for (const target of choice.targets) {
        if (!isAlly(target.targetId) || (!tactical && target.targetId !== player.id)) continue;
        const own = target.targetId === player.id;
        const pokemon = seats.get(target.targetId)[target.slot];
        const status = statusCost[pokemon?.status] ?? 0;
        const health = pokemon && currentHp(pokemon, catalogue);
        const scores = {
          'tour-heal': 4 + recoveryBonus, 'tour-power': canAttack ? 9 : 2,
          'tour-gear': 2, 'tour-dex': room.turn.tourNightObservation ? 2 : 4, 'tour-switch': betterReserve(player,catalogue) ? 9 : 0,
          'tour-incense': player.reserve?.level < 3 ? 4 : 0, 'tour-recycle':4, 'tour-berry':6,
          'hoenn-lum': 2 + status * 2,
          'hoenn-umbrella': target.slot === 'active' && activeFieldWeather(room) &&
            table.some(seat => !read.friendly(seat) && seat.active?.fieldForm) ? 4 : 0,
          revive: 15, potion: pokemon ? 3 * Math.min(2, injuries(pokemon)) + (health <= 2 ? 6 : 0) + recoveryBonus : 0,
          'full-heal': 3 + status * 2 + recoveryBonus,
          'rare-candy': pokemon?.level === 2 ? 8 : 6,
          nugget: (room.drawPile?.length ?? 0) + (room.discardPile?.length ?? 0) > 0 ? (own ? 7 : 4) : 0,
          power: own && canAttack && active.status !== 'burn' ? 11 : 3,
          defense: pokemon?.status !== 'paralysis' ? (health <= 2 ? 9 : 5) : 0,
          speed: own && hasCommand && !canAttack && freeCommand ? 5 : 0,
        };
        add((scores[choice.effect] ?? 0) - (own ? 0 : 2), 'useTool', { cardId: card.id, effect: choice.effect, ...target });
      }
    }
  }

  for (const event of legal.events.filter(event => event.canUse)) {
    const card = cards.find(card => card.kind === 'event' && card.eventType === event.eventType);
    if (event.eventType==='tour-supply') { add(8,'useEvent',{cardId:card.id,targetId:player.id}); continue; }
    if (event.field) {
      if (activeFieldWeather(room)?.kind === event.field) continue;
      let score = active.catalogueId === 'hoenn-castform' ? 8 : 1;
      if (event.field === 'sand') {
        score = table.filter(seat => !seat.eliminated && seat.active && sandstormAffects(seat.active)).reduce((total, seat) => {
          if (seat.id === player.id && seat.active.damageProtected) return total;
          const loss = seat.active.hp === 1 ? 4 : 2;
          return total + (seat.id === player.id || read.friendly(seat) ? -loss : loss);
        }, 0);
      }
      add(score,'useEvent',{cardId:card.id,targetId:player.id});
      continue;
    }
    if (event.eventType==='tour-gift') {
      const recipient=event.targetIds.find(isAlly);
      if(recipient && cards.length>2)add(4,'useEvent',{cardId:card.id,targetId:recipient});
      continue;
    }
    if (event.targeting !== 'single') {
      const offensive = !['berry-harvest', 'mew-blessing', 'tour-clinic'].includes(event.eventType);
      const affected = offensive ? event.targetIds.filter(id => !publicSeats.get(id).active.damageProtected) : [];
      if (offensive && leaderId && !affected.includes(leaderId)) continue;
      if (affected.includes(read.protectedLeaderId)) continue;
      const score = event.targetIds.reduce((sum, id) => {
        const target = publicSeats.get(id);
        const friendly = isAlly(id);
        if (event.eventType === 'berry-harvest') return sum + (friendly ? 3 : -1);
        if (event.eventType==='tour-clinic')return sum+(friendly?3:-2)*Math.min(1,target.active.maxHp-target.active.hp);
        if (event.eventType === 'mew-blessing') {
          const benefit = (target.active.hp <= 2 ? 6 : 0) + (target.active.level < 3 ? 3 : 0);
          return sum + (friendly ? benefit : -benefit * 0.6);
        }
        if (target.active.damageProtected) return sum;
        const likelyDamage = event.eventType === 'zapdos-punishment' ? target.active.level * 0.25 : target.handCount ? 1.5 : 2;
        const opposed = isEnemy(id);
        return sum + (opposed ? 3 : friendly ? -3 : -1) * likelyDamage +
          (opposed && likelyDamage >= target.active.hp ? 5 : 0);
      }, 0);
      add(score, 'useEvent', { cardId: card.id }, hostile(affected));
      continue;
    }
    for (const id of targetOrder(event.targetIds).filter(isEnemy)) {
      const target = publicSeats.get(id);
      const pokemon = seats.get(id).active;
      if (event.eventType === 'jigglypuff-performance' && target.active.status) continue;
      if (event.eventType === 'rival-challenge' && target.active.damageProtected) continue;
      const bestEffect = event.choices?.filter(choice => choice.targetIds.includes(id)).map(choice => ({
        effect: choice.effect,
        value: { item: itemScore(pokemon) + 1, hand: 4, power: 4, defense: 5, speed: 2 }[choice.effect] ?? 0,
      })).toSorted((a, b) => b.value - a.value)[0];
      if (event.delayed) {
        const score = event.eventType==='hoenn-raikou' && target.active.hp===1 ? 6 : 2;
        add(score + read.pressure(target), 'useEvent', { cardId:card.id, targetId:id }, [id]);
        continue;
      }
      const score = bestEffect?.value ?? (event.eventType === 'rival-challenge'
        ? (target.handCount === 0 ? 10 : activeHP <= 2 ? 2 : 6) : 5);
      add(score + read.pressure(target), 'useEvent', { cardId: card.id, targetId: id, ...(bestEffect ? { effect: bestEffect.effect } : {}) }, [id]);
    }
  }

  if (legal.canEquip) {
    for (const slot of legal.equipSlots) {
      const pokemon = player[slot];
      for (const card of cards.filter(card => card.kind === 'held-item' && legal.equipItems.some(option => option.itemType === card.itemType))) {
        const upgrade = heldItemScore(card, pokemon) - heldItemScore(pokemon.item, pokemon);
        if (upgrade > (pokemon.item ? 2 : 0)) add(2 + upgrade + (slot === 'active' ? 1 : -1),
          'equipItem', { cardId: card.id, slot });
      }
    }
  }
  for (const action of legal.tourActions || []) {
    if((action.kind==='prepare' || action.kind==='observe') && !canAttack)add(1,'tourAction',{action:action.kind});
    if(action.kind==='radio-contact') {
      const {scores,goal} = room.scenario.radio;
      const ours = scores[player.role];
      const theirs = Math.max(...Object.entries(scores).filter(([role])=>role!==player.role).map(([,score])=>score));
      add(ours===goal-1 ? 80 : theirs===goal-1 ? 14 : 7,'tourAction',{action:action.kind});
    }
    if(action.kind==='publish-survey') add(4,'tourAction',{action:action.kind});
    if(action.kind==='lake-shutoff' && (cards.length>=4 || currentHp(active,catalogue)<=2))
      add(10,'tourAction',{action:action.kind});
    if(action.kind==='silph-claim' && cards.length>=3 && (room.scenario.silph.control || cards.length>=4))
      add(room.scenario.silph.control?.anchorId ? 8 : 3,'tourAction',{action:action.kind});
    if(action.kind==='oak-register' || action.kind==='looker-inquiry' || action.kind==='bird-supply') add(4,'tourAction',{action:action.kind});
    if(action.kind==='disguise-trade' && cards.length && cardValue(cards[0])<=3) add(4,'tourAction',{action:action.kind});
    if(action.kind==='viridian-investigate' && !canAttack && cards.length>=4 && cardValue(cards[0])<=3) add(3,'tourAction',{action:action.kind});
    if(action.kind==='illusion-decoy'&&!hasCommand) add(3,'tourAction',{action:action.kind});
    if (action.kind==='shed-disguise' && active.status!=='paralysis' && canAttack &&
        legal.moves.some(move => move.canUse && move.printedValue>0 && move.condition.kind==='command' &&
          move.legalTargetIds.some(id => {
            const opponent = publicSeats.get(id)?.active;
            if (!opponent || opponent.disguise || !isEnemy(id) || (leaderId && id!==leaderId)) return false;
            const target = seats.get(id).active;
            return estimateCommandDamage(room,active,target,move,catalogue) === opponent.hp-1 &&
              estimateCommandDamage(room,active,target,move,catalogue,1) >= opponent.hp;
          }))) add(20,'tourAction',{action:action.kind});

    if(action.kind==='showdown' && !canAttack && cards.length>1 &&
       cards.some(card=>card.weather==='thunderstorm' && cardValue(card)<4) &&
       targetsForShowdown(room.players.filter(seat=>seat.id!==player.id&&!seat.eliminated).map(seat=>seat.id),table,read).length) {
      add(2,'tourAction',{action:action.kind});
    }
    if(action.kind==='all-out' && currentHp(active,catalogue)>=3 && cards.length<=2) add(5,'tourAction',{action:action.kind});
    if(action.kind==='pickup' || action.kind==='forecast')add(3,'tourAction',{action:action.kind});
    if(action.kind==='handoff' && heldItemScore(player.reserve?.item,active)>heldItemScore(active.item,active)+2) add(4,'tourAction',{action:action.kind});
  }
  const ballTargets = targetOrder(legal.lightBallTargets).filter(id => isEnemy(id) && !publicSeats.get(id).active.status);
  const ballTarget = ballTargets.includes(leaderId) ? leaderId : ballTargets[0];
  if (ballTarget) add(6, 'useLightBall', { targetId: ballTarget }, [ballTarget]);

  if (tactical && legal.canSwitch && validReserve) {
    const reserveOffersAttack = hasCommand && freeCommand && !canAttack && (moveFace(player.reserve, catalogue)?.moves ?? [])
      .some(move => move.condition.kind === 'command' && move.printedValue > 0);
    const escape = betterReserve(player, catalogue) && activeHP <= 2;
    const leaveBurn = active.status === 'burn' && !player.reserve.status && betterReserve(player, catalogue);
    if (escape || leaveBurn || (hard && reserveOffersAttack)) {
      add((escape ? 11 : 5) + recoveryBonus + (activeHP === 1 ? 5 : 0) - (canAttack ? 2 : 0), 'switchPokemon');
    }
  }
  if (tactical && legal.canTrait) {
    switch (active.catalogueId) {
      case 'rhyhorn':
        if (hard && activeHP >= 4 && cards.length < 3 && room.drawPile.length + room.discardPile.length > 0)
          add(6, 'useTrait', { hpLoss: 1 });
        break;
      case 'magnemite': {
        const spent = cards.filter(card => card.kind === 'held-item' && active.item && heldItemScore(card, active) <= heldItemScore(active.item, active));
        if (spent.length && legal.trait.maxCards > 0)
          add(6, 'useTrait', { cardIds: spent.slice(0, legal.trait.maxCards).map(card => card.id) });
        break;
      }
      default:
        if (!canAttack && hasCommand) add(4, 'useTrait');
    }
  }
  const canPressureLeader = leaderId && candidates.some(candidate => candidate.hostileIds.includes(leaderId));
  return candidates
    .filter(candidate => !canPressureLeader || !candidate.hostileIds.length || candidate.hostileIds.includes(leaderId))
    .sort((a, b) => b.score - a.score).map(candidate => candidate.action).concat({ type: 'finishPlay' });
}

export function aiActions(room, player, catalogue, preferences) {
  if (room.status === 'identity') return [{ type: 'acknowledgeIdentity' }];
  if (room.status === 'setup') return [player.candidateDeal.length ? { type: 'drawPokemon' } : choosePartners(room, player, catalogue)];
  const table = publicAiTable(room, catalogue);
  const partner = rocketPartnerFor(room,player);
  if (partner) {
    const allySeat = table.find(seat=>seat.id===partner.id);
    allySeat.role = 'rocket';
    allySeat.rocketPartner = true;
  }
  if (player.role==='rocket' && room.settings?.rocketInfiltration && room.scenario?.viridian?.infiltrator?.choice==='rocket') {
    const expected = room.settings.rocketPartners ? 3 : 2;
    const others = table.filter(seat=>seat.id!==player.id);
    const hidden = others.filter(seat=>!seat.role&&!seat.eliminated);
    const unaccounted = expected-1-others.filter(seat=>seat.role==='rocket').length;
    for (const seat of others) {
      if (seat.role==='rocket' || (unaccounted===hidden.length && hidden.includes(seat))) {
        seat.rocketPartner = true;
      }
    }
  }
  if (room.pendingBattle) return [response(room, player, catalogue, table, preferences)].filter(Boolean);
  const legal = previewActions(room, player, catalogue);
  switch (room.turn.phase) {
    case 'draw': return legal?.canTrait && aiDifficulty(player) !== 'easy' ? [{ type: 'useTrait' }, { type: 'draw' }] : [{ type: 'draw' }];
    case 'play': return play(room, player, catalogue, table, preferences, legal);
    case 'discard': return [{ type: 'discard', cardId: cheapestFirst(player.hand)[0].id }];
    case 'end': return [...(legal?.tourActions?.some(action=>action.kind==='brock-care') ? [{type:'tourAction',action:'brock-care'}] : []),...(legal?.tourActions?.some(action=>action.kind==='train') && player.reserve?.level<player.active.level ? [{type:'tourAction',action:'train'}] : []),...(legal?.canTrait ? [{ type: 'useTrait' }] : []), { type: 'endTurn', levelUp: !player.raidBoss && !room.turn.tourLevelUsed && (room.turn.tourLevelTarget && room.turn.tourLevelTarget===player.reserve?.instanceId ? player.reserve.level<3 : player.active.level<3) }];
    default: return [];
  }
}
