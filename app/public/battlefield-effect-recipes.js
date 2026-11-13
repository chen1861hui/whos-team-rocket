const moveFamilies = {
  fire: [
    ['Ember','volley',3,.64,.35], ['Flamethrower','beam',1,.99,.20], ['Fire Blast','volley',1,1.42,.12],
    ['Will-O-Wisp','volley',3,.51,.52], ['Fire Fang','strike',2,.96], ['Heat Wave','field',3,1.13],
  ],
  water: [
    ['Water Gun','beam'], ['Aqua Tail','slash',1,1.22], ['Surf','field',3,1.5],
    ['Bubble','volley',6,.62,.46], ['Water Pulse','wave',3,.91,.12], ['Waterfall','field',1,1.28],
    ['Splash','pose',1,.69], ['Life Dew','heal',3,.95],
  ],
  ice: [
    ['Ice Beam','beam'], ['Icicle Spear','volley',4,.81,.19], ['Ice Shard','volley',1,.90,.34], ['Freeze-Dry','field',2,1.03],
  ],
  leaf: [
    ['Leech Seed','volley',1,.67,.56], ['Mega Drain','drain',3,.92,.24],
    ['Giga Drain','drain',5,1.22,.32], ['Seed Bomb','volley',2,1.08,1.65],
  ],
  poison: [
    ['Sludge Bomb','volley',3,.95,.67], ['Toxic','wave',3,.67,.13], ['Poison Sting','volley',2,.53,.06],
    ['Acid Spray','beam',1,.78,.30], ['Sludge Wave','field',3,1.12],
  ],
  spirit: [
    ['Lick','slash',1,.68], ['Shadow Ball','volley',1,1.21,.45], ['Hex','wave',3,.83,.08],
  ],
  air: [
    ['Whirlwind','field',4,.99], ['Wing Attack','slash',2,.95], ['Air Slash','wave',2,.87,.21],
  ],
  pollen: [['Sleep Powder','wave',4,.83,.43]],
  electric: [
    ['Thunder Shock','bolt',1,.72], ['Thunderbolt','bolt',3,1.01],
    ['Thunder','strike-down',3,1.26], ['Thunder Wave','wave',3,.74,.08],
    ['Shock Wave','bolt',2,.93], ['Electroweb','wave',4,1.12,.16],
  ],
  mind: [
    ['Teleport','ward',2,.72], ['Confusion','wave',2,.76,.15], ['Psychic','wave',3,1.12,.21],
    ['Disable','mark',3,.78], ['Zen Headbutt','strike',1,1.06],
    ['Future Sight','mark',4,1.17], ['Psybeam','beam',1,.9,.12],
  ],
  stone: [
    ['Rock Smash','strike',2,1.12], ['Mud-Slap','volley',3,.69,.28],
    ['Bulldoze','field',2,1.09], ['Earthquake','field',3,1.52],
    ['Bone Rush','slash',3,.95], ['Bonemerang','volley',2,.85,.90],
    ['Rock Throw','volley',1,1.18,1.58], ['Rock Slide','volley',4,1.06,2.2], ['Stone Edge','field',2,1.16],
  ],
  dragon: [
    ['Twister','field',3,1.12], ['Dragon Rage','volley',1,1.32,.22],
    ['Draco Meteor','volley',5,1.28,2.60],
  ],
  steel: [
    ['Tackle','strike',1,.83], ['Pound','strike',1,.89], ['Spike Cannon','volley',4,.89,.07],
    ['Protect','ward',3,1.01], ['Pay Day','volley',4,.71,.64], ['Fake Out','strike',2,.72],
    ['Brick Break','slash',1,1.15], ['Dynamic Punch','strike',1,1.39], ['Hyper Beam','beam',1,1.47,.06],
    ['Scratch','slash',3,.71], ['Close Combat','strike',4,1.23], ['Double Kick','strike',2,.95],
    ['Horn Attack','strike',1,1.02], ['Megahorn','strike',1,1.36], ['Double-Edge','strike',2,1.34],
    ['Reversal','strike',2,1.19], ['Stomp','field',1,1.06], ['Body Slam','strike',1,1.40],
  ],
  dark: [
    ['Knock Off','slash',1,1.04], ['Thief','slash',2,.73], ['Bite','strike',2,.86],
  ],
  light: [
    ['Moonlight','heal',2,1.04], ['Helping Hand','heal',3,.82], ['Charm','mark',2,.85],
    ['Light Screen','ward',3,1.13], ['Sweet Kiss','mark',3,.95], ['Lock-On','mark',3,.85],
  ],
  insect: [
    ['Fury Attack','strike',3,.83], ['U-turn','slash',1,.93], ['Fury Cutter','slash',3,.93],
    ['Swords Dance','ward',4,1.10], ['X-Scissor','slash',2,1.28],
  ],
  prism: [['Tri Attack','volley',3,1.06,.23]],
};

