import * as THREE from '/vendor/three.module.js';

const {clamp,smoothstep} = THREE.MathUtils;
const turn = Math.PI*2;
const up = new THREE.Vector3(0,1,0);
const fade = (t,start,end) => 1-smoothstep(t,start,end);
const floor = pod => pod.spritePosition.clone().setY(.54);
const chest = pod => floor(pod).addScaledVector(up,.78+(pod.visual?.size ?? 1)*.34);

function effectGroup(scene,update) {
  const group = new THREE.Group();
  scene.add(group);
  return {group,animate: update,dispose() {
    const geometries = new Set(), materials = new Set();
    group.traverse(part=>{
      if (part.geometry) geometries.add(part.geometry);
      if (part.material) materials.add(part.material);
    });
    for (const item of geometries) item.dispose();
    for (const item of materials) item.dispose();
    group.removeFromParent();
  }};
}

function mesh(group,geometry,color,options={}) {
  const material = new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false,toneMapped:false,...options});
  const item = new THREE.Mesh(geometry,material);
  group.add(item);
  return item;
}

function arc(group,radius,thickness,color,span=turn) {
  return mesh(group,new THREE.TorusGeometry(radius,thickness,8,48,span),color);
}

function tube(group,points,width,color,straight=false) {
  const path = straight ? new THREE.CurvePath() : new THREE.CatmullRomCurve3(points);
  if (straight) for (let i=1;i<points.length;i++) path.add(new THREE.LineCurve3(points[i-1],points[i]));
  return mesh(group,new THREE.TubeGeometry(path,48,width,5,false),color);
}

function sigil(scene,type,position) {
  const marks = {
    psychic:[0xcc6dff,3,Math.PI*1.72],
    fire:[0xff8538,3,Math.PI*.95],
    electric:[0xffdd51,3,Math.PI*.42],
    blessing:[0xffa7df,2,turn],
    song:[0xf69cd4,3,Math.PI*1.37],
    harvest:[0x90d953,3,Math.PI*1.17],
    duel:[0xffd68a,2,Math.PI*.83],
  };
  const [color,count,span] = marks[type];
  const effect = effectGroup(scene,t=>{
    const energy = smoothstep(t,.14,.42)*fade(t,.68,1);
    core.material.opacity = energy*.80;
    core.scale.setScalar(.32+energy*.53);
    core.rotation.y = t*2;
    rings.forEach((ring,i)=>{
      const phase = clamp((t-.08-i*.085)/.77,0,1);
      ring.material.opacity = Math.sin(phase*Math.PI)*.90;
      ring.scale.setScalar(.5+phase*(type==='song'?2.35:1.58));
      ring.rotation.set(grounded ? -Math.PI/2 : i*.69,.28*i,t*(type==='fire'?5:2.7)+i*2.2);
      ring.position.y = grounded ? i*.15 : 0;
    });
  });
  const grounded = ['song','harvest','duel'].includes(type);
  const {group} = effect;
  group.position.copy(position);
  const core = mesh(group,grounded ? new THREE.TorusGeometry(.5,.048,7,type==='duel'?4:6) :
    new THREE.IcosahedronGeometry(.49,1),color,{wireframe:!grounded});
  if (grounded) core.rotation.x = -Math.PI/2;
  const rings = Array.from({length:count},(_,i)=>arc(group,.86+i*.18,.044,color,span));
  return effect;
}

