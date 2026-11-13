import * as THREE from '/vendor/three.module.js';

// The models use several rig naming conventions. Resolve each joint once per clone.
const joints = {
  head:/^head$/, jaw:/^(jaw|lowerjaw)$/, chest:/^(spine2|spine02|chest|neck)$/,
  leftArm:/^(leftarm01|leftarm|larm|leftshoulder|lshoulder)$/,
  rightArm:/^(rightarm01|rightarm|rarm|rightshoulder|rshoulder)$/,
  leftElbow:/^(leftarm02|leftforearm|lforearm)$/,
  rightElbow:/^(rightarm02|rightforearm|rforearm)$/,
  leftLeg:/^(leftthigh|lthigh|leftleg01|lleg)$/, rightLeg:/^(rightthigh|rthigh|rightleg01|rleg)$/,
  tail:/^(tail1|tail01|tail)$/,
};
const axisX = new THREE.Vector3(1,0,0);
const axisY = new THREE.Vector3(0,1,0);
const axisZ = new THREE.Vector3(0,0,1);
const pulse = t => Math.sin(Math.PI*THREE.MathUtils.clamp(t,0,1));
const quadrupeds = new Set([1,2,3,32,37,38,53,58,59,79,111,112,128]);
const airborne = new Set([6,12,15,16,17,18,81,82,92,93,94,109,110,142,144,145,146,149,150,151]);

const jointName = name => name.replace(/^\d+[ _]+/,'').replace(/_[1-9]\d{0,2}$/,'').replaceAll('_','').toLowerCase();

const eventJoints = {
  ...joints,
  body:/^(waist|pelvis)$/,
  chest:/^(spine2|spine02|spine)$/,
  jaw:/^(jaw|lowerbeak|mouth)$/,
  leftWing:/^(lshoulder|lupperarm)$/,
  rightWing:/^(rshoulder|rupperarm)$/,
  leftElbow:/^(leftarm02|leftforearm|lforearm|lforearm1)$/,
  rightElbow:/^(rightarm02|rightforearm|rforearm|rforearm1)$/,
  leftHand:/^(lhand|lefthand)$/,
  rightHand:/^(rhand|righthand)$/,
  leftEar:/^lear$/,
  rightEar:/^rear$/,
};

