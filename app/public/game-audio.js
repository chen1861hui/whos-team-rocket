import {battleCueSpacing, moveEffects, moveRecipe, traitRecipe} from './battlefield-effect-recipes.js';

export const musicTracks = Object.freeze({title:'title',gym:'gym',battle:'battle',rocket:'rocket'});
// BellBlitzKing's recordings: https://bellblitzking.itch.io/pokemon-sound-collection
// Gen VII, with Gen VI Lick. Life Dew uses its own synthesized cue.
export const recordedMoves = moveEffects.map(move=>move.key).filter(key=>key!=='life-dew');
const recordedMoveKeys = new Set(recordedMoves);

const effects = {
  fire: {wave:'sawtooth',from:112,to:47,noise:820,duration:.24},
  water: {wave:'sine',from:300,to:690,noise:1240,duration:.26},
  ice: {wave:'triangle',from:1560,to:540,noise:4150,duration:.19},
  leaf: {wave:'triangle',from:690,to:310,noise:2650,duration:.18},
  poison: {wave:'sine',from:152,to:65,noise:480,duration:.24},
  spirit: {wave:'sine',from:455,to:85,noise:530,duration:.30},
  air: {wave:'sine',from:560,to:180,noise:3500,duration:.22},
  pollen: {wave:'sine',from:670,to:395,noise:1020,duration:.26},
  electric: {wave:'square',from:990,to:166,noise:4600,duration:.16},
  mind: {wave:'sine',from:460,to:1110,noise:0,duration:.27},
  stone: {wave:'triangle',from:102,to:38,noise:420,duration:.29},
  dragon: {wave:'sawtooth',from:250,to:64,noise:600,duration:.32},
  steel: {wave:'triangle',from:430,to:75,noise:1950,duration:.14},
  dark: {wave:'triangle',from:170,to:52,noise:630,duration:.21},
  light: {wave:'sine',from:750,to:1120,noise:0,duration:.21},
  insect: {wave:'triangle',from:1100,to:240,noise:2800,duration:.13},
  prism: {wave:'triangle',from:420,to:1320,noise:1450,duration:.24},
  impact: {wave:'sine',from:127,to:43,noise:810,duration:.13},
  dodge: {wave:'sine',from:510,to:920,noise:2580,duration:.14},
  knockout: {wave:'triangle',from:520,to:145,noise:0,duration:.33},
  dew: {wave:'sine',from:540,to:1080,noise:1700,duration:.25},
};

function cueSound(cue) {
  if (cue.telegraph) return null;
  if (cue.kind === 'attack' && !cue.external) return moveRecipe(cue.name?.en) || {family:'steel'};
  if (cue.kind === 'ability') return traitRecipe(cue.name?.en) || {family:'light'};
  const family = {hit:'impact',dodge:'dodge',knockout:'knockout',event:'prism'}[cue.kind];
  return family ? {family} : null;
}

