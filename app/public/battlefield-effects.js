import * as THREE from '/vendor/three.module.js';
import {clone} from '/vendor/addons/utils/SkeletonUtils.js';
import {playCardFace} from './play-card-face.js';
import {createEventPokemonMotion} from './pokemon-battle-motion.js';
import {createMoveEffects,effectRecipe} from './battlefield-move-effects.js';
import {battleCueSpacing,moveReleaseDuration} from './battlefield-effect-recipes.js';
import {eventGraphics,responseGraphics} from './battlefield-event-effects.js';

const styles = [
  ['fire',0xff632f,/ember|flame|flamethrower|fire|heat wave|will-o-wisp|moltres/i],
  ['water',0x40b8ff,/water|bubble|hydro|surf|aqua/i],
  ['electric',0xffe544,/thunder|volt|spark|electric|zapdos/i],
  ['ice',0xb5eeff,/ice|icicle|blizzard|freeze/i],
  ['grass',0x83ed55,/vine|leaf|drain|seed|solar|leech/i],
  ['earth',0xc08b65,/earthquake|bone|rock|sand|mud|dig/i],
  ['poison',0xd35af4,/sludge|poison|toxic|acid|smog/i],
  ['psychic',0xf293ff,/psy|confusion|shadow|hypnosis|sleep|mewtwo|jigglypuff|dream|sing/i],
];
const slash = ['slash',0xffe0a2];
const up = new THREE.Vector3(0,1,0);
const pulse = t => Math.sin(Math.PI * THREE.MathUtils.clamp(t,0,1));
const eventStyles = {
  'mewtwo-threat':['psychic',0xf092ff],
  'moltres-trial':['fire',0xff632f],
  'zapdos-punishment':['electric',0xffe544],
  'articuno-protection':['ice',0xb5eeff],
  'mew-blessing':['aura',0xffa6dc],
  'jigglypuff-performance':['psychic',0xffb6df],
  'farfetchd-prank':['wind',0xe9f0b4],
  'mr-mime-trick':['psychic',0xf293ff],
  'berry-harvest':['grass',0xa4ea69],
  'rival-challenge':slash,
};
const eventDex = {
  'jigglypuff-performance':39, 'farfetchd-prank':83, 'mr-mime-trick':122,
  'articuno-protection':144, 'zapdos-punishment':145, 'moltres-trial':146,
  'mewtwo-threat':150, 'mew-blessing':151,
};
const flying = new Set([144,145,146]);
const sky = new THREE.Vector3(0,8.4,-11.5);
const shortEvents = new Set(['farfetchd-prank','mr-mime-trick','jigglypuff-performance','articuno-protection']);
const abilityStyles = {
  Blaze:'fire', Drought:'fire', 'Poison Point':'poison', 'Poison Touch':'poison',
  Guts:'fighting', Defiant:'fighting', Multiscale:'guard', 'Marvel Scale':'guard', 'Battle Armor':'guard',
  Static:'electric', 'Water Absorb':'water', 'Swift Swim':'water', Harvest:'grass', Gluttony:'grass',
};
const auraColors = {fire:0xff7a2d,poison:0xd184ff,fighting:0xffaf56,guard:0x8bedff,
  electric:0xffdf58,water:0x62bbff,grass:0xa8f185,aura:0xa5dfff};

function getStyle(cue) {
  if (cue.kind==='ability') {
    const style = abilityStyles[cue.name?.en] || 'aura';
    return [style,auraColors[style]];
  }
  if (cue.kind==='hit') return ['impact',0xff7d5b];
  if (cue.kind==='dodge') return ['wind',0xd1f6ff];
  if (eventStyles[cue.effect]) return eventStyles[cue.effect];
  const move = `${cue.name?.en || ''} ${cue.effect || ''}`;
  return styles.find(([, , pattern])=>pattern.test(move)) || slash;
}
function makeTransfer(scene,cue,from,to,art,reducedMotion) {
  const group = new THREE.Group();
  const meshes = [];
  const add = (geometry,color) => {
    const mesh = new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,toneMapped:false}));
    meshes.push(mesh);
    group.add(mesh);
    return mesh;
  };
  if (cue.object==='marker') {
    add(new THREE.OctahedronGeometry(.39),0xf4d26c);
  } else {
    add(new THREE.BoxGeometry(.78,1.07,.08),0xffd389);
    const face = add(new THREE.BoxGeometry(.68,.96,.086),0x692e52);
    if (art) {
      const item = new THREE.Sprite(new THREE.SpriteMaterial({map:art,toneMapped:false,depthTest:false}));
      item.position.z = .08;
      item.scale.set(.65,.65,1);
      item.renderOrder = 2;
      group.add(item);
    } else {
      add(new THREE.TorusGeometry(.17,.028,8,28),0xffdb93).position.z = .058;
      add(new THREE.SphereGeometry(.052,10,8),0xffdb93).position.z = .067;
    }
    face.position.z = .003;
  }
  scene.add(group);
  return {
    animate(t) {
      const travel = THREE.MathUtils.smoothstep(t,.41,.90);
      group.visible = reducedMotion || (t>=.41 && t<.95);
      group.position.copy(from).lerp(to,reducedMotion ? .58 : travel);
      group.position.y += reducedMotion ? .7 : Math.sin(travel*Math.PI)*(cue.action==='take'?1.6:1.15);
      group.rotation.set(.15+travel*1.4,travel*(cue.action==='take'?3.4:7),-.2-travel);
      group.scale.setScalar(1.08-THREE.MathUtils.smoothstep(t,.83,1)*.57);
    },
    dispose() {
      group.removeFromParent();
      for (const mesh of meshes) { mesh.geometry.dispose(); mesh.material.dispose(); }
      for (const item of group.children) if (item.isSprite) item.material.dispose();
    },
  };
}