export function createEventPokemonMotion(model,dex) {
  model.updateMatrixWorld(true);
  const facing = model.getWorldQuaternion(new THREE.Quaternion());
  const skeleton = new Map();
  model.traverse(bone=>{ if (bone.isBone) skeleton.set(jointName(bone.name),bone); });
  const bindings = {};
  for (const [joint,pattern] of Object.entries(eventJoints)) {
    const bone = dex===146 && joint.endsWith('Wing')
      ? skeleton.get(joint==='leftWing'?'lupperarm':'rupperarm')
      : [...skeleton].find(([name])=>pattern.test(name))?.[1];
    if (!bone?.parent) continue;
    const basis = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(facing);
    bindings[joint] = {bone,rest:bone.quaternion.clone(),
      pitch:axisX.clone().applyQuaternion(basis),yaw:axisY.clone().applyQuaternion(basis),roll:axisZ.clone().applyQuaternion(basis)};
  }
  const turn = new THREE.Quaternion();
  const rotate = (joint,axis,angle)=>{
    const binding = bindings[joint];
    if (binding && angle) binding.bone.quaternion.premultiply(turn.setFromAxisAngle(binding[axis],angle));
  };
  const spread = (lift,sweep)=>{
    rotate('leftWing','roll',lift);
    rotate('rightWing','roll',-lift);
    rotate('leftWing','yaw',sweep);
    rotate('rightWing','yaw',-sweep);
  };
  const envelope = (t,inStart,inEnd,outStart,outEnd)=>THREE.MathUtils.smoothstep(t,inStart,inEnd)*
    (1-THREE.MathUtils.smoothstep(t,outStart,outEnd));
  return {
    reset() {
      for (const {bone,rest} of Object.values(bindings)) bone.quaternion.copy(rest);
    },
    pose(t,cue,side) {
      const windup = envelope(t,.10,.31,.35,.49);
      const release = envelope(t,.32,.48,.56,.83);
      const performance = envelope(t,.22,.44,.74,.97);
      const accent = Math.sin((t-.27)*Math.PI*7)*performance;
      if (dex===39) {
        rotate('body','pitch',-.17*windup+.09*accent);
        rotate('body','roll',.17*accent);
        rotate('leftArm','roll',.49*performance+.17*accent);
        rotate('rightArm','roll',-.49*performance+.17*accent);
        rotate('leftEar','roll',.19*accent);
        rotate('rightEar','roll',.13*accent);
      } else if (dex===83) {
        const swing = cue.action==='discard' ? release : 0;
        const pullback = cue.action==='discard' ? windup : .21*performance;
        // The leek is skinned to the left hand through FeelerB1.
        rotate('chest','yaw',.37*pullback-.66*swing);
        rotate('chest','pitch',-.10*pullback+.22*swing);
        rotate('leftArm','roll',.70*pullback-.37*swing);
        rotate('leftArm','pitch',-.54*pullback-.82*swing);
        rotate('leftElbow','yaw',-.46*swing);
        rotate('leftHand','roll',.45*pullback-.51*swing);
        rotate('rightArm','roll',-.32*swing);
        rotate('head','yaw',side*.22*performance);
        rotate('jaw','pitch',.24*swing);
      } else if (dex===122) {
        const pull = cue.action==='take' ? release : 0;
        rotate('chest','pitch',.13*windup-.22*pull);
        rotate('leftArm','pitch',-.57*performance+.30*pull);
        rotate('rightArm','pitch',-.69*performance+.29*pull);
        rotate('leftElbow','yaw',-.40*pull);
        rotate('rightElbow','yaw',.40*pull);
        rotate('leftHand','roll',.23*performance);
        rotate('rightHand','roll',-.23*performance);
        rotate('head','roll',side*.15*performance);
      } else if (dex===144) {
        spread(.49*windup+.41*release+.14*accent,-.31*release);
        rotate('head','pitch',-.26*windup+.18*release);
        rotate('tail','pitch',.30*release);
      } else if (dex===145) {
        const strike = cue.external ? release : 0;
        spread(.61*windup-.43*strike+.16*accent,.18*strike);
        rotate('head','pitch',-.28*windup+.38*strike);
        rotate('jaw','pitch',.28*strike);
        rotate('leftLeg','pitch',-.27*strike);
        rotate('rightLeg','pitch',-.27*strike);
      } else if (dex===146) {
        const strike = cue.external ? release : 0;
        spread(.35*windup-.44*strike+.13*accent,.33*strike);
        rotate('chest','pitch',-.14*windup+.24*strike);
        rotate('head','pitch',-.23*windup+.24*strike);
        rotate('jaw','pitch',.32*strike);
        rotate('tail','pitch',-.27*strike);
      } else if (dex===150) {
        const cast = cue.external ? release : 0;
        rotate('chest','pitch',-.19*windup+.22*cast);
        rotate('head','pitch',-.19*windup+.12*cast);
        rotate('leftArm','pitch',-.48*windup-.39*cast);
        rotate('rightArm','pitch',-.54*windup-.89*cast);
        rotate('leftElbow','yaw',-.38*windup);
        rotate('rightElbow','yaw',.44*windup);
        rotate('rightHand','pitch',-.33*cast);
        rotate('tail','yaw',-.27*windup+.32*cast);
      } else if (dex===151) {
        rotate('body','roll',.25*accent);
        rotate('head','pitch',-.22*windup+.11*release);
        rotate('leftArm','roll',.55*performance);
        rotate('rightArm','roll',-.55*performance);
        rotate('tail','yaw',.62*accent);
      }
    },
  };
}

export function preparePokemonIdle(asset,dex,bounds) {
  if (dex!==111 && dex!==131) return;
  asset.updateMatrixWorld(true);
  const size=bounds.getSize(new THREE.Vector3());
  const center=bounds.getCenter(new THREE.Vector3());
  const point=new THREE.Vector3();
  const localPoint=new THREE.Vector3();
  asset.traverse(mesh=>{
    if (!mesh.isMesh || mesh.isSkinnedMesh || mesh.morphTargetInfluences?.length) return;
    const geometry=mesh.geometry;
    const source=geometry.attributes.position;
    const inverse=mesh.matrixWorld.clone().invert();
    const relaxed=new Float32Array(source.count*3), breathing=new Float32Array(source.count*3);
    for (let i=0;i<source.count;i++) {
      point.fromBufferAttribute(source,i).applyMatrix4(mesh.matrixWorld);
      const height=(point.y-bounds.min.y)/size.y;
      const side=point.x-center.x;
      localPoint.copy(point).applyMatrix4(inverse).toArray(relaxed,i*3);
      const body=THREE.MathUtils.smoothstep(height,.10,.38)*(1-THREE.MathUtils.smoothstep(height,.71,.96));
      point.x += side*.018*body;
      point.y += size.y*.013*body;
      point.z += (point.z-center.z)*.046*body;
      point.applyMatrix4(inverse).toArray(breathing,i*3);
    }
    const relaxedPosition=new THREE.BufferAttribute(relaxed,3);
    const breathingPosition=new THREE.BufferAttribute(breathing,3);
    relaxedPosition.name='arenaRelaxed';
    breathingPosition.name='arenaBreath';
    const temporary=geometry.clone();
    geometry.morphAttributes.position=[relaxedPosition,breathingPosition];
    geometry.morphAttributes.normal=[relaxedPosition,breathingPosition].map(position=>{
      temporary.setAttribute('position',position);
      temporary.computeVertexNormals();
      const normal=temporary.attributes.normal.clone();
      normal.name=position.name;
      return normal;
    });
    temporary.dispose();
    geometry.computeBoundingSphere();
    mesh.updateMorphTargets();
  });
}