function skyStrike(scene,type,from,to) {
  const psychic = type==='psychic', flame = type==='fire';
  const color = psychic ? 0xe99aff : flame ? 0xff7e32 : 0xffd642;
  const direction = to.clone().sub(from);
  const sideways = new THREE.Vector3().crossVectors(direction,up).normalize();
  const effect = effectGroup(scene,t=>{
    const arrival = smoothstep(t,.16,.65);
    const strike = smoothstep(t,.56,.68)*fade(t,.76,1);
    head.visible = flame && t>.14 && t<.71;
    head.position.copy(from).lerp(to,arrival);
    head.scale.set(.40,.60+(1-arrival)*.35,.40);
    traces.forEach((trace,i)=>{
      const lead = smoothstep(t,.11+i*.035,.58+i*.025);
      const count = trace.geometry.index.count;
      trace.geometry.setDrawRange(0,Math.floor(count*lead/6)*6);
      trace.material.opacity = smoothstep(t,.12,.26)*fade(t,.66,.94)*(i===0?.98:.81);
    });
    rings.forEach((ring,i)=>{
      ring.scale.setScalar(.23+smoothstep(t,.57+i*.055,.98)*(1.49+i*.21));
      ring.material.opacity = strike*(1-i*.18);
      ring.rotation.z = t*2+i*.8;
    });
  });
  const {group} = effect;
  const head = mesh(group,new THREE.IcosahedronGeometry(1,2),0xffe3a2);
  head.quaternion.setFromUnitVectors(up,direction.clone().normalize());
  const traces = Array.from({length:3},(_,i)=>{
    const start = !flame && !psychic && i>0 ? from.clone().addScaledVector(sideways,(i-1.5)*2.2) : from;
    const points = Array.from({length:12},(_,j)=>{
      const u = j/11;
      const point = start.clone().lerp(to,u);
      if (j===0 || j===11) return point;
      const taper = Math.sin(u*Math.PI);
      if (flame) point.addScaledVector(up,taper*(.85+i*.24)).addScaledVector(sideways,(i-1)*taper*.40);
      else point.addScaledVector(sideways,Math.sin(u*(psychic?11:46)+i*2.1)*taper*(psychic?.34:.92));
      return point;
    });
    return tube(group,points,i===0?(flame?.23:.14):.105,i===0?0xfff0db:color,!psychic&&!flame);
  });
  const rings = Array.from({length:3},(_,i)=>{
    const ring = arc(group,1,.055,color,psychic?turn:Math.PI*(1.18+i*.22));
    ring.position.copy(to).setY(.57+i*.18);
    ring.rotation.x = -Math.PI/2;
    return ring;
  });
  return effect;
}

function sweep(scene,from,to,color,shape) {
  const effect = effectGroup(scene,t=>{
    const travel = smoothstep(t,.23,.67);
    const length = stroke.geometry.index.count;
    stroke.geometry.setDrawRange(0,Math.floor(length*travel/6)*6);
    stroke.material.opacity = smoothstep(t,.20,.39)*fade(t,.63,.98);
    seal.material.opacity = smoothstep(t,.37,.61)*fade(t,.74,1);
    seal.scale.setScalar(.45+travel*.82);
    seal.rotation.y = shape==='mime' ? -.29+t*.60 : t*3;
  });
  const lift = shape==='song' ? .42 : .88;
  const points = Array.from({length:10},(_,i)=>{
    const u = i/9, point = from.clone().lerp(to,u);
    point.y += Math.sin(u*Math.PI)*lift;
    if (shape==='song') point.x += Math.sin(u*turn*2)*.34;
    return point;
  });
  const stroke = tube(effect.group,points,.06,color);
  const seal = shape==='mime'
    ? mesh(effect.group,new THREE.TorusGeometry(.62,.044,7,4),color)
    : arc(effect.group,.62,.044,color,Math.PI*1.6);
  if (shape==='mime') seal.rotation.z = Math.PI/4;
  seal.position.copy(to);
  return effect;
}