export function createTrainerReveal(parent,color) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false,
    blending:THREE.AdditiveBlending,toneMapped:false});
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.43,.024,6,36),material);
  ring.rotation.x = -Math.PI/2;
  const sparkGeometry = new THREE.OctahedronGeometry(.045);
  const sparks = Array.from({length:8},()=>new THREE.Mesh(sparkGeometry,material));
  group.add(ring,...sparks);
  parent.add(group);
  return {
    update(progress) {
      const glow = Math.sin(Math.PI*progress);
      material.opacity = glow*.94;
      ring.position.y = .06+progress*1.07;
      ring.scale.setScalar(.9+.42*glow);
      for (const [index,spark] of sparks.entries()) {
        const angle = index*Math.PI/4+progress*1.35;
        const radius = .31+progress*.31;
        spark.position.set(Math.cos(angle)*radius,.13+progress*(.57+index%3*.19),Math.sin(angle)*radius);
        spark.scale.setScalar(glow*(.72+index%3*.22));
      }
    },
    dispose() {
      group.removeFromParent();
      ring.geometry.dispose();
      sparkGeometry.dispose();
      material.dispose();
    },
  };
}

export function createTraitAura(pod) {
  const group = new THREE.Group();
  pod.modelSlot.parent.add(group);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.04,.032,8,48),
    new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,toneMapped:false}));
  ring.rotation.x = -Math.PI/2;
  ring.position.y = .06;
  group.add(ring);
  const spark = new THREE.OctahedronGeometry(.15);
  const bubble = new THREE.SphereGeometry(.14,10,8);
  const ember = new THREE.OctahedronGeometry(.067).scale(.72,1.38,.72);
  const material = new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,toneMapped:false});
  const motes = Array.from({length:10},()=>{
    const mote = new THREE.Mesh(spark,material);
    group.add(mote);
    return mote;
  });
  return {
    update(style,strength,size,time,reducedMotion) {
      group.visible = Boolean(style && strength>0);
      if (!group.visible) return;
      group.position.copy(pod.modelSlot.position);
      group.scale.setScalar(size);
      const color = auraColors[style] || auraColors.aura;
      ring.material.color.setHex(color);
      ring.material.opacity = strength*.75;
      ring.scale.setScalar(.97 + strength*.12);
      material.color.setHex(color);
      material.opacity = style==='fire' ? Math.min(1,.33+strength) : strength;
      const seconds = reducedMotion ? .3 : time*.001;
      const geometry = style==='fire' ? ember : ['poison','water'].includes(style) ? bubble : spark;
      for (const [index,mote] of motes.entries()) {
        const lift = (seconds*(style==='fire'?1.9:.8)+index/motes.length)%1;
        const angle = index*Math.PI*2/motes.length + seconds*(style==='poison'?.65:1.2);
        const radius = 1.06+Math.sin(lift*Math.PI)*.13;
        mote.geometry = geometry;
        mote.position.set(Math.cos(angle)*radius,.23+lift*1.8,Math.sin(angle)*radius);
        mote.rotation.set(lift*.25,angle,Math.sin(angle)*.23);
        mote.scale.setScalar((.56+strength*.56)*(.36+Math.sin(lift*Math.PI)*.75));
      }
    },
    dispose() {
      group.removeFromParent();
      ring.geometry.dispose(); ring.material.dispose(); material.dispose();
      spark.dispose(); bubble.dispose(); ember.dispose();
    },
  };
}