export function createPokemonBattleMotion(model, dex) {
  model.updateMatrixWorld(true);
  const bindings = {};
  model.traverse(bone=>{
    if (!bone.isBone || !bone.parent) return;
    const name = jointName(bone.name);
    const key = Object.keys(joints).find(joint=>joints[joint].test(name));
    if (!key || bindings[key]) return;
    const inverse = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    bindings[key] = {
      bone,rest:bone.quaternion.clone(),
      pitch:axisX.clone().applyQuaternion(inverse),yaw:axisY.clone().applyQuaternion(inverse),
      roll:axisZ.clone().applyQuaternion(inverse),
    };
  });
  const turn = new THREE.Quaternion();
  const rotate = (joint,axis,radians)=>{
    const binding = bindings[joint];
    if (binding) binding.bone.quaternion.premultiply(turn.setFromAxisAngle(binding[axis],radians));
  };
  const wings = dex===142 || dex===144 || dex===145 || dex===146 || dex===149 || dex===6;
  const onFourFeet = quadrupeds.has(dex);
  const restArms = [];
  if (!wings && !onFourFeet) {
    for (const side of ['left','right']) {
      const arm=bindings[side+'Arm']?.bone, elbow=bindings[side+'Elbow']?.bone;
      if (!arm || !elbow) continue;
      const line=elbow.getWorldPosition(new THREE.Vector3()).sub(arm.getWorldPosition(new THREE.Vector3())).normalize();
      if (Math.abs(line.x)<.72 || line.y<-.48) continue;
      const delta=Math.atan2(-.86,Math.sign(line.x)*.51)-Math.atan2(line.y,line.x);
      restArms.push([side,Math.atan2(Math.sin(delta),Math.cos(delta))]);
    }
  }
  const morphs=[];
  model.traverse(mesh=>{
    const relaxed=mesh.morphTargetDictionary?.arenaRelaxed;
    if (relaxed!=null) morphs.push(mesh.morphTargetInfluences);
  });
  return {
    airborne: airborne.has(dex),
    reset() {
      for (const {bone,rest} of Object.values(bindings)) bone.quaternion.copy(rest);
    },
    pose(kind,t,seconds,animatedIdle) {
      const still = seconds==null;
      const breath = still ? .3 : .5+.5*Math.sin(seconds*2.1);
      for (const influences of morphs) {
        influences[0]=1-breath;
        influences[1]=breath;
      }
      if (!animatedIdle) for (const [side,angle] of restArms) {
        rotate(side+'Arm','roll',angle);
        rotate(side+'Elbow','pitch',.17);
      }
      if (kind==='idle') {
        if (animatedIdle || still) return;
        const glance = Math.sin(seconds*1.07);
        rotate('head','yaw',.16*glance);
        rotate('head','pitch',-.038+.075*breath);
        rotate('tail','yaw',(onFourFeet?.22:.15)*Math.sin(seconds*1.65));
        if (wings) {
          rotate('leftArm','roll',.24*(breath-.5));
          rotate('rightArm','roll',-.24*(breath-.5));
        } else if (!onFourFeet) {
          rotate('chest','pitch',.04*breath);
          rotate('leftElbow','pitch',.046*glance);
          rotate('rightElbow','pitch',-.032*glance);
        }
        return;
      }
      if (kind==='attack') {
        const windup = pulse(t/.38);
        const release = pulse((t-.23)/.65);
        rotate('head','pitch',-.30*windup+.25*release);
        rotate('jaw','pitch',.47*release);
        rotate('chest','pitch',-.18*windup+.31*release);
        rotate('leftArm',wings?'roll':'pitch',-.37*windup+.64*release);
        rotate('rightArm',wings?'roll':'pitch',(wings?-1:1)*(-.37*windup+.64*release));
        rotate('tail','yaw',.31*(windup-release));
      } else if (kind==='hit') {
        const flinch = Math.sin(t*7.7)*Math.exp(-t*3.0);
        rotate('head','pitch',-.61*flinch);
        rotate('chest','roll',.30*flinch);
        rotate('leftArm','pitch',-.46*flinch);
        rotate('rightArm','pitch',-.29*flinch);
        rotate('tail','yaw',-.41*flinch);
      } else if (kind==='dodge') {
        const tuck = pulse(t);
        rotate('head','roll',.28*tuck);
        rotate('leftArm','roll',.45*tuck);
        rotate('rightArm','roll',-.53*tuck);
        rotate('leftLeg','pitch',.41*tuck);
        rotate('rightLeg','pitch',-.39*tuck);
        rotate('tail','yaw',-.48*tuck);
      } else if (kind==='faint' || kind==='knockout') {
        rotate('head','pitch',.43*t);
        rotate('chest','pitch',.32*t);
        rotate('leftLeg','pitch',.44*t);
        rotate('rightLeg','pitch',.57*t);
        rotate('tail','pitch',.31*t);
      }
    },
  };
}