const traitFamilies = {
  fire: [['Blaze','flare'],['Drought','sun'],['Defiant','flare']],
  leaf: [['Chlorophyll','sun'],['Harvest','gather'],['Sniper','focus']],
  water: [['Rain Dish','heal'],['Swift Swim','flow'],['Water Absorb','flow']],
  poison: [['Poison Touch','cloud'],['Poison Point','focus'],['Neutralizing Gas','cloud']],
  steel: [['Skill Link','focus'],['Limber','ward'],['Guts','flare'],['Rattled','flow'],['Moxie','flare'],
    ['Battle Armor','ward'],['Reckless','flare'],['Technician','focus'],['Pressure','ward']],
  spirit: [['Levitate','flow'],['Cursed Body','cloud']],
  insect: [['Shield Dust','ward'],['Shed Skin','ward'],['Compound Eyes','focus']],
  air: [['Keen Eye','focus']],
  stone: [['Sand Veil','cloud'],['Arena Trap','ward']],
  electric: [['Static','flare'],['Analytic','focus'],['Vital Spirit','ward']],
  mind: [['Synchronize','gather'],['Oblivious','ward'],['Forewarn','focus'],['Download','gather']],
  light: [['Pickup','gather'],['Cute Charm','flow'],['Justified','gather'],['Healer','heal'],
    ['Early Bird','ward'],['Illuminate','sun'],['Intimidate','flare'],['Gluttony','heal']],
  dragon: [['Marvel Scale','ward'],['Multiscale','ward']],
};