const statusEffects = {
  burn: {count:7, size:.57, speed:.88, color:'#ff9b4b', edge:'#c64e20'},
  poison: {count:6, size:.49, speed:.58, color:'#cc77eb', edge:'#60217e'},
  paralysis: {count:4, size:.83, speed:.94, color:'#ffe570', edge:'#8f570b'},
  sleep: {count:3, size:.65, speed:.44, color:'#bfeaff', edge:'#325889'},
  confusion: {count:4, size:.51, speed:.48, color:'#ffdb87', edge:'#a15722'},
  flinch: {count:1, size:.88, speed:.60, color:'#fff4de', edge:'#c74330'},
};

function statusTexture(status,{color,edge}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.lineJoin = ctx.lineCap = 'round';
  ctx.lineWidth = 5;
  ctx.strokeStyle = edge;
  ctx.fillStyle = color;
  ctx.beginPath();
  switch (status) {
    case 'burn': {
      const flame = ctx.createLinearGradient(0,12,0,85);
      flame.addColorStop(0,'#ffda83');
      flame.addColorStop(.54,color);
      flame.addColorStop(1,'#f24f25');
      ctx.fillStyle = flame;
      ctx.moveTo(49,10);
      ctx.bezierCurveTo(40,39,75,40,73,64);
      ctx.bezierCurveTo(72,94,20,94,21,61);
      ctx.bezierCurveTo(20,44,32,37,34,27);
      ctx.bezierCurveTo(34,48,46,51,49,10);
      break;
    }
    case 'poison': {
      const bubble = ctx.createRadialGradient(35,34,4,49,49,33);
      bubble.addColorStop(0,'#f4caff');
      bubble.addColorStop(.6,color);
      bubble.addColorStop(1,'#913eae');
      ctx.fillStyle = bubble;
      ctx.arc(48,48,31,0,Math.PI*2);
      break;
    }
    case 'paralysis':
      ctx.moveTo(55,9);
      ctx.lineTo(19,56);
      ctx.lineTo(44,52);
      ctx.lineTo(38,87);
      ctx.lineTo(77,37);
      ctx.lineTo(52,41);
      break;
    case 'sleep':
      ctx.font = '900 70px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 8;
      ctx.strokeText('Z',48,50);
      ctx.fillText('Z',48,50);
      break;
    case 'confusion':
      for (let i=0; i<10; i++) {
        const angle = -Math.PI/2+i*Math.PI/5;
        const radius = i%2 ? 15 : 34;
        ctx.lineTo(48+Math.cos(angle)*radius,48+Math.sin(angle)*radius);
      }
      break;
    case 'flinch':
      ctx.moveTo(39,14);
      ctx.lineTo(57,14);
      ctx.lineTo(53,57);
      ctx.lineTo(43,57);
      ctx.closePath();
      ctx.moveTo(56,73);
      ctx.arc(48,73,8,0,Math.PI*2);
      break;
  }
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  if (status==='burn') {
    ctx.fillStyle = '#ffe796';
    ctx.beginPath();
    ctx.moveTo(49,48);
    ctx.bezierCurveTo(47,60,65,65,57,76);
    ctx.bezierCurveTo(51,84,34,79,37,70);
    ctx.bezierCurveTo(38,63,44,60,49,48);
    ctx.fill();
  } else if (status==='flinch') {
    ctx.strokeStyle = '#ff9d77';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(13,32); ctx.lineTo(26,40);
    ctx.moveTo(83,32); ctx.lineTo(70,40);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createStatusEffect(pod,status) {
  if (!Object.hasOwn(statusEffects,status)) return null;
  const style = statusEffects[status];
  const texture = statusTexture(status,style);
  const group = new THREE.Group();
  const particles = Array.from({length:style.count},()=>{
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map:texture,depthWrite:false,depthTest:status!=='flinch',toneMapped:false,
    }));
    group.add(sprite);
    return sprite;
  });
  pod.modelSlot.parent.add(group);
  const started = performance.now();
  return {
    status,
    update(visible,size,time,reducedMotion) {
      group.visible = visible;
      if (!visible) return;
      group.position.copy(pod.modelSlot.position);
      const bounds = pod.visual?.footprint;
      const height = Math.max(.75,(bounds?.top ?? 1.65)*size);
      const base = Math.max(.06,(bounds?.bottom ?? 0)*size);
      const width = THREE.MathUtils.clamp((bounds?.halfWidth ?? .7)*size,.48,1.38);
      const depth = THREE.MathUtils.clamp((bounds?.halfDepth ?? .6)*size,.48,1.22);
      const seconds = reducedMotion ? 0 : Math.max(0,time-started)*.001;
      const entrance = reducedMotion ? 0 : 1-THREE.MathUtils.smoothstep(seconds,0,.48);
      for (const [i,sprite] of particles.entries()) {
        const phase = (seconds*style.speed+i/particles.length+.18)%1;
        const rise = Math.sin(Math.PI*phase);
        const angle = i*Math.PI*2/particles.length+.6;
        const x = Math.cos(angle), z = Math.sin(angle);
        let scale = style.size, opacity = .93, rotation = 0;
        switch (status) {
          case 'burn':
            sprite.position.set(x*(width+.27),base+.13+phase*.95,z*(depth+.30));
            scale *= .43+rise*.66;
            opacity *= rise;
            rotation = Math.sin(angle+phase*4)*.22;
            break;
          case 'poison':
            sprite.position.set(x*(width+.22)+Math.sin(phase*5+angle)*.13,
              base+.24+phase*(height*.64+.35),z*(depth+.24));
            scale *= (.64+(i%3)*.16)*(.58+phase*.66);
            opacity *= Math.min(1,rise*1.7);
            break;
          case 'paralysis': {
            const shock = reducedMotion ? .72 : Math.pow(Math.max(0,Math.cos(phase*Math.PI*2)),2.3);
            sprite.position.set(x*(width+.37),base+.27+(height-base)*(.22+i%2*.46),z*(depth+.34));
            scale *= .83+shock*.26;
            opacity *= .22+.78*shock;
            rotation = i%2 ? .53 : -.45;
            break;
          }
          case 'sleep':
            sprite.position.set(.15+phase*.56,height+.22+phase*.82,.05+phase*.22);
            scale *= .59+phase*.60;
            opacity *= Math.min(1,rise*1.8);
            rotation = -.14-phase*.15;
            break;
          case 'confusion': {
            const orbit = angle+seconds*3;
            sprite.position.set(Math.cos(orbit)*(width*.53+.33),height+.29+Math.sin(orbit)*.13,
              Math.sin(orbit)*(depth*.57+.28));
            scale *= .85+Math.sin(orbit)*.14;
            rotation = orbit*.52;
            break;
          }
          case 'flinch': {
            const hop = reducedMotion ? 0 : Math.pow(rise,7);
            sprite.position.set(0,height*.77+.20+hop*.18,-1.10);
            scale *= .87+hop*.24;
            opacity *= .7+hop*.3;
            break;
          }
        }
        sprite.scale.setScalar(scale*(1+entrance*.26));
        sprite.material.rotation = rotation;
        sprite.material.opacity = Math.min(1,opacity*(1+entrance*.36));
      }
    },
    dispose() {
      group.removeFromParent();
      for (const sprite of particles) sprite.material.dispose();
      texture.dispose();
    },
  };
}