function protection(scene,target,reducedMotion) {
  const effect = effectGroup(scene,t=>{
    const strength = reducedMotion ? 1 : smoothstep(t,.27,.51)*fade(t,.79,.98);
    const size = target.visual?.size ?? 1;
    group.position.copy(floor(target));
    group.scale.setScalar(size*(.86+strength*.15));
    shell.material.opacity = strength*.36;
    veins.material.opacity = strength*.55;
    rim.material.opacity = strength*.95;
    facets.forEach((facet,i)=>{
      const angle = i*turn/facets.length;
      facet.position.set(Math.cos(angle)*1.08,.28,Math.sin(angle)*1.08);
      facet.rotation.set(.20*Math.sin(angle),-angle,.22*Math.cos(angle));
      facet.scale.setScalar(.45+strength*.62);
      facet.material.opacity = strength*.85;
    });
  });
  const {group} = effect;
  const geometry = new THREE.IcosahedronGeometry(1.42,1);
  const shell = mesh(group,geometry,0x8bdfff);
  const veins = mesh(group,geometry,0xe1f8ff,{wireframe:true});
  shell.position.y = veins.position.y = 1.02;
  const rim = arc(group,1.35,.06,0xc5f5ff);
  rim.rotation.x = -Math.PI/2;
  const crystal = new THREE.ConeGeometry(.16,.66,4);
  const facets = Array.from({length:9},()=>mesh(group,crystal,0xbbf2ff));
  return effect;
}

export function eventGraphics(scene,cue,{source,target,origin,reducedMotion}) {
  if (cue.action==='shield' && target) return [protection(scene,target,reducedMotion)];
  if (reducedMotion) return [];
  const {kind,effect,action} = cue;
  const type = {'mewtwo-threat':'psychic','moltres-trial':'fire','zapdos-punishment':'electric'}[effect];
  if (type && kind==='event') return [sigil(scene,type,origin)];
  if (type && kind==='attack' && target) return [skyStrike(scene,type,origin,chest(target))];
  if (effect==='mew-blessing') {
    if (action==='bless' && target) return [sweep(scene,origin,chest(target),0xffa8e3,'mew'),sigil(scene,'blessing',floor(target))];
    if (kind==='event') return [sigil(scene,'blessing',origin)];
  }
  if (effect==='jigglypuff-performance' && target) {
    if (kind==='event') return [sigil(scene,'song',origin.clone().setY(.56))];
    if (action==='lull') return [sweep(scene,origin,chest(target),0xffa4db,'song'),sigil(scene,'song',floor(target))];
  }
  if (effect==='farfetchd-prank' || effect==='mr-mime-trick') {
    if (kind==='event') return [sigil(scene,effect==='mr-mime-trick'?'psychic':'duel',origin)];
    if (target) return [sweep(scene,origin,chest(target),effect==='mr-mime-trick'?0xe9a2ff:0xe8efac,
      effect==='mr-mime-trick'?'mime':'leek')];
  }
  if (effect==='berry-harvest') {
    if (kind==='event') return [sigil(scene,'harvest',new THREE.Vector3(0,.58,0))];
    if (action==='harvest' && target) return [sweep(scene,new THREE.Vector3(0,1,0),chest(target),0xb4e86c,'berry'),
      sigil(scene,'harvest',floor(target))];
  }
  if (effect==='rival-challenge') {
    if (kind==='event' && source && target) return [sigil(scene,'duel',floor(source)),sigil(scene,'duel',floor(target))];
    if (source && target && ['challenge','duel-strike'].includes(action)) {
      return [sweep(scene,chest(source),chest(target),0xffd28b,'duel'),sigil(scene,'duel',floor(target))];
    }
  }
  return [];
}

export function responseGraphics(scene,kind,target) {
  const isDodge = kind==='dodge';
  const effect = effectGroup(scene,t=>{
    const energy = smoothstep(t,0,.14)*fade(t,.23,.69);
    const size = .32+smoothstep(t,.01,.68)*(isDodge?1.46:1.15);
    mark.material.opacity = energy*.89;
    mark.scale.setScalar(size);
    mark.rotation.z = isDodge ? -.42+t*1.5 : Math.PI*.25;
  });
  const mark = arc(effect.group,.68,.062,isDodge?0xc4f6ef:0xffba8d,isDodge?Math.PI*1.26:turn);
  effect.group.position.copy(chest(target));
  if (isDodge) effect.group.rotation.y = -.44;
  else mark.rotation.x = -.22;
  return effect;
}