const slug = name => name.toLowerCase().replaceAll(/[^a-z0-9]+/g,'-');
// Signature shapes and paths within the common battle timing and material system.
const signatures = {
  Ember:'cinders',Flamethrower:'fire-stream','Fire Blast':'fire-star','Will-O-Wisp':'wisps','Fire Fang':'jaws','Heat Wave':'heat-front',
  'Water Gun':'water-stream','Aqua Tail':'tail-wave',Surf:'surf',Bubble:'bubbles','Water Pulse':'pulse-orb',Waterfall:'cascade',Splash:'splash','Life Dew':'dew',
  'Ice Beam':'ice-beam','Icicle Spear':'icicles','Ice Shard':'ice-shard','Freeze-Dry':'frost',
  'Leech Seed':'vines','Mega Drain':'sap','Giga Drain':'sap-burst','Seed Bomb':'seed',
  'Sludge Bomb':'sludge-glob',Toxic:'venom-cloud','Poison Sting':'needles','Acid Spray':'acid-stream','Sludge Wave':'sludge-front',
  Lick:'tongue','Shadow Ball':'shadow-orb',Hex:'hex-rings',
  Whirlwind:'wind-spiral','Wing Attack':'wing-arc','Air Slash':'air-blades','Sleep Powder':'pollen',
  'Thunder Shock':'short-sparks',Thunderbolt:'branching-bolts',Thunder:'sky-strike','Thunder Wave':'static-rings','Shock Wave':'electric-front',Electroweb:'web',
  Teleport:'portal',Confusion:'mind-ripples',Psychic:'psychic-pressure',Disable:'seal','Zen Headbutt':'headbutt','Future Sight':'omen',Psybeam:'prism-beam',
  'Rock Smash':'broken-stone','Mud-Slap':'mud-fan',Bulldoze:'ground-front',Earthquake:'faults','Bone Rush':'bone-strikes',Bonemerang:'boomerang','Rock Throw':'boulder','Rock Slide':'rockfall','Stone Edge':'spires',
  Twister:'tornado','Dragon Rage':'dragon-orb','Draco Meteor':'meteors',
  Tackle:'rush',Pound:'palm','Spike Cannon':'spikes',Protect:'shell','Pay Day':'coins','Fake Out':'clap','Brick Break':'chop','Dynamic Punch':'punch','Hyper Beam':'hyper-beam',
  Scratch:'claws','Close Combat':'flurry','Double Kick':'kicks','Horn Attack':'horn',Megahorn:'great-horn','Double-Edge':'recoil-rush',Reversal:'counter',Stomp:'stomp','Body Slam':'slam',
  'Knock Off':'knock-away',Thief:'snatch',Bite:'dark-jaws',Moonlight:'moon','Helping Hand':'helping-light',Charm:'hearts','Light Screen':'screen','Sweet Kiss':'kiss','Lock-On':'reticle',
  'Fury Attack':'jabs','U-turn':'return-arc','Fury Cutter':'rapid-cuts','Swords Dance':'swords','X-Scissor':'cross-cut','Tri Attack':'triad',
};
const moves = Object.fromEntries(Object.entries(moveFamilies).flatMap(([family,entries])=>
  entries.map(([name,form,count=1,scale=1,arc=0])=>
    [name,{name,key:slug(name),family,form,count,scale,arc,signature:signatures[name],
      rhythm: form==='strike' || form==='slash' ? 1/Math.sqrt(scale) : Math.sqrt(scale)}])));
export const moveEffects = Object.freeze(Object.values(moves));
const traits = Object.fromEntries(Object.entries(traitFamilies).flatMap(([family,entries])=>
  entries.map(([name,form])=>[name,{key:slug(name),family,form}])));

export function moveRecipe(name) { return Object.hasOwn(moves,name) ? moves[name] : undefined; }
export function traitRecipe(name) { return Object.hasOwn(traits,name) ? traits[name] : undefined; }

export const moveReleaseDuration = 1080;

function moveContact(recipe) {
  if (!recipe) return .48;
  if (recipe.signature==='water-stream' || recipe.signature==='acid-stream') return .46;
  if (recipe.signature==='fire-stream') return .53;
  switch (recipe.form) {
    case 'beam': return .56;
    case 'volley':
    case 'wave': return Math.min(.79,.20+.43*recipe.rhythm);
    case 'bolt':
    case 'strike-down': return .31;
    case 'drain': return .26;
    case 'strike':
    case 'slash': return .43;
    default: return .53;
  }
}

export function battleCueSpacing(cue, nextCue) {
  if (cue.kind==='knockout' || cue.telegraph) return 0;
  if (cue.kind==='event-action') return 1600;
  if (cue.kind==='event') return 1480;
  if (cue.external) return 1020;
  const recipe = moveRecipe(cue.name?.en);
  if (cue.release) {
    const reacts = nextCue?.kind==='hit' || nextCue?.kind==='dodge';
    return Math.round((reacts ? moveContact(recipe) : .76)*moveReleaseDuration);
  }
  if (cue.kind==='ability') return nextCue?.release ? 90 : 560;
  if (cue.kind==='attack') return recipe ? 880 : 690;
  if (nextCue?.release && (cue.kind==='hit' || cue.kind==='dodge')) return 360;
  return recipe ? 640 : 470;
}