export function createBattleEffects(scene, pods, loadModel) {
  const queued = [], playing = [];
  const cardActors = new Map();
  const podById = new Map(pods.map(pod=>[pod.id,pod]));
  let nextStart = 0;
  let activeCardEvent;
  const motions = new Map();
  const traitBursts = new Map();
  const steadyBlaze = new Map();
  let moveEffects;
  const midpoint = pod => pod.position.clone().setY(1.04);
  const textureLoader = new THREE.TextureLoader(), portraits = new Map();
  let songNote;
  function textureFor(art) {
    if (!portraits.has(art)) {
      const texture = textureLoader.load(`/play-card-art/${art}`);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      portraits.set(art,texture);
    }
    return portraits.get(art);
  }
  function singingNotes(origin) {
    if (!songNote) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 96;
      const context = canvas.getContext('2d');
      context.font = 'bold 72px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.lineWidth = 5;
      context.strokeStyle = '#813a79';
      context.fillStyle = '#fff0fa';
      context.strokeText('♪',48,49);
      context.fillText('♪',48,49);
      songNote = new THREE.CanvasTexture(canvas);
      songNote.colorSpace = THREE.SRGBColorSpace;
    }
    const notes = Array.from({length:5},()=>new THREE.Sprite(new THREE.SpriteMaterial({
      map:songNote,transparent:true,depthWrite:false,toneMapped:false,
    })));
    scene.add(...notes);
    return {
      animate(t) {
        for (const [i,note] of notes.entries()) {
          const age = THREE.MathUtils.clamp((t-.26-i*.081)/.38,0,1);
          note.visible = age>0 && age<1;
          if (!note.visible) continue;
          const side = i%2 ? 1 : -1;
          note.position.copy(origin).add(new THREE.Vector3(side*(.32+age*(.38+i*.07)),.65+age*1.42,.55+age*.25));
          note.scale.setScalar(.55+age*.13);
          note.material.rotation = side*(.14+age*.15);
          note.material.opacity = Math.min(1,age*6,(1-age)*5);
        }
      },
      dispose() {
        for (const note of notes) { note.removeFromParent(); note.material.dispose(); }
      },
    };
  }
  function eventActor(cue,reducedMotion,near,target) {
    const art = playCardFace({kind:'event',eventType:cue.effect},'en').art[0];
    if (!art) return null;
    const group = new THREE.Group();
    const dex = eventDex[cue.effect];
    let alive = true, sprite, model, mixer, motion;
    const side = near ? Math.sign(target.position.x-near.x) : 0;
    function addSprite() {
      if (!alive) return;
      sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:textureFor(art),transparent:true,depthWrite:false,toneMapped:false}));
      group.add(sprite);
    }
    if (dex) loadModel(dex).then(asset=>{
      if (!alive) return;
      if (!asset) { addSprite(); return; }
      model = clone(asset.mount);
      model.position.y = flying.has(dex) ? -.7 : -1.15;
      model.rotation.set(0,0,0);
      group.add(model);
      motion = createEventPokemonMotion(model,dex);
      if (asset.idle) {
        mixer = new THREE.AnimationMixer(model.children[0]);
        mixer.clipAction(asset.idle).play();
      }
    }).catch(addSprite);
    else addSprite();
    scene.add(group);
    return {
      get modelLoaded() { return Boolean(model); },
      get position() { return group.position.lengthSq() ? group.position.clone() : sky; },
      animate(t, presentation) {
        const action = presentation?.action ?? cue;
        const shield = action.action==='shield';
        const entry = reducedMotion ? 1 : presentation?.entry ?? THREE.MathUtils.smoothstep(t,0,.28);
        const exit = reducedMotion ? 0 : presentation?.exit ?? THREE.MathUtils.smoothstep(t,shield ? .86 : .75,1);
        const idleTime = presentation?.idleTime ?? t*1.55;
        const dive = !reducedMotion && action.external ? Math.sin(t*Math.PI)**2 : 0;
        group.position.copy(sky);
        group.position.x += -7*(1-entry)+exit*6;
        group.position.y += reducedMotion ? 0 : Math.sin(idleTime*5.5)*.20+exit*1.3-dive*.55;
        group.position.z += dive*1.2;
        const nearEntry = presentation || shield || reducedMotion ? entry : THREE.MathUtils.smoothstep(t,.10,.45);
        const reach = near ? nearEntry : 0;
        const gesture = near && !reducedMotion && !shield && action.action
          ? Math.sin(Math.PI*THREE.MathUtils.smoothstep(t,.30,.66)) : 0;
        if (near) {
          group.position.lerp(near,reach*(1-exit*.75));
          group.position.x += side*gesture*.48;
        }
        if (model) {
          const pitch = dex===146 ? .48 : flying.has(dex) ? .32 : .10;
          const yaw = shield && near ? target.angle+Math.PI : .22+side*(reach*.57+gesture*.24);
          model.rotation.set(pitch+dive*.25+gesture*.14,yaw-(1-entry)*.85+exit*.7,
            (1-entry)*.2-exit*.22-side*gesture*.18);
          model.scale.setScalar((flying.has(dex)?2.65:1.72)*(.70+entry*.30-exit*.30-reach*.31));
          motion.reset();
          mixer?.setTime(reducedMotion ? .1 : idleTime);
          if (!reducedMotion) motion.pose(t,action,side);
        }
        if (sprite) {
          const size = 2.6+entry*.8;
          const image = sprite.material.map.image;
          const ratio = image?.width && image?.height ? image.width/image.height : 1;
          sprite.scale.set(size*Math.min(1,ratio),size*Math.min(1,1/ratio),1);
          sprite.material.opacity = entry*(1-exit);
        }
      },
      dispose() { alive = false; group.removeFromParent(); mixer?.stopAllAction(); sprite?.material.dispose(); },
    };
  }
  function actorPosition(cue,target) {
    if (!target || !shortEvents.has(cue.effect)) return null;
    if (cue.action==='shield') {
      // A seat faces local -Z. Its +Z axis points behind the Pokémon.
      const behind = new THREE.Vector3(0,2.85,1.65).applyAxisAngle(up,target.angle);
      return midpoint(target).add(behind);
    }
    return midpoint(target).add(new THREE.Vector3(target.position.x>0 ? -2.4 : 2.4,.95,-.45));
  }
  function startCardActor(cue,time,reducedMotion) {
    if (cardActors.has(cue.eventId)) return;
    const target = podById.get(cue.targetIds[0]);
    const near = actorPosition(cue,target);
    const actor = eventActor(cue,reducedMotion,near,target);
    if (actor) cardActors.set(cue.eventId,{cue,actor,near,focus:near && {targetIds:cue.targetIds},start:time,exitAt:null});
  }
  return {
    preload(types = []) {
      for (const type of new Set(types)) if (eventDex[type]) loadModel(eventDex[type]).catch(()=>{});
    },
    enqueue(cues, time, currentEvent) {
      activeCardEvent = currentEvent;
      for (const [index,cue] of cues.entries()) {
        if (cue.telegraph) continue;
        if (cue.kind==='knockout') {
          // The arena handles model removal; this queues only its sound.
          const hit = queued.findLast(entry=>entry.cue.kind==='hit' && entry.cue.targetIds.some(id=>cue.targetIds.includes(id)));
          const start = hit ? hit.start + 400 : time;
          const index = queued.findIndex(entry=>entry.start>start);
          queued.splice(index<0 ? queued.length : index,0,{cue,start});
          continue;
        }
        const start = Math.max(time,nextStart);
        const recipe = effectRecipe(cue);
        const moveKey = recipe?.key;
        queued.push({cue,start,recipe,moveKey});
        nextStart = start + battleCueSpacing(cue,cues[index+1]);
      }
    },
    pendingHit(id) {
      return queued.find(({cue})=>cue.kind==='hit' && cue.targetIds.includes(id))?.cue;
    },
    get active() { return queued.length>0 || playing.length>0 || cardActors.size>0; },
    get skyActive() { return playing.some(action=>action.actor) || [...cardActors.values()].some(entry=>!entry.near); },
    get nearFocus() {
      return playing.findLast(action=>action.near && (action.cue.action==='shield' || action.progress>=.24))?.focus ??
        [...cardActors.values()].findLast(entry=>entry.focus && entry.arrived)?.focus;
    },
    get responseFocus() {
      const cue = playing.findLast(action=>action.cue.release || action.cue.kind==='hit' || action.cue.kind==='dodge')?.cue;
      return cue && {targetIds:cue.targetIds,sourceId:cue.sourceId};
    },
    traitBurst(id) { return traitBursts.get(id); },
    updateSteadyBlaze(pod,visible,time,reducedMotion) {
      let effect = steadyBlaze.get(pod.id);
      if (!visible) {
        effect?.dispose();
        steadyBlaze.delete(pod.id);
        return;
      }
      if (!effect) {
        moveEffects ??= createMoveEffects(scene);
        effect = moveEffects.createSteadyBlaze(pod);
        steadyBlaze.set(pod.id,effect);
      }
      effect.animate(reducedMotion ? .35 : time*.001);
    },
    get eventModel() { return playing.findLast(action=>action.actor?.modelLoaded)?.cue.effect ??
      [...cardActors.values()].findLast(entry=>entry.actor.modelLoaded)?.cue.effect; },
    get moveEffect() { return playing.findLast(action=>action.moveKey)?.moveKey; },
    get eventEffect() {
      const action = playing.findLast(action=>action.eventEffect);
      return action && `${action.cue.effect}:${action.cue.action || action.cue.kind}`;
    },
    update(time,reducedMotion,playCue) {
      motions.clear();
      traitBursts.clear();
      while (queued.length && queued[0].start <= time) {
        const {cue,start,recipe,moveKey} = queued.shift();
        playCue?.(cue);
        if (cue.kind==='knockout') continue;
        const source = podById.get(cue.sourceId);
        const targets = (cue.targetIds || []).map(id=>podById.get(id)).filter(Boolean);
        const [style] = getStyle(cue);
        const activation = cue.kind==='event';
        const settlement = cue.kind==='event-action';
        const target = targets[0];
        const near = (activation || settlement) ? actorPosition(cue,target) : null;
        if (activation && cue.eventId) startCardActor(cue,time,reducedMotion);
        const isEvent = activation || settlement || cue.external;
        const origin = near || cardActors.get(cue.eventId)?.actor.position || sky;
        const graphics = isEvent ? eventGraphics(scene,cue,{source,target,origin,reducedMotion}) : [];
        const eventEffect = isEvent && graphics.length>0;
        if (near && activation && cue.effect==='jigglypuff-performance' && !reducedMotion) {
          graphics.push(singingNotes(near));
        }
        if (settlement && target && ['take','discard'].includes(cue.action)) {
          const from = target.spritePosition.clone();
          from.y += cue.object==='card' ? 2.05 : 1.18;
          const to = cue.action==='take' && source
            ? source.spritePosition.clone().add(new THREE.Vector3(0,1.65,.60))
            : from.clone().add(new THREE.Vector3(target.position.x>=0?4.4:-4.4,-1.50,1.55));
          const art = cue.itemType && playCardFace({kind:'held-item',itemType:cue.itemType},'en').art[0];
          graphics.push(makeTransfer(scene,cue,from,to,art?textureFor(art):null,reducedMotion));
        }
        if (settlement && target && cue.action==='harvest') {
          const to = midpoint(target).add(new THREE.Vector3(0,.58,0));
          graphics.push(makeTransfer(scene,{action:'take',object:'card'},new THREE.Vector3(0,1,0),to,null,reducedMotion));
        }
        if (!isEvent && !reducedMotion) {
          if (recipe) {
            moveEffects ??= createMoveEffects(scene);
            const destinations = cue.kind==='ability' ? [target] : targets;
            for (const destination of destinations) {
              const effect = moveEffects.create(recipe,cue.kind,source,destination);
              if (effect) graphics.push(effect);
            }
          } else if (cue.kind==='hit' || cue.kind==='dodge') {
            for (const destination of targets) graphics.push(responseGraphics(scene,cue.kind,destination));
          }
        }
        const oneShot = cue.action==='shield' || (!cue.eventId && (activation || settlement || cue.external));
        const actor = oneShot ? eventActor(cue,reducedMotion,near,target) : null;
        if (actor) graphics.push(actor);
        const duration = settlement?1600:activation?1480:cue.external?1450:
          cue.release?moveReleaseDuration:cue.kind==='attack'?(moveKey?1320:1080):cue.kind==='ability'?(moveKey?1320:820):
          cue.kind==='dodge'?820:moveKey?980:720;
        const focus = near && {targetIds:cue.targetIds,sourceId:cue.action==='take'?cue.sourceId:null};
        playing.push({cue,start,duration,source,targets,graphics,style,actor,near,focus,moveKey,recipe,eventEffect});
      }
      for (let i=playing.length-1;i>=0;i--) {
        const action = playing[i], t = (time-action.start)/action.duration;
        if (t>=1) {
          action.graphics.forEach(effect=>effect.dispose());
          playing.splice(i,1);
        }
      }
      for (const action of playing) {
        const {cue,source,targets,start,duration,graphics,style} = action;
        const t = (time-start)/duration;
        action.progress = reducedMotion ? 1 : t;
        graphics.forEach(effect=>effect.animate(t));
        if (cue.kind==='ability' && source && (!action.moveKey || reducedMotion)) {
          traitBursts.set(source.id,{style,strength:reducedMotion?.78:.42+pulse(t)*.58});
        }
        const body = cue.kind==='event' ? null : cue.kind==='attack'||cue.kind==='ability' ? source : targets[0];
        if (cue.kind==='event-action' && !reducedMotion && t<.40) continue;
        if (body && !(cue.kind==='attack' && cue.external)) {
          const other = cue.kind==='attack' ? targets[0] : source;
          const direction = other ? other.position.clone().sub(body.position).setY(0).applyAxisAngle(up,-body.angle).normalize() : new THREE.Vector3(0,0,-1);
          const form = action.recipe?.form;
          const specialCast = cue.kind==='attack' && ['beam','volley','wave','bolt','strike-down','drain','mark'].includes(form);
          const physicalCast = cue.kind==='attack' && (form==='strike' || form==='slash');
          motions.set(body.id,{cue,t,direction,style,specialCast,physicalCast,recipe:action.recipe});
        }
      }
      if (activeCardEvent && !queued.some(action=>action.cue.kind==='event' && action.cue.eventId===activeCardEvent.eventId)) {
        startCardActor(activeCardEvent,time,reducedMotion);
      }
      for (const [id,entry] of cardActors) {
        const {actor,cue,start} = entry;
        const related = playing.filter(action=>action.cue.eventId===id);
        const performing = related.findLast(action=>action.cue.effect===cue.effect &&
          ['event','event-action','attack'].includes(action.cue.kind));
        if (activeCardEvent?.eventId===id || related.length || queued.some(action=>action.cue.eventId===id)) {
          entry.exitAt = null;
        } else entry.exitAt ??= time;
        const exit = entry.exitAt===null ? 0 : THREE.MathUtils.smoothstep(time-entry.exitAt,0,reducedMotion ? 1 : 720);
        if (exit===1) {
          actor.dispose();
          cardActors.delete(id);
          continue;
        }
        const elapsed = time-start;
        entry.arrived = reducedMotion || elapsed>=300;
        actor.animate(performing?.progress ?? 0,{action:performing?.cue,entry:THREE.MathUtils.smoothstep(elapsed,0,550),
          exit,idleTime:elapsed/1000});
      }
      return motions;
    },
    dispose() {
      for (const action of playing) action.graphics.forEach(effect=>effect.dispose());
      for (const effect of steadyBlaze.values()) effect.dispose();
      steadyBlaze.clear();
      for (const entry of cardActors.values()) entry.actor.dispose();
      cardActors.clear();
      playing.length=queued.length=0;
      for (const texture of portraits.values()) texture.dispose();
      portraits.clear();
      songNote?.dispose();
      moveEffects?.dispose();
    },
  };
}

