import * as THREE from '/vendor/three.module.js';
import {GLTFLoader} from '/vendor/addons/loaders/GLTFLoader.js';
import {clone} from '/vendor/addons/utils/SkeletonUtils.js';
import {coastalSeatLayout, coastalStationLayout, pokemonArenaModelScale, pokemonLevelScale, seatLayout} from './battlefield-layout.js';
import {animateBattlePose, battleEffectLabel, createBattleEffects, createStatusEffect, createTrainerReveal, createTraitAura} from './battlefield-effects.js';
import {civilianProfiles, gymLeaderProfiles} from './trainer-profiles.js';
import {waterGymArcadeBounds,waterGymRearStation} from './battlefield-arcade.js';
import {createGymTerrain} from './battlefield-terrain.js';
import {createDraftModels} from './battlefield-draft.js';
import {createPokemonBattleMotion,preparePokemonIdle} from './pokemon-battle-motion.js';

const colors = [0xec604a, 0x4599d5, 0xe4b643, 0x8b78c5, 0x3f9c85, 0xe289a0];
const palettes = {
  fire: {sky:0x5b3741, edge:0x86605b, trim:0x372a31, accent:0xff9b49},
  water: {sky:0x81bddc, edge:0xd9c4a3, trim:0x807566, accent:0x80eaff},
  grass: {sky:0xa7c09a, edge:0xa9a580, trim:0x536248, accent:0xd1ed79},
  stadium: {sky:0xd8e8e6, ground:0x719a71, field:0x5d8e63, edge:0xe5e4cd, trim:0x213d42, seats:0xc65242},
  gym: {sky:0x162c41, ground:0x1b354a, field:0x32576b, edge:0x6e98ac, trim:0x112b3b, seats:0x497b95},
  floating: {sky:0xbcdbe7, ground:0x9ac2d3, field:0x83a784, edge:0xf1e6cc, trim:0x507886, seats:0xe6c396},
};