export function createGameAudio(readPreferences) {
  let context, effectsGain, musicGain, noiseBuffer, unlocked = false, scene = 'title', currentTrack;
  let nextBattleCue = 0;
  const samples = new Map();
  let visibleMoves = ['water-gun'];
  const music = new Audio();
  music.loop = true;
  music.preload = 'none';

  function sync() {
    const prefs = readPreferences();
    if (effectsGain) effectsGain.gain.value = prefs.effects ? prefs.effectsVolume : 0;
    if (musicGain) musicGain.gain.value = prefs.musicVolume;
    else music.volume = prefs.musicVolume;
    if (!unlocked || !prefs.music || document.hidden) { music.pause(); return; }
    const track = Object.hasOwn(musicTracks,prefs.track) ? prefs.track : scene;
    if (track !== currentTrack) {
      currentTrack = track;
      music.src = '/audio/' + musicTracks[track] + '.mp3';
    }
    if (music.paused) music.play().catch(()=>{});
  }

  function unlock() {
    unlocked = true;
    if (!context && window.AudioContext) {
      try {
        context = new AudioContext();
        effectsGain = context.createGain();
        effectsGain.connect(context.destination);
        musicGain = context.createGain();
        context.createMediaElementSource(music).connect(musicGain).connect(context.destination);
        visibleMoves.forEach(loadSample);
      } catch { musicGain = null; }
    }
    if (context?.state !== 'running') context?.resume().catch(()=>{});
    sync();
  }
  // Pointer and keyboard activation both support the browser's audio autoplay policy.
  for (const event of ['click','keydown']) document.addEventListener(event, unlock, {capture:true});
  document.addEventListener('visibilitychange', sync);

  function loadSample(key) {
    if (!context || !recordedMoveKeys.has(key)) return null;
    if (!samples.has(key)) {
      samples.set(key,fetch(`/audio/moves/${key}.mp3`).then(response=>{
        if (!response.ok) throw Error('Move audio unavailable');
        return response.arrayBuffer();
      }).then(bytes=>context.decodeAudioData(bytes)).catch(()=>{ samples.delete(key); return null; }));
    }
    return samples.get(key);
  }

  function playable() { return context?.state === 'running' && effectsGain?.gain.value && !document.hidden; }

  function play(recipe, delay = 0) {
    if (!playable()) return;
    const sample = loadSample(recipe.key);
    if (!sample) { synthesize(recipe,delay); return; }
    const due = context.currentTime + delay;
    sample.then(buffer=>{
      if (!playable() || context.currentTime-due>1.4) return;
      if (!buffer) { synthesize(recipe,Math.max(0,due-context.currentTime)); return; }
      const sound = context.createBufferSource();
      sound.buffer = buffer;
      sound.connect(effectsGain);
      sound.start(Math.max(due,context.currentTime));
    });
  }

  function synthesize(recipe, delay) {
    const effect = effects[recipe.signature] || effects[recipe.family] || effects.steel;
    const count = Math.min(recipe.count || 1,4);
    const duration = effect.duration * Math.min(recipe.scale || 1,1.35);
    const pitch = recipe.form === 'beam' ? .72 : recipe.form === 'slash' ? 1.35 : 1;
    const now = context.currentTime + .012 + delay;
    for (let index=0; index<count; index++) {
      const start = now + index * duration * .45;
      const end = start + duration;
      const oscillator = context.createOscillator(), envelope = context.createGain();
      oscillator.type = effect.wave;
      oscillator.frequency.setValueAtTime(effect.from * pitch * (1+index*.07), start);
      oscillator.frequency.exponentialRampToValueAtTime(effect.to * pitch, end);
      envelope.gain.setValueAtTime(.001,start);
      envelope.gain.exponentialRampToValueAtTime(.17 / Math.sqrt(count),start+.016);
      envelope.gain.exponentialRampToValueAtTime(.001,end);
      oscillator.connect(envelope).connect(effectsGain);
      oscillator.start(start);
      oscillator.stop(end);
    }
    if (!effect.noise) return;
    if (!noiseBuffer) {
      noiseBuffer = context.createBuffer(1,context.sampleRate,context.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      for (let index=0; index<samples.length; index++) samples[index] = Math.random()*2-1;
    }
    const burst = context.createBufferSource(), filter = context.createBiquadFilter(), envelope = context.createGain();
    burst.buffer = noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(effect.noise,now);
    filter.frequency.exponentialRampToValueAtTime(effect.noise*.57,now+duration);
    envelope.gain.setValueAtTime(.001,now);
    envelope.gain.exponentialRampToValueAtTime(.36,now+.014);
    envelope.gain.exponentialRampToValueAtTime(.001,now+duration);
    burst.connect(filter).connect(envelope).connect(effectsGain);
    burst.start(now,0,duration);
  }

  return {
    sync,
    setScene(track) { if (scene !== track) { scene = track; nextBattleCue = 0; sync(); } },
    prepareMoves(names) {
      visibleMoves = ['water-gun',...new Set(names.map(name=>moveRecipe(name)?.key).filter(Boolean))];
      if (readPreferences().effects) visibleMoves.forEach(loadSample);
    },
    playBattleCue(cue) {
      const recipe = cueSound(cue);
      if (recipe) play(recipe);
    },
    victory(winner) {
      if (!playable()) return;
      const melody = winner==='rocket' ? [330,392,523,659] : winner==='challengers' ? [392,494,587,784] : [392,523,659,784];
      const now = context.currentTime;
      melody.forEach((frequency,index)=>{
        const start = now+index*.105;
        const end = start+(index===3?.52:.24);
        const note = context.createOscillator(), envelope = context.createGain();
        note.type = 'triangle';
        note.frequency.value = frequency;
        envelope.gain.setValueAtTime(.001,start);
        envelope.gain.exponentialRampToValueAtTime(.13,start+.025);
        envelope.gain.exponentialRampToValueAtTime(.001,end);
        note.connect(envelope).connect(effectsGain);
        note.start(start);
        note.stop(end);
      });
    },
    playCues(cues) {
      if (!context) return;
      const now = context.currentTime;
      let start = Math.max(now,nextBattleCue);
      for (const [index,cue] of cues.entries()) {
        if (cue.telegraph) continue;
        const recipe = cueSound(cue);
        if (recipe) play(recipe,start-now);
        start += battleCueSpacing(cue,cues[index+1])/1000;
      }
      nextBattleCue = start;
    },
    preview() { unlock(); play(moveRecipe('Water Gun')); },
  };
}