export function animateBattlePose(pod,motion,time,reducedMotion) {
  const {modelSlot,visual} = pod;
  const idle = !reducedMotion && visual?.rig?.airborne && !visual.mixer && !pod.change;
  const breathing = idle ? Math.sin(time*.003 + pod.angle*1.8) : 0;
  modelSlot.position.set(0,.27+breathing*.043,-.24);
  modelSlot.rotation.set(0,0,0);
  modelSlot.scale.set(1,1+breathing*.026,1);
  if (!motion || reducedMotion || (pod.change && !pod.change.waitForHit)) return;
  const {cue,t,direction,style,specialCast,recipe} = motion, swing = pulse(t);
  if (cue.kind==='attack') {
    const windup = pulse(t/.37);
    const release = pulse((t-.23)/.69);
    const strike = release*(specialCast?.25:style==='slash'?1.26:.91)-windup*.26;
    modelSlot.position.addScaledVector(direction,strike);
    modelSlot.position.y += release*.28-windup*.12;
    const facing = specialCast ? THREE.MathUtils.smoothstep(t,0,.17)*(1-THREE.MathUtils.smoothstep(t,.79,1)) : swing;
    if (direction.lengthSq()>.01) modelSlot.rotation.y = Math.atan2(-direction.x,-direction.z)*facing;
    modelSlot.rotation.x = release*.14-windup*.11;
    modelSlot.scale.y += release*.048-windup*.095;
  } else if (cue.kind==='hit') {
    const recoil = THREE.MathUtils.smoothstep(t,0,.075)*(1-THREE.MathUtils.smoothstep(t,.23,1));
    const grounded = recipe?.form==='field' && recipe.family==='stone';
    const slash = recipe?.form==='slash';
    const electric = recipe?.family==='electric';
    const force = grounded?.20:recipe?.form==='strike'?1.03:.73;
    modelSlot.position.addScaledVector(direction,-recoil*force);
    modelSlot.position.x += Math.sin(t*(electric?94:37))*recoil*(electric?.23:.11);
    modelSlot.position.y += (grounded?Math.abs(Math.sin(t*34))*.38:slash?.26:.10)*recoil;
    modelSlot.rotation.z = (slash?-.60:grounded?-.17:-.39)*recoil;
    modelSlot.rotation.x = (grounded?.17:-.12)*recoil;
    modelSlot.scale.y -= (grounded?.18:.12)*recoil;
  } else if (cue.kind==='dodge') {
    const step = THREE.MathUtils.smoothstep(t,0,.24)*(1-THREE.MathUtils.smoothstep(t,.46,1));
    const side = direction.x > .12 ? -1 : 1;
    modelSlot.position.x += step*1.22*side;
    modelSlot.position.y += pulse((t-.08)/.68)*.57;
    modelSlot.rotation.z = -.38*step*side;
    modelSlot.rotation.x = .14*step;
  } else if (cue.kind==='event-action') {
    if (cue.action==='discard') modelSlot.rotation.z = .17*pulse((t-.40)/.30);
  } else {
    modelSlot.position.y += swing*.17;
    modelSlot.scale.y += swing*.055;
  }
}

export function battleEffectLabel(cue,language) {
  if (!cue) return '';
  if (cue.kind==='hit') return `−${cue.amount} HP`;
  if (cue.kind==='dodge') return language==='zh'?'闪避':'Dodge';
  if (cue.kind==='event-action') {
    if (cue.action==='shield') return language==='zh'?'急冻鸟的护盾':'Articuno’s shield';
    if (!['take','discard'].includes(cue.action)) return cue.name?.[language] || cue.name?.en || '';
    const object = cue.object==='card' ? ['a hand card','手牌'] : cue.object==='item' ? ['the held item','持有物'] : ['a boost marker','强化指示物'];
    return language==='zh' ? `${cue.action==='take'?'取得':'打落'}${object[1]}` : `${cue.action==='take'?'Took':'Knocked away'} ${object[0]}`;
  }
  return cue.name?.[language] || cue.name?.en || '';
}