const trainerRevealColors = {leader:0x89e5ff,gym:0x93f1bf,rocket:0xff745c,challenger:0xffd58a,jenny:0x79baff,joy:0xffaad8};
const pokemonPodiumTop = .26;
function shorelineLeaves() {
  const positions = [], colors = [];
  for (let i=0;i<12;i++) {
    const angle = i*2.39996;
    const s = Math.sin(angle), c = Math.cos(angle);
    const rootX=s*.14, rootZ=c*.14;
    const height=.29+(i%5)*.093, bend=.18+(i%4)*.057, width=.045+(i%3)*.014;
    const root=[rootX,0,rootZ];
    const left=[rootX+s*bend*.36-c*width,height*.49,rootZ+c*bend*.36+s*width];
    const right=[rootX+s*bend*.36+c*width,height*.49,rootZ+c*bend*.36-s*width];
    const tip=[rootX+s*bend,height,rootZ+c*bend];
    const shade = new THREE.Color([0x416447,0x6a854e,0x8a994e][i%3]);
    positions.push(...root,...right,...left,...left,...right,...tip);
    for (let v=0;v<6;v++) colors.push(shade.r,shade.g,shade.b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  return geometry;
}

export function createBattlefield() {
  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:true, powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.domElement.className = 'battlefield-canvas';
  renderer.domElement.setAttribute('aria-hidden','true');
  const camera = new THREE.PerspectiveCamera(41, 1, 0.1, 150);
  const loader = new GLTFLoader();
  const models = new Map();
  const mutedMaterials = new Map(), modelMaterials = new WeakMap();
  const trainerSlots = [];
  const cameraBase = new THREE.Vector3(), cameraTarget = new THREE.Vector3();
  const turnTarget = new THREE.Vector3(), cameraRight = new THREE.Vector3();
  const desiredCamera = new THREE.Vector3(), desiredTarget = new THREE.Vector3();
  const flyingMotionBounds = new THREE.Box3();
  const faintCenter = new THREE.Vector3(), faintLanding = new THREE.Vector3();
  const faintPitch = new THREE.Quaternion(), slotInverse = new THREE.Quaternion();
  const horizontalAxis = new THREE.Vector3(1,0,0);
  const framingCamera = new THREE.PerspectiveCamera();
  const framingPoint = new THREE.Vector3();
  const badgeSizes = new WeakMap();
  let cameraFit;
  let sceneryAngle = 0;
  let seatedCoastalViewer = false;
  let forms, draftModels, cameraReady = false, eligible = null, marked = [], aimBottom = 0, previousFrame = 0;
  let turnFocus = null;
  let scene, host, config, battleEffects, terrain, contactMap, geometryKey = '', pods = [], labelLayer, spriteLayer, targetLayer, observer, disposed = false, lost = false, lastFrame = 0;

  function muteModel(model, muted) {
    model?.traverse(part => {
      if (!part.isMesh) return;
      if (!muted) {
        if (modelMaterials.has(part)) {
          part.material = modelMaterials.get(part);
          modelMaterials.delete(part);
        }
        return;
      }
      modelMaterials.set(part,part.material);
      const dim = material => {
        if (!mutedMaterials.has(material)) {
          const copy = material.clone();
          copy.color?.multiplyScalar(.59);
          copy.emissive?.multiplyScalar(.59);
          mutedMaterials.set(material,copy);
        }
        return mutedMaterials.get(material);
      };
      part.material = Array.isArray(part.material) ? part.material.map(dim) : dim(part.material);
    });
  }

  function modelFor(active) {
    forms ??= fetch('/pokemon-models/forms.json').then(response => {
      if (!response.ok) throw Error('Pokémon model catalogue is unavailable');
      return response.json();
    });
    return forms.then(catalogue => modelForDex(catalogue[active.catalogueId]?.[active.level - 1]));
  }
  function modelForDex(dex) {
    if (!dex) return null;
    if (!models.has(dex)) models.set(dex, loader.loadAsync(`/pokemon-models/${dex}.glb?v=11`).then(({scene: asset, animations}) => {
      const idle = animations.find(clip=>clip.name==='idle');
      const faint = animations.find(clip=>clip.name==='faint');
      const special = animations.find(clip=>clip.name==='special');
      const physical = animations.find(clip=>clip.name==='physical');
      const nativeIdle = asset.userData.nativeBattleIdle === true || dex===58 || dex===143;
      let pose;
      if (idle) {
        pose = new THREE.AnimationMixer(asset);
        pose.clipAction(idle).play();
        pose.setTime(.1);
        asset.updateMatrixWorld(true);
      }
      const bounds = new THREE.Box3().setFromObject(asset,nativeIdle);
      let ground = bounds.min.y;
      const groundTime = asset.userData.idleGroundTime;
      if (pose && Number.isFinite(groundTime)) {
        pose.setTime(groundTime);
        asset.updateMatrixWorld(true);
        ground = Math.min(ground,new THREE.Box3().setFromObject(asset,true).min.y);
        pose.setTime(.1);
        asset.updateMatrixWorld(true);
      }
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      if (!idle) preparePokemonIdle(asset,dex,bounds);
      const extent = Math.max(size.x,size.y,size.z,.01);
      const arenaScale = pokemonArenaModelScale(dex,size);
      const span = dex===142 ? 3.05 : 2.25;
      const scale = span/extent;
      const mount = new THREE.Group();
      asset.scale.multiplyScalar(scale);
      asset.position.set(-center.x * scale, -ground * scale, -center.z * scale);
      asset.traverse(part => {
        if (part.isMesh) {
          part.castShadow = true;
          part.receiveShadow = true;
          if (part.isSkinnedMesh) part.frustumCulled = false;
        }
      });
      mount.add(asset);
      mount.rotation.y = Math.PI;
      return {dex,mount,idle,faint,special,physical,arenaScaleRatio:arenaScale/scale,
        footprint:{halfWidth:size.x*arenaScale/2,halfDepth:size.z*arenaScale/2,
          bottom:(bounds.min.y-ground)*arenaScale,top:(bounds.max.y-ground)*arenaScale},
        arenaLabelLift:Math.max(-.42,size.y*(arenaScale-scale))+(bounds.min.y-ground)*arenaScale};
    }));
    return models.get(dex);
  }

  function addTrainer(parent, index, leader, {portrait = false, local = false, avatar, commandPost, previous} = {}) {
    const slot = new THREE.Group();
    if (portrait) {
      slot.rotation.y = -.22;
    } else {
      if (commandPost) {
        slot.position.set(0,commandPost.y+.41,commandPost.z);
        slot.rotation.y = Math.PI;
      } else {
        slot.position.set(-1.72,0,local ? .28 : .78);
        slot.rotation.y = Math.PI;
      }
    }
    slot.scale.setScalar(leader ? 1.95 : 1.76);
    slot.restPosition = slot.position.clone();
    slot.restYaw = slot.rotation.y;
    slot.idleSide = index%2 ? -1 : 1;
    parent.add(slot);
    trainerSlots.push(slot);
    slot.defaultProfile = leader ? (gymLeaderProfiles[config.theme] || gymLeaderProfiles.fire) : civilianProfiles[index % civilianProfiles.length];
    if (previous && avatar && previous.profile !== avatar) installTrainer(slot,previous.profile,previous.asset);
    setTrainerModel(slot, avatar || slot.defaultProfile);
    return slot;
  }

  function setTrainerModel(slot, profile) {
    if (slot.profile === profile) return;
    slot.profile = profile;
    slot.pendingTrainer = null;
    slot.reveal?.effect.dispose();
    slot.reveal = null;
    if (slot.modelProfile === profile) return;
    if (!models.has(profile)) {
      const pending = loader.loadAsync(`/trainer-models/${profile}.glb?v=2`).then(({scene: mount, animations}) => {
        mount.traverse(part => {
          if (part.isMesh) {
            part.castShadow = true;
            // The standing bounds cannot describe the reach of a skinned gesture.
            if (part.isSkinnedMesh) part.frustumCulled = false;
          }
        });
        return {mount, animations};
      }).catch(error => {
        if (models.get(profile) === pending) models.delete(profile);
        throw error;
      });
      models.set(profile, pending);
    }
    models.get(profile).then(asset => {
      if (disposed || !trainerSlots.includes(slot) || slot.profile !== profile) return;
      if (slot.model && !config.reducedMotion) slot.pendingTrainer = {profile,asset};
      else installTrainer(slot,profile,asset);
      if (!lost) host.dataset.mode = displayMode();
      draw(performance.now());
    }).catch(() => {
      if (!disposed && trainerSlots.includes(slot) && slot.profile === profile && !slot.model && profile !== slot.defaultProfile) {
        setTrainerModel(slot,slot.defaultProfile);
      }
    });
  }

  function installTrainer(slot,profile,asset) {
    slot.animation?.mixer.stopAllAction();
    slot.model?.removeFromParent();
    const model = clone(asset.mount);
    slot.model = model;
    slot.modelProfile = profile;
    slot.modelAsset = asset;
    slot.add(model);
    slot.motion = null;
    const mixer = new THREE.AnimationMixer(model);
    const joints = ['RArm','RForeArm','RHand','Spine2','Head','LArm','LForeArm','LHand','Waist',
      'RThigh','RLeg','RFoot','LThigh','LLeg','LFoot'].map(name=>model.getObjectByName(name));
    const facing = slot.getWorldQuaternion(new THREE.Quaternion()).multiply(trainerPoseBasis);
    const idleAxes = joints.map(joint=>{
      if (!joint?.parent) return null;
      const inverse=joint.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(facing);
      return [new THREE.Vector3(1,0,0).applyQuaternion(inverse),
        new THREE.Vector3(0,1,0).applyQuaternion(inverse),
        new THREE.Vector3(0,0,1).applyQuaternion(inverse)];
    });
    slot.animation = {mixer,joints,clips:new Map(asset.animations.map(clip=>[clip.name,clip])),
      idleAxes,idleRotation:new THREE.Quaternion(),
      jointBase:joints.map(()=>new THREE.Quaternion()),hasOverlay:false};
    slot.ballHand = joints[2];
  }

  // The trainer assets face +Z. Pose directions use +X on the trainer's right and -Z forward.
  const trainerPoseBasis = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI);
  const poseFacing = new THREE.Quaternion(), parentInverse = new THREE.Quaternion(), limbTurn = new THREE.Quaternion();
  const boneFrom = new THREE.Vector3(), boneTo = new THREE.Vector3(), limbAim = new THREE.Vector3();
  function aimTrainerLimb(joint, tip, x, y, z, weight) {
    if (!joint?.parent || !tip || weight<=0) return;
    joint.getWorldPosition(boneFrom);
    tip.getWorldPosition(boneTo);
    joint.parent.getWorldQuaternion(parentInverse).invert();
    boneTo.sub(boneFrom).normalize().applyQuaternion(parentInverse);
    limbAim.set(x,y,z).normalize().applyQuaternion(poseFacing).applyQuaternion(parentInverse);
    limbTurn.identity().slerp(parentInverse.setFromUnitVectors(boneTo,limbAim),weight);
    joint.quaternion.premultiply(limbTurn);
  }

  function animateTrainerReveal(pod,time) {
    const slot = pod.trainerSlot;
    if (slot.pendingTrainer && !slot.reveal && !pod.change?.waitForHit && !config.reducedMotion) {
      const color = trainerRevealColors[slot.pendingTrainer.profile] ?? trainerRevealColors[pod.role] ?? 0xffe5b0;
      slot.reveal = {started:time,effect:createTrainerReveal(slot,color)};
    }
    const elapsed = time-(slot.reveal?.started ?? time);
    if (slot.pendingTrainer && (config.reducedMotion || elapsed>=310)) {
      const {profile,asset} = slot.pendingTrainer;
      installTrainer(slot,profile,asset);
      slot.pendingTrainer = null;
      if (Number.isFinite(pod.defeatAt)) pod.defeatAt = time-120;
    }
    if (!slot.reveal) return;
    if (config.reducedMotion || elapsed>=850) {
      slot.reveal.effect.dispose();
      slot.reveal = null;
    } else slot.reveal.effect.update(elapsed/850);
  }

  function poseTrainer(slot, name, progress, time, {direction, lookYaw=0}={}) {
    const animation = slot?.animation;
    const clipName = name==='throw' ? 'command' : name==='victory' ? 'idle' : ['ready','evade','reveal'].includes(name) ? 'brace' : name;
    const clip = animation?.clips.get(clipName);
    if (!clip) return;
    const animate = !config.reducedMotion;
    slot.position.copy(slot.restPosition);
    slot.rotation.set(0,slot.restYaw,0);
    const {joints,jointBase} = animation;
    if (animation.hasOverlay) {
      joints.forEach((joint,index)=>joint?.quaternion.copy(jointBase[index]));
      animation.hasOverlay = false;
    }
    if (animation.action?.getClip() !== clip) {
      const next = animation.mixer.clipAction(clip);
      if (animation.outgoing!==next) animation.outgoing?.stop();
      animation.outgoing = animation.action;
      animation.action = next.reset().play();
      animation.action.paused = true;
      animation.blendAt = time;
    }
    if (animation.outgoing) {
      const weight = animate ? THREE.MathUtils.smoothstep(time-animation.blendAt,0,170) : 1;
      animation.action.setEffectiveWeight(weight);
      if (weight>=1) {
        animation.outgoing.stop();
        animation.outgoing = null;
      } else animation.outgoing.setEffectiveWeight(1-weight);
    }
    const sample = name==='idle' || name==='victory' ? .14 : name==='throw' ? THREE.MathUtils.smoothstep(progress,.27,.89) :
      name==='ready' ? .26 : name==='defeat' ? Math.min(.84,progress) : progress;
    animation.action.time = sample*clip.duration;
    animation.mixer.update(0);
    const changed = slot.motion !== name;
    slot.motion = name;
    if (changed) animation.poseAt = time;
    joints.forEach((joint,index)=>{ if (joint) jointBase[index].copy(joint.quaternion); });
    animation.hasOverlay = true;
    const [arm,forearm,hand,chest,head,leftArm,leftForearm,leftHand] = joints;
    slot.getWorldQuaternion(poseFacing).multiply(trainerPoseBasis);
    const side = slot.idleSide;
    const tilt=(index,axis,angle)=>{
      const basis=animation.idleAxes[index]?.[axis];
      if (basis) joints[index].quaternion.premultiply(animation.idleRotation.setFromAxisAngle(basis,angle));
    };
    const braceLeg = (index,bend)=>{
      tilt(index,0,bend);
      tilt(index+1,0,-bend*1.68);
      tilt(index+2,0,bend*.68);
    };
    const ease = (from,to)=>THREE.MathUtils.smoothstep(progress,from,to);
    if (name==='idle') {
      const entry=animate ? THREE.MathUtils.smoothstep(time-animation.poseAt,0,220) : 1;
      const composed = slot.modelProfile==='erika' || slot.modelProfile==='joy' || slot.modelProfile==='civilian-older-f';
      const stance = composed ? .075 : .14;
      tilt(8,2,side*stance*entry);
      tilt(3,2,-side*stance*.72*entry);
      tilt(3,1,side*.13*entry);
      tilt(4,1,lookYaw*.65*entry);
      braceLeg(side>0?9:12,stance*entry);
      if (composed) {
        aimTrainerLimb(arm,forearm,.12,-1,-.28,.72*entry);
        aimTrainerLimb(leftArm,leftForearm,-.12,-1,-.28,.72*entry);
        aimTrainerLimb(forearm,hand,-.63,-.32,-.85,.74*entry);
        aimTrainerLimb(leftForearm,leftHand,.63,-.32,-.85,.74*entry);
      } else {
        const [upper,lower,wrist] = side>0 ? [arm,forearm,hand] : [leftArm,leftForearm,leftHand];
        aimTrainerLimb(upper,lower,side*.33,-1,.08,.75*entry);
        aimTrainerLimb(lower,wrist,-side*.72,-.72,-.55,.8*entry);
      }
    } else if (name==='ready') {
      const ready = THREE.MathUtils.smoothstep(time-animation.poseAt,0,280);
      slot.position.y -= .055*ready;
      tilt(3,0,-.15*ready);
      tilt(4,1,lookYaw*.55*ready);
      braceLeg(9,.18*ready);
      braceLeg(12,.11*ready);
      aimTrainerLimb(arm,forearm,.34,-1,-.2,ready*.76);
      aimTrainerLimb(forearm,hand,-.36,.34,-1,ready*.86);
    } else if (name==='command') {
      const windup = ease(0,.16)*(1-ease(.19,.32));
      const point = ease(.17,.34)*(1-ease(.66,.98));
      const aim = direction?.lengthSq()>.01 ? THREE.MathUtils.clamp(Math.atan2(-direction.x,-direction.z),-.94,.94) : 0;
      tilt(8,1,aim*.47*point+side*.20*windup);
      tilt(3,0,-.18*point+.11*windup);
      tilt(3,1,aim*.28*point);
      tilt(4,1,lookYaw*.36*point);
      braceLeg(9,.19*point);
      slot.position.y -= .035*point;
      aimTrainerLimb(arm,forearm,.46,.24,.38,windup*.92);
      aimTrainerLimb(forearm,hand,-.35,.66,-.35,windup*.9);
      aimTrainerLimb(arm,forearm,Math.sin(-aim)*.65+.14,.06+side*.15,-1,point*.97);
      aimTrainerLimb(forearm,hand,Math.sin(-aim)*.70,.12+side*.11,-1,point*.96);
      aimTrainerLimb(leftArm,leftForearm,-.56,-.8,.25,point*.75);
    } else if (name==='brace' || name==='evade') {
      const recoil = ease(0,.14)*(1-ease(.40,.94));
      const dodge = name==='evade';
      const away = direction?.x>0 ? -1 : 1;
      tilt(3,0,(dodge?-.16:.25)*recoil);
      tilt(3,2,-away*(dodge?.25:.14)*recoil);
      tilt(4,0,-.24*recoil);
      tilt(4,1,lookYaw*.43*recoil);
      braceLeg(9,.18*recoil);
      braceLeg(12,.28*recoil);
      slot.position.y -= .078*recoil;
      aimTrainerLimb(arm,forearm,dodge?.34:.75,-.42,-.65,recoil*.86);
      aimTrainerLimb(forearm,hand,dodge?-.15:-.42,.6,-.9,recoil*.93);
      aimTrainerLimb(leftArm,leftForearm,dodge?-.7:-.72,-.46,dodge?.22:-.55,recoil*.85);
      aimTrainerLimb(leftForearm,leftHand,.45,.48,-1,recoil*.9);
    } else if (name==='throw') {
      const windup = Math.sin(Math.PI*THREE.MathUtils.smoothstep(progress,.11,.50));
      const release = Math.sin(Math.PI*THREE.MathUtils.smoothstep(progress,.32,.86));
      slot.position.x += release*.40;
      slot.position.z -= release*.29;
      slot.rotation.y -= (windup*.61+release*.66);
      slot.rotation.x += windup*.08-release*.16;
      arm?.rotateZ(windup*.58-release*.45);
      forearm?.rotateX(-windup*.89+release*.32);
      hand?.rotateZ(windup*.25-release*.30);
      chest?.rotateY(windup*.31-release*.28);
      head?.rotateY(release*.19);
      braceLeg(9,.18*windup+.16*release);
      braceLeg(12,.09*windup+.24*release);
    } else if (name==='reveal') {
      const turn = Math.sin(progress*Math.PI);
      slot.rotation.y += turn*.52;
      slot.rotation.x = -.12*turn;
      chest?.rotateY(turn*.27);
      head?.rotateX(-turn*.14);
    } else if (name==='defeat') {
      const drop = ease(.13,.82);
      slot.position.y -= drop*.12;
      tilt(8,0,-.11*drop);
      tilt(3,0,-.28*drop);
      tilt(4,0,-.37*drop);
      braceLeg(9,.32*drop);
      braceLeg(12,.25*drop);
      aimTrainerLimb(arm,forearm,.26,-1,-.15,drop*.91);
      aimTrainerLimb(forearm,hand,-.36,-.64,-.46,drop*.91);
      aimTrainerLimb(leftArm,leftForearm,-.26,-1,-.15,drop*.91);
      aimTrainerLimb(leftForearm,leftHand,.36,-.64,-.46,drop*.91);
    } else if (name==='victory') {
      const salute = ease(.12,.66);
      const windup = ease(0,.22)*(1-ease(.28,.58));
      const rocket = slot.modelProfile?.startsWith('rocket-');
      tilt(8,2,side*.14*salute);
      tilt(3,2,-side*.18*salute);
      tilt(4,0,.12*salute);
      aimTrainerLimb(arm,forearm,.43,-.64,-.35,windup*.94);
      aimTrainerLimb(forearm,hand,-.32,.78,-.22,windup*.92);
      aimTrainerLimb(arm,forearm,rocket?.93:.68,rocket?.55:.86,-.17,salute*.93);
      aimTrainerLimb(forearm,hand,rocket?.9:.15,rocket?.58:1,-.30,salute*.94);
      aimTrainerLimb(leftArm,leftForearm,-.42,-1,0,salute*.9);
      aimTrainerLimb(leftForearm,leftHand,.73,-.69,-.36,salute*.84);
    }
  }

  function throwFromTrainer(pod, transition, t, release, land) {
    const hand = pod.trainerSlot.ballHand;
    const point = hand ? pod.ball.parent.worldToLocal(hand.getWorldPosition(new THREE.Vector3()))
      : new THREE.Vector3(-1.30,1.25,.60);
    if (t < release) {
      pod.ball.position.copy(point);
      pod.ball.rotation.x = -.35;
      return;
    }
    transition.releasePoint ??= point;
    const flight = THREE.MathUtils.clamp((t-release)/(land-release),0,1);
    pod.ball.position.copy(transition.releasePoint).lerp(new THREE.Vector3(0,.47,-.24),flight);
    pod.ball.position.y += 4*flight*(1-flight)*1.08;
    pod.ball.rotation.x = flight*Math.PI*3;
  }

  function displayMode() {
    const portrait = Number.isInteger(config.portraitIndex);
    return lost || (portrait && !trainerSlots[0]?.children.length) ? 'flat' : '3d';
  }

  function mountDraftModels() {
    if (!lost && config.draftCenter) {
      try {
        draftModels ??= createDraftModels(modelFor,()=>draw(performance.now()));
        draftModels.mount(config.draftCenter);
        return;
      } catch { /* The draft still shows the illustration without WebGL. */ }
    }
    draftModels?.dispose();
    draftModels = null;
  }

  function updateModels() {
    const knockouts = new Set((config.cues || []).filter(cue => cue.kind === 'knockout').flatMap(cue => cue.targetIds));
    const hits = new Set((config.cues || []).filter(cue => cue.kind === 'hit').flatMap(cue => cue.targetIds));
    const started = performance.now();
    for (const pod of pods) {
      const player = config.players.find(player => player.id === pod.id);
      pod.role = player?.role;
      setTrainerModel(pod.trainerSlot, player?.trainerAvatar || pod.trainerSlot.defaultProfile);
      const active = player?.active;
      pod.activePokemon = active;
      const key = active && !active.defeated ? `${active.catalogueId}:${active.level}` : '';
      const fainting = Boolean(key && active.hp <= 0);
      pod.passiveTrait = player?.passiveTrait;
      pod.passiveStyle = player?.passiveStyle;
      pod.status = key && !fainting ? active.status : null;
      if (pod.statusEffect && pod.statusEffect.status !== pod.status) {
        pod.statusEffect.dispose();
        pod.statusEffect = null;
      }
      if (fainting && pod.faintAt == null) {
        pod.faintAt = pod.visual && key === pod.modelKey ? started : -Infinity;
        pod.faintWait = hits.has(pod.id) ? {until:started+1800,seen:false} : null;
      }
      if (!fainting && pod.faintAt != null) {
        if (key && key === pod.modelKey && pod.down) pod.recovery = {started, from:pod.down};
        pod.faintAt = null;
        pod.faintWait = null;
      }
      if (player?.eliminated && pod.defeatAt == null) pod.defeatAt = knockouts.has(pod.id) ? started : -Infinity;
      if (!player?.eliminated) pod.defeatAt = null;
      if (pod.modelKey === key) continue;
      const knockedOut = !config.reducedMotion && pod.visual && knockouts.has(pod.id);
      const down = pod.down || 0;
      pod.recovery = null;
      pod.modelKey = key;
      pod.modelRequest = active;
      if (!key) {
        if (knockedOut) {
          pod.modelSlot.clear();
          pod.modelSlot.add(pod.visual.model);
          pod.change = {kind:'knockout', started, down, waitForHit:hits.has(pod.id)};
          continue;
        }
        pod.modelSlot.clear();
        pod.visual = pod.change = null;
        continue;
      }
      modelFor(active).then(asset => {
        if (disposed || !pods.includes(pod) || pod.modelRequest !== active) return;
        if (!asset) throw Error('No arena model for this Pokémon form');
        const previous = pod.visual;
        const sameForm = previous?.dex === asset.dex;
        const size = pokemonLevelScale(active.level);
        const next = {model:sameForm ? previous.model : clone(asset.mount),
          dex:asset.dex, family:active.catalogueId, level:active.level, size,labelLift:asset.arenaLabelLift,
          footprint:asset.footprint};
        if (asset.dex===143) next.faintWaist = next.model.getObjectByName('Waist');
        if (!sameForm) {
          const body = next.model.children[0];
          body.scale.multiplyScalar(asset.arenaScaleRatio);
          body.position.multiplyScalar(asset.arenaScaleRatio);
        }
        next.rig = sameForm ? previous.rig : createPokemonBattleMotion(next.model,asset.dex);
        if (sameForm) {
          next.mixer = previous.mixer;
          next.idleAction = previous.idleAction;
          next.faintAction = previous.faintAction;
          next.specialAction = previous.specialAction;
          next.physicalAction = previous.physicalAction;
          next.castAction = previous.castAction;
        } else if (asset.idle || asset.faint || asset.special || asset.physical) {
          next.mixer = new THREE.AnimationMixer(next.model.children[0]);
          if (asset.idle) next.idleAction = next.mixer.clipAction(asset.idle).play();
          if (asset.faint) {
            next.faintAction = next.mixer.clipAction(asset.faint).setLoop(THREE.LoopOnce,1);
            next.faintAction.paused = true;
            next.faintAction.setEffectiveWeight(0).play();
          }
          for (const name of ['special','physical']) {
            if (!asset[name]) continue;
            const action = next.mixer.clipAction(asset[name]).setLoop(THREE.LoopOnce,1);
            action.paused = true;
            action.setEffectiveWeight(0).play();
            next[`${name}Action`] = action;
          }
          next.mixer.setTime(.1);
        }
        const startSize = previous?.model.scale.x;
        pod.modelSlot.clear();
        pod.change = null;
        pod.visual = next;
        pod.modelSlot.add(next.model);
        next.model.position.set(0,0,0);
        next.model.scale.setScalar(size);
        next.model.visible = true;
        const started = performance.now();
        if (knockedOut && !sameForm) {
          pod.modelSlot.add(previous.model);
          pod.change = {kind:'deploy', previous:previous.model, fallenVisual:previous,
            startSize:previous.size, started, down, waitForHit:hits.has(pod.id)};
          next.model.visible = false;
        } else if (!config.reducedMotion && sameForm && active.level > previous.level) {
          pod.change = {kind:'level-up', started, startSize};
        } else if (pod.deployed && !config.reducedMotion && !sameForm) {
          if (previous) {
            previous.model.position.set(0,0,0);
            previous.model.scale.setScalar(previous.size);
            previous.model.visible = true;
            pod.modelSlot.add(previous.model);
          }
          const kind = previous?.family === next.family ? 'evolution' : 'switch';
          pod.change = {previous:previous?.model, startSize:previous?.size, kind, started};
          next.model.visible = false;
        }
        pod.deployed = true;
        draw(started);
      }).catch(() => {
        if (disposed || !pods.includes(pod) || pod.modelRequest !== active) return;
        pod.modelSlot.clear();
        pod.visual = pod.change = null;
        draw(performance.now());
      });
    }
  }

  function poseNativeFaint(pod, visual, progress) {
    const {model,faintAction,mixer,idleAction} = visual;
    if (visual.faintProgress!==progress) {
      const weight = THREE.MathUtils.smoothstep(progress,0,.15);
      faintAction.time = faintAction.getClip().duration*progress;
      faintAction.setEffectiveWeight(weight);
      idleAction?.setEffectiveWeight(1-weight);
      mixer.update(0);
      if (visual.faintWaist) {
        // The native clip rolls seven degrees past horizontal at the end of the fall.
        const landing = THREE.MathUtils.smoothstep(progress,.58,.73);
        visual.faintWaist.quaternion.premultiply(faintPitch.setFromAxisAngle(horizontalAxis,landing*7*Math.PI/180));
      }
      visual.faintProgress = progress;
      visual.faintGroundScale = null;
    }
    if (!progress) {
      if (visual.faintWaist) model.position.set(0,0,0);
      else model.position.y = 0;
      return;
    }
    if (visual.faintWaist) {
      // The original animation uses the open battlefield behind Snorlax. Center its
      // lying pose on the smaller tabletop podium and keep its back on the surface.
      model.position.set(0,0,0);
      pod.modelSlot.parent.updateWorldMatrix(true,false);
      // Attached skinned meshes refresh bindMatrixInverse in updateMatrixWorld.
      pod.modelSlot.updateMatrixWorld(true);
      const bounds = flyingMotionBounds.setFromObject(model,true);
      if (bounds.isEmpty()) return;
      bounds.getCenter(faintCenter);
      faintLanding.setFromMatrixPosition(pod.modelSlot.matrixWorld);
      const settle = THREE.MathUtils.smoothstep(progress,.36,.74);
      const floor = pod.modelSlot.parent.matrixWorld.elements[13]+pokemonPodiumTop+.01;
      faintLanding.set((faintLanding.x-faintCenter.x)*settle,floor-bounds.min.y,(faintLanding.z-faintCenter.z)*settle);
      if (faintLanding.y<0) faintLanding.y *= settle;
      model.position.copy(faintLanding.applyQuaternion(pod.modelSlot.getWorldQuaternion(slotInverse).invert()));
      return;
    }
    if (visual.faintGroundScale!==model.scale.x) {
      model.position.y = 0;
      pod.modelSlot.updateMatrixWorld(true);
      const floor = pod.modelSlot.parent.matrixWorld.elements[13]+pokemonPodiumTop+.01;
      const gap = floor-flyingMotionBounds.setFromObject(model,true).min.y;
      visual.faintGroundOffset = Number.isFinite(gap)
        ? gap<0 ? gap*THREE.MathUtils.smoothstep(progress,.15,.95) : gap
        : 0;
      visual.faintGroundScale = model.scale.x;
    }
    model.position.y = visual.faintGroundOffset;
  }

  function animateModel(pod, time, motion) {
    const transition = pod.change;
    pod.ball.visible = pod.flash.visible = false;
    pod.levelAura.visible = false;
    if (!transition) return;
    if (transition.waitForHit) {
      if (motion?.cue.kind==='hit') transition.hitSeen = true;
      if (motion?.cue.kind==='hit' || (!transition.hitSeen && time < transition.started+1800)) return;
      transition.waitForHit = false;
      transition.started = time;
      if (pod.defeatAt != null) pod.defeatAt = time;
    }
    const incoming = pod.visual.model;
    const size = pod.visual.size;
    const outgoing = transition.previous;
    const duration = transition.kind === 'deploy' ? 1750 : transition.kind === 'switch' ? 1420 : 1220;
    const retiring = transition.kind === 'knockout' || transition.kind === 'deploy';
    const fallenVisual = retiring ? transition.fallenVisual || pod.visual : null;
    const faintDuration = (fallenVisual?.faintAction?.getClip().duration ?? 0)*1000;
    const elapsed = Math.max(0,time-transition.started);
    const retireDelay = faintDuration ? faintDuration*(1-transition.down) : 0;
    const t = config.reducedMotion ? 1 : THREE.MathUtils.clamp((elapsed-retireDelay)/duration,0,1);
    if (retiring) {
      const fallen = outgoing || incoming;
      const exit = THREE.MathUtils.smoothstep(t, .24, outgoing ? .54 : .83);
      const down = faintDuration ? Math.min(1,transition.down+elapsed/faintDuration)
        : THREE.MathUtils.lerp(transition.down,1,THREE.MathUtils.smoothstep(t,0,.25));
      fallen.visible = exit < 1;
      fallen.rotation.z = faintDuration ? 0 : -down*1.24;
      fallen.scale.setScalar((transition.startSize ?? size) * (1-exit));
      if (faintDuration) {
        fallen.position.set(0,0,0);
        if (fallen.visible) poseNativeFaint(pod,fallenVisual,down);
      } else {
        fallen.position.set(down*.27, down*.44*(1-exit), 0);
        fallenVisual.rig?.reset();
        fallenVisual.rig?.pose('knockout',down,0,false);
      }
      if (!outgoing) {
        if (t === 1) {
          pod.modelSlot.clear();
          pod.visual = pod.change = null;
        }
        return;
      }
      pod.ball.visible = t >= .36 && t < .84;
      if (pod.ball.visible) throwFromTrainer(pod,transition,t,.56,.83);
      incoming.visible = t >= .83;
      incoming.scale.setScalar(size * Math.max(.025, THREE.MathUtils.smoothstep(t,.83,1)));
      pod.flash.visible = t >= .81 && t < .98;
      pod.flash.scale.setScalar(.9);
      pod.flash.material.opacity = Math.max(0,1-(t-.81)/.17)*.8;
    } else if (transition.kind === 'evolution') {
      const glow = Math.sin(Math.PI * t);
      pod.flash.visible = t < 1;
      pod.flash.scale.setScalar(.45 + glow * 1.65);
      pod.flash.material.opacity = glow ** 2 * .95;
      outgoing.visible = t < .5;
      incoming.visible = t >= .5;
      incoming.scale.setScalar(size * (.7 + .3 * Math.max(0, 2*t-1)));
    } else if (transition.kind === 'level-up') {
      const progress = t*t*(3-2*t);
      const lift = Math.sin(Math.PI * t);
      incoming.scale.setScalar(THREE.MathUtils.lerp(transition.startSize, size, progress) + lift*.05);
      incoming.position.y = lift*lift*.42;
      pod.levelAura.visible = t < 1;
      pod.levelRing.scale.setScalar(.45+t*1.6);
      pod.levelRing.material.opacity = .9*(1-t);
      pod.levelSparkMaterial.opacity = lift;
      pod.levelSparks.children.forEach((spark,index) => {
        const angle = index * Math.PI / 6 + t*1.4;
        const radius = .48 + t*(.75 + .19*(index%3));
        spark.position.set(Math.cos(angle)*radius, .18+t*(1.4+.23*(index%4)), Math.sin(angle)*radius);
        spark.rotation.z = angle+t*3;
        spark.scale.setScalar(lift*(.8+.22*(index%3)));
      });
    } else {
      const recall = Math.min(1,t/.28);
      const release = Math.max(0,(t-.72)/.28);
      if (outgoing) {
        outgoing.scale.setScalar(transition.startSize*Math.max(.025,1-recall));
        outgoing.position.set(.45*recall,.85*recall,1.1*recall);
        outgoing.visible = t < .28;
      }
      incoming.visible = t >= .72;
      incoming.scale.setScalar(size*Math.max(.025,release));
      pod.ball.visible = t >= .16 && t < .76;
      if (pod.ball.visible) throwFromTrainer(pod,transition,t,.45,.72);
      pod.flash.visible = t < .28 || (t >= .67 && t < .93);
      pod.flash.scale.setScalar(.34 + release*.8);
      pod.flash.material.opacity = t < .28 ? recall*.8 : (1-release)*.92;
    }
    if (t === 1) {
      outgoing?.removeFromParent();
      incoming.visible = true;
      incoming.scale.setScalar(size);
      incoming.position.set(0,0,0);
      pod.change = null;
    }
  }

  function clearScene() {
    if (!scene) return;
    battleEffects?.dispose(); battleEffects = null;
    terrain?.dispose(); terrain = null;
    contactMap?.dispose(); contactMap = null;
    for (const pod of pods) {
      pod.traitAura?.dispose();
      pod.statusEffect?.dispose();
      pod.modelSlot.clear();
    }
    for (const slot of trainerSlots) {
      slot.reveal?.effect.dispose();
      slot.animation?.mixer.stopAllAction();
      slot.clear();
    }
    trainerSlots.length = 0;
    const geometries = new Set(), materials = new Set();
    scene.traverse(object => {
      if (object.isInstancedMesh) object.dispose();
      object.shadow?.dispose();
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m));
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    scene.clear();
  }
  function build(previousTrainers) {
    clearScene(); pods = []; cameraReady = false;
    const p = palettes[config.theme] || palettes.stadium;
    scene = new THREE.Scene(); scene.background = new THREE.Color(p.sky);
    scene.fog = new THREE.Fog(p.sky, 45, 90);
    const themed = Boolean(p.accent);
    const coast = config.theme==='water' && !Number.isInteger(config.portraitIndex);
    if (coast) scene.fog = new THREE.Fog(0x9fc1d1,24,82);
    renderer.toneMappingExposure = coast ? 1.03 : 1.35;
    scene.add(new THREE.HemisphereLight(coast ? 0xc5dcff : 0xeafaff, coast ? 0x827b73 : 0x58705b, coast ? 1.29 : 2.5));
    const sun = new THREE.DirectionalLight(coast ? 0xffebd8 : 0xfff0d4, coast ? 3.65 : 3.2);
    sun.position.set(coast ? -16 : -12, coast ? 11.5 : 22, coast ? 9 : 8); sun.castShadow = true;
    sun.shadow.mapSize.setScalar(coast && window.innerWidth>=850 ? 2048 : 1024);
    Object.assign(sun.shadow.camera,{left:-17,right:17,top:17,bottom:-17,near:1,far:65});
    sun.shadow.bias = -0.001;
    if (coast) {
      Object.assign(sun.shadow.camera,{left:-24,right:24,top:23,bottom:-23});
      sun.shadow.camera.updateProjectionMatrix();
      sun.shadow.normalBias = .033;
      sun.shadow.bias = -.00026;
      sun.shadow.radius = 3.6;
      const bounce = new THREE.DirectionalLight(0xc3e6ff,.49);
      bounce.position.set(9,4,10);
      scene.add(bounce);
    }
    scene.add(sun);
    const mat = (color, extra={}) => new THREE.MeshStandardMaterial({color, roughness:0.86, ...extra});
    const mesh = (geometry, material, x=0, y=0, z=0, parent=scene) => {
      const object = new THREE.Mesh(geometry,material); object.position.set(x,y,z);
      object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
    };
    const cylinder = (r,h,color,x=0,y=0,z=0,parent=scene,segments=64) => mesh(new THREE.CylinderGeometry(r,r,h,segments),mat(color),x,y,z,parent);
    const box = (w,h,d,color,x,y,z,parent=scene) => mesh(new THREE.BoxGeometry(w,h,d),mat(color),x,y,z,parent);
    const ring = (r,width,color,x=0,y=0,z=0,parent=scene) => {
      const object = mesh(new THREE.RingGeometry(r-width,r,96),new THREE.MeshBasicMaterial({color, side:THREE.DoubleSide}),x,y,z,parent);
      object.rotation.x=-Math.PI/2; object.castShadow=false; return object;
    };
    const orb = (radius,color,x,y,z,parent=scene) => mesh(new THREE.SphereGeometry(radius,12,8),mat(color),x,y,z,parent);
    if (Number.isInteger(config.portraitIndex)) {
      scene.background=null;
      addTrainer(scene, config.portraitIndex, true, {portrait:true});
      return;
    }
    const coastalStations = config.coastalBattle ? coastalStationLayout(config.players,config.viewerId) : null;
    seatedCoastalViewer = coastalStations?.seated ?? false;
    sceneryAngle = coastalStations?.sceneryAngle ?? 0;
    const layout = config.coastalBattle
      ? coastalSeatLayout(config.players,config.viewerId)
      : seatLayout(config.players,config.viewerId);
    if (themed) {
      const terrainScene = scene;
      terrain = createGymTerrain(scene,config.theme,()=>{
        if (scene===terrainScene) draw(performance.now());
      },sceneryAngle);
    } else {
      if (config.theme !== 'floating') {
        const ground=mesh(new THREE.PlaneGeometry(200,200),mat(p.ground),0,-1.2,0);
        ground.rotation.x=-Math.PI/2; ground.castShadow=false;
      } else {
        for(let i=0;i<12;i++) {
          const a=i*Math.PI/6;
          const cloud=mesh(new THREE.SphereGeometry(2.4,12,8),mat(0xf4f8f1),Math.sin(a)*16,-3-Math.cos(a),Math.cos(a)*15);
          cloud.scale.set(2.1,.5,1.1); cloud.castShadow=false;
        }
        mesh(new THREE.ConeGeometry(10,6,8),mat(0x6c8291),0,-3.3,0).rotation.z=Math.PI;
      }
      cylinder(11.8,.5,p.trim,0,-.65); cylinder(11.5,.6,p.edge,0,-.18); cylinder(10.8,.1,p.field,0,.17);
      ring(10.2,.09,0xe5ebcf,0,.235); ring(4.4,.07,0xe5ebcf,0,.245);
      // Central field emblem and opposing lanes stay clear for future attack effects.
      ring(2.05,.08,0xe8eed7,0,.26); ring(.62,.11,0xe8eed7,0,.27);
      box(2.85,.014,.09,0xe8eed7,-2.05,.26,0); box(2.85,.014,.09,0xe8eed7,2.05,.26,0);
      for (const z of [-3.4,3.4]) box(2.8,.014,.06,0xe8eed7,0,.26,z);
      // Short grandstands leave the front of the diorama open to the camera.
      for(let i=0;i<12;i++) {
        const a=(i/11)*Math.PI+Math.PI/2;
        for(let row=0;row<3;row++) {
          const r=12.15+row*.6;
          const stand=box(2.6,.35,.48,row%2?p.edge:p.seats,Math.sin(a)*r,.12+row*.42,Math.cos(a)*r);
          stand.rotation.y=a;
        }
      }
      for(const [x,z] of [[-11,-7],[11,-7]]) {
        box(.15,6.5,.15,p.trim,x,3,z);
        box(2.2,.5,.4,p.trim,x,6.1,z);
        for(let j=0;j<4;j++) box(.36,.26,.44,0xfff4c8,x-.8+j*.53,6.1,z+.02);
      }
    }
    const layouts = new Map(config.players.map(player=>[player.id,player]));
    const reedGeometry = coast && config.players.some(player=>!player.leader) ? shorelineLeaves() : null;
    const reedMaterial = reedGeometry ? mat(0xffffff,{vertexColors:true,side:THREE.DoubleSide}) : null;
    let contactMaterial;
    if (coast && layout.length) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 96;
      const context = canvas.getContext('2d');
      const shade = context.createRadialGradient(48,48,11,48,48,48);
      shade.addColorStop(0,'#171b27ad');
      shade.addColorStop(.62,'#20202b64');
      shade.addColorStop(1,'#25222f00');
      context.fillStyle = shade;
      context.fillRect(0,0,96,96);
      contactMap = new THREE.CanvasTexture(canvas);
      contactMap.colorSpace = THREE.SRGBColorSpace;
      contactMaterial = new THREE.MeshBasicMaterial({map:contactMap,transparent:true,depthWrite:false,toneMapped:false});
    }
    let trainerIndex = 0;
    layout.forEach(position => {
      const group=new THREE.Group(); group.position.set(position.x,.24,position.z); group.rotation.y=position.angle;
      scene.add(group);
      const color=colors[position.index%colors.length];
      const facets = coast ? 36 : 8;
      cylinder(1.32,.16,p.trim,0,.06,0,group,facets);
      cylinder(coast ? 1.24 : 1.17,.12,p.edge,0,pokemonPodiumTop-.06,0,group,facets);
      let footShadow;
      if (contactMaterial) {
        const plinthShadow = mesh(new THREE.PlaneGeometry(3.5,3.12),contactMaterial,.14,-.017,.13,group);
        footShadow = mesh(new THREE.PlaneGeometry(1.94,1.82),contactMaterial,0,.263,-.24,group);
        for (const shadow of [plinthShadow,footShadow]) {
          shadow.rotation.x = -Math.PI/2;
          shadow.castShadow = shadow.receiveShadow = false;
        }
      }
      const halo=ring(1.12,.075,color,0,.269,0,group);
      halo.material.toneMapped = false;
      const glowRing = ring(1.23,.18,0xffffff,0,.272,0,group);
      glowRing.visible = false;
      glowRing.receiveShadow = false;
      Object.assign(glowRing.material,{transparent:true,opacity:.29,depthWrite:false,toneMapped:false});
      // A neutral capsule is a model slot, not a claimed Pokémon asset.
      const proxy=new THREE.Group(); proxy.position.set(0,.28,-.24); group.add(proxy);
      mesh(new THREE.SphereGeometry(.5,24,16,0,Math.PI*2,0,Math.PI/2),mat(color),0,.53,0,proxy);
      mesh(new THREE.SphereGeometry(.5,24,16,0,Math.PI*2,Math.PI/2,Math.PI/2),mat(0xeef0dc),0,.53,0,proxy);
      cylinder(.508,.075,p.trim,0,.53,0,proxy,32);
      const leader=layouts.get(position.id).leader;
      const station = coastalStations?.stations.get(position.id);
      const rearStation = station?.rear ?? false;
      let trainerParent = group;
      let commandPost;
      if (station) {
        // The station shares the arcade's orientation, independent of Pokémon seat spacing.
        const radius = rearStation ? waterGymRearStation.radius : 13.0;
        const baseHeight = rearStation ? waterGymRearStation.baseHeight : .49;
        trainerParent = new THREE.Group();
        trainerParent.position.set(Math.sin(station.angle)*radius,baseHeight,Math.cos(station.angle)*radius);
        trainerParent.rotation.y = station.angle;
        scene.add(trainerParent);
        commandPost = {y:0,z:0};
      } else if (coast) {
        commandPost = {y:0,z:2.62};
      }
      const trainerSlot = addTrainer(trainerParent, leader ? 0 : trainerIndex++, leader, {
        local:position.id===config.viewerId, avatar:layouts.get(position.id).trainerAvatar,commandPost,
        previous:previousTrainers?.get(position.id),
      });
      let commandDais;
      if (commandPost) {
        const dais = new THREE.Group();
        commandDais = dais;
        dais.position.set(0,commandPost.y,commandPost.z);
        trainerParent.add(dais);
        if (!rearStation) {
          mesh(new THREE.CylinderGeometry(.59,.78,.82,9),mat(0x839288),0,-.43,0,dais);
          mesh(new THREE.CylinderGeometry(.73,.64,.14,9),mat(0xb4ae99),0,.005,0,dais);
          mesh(new THREE.CylinderGeometry(.87,.72,.24,9),mat(0xb7b2a2),0,.175,0,dais);
          mesh(new THREE.CylinderGeometry(.92,.87,.12,9),mat(0xd1c8b7),0,.342,0,dais);
          box(.91,.30,.69,0x929e88,-.56,-.60,.27,dais);
          mesh(reedGeometry,reedMaterial,-.64,-.44,.37,dais);
        }
        cylinder(rearStation ? .79 : .71,.016,0x566b6b,0,.406,.035,dais,rearStation ? 24 : 9);
        box(.66,.32,.24,0xb7ae9b,0,.54,-.62,dais);
        box(.81,.09,.32,0xd5c5aa,0,.72,-.62,dais);
        box(.57,.022,.21,0x366371,0,.772,-.62,dais).rotation.x=.12;
        if (leader) {
          const pennant=mesh(new THREE.PlaneGeometry(.59,.87),mat(p.accent,{side:THREE.DoubleSide}),1.21,1.29,.39,dais);
          pennant.rotation.y=-.2;
          box(.06,1.66,.06,p.trim,.94,.85,.39,dais);
        }
        dais.traverse(part=>{ if (part.isMesh) part.layers.enable(1); });
      }
      if(leader) {
        ring(1.27,.13,p.accent||0xffd477,0,.272,0,group);
        if (!commandPost) {
          const pennant=mesh(new THREE.PlaneGeometry(.64,.98),mat(p.accent||0xffd477,{side:THREE.DoubleSide}),.84,1.2,1.68,group);
          pennant.rotation.y=-.2;
          box(.06,1.68,.06,p.trim,.49,.86,1.68,group);
        }
      }
      const turnMarker=mesh(new THREE.OctahedronGeometry(.16),new THREE.MeshBasicMaterial({color:0xffd459}),0,2.1,0,group);
      const modelSlot = new THREE.Group();
      modelSlot.position.set(0,.27,-.24);
      group.add(modelSlot);
      const ball = new THREE.Group();
      group.add(ball);
      ball.scale.setScalar(.33);
      mesh(new THREE.SphereGeometry(.5,20,12,0,Math.PI*2,0,Math.PI/2),mat(0xde273e),0,0,0,ball);
      mesh(new THREE.SphereGeometry(.5,20,12,0,Math.PI*2,Math.PI/2,Math.PI/2),mat(0xfff2d9),0,0,0,ball);
      cylinder(.505,.055,0x221e2c,0,0,0,ball,24);
      orb(.135,0xfff4df,0,0,-.49,ball);
      const flash = mesh(new THREE.SphereGeometry(.75,20,14),new THREE.MeshBasicMaterial({
        color:0xfffaf0, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false
      }),0,1,-.24,group);
      flash.castShadow = flash.receiveShadow = false;
      const levelAura = new THREE.Group();
      levelAura.position.copy(modelSlot.position);
      levelAura.visible = false;
      group.add(levelAura);
      const glow = {transparent:true, depthWrite:false, toneMapped:false};
      const levelRing = new THREE.Mesh(new THREE.RingGeometry(.9,1,48),
        new THREE.MeshBasicMaterial({color:0xffda64, side:THREE.DoubleSide, ...glow}));
      levelRing.rotation.x = -Math.PI/2;
      levelRing.position.y = .03;
      const levelSparks = new THREE.Group();
      const levelSparkMaterial = new THREE.MeshBasicMaterial({color:0xffdf73, ...glow});
      const sparkGeometry = new THREE.OctahedronGeometry(.10);
      for (let i=0; i<12; i++) levelSparks.add(new THREE.Mesh(sparkGeometry, levelSparkMaterial));
      levelAura.add(levelRing, levelSparks);
      pods.push({id:position.id, angle:position.angle, position:new THREE.Vector3(position.x,2.65,position.z), spritePosition:group.localToWorld(new THREE.Vector3(0,.42,-.24)), halo, glowRing, footShadow, turnMarker, proxy, modelSlot, ball, flash, levelAura, levelRing, levelSparks, levelSparkMaterial, trainerSlot, commandDais,
        rearStation, stationAngle:station?.angle ?? position.angle, stationPosition:station ? trainerParent.position : null});
    });
    battleEffects = createBattleEffects(scene,pods,modelForDex);
  }
  function resize() {
    if(!host || disposed || lost) return;
    const w=Math.max(host.clientWidth,1), h=Math.max(host.clientHeight,1);
    renderer.setSize(w,h,false); camera.aspect=w/h;
    camera.updateProjectionMatrix();
    draw(performance.now());
  }
  function projectedPartners(viewCamera,width,height) {
    const point = (x,y,z) => {
      const p = framingPoint.set(x,y,z).project(viewCamera);
      return {x:(p.x+1)*width/2,y:(1-p.y)*height/2,depth:p.z};
    };
    return pods.filter(pod=>pod.visual?.footprint && !pod.down).map(pod=>{
      const {footprint, size} = pod.visual;
      const sine = Math.sin(pod.angle), cosine = Math.cos(pod.angle);
      const x = pod.position.x-.24*sine, z = pod.position.z-.24*cosine;
      const floor = pod.modelSlot.parent.position.y+pokemonPodiumTop+.01;
      const bottom = floor+footprint.bottom*size, top = floor+footprint.top*size;
      const center = point(x,bottom+(top-bottom)*.64,z);
      const body = {left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
      for (const u of [-footprint.halfWidth*size,footprint.halfWidth*size]) {
        for (const v of [-footprint.halfDepth*size,footprint.halfDepth*size]) {
          for (const y of [bottom,top]) {
            const corner = point(x+u*cosine+v*sine,y,z-u*sine+v*cosine);
            body.left = Math.min(body.left,corner.x); body.right = Math.max(body.right,corner.x);
            body.top = Math.min(body.top,corner.y); body.bottom = Math.max(body.bottom,corner.y);
          }
        }
      }
      const halfWidth = Math.max(7,(body.right-body.left)*.18);
      const halfHeight = Math.max(7,(body.bottom-body.top)*.19);
      const core = {left:center.x-halfWidth,right:center.x+halfWidth,top:center.y-halfHeight,bottom:center.y+halfHeight};
      return {id:pod.id,center,body,core};
    });
  }
  function overlap(a,b) {
    return Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left)) *
      Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
  }
  function fitTrainerView() {
    const key = JSON.stringify([host.clientWidth,camera.aspect,camera.fov,desiredCamera.toArray(),desiredTarget.toArray(),
      pods.map(pod=>[pod.id,pod.visual?.dex,pod.visual?.level])]);
    if (cameraFit?.key!==key) {
      const width = host.clientWidth, height = host.clientHeight;
      framingCamera.aspect = camera.aspect;
      framingCamera.fov = camera.fov;
      framingCamera.updateProjectionMatrix();
      function score(slide,lift) {
        framingCamera.position.copy(desiredCamera);
        framingCamera.position.x += slide;
        framingCamera.position.y += lift;
        framingCamera.lookAt(desiredTarget.x+slide*.28,desiredTarget.y+lift*.19,desiredTarget.z);
        framingCamera.updateMatrixWorld();
        const partners = projectedPartners(framingCamera,width,height);
        return partners.reduce((sum,back)=>{
          const {core,center} = back;
          const area = (core.right-core.left)*(core.bottom-core.top);
          const obstruction = Math.max(0,...partners.filter(front=>front.center.depth<center.depth && front.id!==back.id)
            .map(front=>overlap(core,front.body)/area));
          const visible = overlap(core,{left:12,right:width-12,top:45,bottom:height-92})/area;
          return sum+Math.max(0,obstruction-.15)+obstruction**3+(1-visible)*1.4;
        },0);
      }
      let best = {slide:0,lift:0,score:score(0,0)};
      if (best.score>.12) {
        const candidates = [[0,.8],[0,1.6],[-.9,1.2],[.9,1.2],[-1.25,2],[1.25,2]];
        if (best.score>1.4) candidates.push([-3,2.8],[3,2.8],[0,3.5],[-2.6,4.5],[2.6,4.5],[0,4.5]);
        for (const [slide,lift] of candidates) {
          const candidate = score(slide,lift)+.09+.035*lift+.04*Math.abs(slide);
          if (candidate<best.score) best = {slide,lift,score:candidate};
        }
      }
      cameraFit = {key,...best};
    }
    desiredCamera.x += cameraFit.slide;
    desiredCamera.y += cameraFit.lift;
    desiredTarget.x += cameraFit.slide*.28;
    desiredTarget.y += cameraFit.lift*.19;
  }
  function frameTurnFocus(time, mode, focus) {
    turnTarget.copy(cameraTarget);
    host.dataset.turnFocus = '';
    if (!turnFocus) return;
    if (config.reducedMotion || config.camera==='overhead' || eligible ||
        (turnFocus.startedAt===null && time-turnFocus.queuedAt>1400)) {
      turnFocus = null;
      return;
    }
    if (mode!=='trainer' || focus) return;
    const pod = pods.find(pod=>pod.id===turnFocus.playerId);
    if (!pod) return;
    turnFocus.startedAt ??= time;
    const elapsed = Math.max(0,time-turnFocus.startedAt);
    if (elapsed>=1270) {
      turnFocus = null;
      return;
    }
    const strength = THREE.MathUtils.smoothstep(elapsed,0,480)*(1-THREE.MathUtils.smoothstep(elapsed,730,1270));
    const compact = camera.aspect<1.7;
    const ownTurn = pod.id===config.viewerId;
    // Truck and dolly along the existing camera axes to preserve each player's view direction.
    cameraRight.subVectors(cameraTarget,cameraBase).cross(scene.up).normalize();
    const subject = pod.spritePosition;
    const station = pod.stationPosition;
    const subjectX = !ownTurn && station ? THREE.MathUtils.lerp(subject.x,station.x,.15) : subject.x;
    const subjectZ = !ownTurn && station ? THREE.MathUtils.lerp(subject.z,station.z,.15) : subject.z;
    const lateral = (subjectX-cameraTarget.x)*cameraRight.x+(subjectZ-cameraTarget.z)*cameraRight.z;
    const limit = compact ? .68 : 1.12;
    const slide = THREE.MathUtils.clamp(lateral*.23,-limit,limit)*strength;
    const push = strength*(ownTurn ? .024 : compact ? .035 : .047);
    camera.position.lerp(cameraTarget,push).addScaledVector(cameraRight,slide);
    turnTarget.addScaledVector(cameraRight,slide);
    if (camera.near>.1) camera.near = Math.max(.1,camera.near-cameraBase.distanceTo(cameraTarget)*push);
    host.dataset.turnFocus = pod.id;
  }

  function frameCamera(focus, nearFocus, time) {
    const targets = pods.filter(pod => focus?.targetIds?.includes(pod.id));
    const source = pods.find(pod => pod.id === focus?.sourceId);
    const narrow = camera.aspect < .9;
    const distance = narrow ? Math.max(22,21 / Math.max(.43,camera.aspect)) : 21.5;
    let mode = 'trainer';
    camera.fov = 49;
    camera.near = .1;
    if (Number.isInteger(config.portraitIndex)) {
      desiredCamera.set(0,1.05,Math.max(2.95, 2.9/camera.aspect));
      desiredTarget.set(0,1.04,0);
    } else if (config.camera!=='overhead' && !eligible && !nearFocus && battleEffects?.skyActive) {
      mode = 'event';
      if (config.coastalBattle && !narrow) {
        // Keep the camera on the arena side of the basin and the model below the HUD.
        camera.fov = 56;
        desiredCamera.set(0,12.4,15.0);
        desiredTarget.set(0,5.0,-3.2);
      } else {
        desiredCamera.set(0,distance*.68,distance*1.14);
        desiredTarget.set(0,3.6,-3.2);
      }
    } else if (config.camera === 'overhead' || focus?.wide || (targets.length > 1 &&
      targets.some(a => targets.some(b => a.position.distanceTo(b.position) > 12)))) {
      mode = 'wide';
      const coastalWide = config.coastalBattle && !narrow;
      desiredCamera.set(0,distance*(narrow?1.02:coastalWide?2.46:1.27),distance*(coastalWide?.12:.35));
      desiredTarget.set(0,0,narrow?1.9:coastalWide?-.95:1.7);
    } else if (targets.length) {
      mode = 'target';
      desiredTarget.set(0,0,0);
      for (const pod of targets) desiredTarget.add(pod.position);
      desiredTarget.divideScalar(targets.length);
      const close = config.coastalBattle && !narrow;
      const compact = camera.aspect < 1.7;
      if (close && compact && !focus.trainer) camera.fov = 54;
      const yaw = THREE.MathUtils.clamp(desiredTarget.x/8,-1,1)*(close ? .45 : .79);
      if (source) desiredTarget.lerp(source.position,.42);
      if (focus.trainer && targets.length===1) {
        desiredTarget.lerp(targets[0].trainerSlot.getWorldPosition(new THREE.Vector3()),.42);
      }
      if (config.coastalBattle) {
        desiredTarget.multiplyScalar(.76);
        desiredTarget.y = close ? 1.36 : 1.1;
      } else desiredTarget.set(desiredTarget.x*.83,1.1,desiredTarget.z*.68);
      const zoom = distance*(close ? (focus.trainer ? .56 : compact ? .99 : .88) : .76);
      desiredCamera.set(desiredTarget.x+Math.sin(yaw)*zoom,zoom*(close ? .34 : .40),desiredTarget.z+Math.cos(yaw)*zoom);
      if (close && config.rescuePanel && host.clientWidth>=900) {
        // Keep the fainted partner left of the rescue controls.
        desiredCamera.x += Math.cos(yaw)*2.35;
        desiredCamera.z -= Math.sin(yaw)*2.35;
        desiredTarget.x += Math.cos(yaw)*2.35;
        desiredTarget.z -= Math.sin(yaw)*2.35;
      }
    } else {
      const coastalDesktop = config.coastalBattle && host.clientWidth>=900 && camera.aspect>=1.4;
      if (coastalDesktop) {
        const compact = camera.aspect < 1.7;
        camera.fov = compact ? 46 : 44;
        desiredCamera.set(0,5.1,compact ? 22.5 : 19.7);
        desiredTarget.set(0,.82,-1.05);
        if (seatedCoastalViewer) {
          // Keep the foreground partner low and left, with the opponents spread across the court.
          camera.fov = compact ? 48 : 46;
          desiredCamera.set(5.05,3.30,compact ? 17.05 : 14.95);
          desiredTarget.set(compact ? .55 : 1.08,1.40,-1.05);
        }
      } else {
        desiredCamera.set(0,distance*(narrow?.46:.42),distance);
        const aimTilt = THREE.MathUtils.smoothstep(aimBottom,172,302);
        desiredTarget.set(0,(narrow?.15:1.15)-aimTilt*.8,(narrow?-.7:-1.4)+aimTilt*1.5);
        if (seatedCoastalViewer) {
          desiredCamera.x = narrow ? 3.0 : 4.4;
          desiredTarget.x = narrow ? .56 : .82;
        }
      }
    }
    if (config.coastalBattle && seatedCoastalViewer && mode==='trainer') fitTrainerView();
    if (config.coastalBattle && (mode==='trainer' || mode==='target')) {
      const radius = Math.hypot(desiredCamera.x,desiredCamera.z);
      const scenicSin = Math.sin(sceneryAngle), scenicCos = Math.cos(sceneryAngle);
      const scenicDepth = desiredCamera.x*scenicSin+desiredCamera.z*scenicCos;
      const cameraAngle = Math.atan2(desiredCamera.x*scenicCos-desiredCamera.z*scenicSin,-scenicDepth);
      const [leftEnd,rightEnd] = waterGymArcadeBounds;
      const besideArcade = radius>16.4 && cameraAngle>leftEnd && cameraAngle<rightEnd;
      if (mode==='trainer' && seatedCoastalViewer && (scenicDepth<.30*radius || besideArcade)) {
        camera.near = Math.max(.1,radius-12.8);
      } else if (mode==='target' && radius>15.15) {
        // Stay inside the extended arcade while retaining the original subject scale.
        const initialDistance = desiredCamera.distanceTo(desiredTarget);
        desiredCamera.x *= 15.15/radius;
        desiredCamera.z *= 15.15/radius;
        const framing = Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*initialDistance/
          desiredCamera.distanceTo(desiredTarget);
        camera.fov = THREE.MathUtils.radToDeg(2*Math.atan(framing));
      } else if (scenicDepth<-.18*radius && radius>15.15) {
        desiredCamera.x *= 15.15/radius;
        desiredCamera.z *= 15.15/radius;
        desiredCamera.y = Math.max(7.6,desiredCamera.y);
        camera.fov = Math.max(camera.fov,camera.aspect<1.7 ? 60 : 55);
      }
    }
    host.dataset.camera = mode;
    if (turnFocus?.startedAt!=null && (mode!=='trainer' || focus || eligible || config.reducedMotion)) {
      // Continue from the frame on screen when the player chooses another view mid-push.
      cameraBase.copy(camera.position);
      cameraTarget.copy(turnTarget);
      turnFocus = null;
    }
    const blend = !cameraReady || config.reducedMotion ? 1 : .14;
    cameraBase.lerp(desiredCamera,blend);
    cameraTarget.lerp(desiredTarget,blend);
    camera.position.copy(cameraBase);
    frameTurnFocus(time,mode,focus);
    camera.lookAt(turnTarget);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    cameraReady = true;
  }
  function draw(time) {
    if (!scene || !host?.isConnected || disposed || lost || document.hidden) return;
    const motions = battleEffects?.update(time,config.reducedMotion,config.playCue);
    const nearFocus = eligible ? null : battleEffects?.nearFocus;
    const fallen = !config.reducedMotion && pods.find(pod=>['knockout','deploy'].includes(pod.change?.kind));
    const switching = config.coastalBattle && !config.reducedMotion && pods.find(pod=>pod.change?.kind==='switch');
    const switchFocus = switching && {targetIds:[switching.id],trainer:true};
    const actionFocus = !config.reducedMotion && (switchFocus || battleEffects?.responseFocus ||
      (fallen && {targetIds:[fallen.id],sourceId:config.turnId}));
    const focus = eligible ? null : nearFocus || actionFocus || config.focus;
    frameCamera(focus,nearFocus,time);
    const trainerCamera = host.dataset.camera==='trainer';
    const clipOwnStation = trainerCamera && camera.near>.1;
    const clipRearStation = clipOwnStation && pods.some(pod=>pod.rearStation && pod.id===config.viewerId);
    terrain?.update(time,config.reducedMotion,clipRearStation,config.waterMotion);
    const dt = Math.min(.075,Math.max(0,(time-previousFrame)/1000));
    previousFrame = time;
    const viewWidth = host.clientWidth, viewHeight = host.clientHeight;
    const visiblePartners = config.coastalBattle && trainerCamera ? projectedPartners(camera,viewWidth,viewHeight) : [];
    const placedBadges = [];
    function placeBadge(badge,x,y) {
      let size = badgeSizes.get(badge);
      if (size?.width!==viewWidth) {
        size = {width:viewWidth,w:badge.offsetWidth,h:badge.offsetHeight};
        badgeSizes.set(badge,size);
      }
      const {w,h} = size;
      if (!w || !h) return {x,y};
      function candidate(dx,dy) {
        const cx = THREE.MathUtils.clamp(x+dx,w/2+2,viewWidth-w/2-2);
        const cy = y+dy;
        const rect = {left:cx-w/2,right:cx+w/2,top:cy-h-5,bottom:cy-5};
        const obstruction = visiblePartners.reduce((total,partner)=>total+overlap(rect,partner.core),0);
        const collisions = placedBadges.reduce((total,other)=>total+overlap(rect,other),0);
        const outside = Math.max(0,51-rect.top)+Math.max(0,rect.bottom-(viewHeight-104));
        return {x:cx,y:cy,rect,cost:obstruction+collisions*1.35+outside*w+2*(Math.abs(dx)+Math.abs(dy))};
      }
      let best = candidate(0,0);
      if (best.cost>0) {
        const offsets = [[0,-h*.8],[0,h*.8],[-w*.62,0],[w*.62,0],[-w*.9,-h*.65],[w*.9,-h*.65],[0,-h*1.5]];
        for (const [dx,dy] of offsets) {
          const option = candidate(dx,dy);
          if (option.cost<best.cost) best = option;
        }
      }
      placedBadges.push(best.rect);
      return best;
    }
    const project = (element, point, clip = false) => {
      if (!element) return;
      const p = point.clone().project(camera);
      let x = p.x*.5+.5, y = -p.y*.5+.5;
      if (visiblePartners.length && element.classList.contains('world-seat-compact') && Math.abs(p.x)<.94 && Math.abs(p.y)<.91 && p.z<=1) {
        const position = placeBadge(element,x*viewWidth,y*viewHeight);
        x = position.x/viewWidth;
        y = position.y/viewHeight;
      }
      element.style.setProperty('--projected-left', `${x*100}%`);
      element.style.setProperty('--projected-top', `${y*100}%`);
      if (clip) {
        const sideLimit = camera.aspect < .9 && host.dataset.camera==='target' ? .76 : .94;
        element.classList.toggle('off-camera',Math.abs(p.x)>sideLimit || Math.abs(p.y)>.91 || p.z>1);
      }
    };
    const targets = focus?.targetIds || [];
    host.dataset.effects = [...(motions?.values() || [])].map(motion=>motion.style).join(' ');
    host.dataset.eventModel = battleEffects?.eventModel || '';
    host.dataset.eventEffect = battleEffects?.eventEffect || '';
    host.dataset.moveEffect = battleEffects?.moveEffect || '';
    if (Number.isInteger(config.portraitIndex)) poseTrainer(trainerSlots[0],'idle',0,time);
    const turnPod = pods.find(pod=>pod.id===config.turnId);
    const targetPod = pods.find(pod=>targets.includes(pod.id));
    let loaded = 0;
    for(const pod of pods) {
      const active=pod.id===config.turnId;
      const ownTrainerView = config.coastalBattle && trainerCamera && pod.id===config.viewerId;
      pod.trainerSlot.visible = !ownTrainerView;
      if (pod.commandDais) pod.commandDais.visible = !ownTrainerView || !clipOwnStation;
      const size = pod.visual?.size ?? pokemonLevelScale(pod.modelRequest?.level);
      pod.turnMarker.visible=active && !eligible;
      pod.turnMarker.position.y=2.1+(size-1)*1.8+(config.reducedMotion?0:Math.sin(time*.002)*.08);
      const isEligible = eligible?.includes(pod.id);
      pod.halo.material.color.setHex(eligible
        ? marked.includes(pod.id) ? 0xffbc4f : eligible.includes(pod.id) ? 0xb5ffe8 : 0x526560
        : targets.includes(pod.id)?0xff8457:active?0xffd459:0x809e94);
      if (pod.glowRing) {
        pod.glowRing.visible = Boolean(isEligible);
        pod.glowRing.material.color.copy(pod.halo.material.color);
        const selected = marked.includes(pod.id);
        pod.glowRing.material.opacity = selected ? .68 : .32;
      }
      const muted = config.coastalBattle && Boolean(eligible && !isEligible && config.viewerId!==pod.id);
      const model = pod.visual?.model;
      if (pod.mutedModel && (pod.mutedModel!==model || !muted)) {
        muteModel(pod.mutedModel,false);
        pod.mutedModel = null;
      }
      if (model && muted && !pod.mutedModel) {
        muteModel(model,true);
        pod.mutedModel = model;
      }
      const label=labelLayer?.querySelector(`[data-seat-id="${CSS.escape(pod.id)}"]`);
      const sprite=spriteLayer?.querySelector(`[data-sprite-id="${CSS.escape(pod.id)}"]`);
      const motion = motions?.get(pod.id);
      animateBattlePose(pod,motion,time,config.reducedMotion);
      const watch = active ? targetPod : turnPod;
      const stationPosition = pod.stationPosition ?? pod.position;
      const facing = watch && watch!==pod
        ? Math.atan2(stationPosition.x-watch.position.x,stationPosition.z-watch.position.z)-pod.stationAngle : 0;
      const lookYaw = THREE.MathUtils.clamp(Math.atan2(Math.sin(facing),Math.cos(facing)),-.62,.62);
      const opponent = motion?.cue.kind==='attack' ? pods.find(other=>motion.cue.targetIds.includes(other.id)) :
        motion?.cue.sourceId ? pods.find(other=>other.id===motion.cue.sourceId) : null;
      const trainerDirection = opponent && opponent!==pod
        ? opponent.position.clone().sub(stationPosition).setY(0).applyAxisAngle(scene.up,-pod.stationAngle).normalize()
        : motion?.direction;
      animateTrainerReveal(pod,time);
      if (!config.reducedMotion && (motion?.cue.kind==='hit' || motion?.cue.kind==='dodge')) {
        const reaction = motion.cue.kind==='dodge' ? 'evade' : 'brace';
        poseTrainer(pod.trainerSlot,reaction,motion.t,time,{direction:trainerDirection,lookYaw});
      } else if (pod.defeatAt != null && !pod.change?.waitForHit) {
        poseTrainer(pod.trainerSlot,'defeat',config.reducedMotion ? 1 : THREE.MathUtils.clamp((time-pod.defeatAt)/1130,0,1),time);
      } else if (config.victoryWinners?.includes(pod.id) && !battleEffects?.active) {
        pod.victoryAt ??= time;
        poseTrainer(pod.trainerSlot,'victory',config.reducedMotion ? 1 : THREE.MathUtils.clamp((time-pod.victoryAt)/1050,0,1),time);
      } else if (pod.trainerSlot.reveal) {
        poseTrainer(pod.trainerSlot,'reveal',(time-pod.trainerSlot.reveal.started)/850,time);
      } else if (!config.reducedMotion && motion?.cue.kind === 'attack') {
        poseTrainer(pod.trainerSlot,'command',motion.t,time,{direction:trainerDirection,lookYaw});
      } else if (!config.reducedMotion && !pod.change?.waitForHit && ['switch','deploy'].includes(pod.change?.kind)) {
        const deploying = pod.change.kind==='deploy';
        const progress = THREE.MathUtils.clamp((time-pod.change.started)/(deploying ? 1750 : 1420),0,1);
        poseTrainer(pod.trainerSlot,'throw',deploying ? Math.max(0,(progress-.2)/.8) : progress,time);
      } else if (!config.reducedMotion && pod.id===config.defendingTrainerId) {
        poseTrainer(pod.trainerSlot,'ready',0,time,{lookYaw});
      } else {
        poseTrainer(pod.trainerSlot,'idle',0,time,{lookYaw});
      }
      animateModel(pod,time,motion);
      if (pod.footShadow) {
        pod.footShadow.visible = Boolean(pod.visual?.model.visible);
        pod.footShadow.position.x = pod.modelSlot.position.x;
        pod.footShadow.position.z = pod.modelSlot.position.z;
      }
      const fainting = pod.faintAt != null;
      if (pod.faintWait && !config.reducedMotion) {
        if (motion?.cue.kind==='hit') pod.faintWait.seen = true;
        else if (pod.faintWait.seen || time>=pod.faintWait.until) {
          pod.faintWait = null;
          pod.faintAt = time;
        }
      }
      if (!pod.change && pod.visual) {
        const faintDuration = (pod.visual.faintAction?.getClip().duration ?? 0)*1000;
        const fall = fainting && !pod.faintWait
          ? faintDuration ? THREE.MathUtils.clamp((time-pod.faintAt-80)/faintDuration,0,1)
            : THREE.MathUtils.smoothstep(time-pod.faintAt,80,770)
          : 0;
        const recovery = pod.recovery ? pod.recovery.from*(1-THREE.MathUtils.smoothstep(time-pod.recovery.started,0,560)) : 0;
        pod.down = config.reducedMotion ? Number(fainting) : Math.max(fall,recovery);
        if (!recovery) pod.recovery = null;
        if (pod.down && !faintDuration) {
          pod.modelSlot.rotation.z = -pod.down*1.24;
          pod.modelSlot.position.set(pod.down*.27,.27+pod.down*.44,-.24);
        }
      }
      const leveling = pod.change?.kind === 'level-up';
      const evolving = pod.change?.kind === 'evolution';
      const replacingKnockedOut = pod.change?.kind === 'deploy' && !pod.visual.model.visible;
      const knockedOut = pod.change?.kind === 'knockout' || replacingKnockedOut;
      const burst = battleEffects?.traitBurst(pod.id);
      if (label) {
        const activePokemon = pod.activePokemon;
        const waitingHit = config.reducedMotion ? null : battleEffects?.pendingHit(pod.id);
        const health = activePokemon?.catalogueId===waitingHit?.targetCatalogueId && Number.isFinite(waitingHit?.hpBefore)
          ? waitingHit.hpBefore : activePokemon?.hp;
        const healthValue = label.querySelector('.world-hp-value');
        if (healthValue && Number.isFinite(health)) {
          const value = `${health}/${activePokemon.maxHp}`;
          if (healthValue.textContent!==value) {
            healthValue.textContent = value;
            const low = health*3<=activePokemon.maxHp;
            healthValue.parentElement.classList.toggle('hp-low',low);
            const track = label.querySelector('.world-hp-track');
            track.classList.toggle('hp-low',low);
            track.firstElementChild.style.width = `${THREE.MathUtils.clamp(100*health/activePokemon.maxHp,0,100)}%`;
          }
        }
        const showingKnockout = knockedOut && !pod.change?.waitForHit;
        const showingFaint = fainting && (!pod.faintWait || config.reducedMotion) && motion?.cue.kind!=='hit';
        label.dataset.trainerMotion = pod.trainerSlot.motion || '';
        label.dataset.trainerModel = pod.trainerSlot.modelProfile || '';
        label.dataset.trainerReveal = pod.trainerSlot.reveal ? 'true' : '';
        label.dataset.action = showingKnockout ? 'knockout' : showingFaint ? 'faint' : evolving ? 'evolution' : leveling ? 'level-up' : motion?.cue.kind || '';
        label.dataset.actionLabel = showingKnockout && replacingKnockedOut
          ? (config.language === 'zh' ? '上一只搭档失去战斗能力' : 'Previous partner knocked out')
          : showingKnockout ? (config.language === 'zh' ? '失去战斗能力' : 'Knocked out')
          : showingFaint ? (config.language === 'zh' ? '昏厥 · 等待救援' : 'Fainted · awaiting rescue')
          : evolving
          ? (config.language === 'zh' ? `进化 · Lv.${pod.visual.level}` : `Evolution · Lv.${pod.visual.level}`)
          : leveling
          ? (config.language === 'zh' ? `升到 ${pod.visual.level} 级！` : `Level ${pod.visual.level}!`)
          : battleEffectLabel(motion?.cue,config.language);
      }
      const acting = pod.change?.waitForHit ? pod.change.fallenVisual || pod.visual : pod.visual;
      const actingDown = pod.change?.kind==='deploy' && !pod.change.waitForHit ? 0 : pod.down;
      const castAction = acting && motion && !actingDown && !config.reducedMotion &&
        acting.family===motion.cue.family && acting.model.visible &&
        (motion.specialCast ? acting.specialAction : motion.physicalCast ? acting.physicalAction : null);
      if (acting?.castAction && acting.castAction!==castAction) {
        acting.castAction.setEffectiveWeight(0);
        acting.idleAction?.setEffectiveWeight(1);
        acting.castAction = null;
      }
      if (castAction) {
        const weight = THREE.MathUtils.smoothstep(motion.t,0,.12) * (1-THREE.MathUtils.smoothstep(motion.t,.78,1));
        castAction.time = castAction.getClip().duration * motion.t;
        castAction.setEffectiveWeight(weight);
        acting.idleAction?.setEffectiveWeight(1-weight);
        acting.castAction = castAction;
      }
      if (label) label.dataset.nativeCast = castAction ? 'true' : '';
      if (acting?.model.visible && (!knockedOut || pod.change?.waitForHit) && acting.faintAction && actingDown) {
        poseNativeFaint(pod,acting,actingDown);
      } else if (acting?.model.visible && (!knockedOut || pod.change?.waitForHit)) {
        if (acting.faintProgress) poseNativeFaint(pod,acting,0);
        acting.rig?.reset();
        const action = motion?.cue.kind || 'idle';
        if (!config.reducedMotion && !actingDown) acting.mixer?.update(dt);
        if (actingDown) acting.rig?.pose('faint',actingDown,0,false);
        else if (!castAction) acting.rig?.pose(config.reducedMotion ? 'idle' : action,motion?.t || 0,
          config.reducedMotion ? null : time*.001+pod.angle,Boolean(acting.idleAction));
        if (motion && acting.rig?.airborne && !actingDown && !config.reducedMotion && (!pod.change || pod.change.waitForHit)) {
          // Attack and recoil can tilt a wing below the idle loop's lowest point.
          pod.modelSlot.updateMatrixWorld(true);
          const floor = pod.modelSlot.parent.matrixWorld.elements[13]+pokemonPodiumTop;
          const wingBottom = flyingMotionBounds.setFromObject(acting.model,true).min.y;
          if (wingBottom < floor) pod.modelSlot.position.y += floor-wingBottom;
        }
      }
      const showingPartner = !pod.visual ||
        (pod.visual.family === pod.modelRequest?.catalogueId && pod.visual.model.visible);
      const passive = showingPartner && !knockedOut && pod.passiveTrait;
      const blaze = passive==='blaze';
      battleEffects?.updateSteadyBlaze(pod,blaze,time,config.reducedMotion);
      const traitStyle = !knockedOut && !blaze && (burst?.style || (passive && pod.passiveStyle));
      if (traitStyle && !pod.traitAura) pod.traitAura = createTraitAura(pod);
      pod.traitAura?.update(traitStyle,burst?.strength ?? .34,size,time,config.reducedMotion);
      if (label) {
        label.dataset.traitAura = blaze ? 'fire' : traitStyle || '';
        label.dataset.passiveTrait = passive || '';
      }
      const showingStatus = Boolean(pod.status && showingPartner);
      if (showingStatus && !pod.statusEffect) pod.statusEffect = createStatusEffect(pod,pod.status);
      pod.statusEffect?.update(showingStatus,size,time,config.reducedMotion);
      if (label) label.dataset.statusEffect = showingStatus ? pod.statusEffect?.status || '' : '';
      if (pod.visual) loaded++;
      label?.classList.toggle('world-effect-target',targets.includes(pod.id));
      label?.classList.toggle('world-peripheral',camera.aspect<.9 && host.dataset.camera==='target' &&
        !targets.includes(pod.id) && focus?.sourceId!==pod.id && config.viewerId!==pod.id);
      pod.position.y = 2.65 + (size-1)*1.8 + (leveling ? pod.visual.model.position.y : 0);
      const labelAnchor = pod.position.clone();
      const labelLift = (pod.visual?.labelLift ?? 0)*size;
      labelAnchor.y += labelLift;
      if (config.coastalBattle && host.dataset.camera==='trainer' && host.clientWidth>=900 && camera.aspect>=1.4) {
        const side = Math.sin(pod.angle), depth = Math.cos(pod.angle);
        let shift = 0;
        if (depth>.94) {
          shift = 1.95;
          labelAnchor.y -= 1.32;
        } else if (pods.length===6 && depth>.15) {
          shift = side>0 && labelLift>.25 ? .85 : -Math.sign(side)*1.35;
          labelAnchor.y -= 1.0;
        } else if (depth<-.94) {
          shift = -1.75;
          labelAnchor.y -= .35;
        } else {
          shift = Math.sign(side)*1.1;
        }
        labelAnchor.x += shift;
      }
      project(label,labelAnchor,true);
      project(sprite,pod.spritePosition,true);
      if (isEligible) {
        for (const target of targetLayer?.querySelectorAll(`[data-target-seat="${CSS.escape(pod.id)}"]:not([hidden])`) || []) {
          const point = pod.spritePosition.clone();
          point.y = target.dataset.targetSlot ? point.y + .65*size : .53;
          project(target,point);
        }
      }
      const hasPokemon = Boolean(pod.modelKey);
      pod.proxy.visible=hasPokemon && !pod.visual && !sprite?.naturalWidth;
      if (pod.proxy.visible) pod.proxy.scale.setScalar(size);
      sprite?.classList.toggle('model-ready',Boolean(pod.visual));
    }
    host.dataset.models = loaded;
    host.dataset.trainers = trainerSlots.filter(slot => slot.model).length;
    host.dataset.animation = pods.find(pod=>pod.change)?.change.kind || '';
    renderer.render(scene,camera);
    draftModels?.draw(time,dt,config.reducedMotion);
  }
  const onLost = event => {
    event.preventDefault(); lost=true;
    mountDraftModels();
    if(host) {host.dataset.mode='flat'; host.dataset.reason='webgl';}
  };
  const onRestored = () => { if(disposed)return; lost=false; host.dataset.mode=displayMode(); delete host.dataset.reason; mountDraftModels(); resize(); };
  renderer.domElement.addEventListener('webglcontextlost',onLost);
  renderer.domElement.addEventListener('webglcontextrestored',onRestored);
  renderer.setAnimationLoop(time => {
    if ((config?.reducedMotion && !config.waterMotion && !battleEffects?.active) || time-lastFrame<33) return;
    lastFrame=time; draw(time);
  });
  return {
    mount(nextHost, nextConfig) {
      const sameTable = config?.roomCode && config.roomCode===nextConfig.roomCode && config.theme===nextConfig.theme;
      const sameViewer = sameTable && config.viewerId===nextConfig.viewerId;
      if (!sameViewer || !nextConfig.turnId || !nextConfig.turnNumber) {
        turnFocus = null;
      } else if (config.turnId && nextConfig.turnNumber>config.turnNumber && nextConfig.turnId!==config.turnId &&
        nextConfig.camera!=='overhead' && !nextConfig.reducedMotion) {
        turnFocus = {playerId:nextConfig.turnId,queuedAt:performance.now(),startedAt:null};
      }
      host=nextHost; config=nextConfig; labelLayer=host.querySelector('.world-labels'); spriteLayer=host.querySelector('.world-sprites'); targetLayer=host.querySelector('.world-targets');
      host.prepend(renderer.domElement);
      const key=JSON.stringify([config.theme,config.coastalBattle,config.roomCode,config.portraitIndex,config.viewerId,config.players.map(p=>[p.id,p.leader])]);
      if (key!==geometryKey) {
        const previousTrainers = sameTable ? new Map(pods.filter(pod=>pod.trainerSlot.modelAsset).map(pod=>[
          pod.id,{profile:pod.trainerSlot.modelProfile,asset:pod.trainerSlot.modelAsset},
        ])) : null;
        geometryKey=key;
        build(previousTrainers);
      }
      host.dataset.mode = displayMode();
      observer?.disconnect(); observer=new ResizeObserver(resize); observer.observe(host);
      eligible = null;
      marked = [];
      aimBottom = 0;
      mountDraftModels();
      updateModels();
      battleEffects?.preload(config.eventTypes);
      battleEffects?.enqueue(config.cues || [],performance.now(),config.activeCardEvent);
      resize();
    },
    refresh() { draw(performance.now()); },
    targeting(ids, selected, inset) {
      if (!ids && !eligible) return;
      eligible = ids;
      marked = selected;
      aimBottom = inset;
      draw(performance.now());
    },
    dispose() {
      disposed=true; observer?.disconnect(); renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('webglcontextlost',onLost);
      renderer.domElement.removeEventListener('webglcontextrestored',onRestored);
      draftModels?.dispose();
      clearScene();
      for (const pending of models.values()) pending.then(({mount}) => {
        const textures = new Set(), geometries = new Set(), materials = new Set();
        mount.traverse(part => {
          if (part.geometry) geometries.add(part.geometry);
          if (part.material) for (const material of [part.material].flat()) {
            materials.add(material);
            for (const property of Object.values(material)) if (property?.isTexture) textures.add(property);
          }
        });
        textures.forEach(texture=>texture.dispose());
        geometries.forEach(geometry=>geometry.dispose());
        materials.forEach(material=>material.dispose());
      }).catch(()=>{});
      models.clear();
      for (const material of mutedMaterials.values()) material.dispose();
      mutedMaterials.clear();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}
