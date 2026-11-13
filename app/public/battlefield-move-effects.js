import * as THREE from '/vendor/three.module.js';
import {moveRecipe,traitRecipe} from './battlefield-effect-recipes.js';

const up = new THREE.Vector3(0,1,0);
const turn = Math.PI*2;
const {clamp,smoothstep} = THREE.MathUtils;
const fade = (t,start,end) => 1-smoothstep(t,start,end);
const mouth = pod => {
  const top = (pod.visual?.footprint?.top ?? 1.55)*(pod.visual?.size ?? 1);
  return pod.spritePosition.clone().addScaledVector(up,clamp(top*.64,.63,1.58));
};
const palettes = {
  'ice-beam': [0x267fcd,0xc7ffff,0xe7f9ff],
  'water-gun': [0x106abb,0x72e5f6,0xcbffff],
  'water-absorb': [0x138cc9,0x7af8ed,0xc2fff0],
  blaze: [0xdd3710,0xffa228,0xffeac5],
  fire: [0xc52b0d,0xff912c,0xffe29b],
  water: [0x1165aa,0x5ddaf5,0xe1ffff],
  ice: [0x389ee2,0x9aebff,0xedfcff],
  leaf: [0x427c21,0x98d750,0xe8ff9b],
  poison: [0x69338d,0xc874d9,0xf2bcff],
  spirit: [0x492064,0xa45adc,0xedbaff],
  air: [0x648f9b,0xbee1d6,0xeaffed],
  pollen: [0x9767a8,0xf2c8df,0xfff2d2],
  electric: [0xdb8311,0xffde48,0xfff8c3],
  mind: [0x71378b,0xe57cc8,0xffc5f2],
  stone: [0x754a32,0xc09968,0xf8e2b1],
  dragon: [0x6348a2,0xd6a7f8,0xffdfaa],
  steel: [0x6c7187,0xc5d6e9,0xffedc5],
  dark: [0x402954,0xb27caa,0xeec3d6],
  light: [0x327a9e,0x86e8dc,0xe8ffef],
  insect: [0x617f2d,0xc2de65,0xf7ffc4],
  prism: [0xa7619d,0xe2aaff,0xffedc1],
};

export function effectRecipe(cue) {
  if (cue.kind==='attack' || cue.kind==='hit') return !cue.external && moveRecipe(cue.name?.en);
  if (cue.kind==='ability') return traitRecipe(cue.name?.en);
}

function flowMaterial(dark,light,pattern,profile) {
  return new THREE.ShaderMaterial({
    uniforms:{
      dark:{value:new THREE.Color(dark)},light:{value:new THREE.Color(light)},
      pattern:{value:pattern},clock:{value:0},alpha:{value:0},profile:{value:profile},
    },
    vertexShader:`
      varying vec2 tex;
      varying vec3 normalView;
      varying vec3 eye;
      uniform float clock;
      uniform float profile;
      void main() {
        tex = uv;
        vec3 pos = position;
        if (profile < 2.5) {
          float swell = sin(uv.y * 20.0 - clock * 12.0 + uv.x * 6.28);
          pos.xz *= 0.78 + uv.y * 0.3 + swell * 0.09;
          if (profile > 0.5) {
            float bend = sin(uv.y * 3.1416);
            pos.x += bend * (.76 + sin(uv.y * 11.0 - clock * 8.0) * .26);
            pos.z += bend * sin(uv.y * 7.0 + clock * 5.0) * .24;
            pos.xz *= .65 + smoothstep(0.,.23,uv.y)*.45 - smoothstep(.84,1.,uv.y)*.30;
          }
        }
        if (profile > 3.5) pos.x += sin(uv.y * 5.0 - clock * 12.0) * uv.y * .22;
        vec4 vertex = modelViewMatrix * vec4(pos,1.);
        normalView = normalize(normalMatrix * normal);
        eye = -vertex.xyz;
        gl_Position = projectionMatrix * vertex;
      }`,
    fragmentShader:`
      varying vec2 tex;
      varying vec3 normalView;
      varying vec3 eye;
      uniform vec3 dark;
      uniform vec3 light;
      uniform sampler2D pattern;
      uniform float clock;
      uniform float alpha;
      uniform float profile;
      void main() {
        vec2 coords = vec2(tex.x + clock * .16, tex.y * 2.5 - clock * 2.1);
        if (profile > 2.5) coords = vec2(tex.y, tex.x * 2.0 - clock * .88);
        float veins = texture2D(pattern,fract(coords)).r;
        float facing = abs(dot(normalize(normalView),normalize(eye)));
        float rim = pow(1.0-facing,2.4);
        float streak = sin((tex.x*8.0 + tex.y*2.6 - clock*2.8)*6.2832) * .5 + .5;
        float gleam = clamp(veins * .76 + streak * .24 + rim * .46,0.,1.);
        float ends = smoothstep(0.,.085,tex.y)*(1.-smoothstep(.91,1.,tex.y));
        if (profile > 2.5) ends = smoothstep(0.,.10,tex.x)*(1.-smoothstep(.82,1.,tex.x));
        if (profile > 3.5) {
          float center = .50 + sin(tex.y*8.0-clock*13.0)*.09*tex.y;
          float width = .42*pow(1.0-tex.y,.64)*(.76+veins*.37);
          ends = (1.-smoothstep(width*.5,width,abs(tex.x-center))) *
            smoothstep(0.,.10,tex.y)*(1.-smoothstep(.66,1.,tex.y));
          gleam = clamp(veins*.43+.73*(1.-tex.y),0.,1.);
        }
        gl_FragColor = vec4(mix(dark,light,gleam),alpha*ends*(.46+.52*gleam));
        #include <colorspace_fragment>
      }`,
    transparent:true,depthWrite:false,toneMapped:false,
  });
}

function basic(color,extra={}) {
  return new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false,toneMapped:false,...extra});
}

function attach(scene,animate) {
  const group = new THREE.Group();
  scene.add(group);
  return {group,animate,dispose() {
    group.removeFromParent();
    const geometry = new Set(), materials = new Set();
    group.traverse(object=>{
      if (object.geometry) geometry.add(object.geometry);
      if (object.material) materials.add(object.material);
    });
    for (const item of geometry) item.dispose();
    for (const item of materials) item.dispose();
  }};
}

function mesh(group,geometry,material) {
  const item = new THREE.Mesh(geometry,material);
  group.add(item);
  return item;
}

function lightDisc(group,map,color) {
  const disc = mesh(group,new THREE.PlaneGeometry(2,2),basic(color,{alphaMap:map,blending:THREE.AdditiveBlending}));
  disc.rotation.x = -Math.PI/2;
  return disc;
}

function stream(scene,recipe,source,target,textures) {
  const ice = recipe.family==='ice';
  const prism = recipe.signature==='prism-beam';
  const hyper = recipe.signature==='hyper-beam';
  const fluid = ['fire','water','poison'].includes(recipe.family);
  const [dark,light,white] = palettes[recipe.key] ?? palettes[recipe.family];
  const start = mouth(source), end = mouth(target);
  const heading = end.clone().sub(start).setY(0).normalize();
  start.addScaledVector(heading,clamp((source.visual?.footprint?.halfDepth ?? .72)*.72,.38,1.05));
  end.addScaledVector(heading,-.33);
  const mouthJoint = source.visual?.model.getObjectByName('EffMouth01');
  const aim = new THREE.Vector3(), direction = new THREE.Vector3();
  const orientation = new THREE.Quaternion();
  const effect = attach(scene,t=>{
    if (mouthJoint) mouthJoint.getWorldPosition(start).addScaledVector(heading,.07);
    aim.subVectors(end,start);
    const length = aim.length();
    orientation.setFromUnitVectors(up,direction.copy(aim).normalize());
    muzzle.position.copy(start);
    const charge = smoothstep(t,.02,hyper?.27:.17)*fade(t,hyper?.41:.32,hyper?.59:.49);
    muzzle.material.opacity = charge*.89;
    muzzle.scale.setScalar((.12+charge*.48)*(1+.12*Math.sin(t*56)));
    const nose = smoothstep(t,hyper?.32:.22,.56), tail = smoothstep(t,.62,.94);
    const visibleLength = length*(nose-tail);
    outer.visible = core.visible = visibleLength>.01;
    outer.position.copy(start).addScaledVector(aim,(nose+tail)*.5);
    core.position.copy(outer.position);
    outer.quaternion.copy(orientation);
    core.quaternion.copy(orientation);
    const width = (ice?.26:fluid?.37:.29)*recipe.scale*(.69+.31*smoothstep(t,.25,.51))*fade(t,.76,.99);
    outer.scale.set(width,visibleLength,width);
    core.scale.set(width*(ice?.28:.46),visibleLength,width*(ice?.28:.46));
    material.uniforms.alpha.value = ice?.94:.91;
    material.uniforms.clock.value = t*(ice?1.45:1.85);
    if (!fluid) {
      core.material.opacity = .87;
      if (prism) core.material.color.setHSL(.66+t*.82,.83,.76);
    }
    else {
      core.material.uniforms.alpha.value = .73;
      core.material.uniforms.clock.value = t*2.17;
    }
    for (const [i,drop] of fringe.entries()) {
      const progress = (i/fringe.length+t*2.5)%1;
      const radius = width*(1.32+progress*.68), angle = i*2.399+t*15;
      drop.visible = progress>tail && progress<nose;
      drop.position.set(Math.cos(angle)*radius,progress*length,Math.sin(angle)*radius)
        .applyQuaternion(orientation).add(start);
      const scale = .10+.065*Math.sin(i*8);
      drop.scale.set(scale,scale*(ice?1.42:1.9),scale);
      drop.quaternion.copy(orientation);
    }
  });
  const {group} = effect;
  const tube = new THREE.CylinderGeometry(1,1,1,16,12,true);
  const material = flowMaterial(dark,light,ice?textures.ice:fluid?textures.flow:textures.laser,fluid?1:0);
  const outer = mesh(group,tube,material);
  const core = mesh(group,tube,!fluid ? basic(white,{blending:THREE.AdditiveBlending}) :
    flowMaterial(light,white,textures.flow,1));
  const muzzle = mesh(group,new THREE.IcosahedronGeometry(1,2),basic(light,{blending:THREE.AdditiveBlending}));
  const fringeGeo = ice ? new THREE.OctahedronGeometry(1) : new THREE.SphereGeometry(1,8,6);
  const fringeMaterial = basic(light,{opacity:ice?.77:.63});
  const fringe = Array.from({length:ice?13:19},()=>mesh(group,fringeGeo,fringeMaterial));
  return effect;
}

function spray(scene,recipe,source,target,textures,hit = false) {
  const fire = recipe.signature==='fire-stream';
  const acid = recipe.signature==='acid-stream';
  const start = mouth(source), end = mouth(target);
  const heading = end.clone().sub(start).setY(0).normalize();
  const side = new THREE.Vector3(-heading.z,0,heading.x);
  const mouthJoint = !hit && source.visual?.model.getObjectByName('EffMouth01');
  start.addScaledVector(heading,.48);
  end.addScaledVector(heading,-.24);
  if (hit) {
    start.copy(end).addScaledVector(heading,-.22);
    end.addScaledVector(heading,.78);
  }
  const ray = new THREE.Vector3(), axis = new THREE.Vector3();
  const effect = attach(scene,t=>{
    if (mouthJoint) mouthJoint.getWorldPosition(start).addScaledVector(heading,.07);
    ray.subVectors(end,start);
    axis.copy(ray).normalize();
    for (const [i,particle] of particles.entries()) {
      const launch = hit ? i/particles.length*.22 : .15 + i/particles.length*.39;
      const life = (hit?.51:fire?.37:.29) + (i%7)*.011;
      const age = (t-launch)/life;
      particle.visible = age > 0 && age < 1;
      if (!particle.visible) continue;
      const angle = i*2.399 + age*(fire?2.7:1.2);
      const edge = (.14+(i%7)*.039) * age;
      const spread = hit ? (.44+edge*2.4)*Math.sin(age*Math.PI*.7) :
        fire ? edge*(1.4+age*2.6) : edge*(.9+age*1.65);
      particle.position.copy(start).addScaledVector(ray,age)
        .addScaledVector(side,Math.cos(angle)*spread)
        .addScaledVector(heading,hit ? Math.sin(angle)*spread : 0)
        .addScaledVector(up,Math.sin(angle)*spread+(fire?.48*age*age:-.31*age*age)+(hit?.85*age:0));
      const opacity = smoothstep(age,0,.14)*fade(age,fire?.57:.76,1);
      if (fire) {
        const size = (.38+age*1.38)*(1+(i%5)*.12);
        particle.scale.set(size*1.35,size,1);
        particle.material.rotation = angle;
        particle.material.color.copy(hot).lerp(i%3===0?smoke:flame,smoothstep(age,.17,.91));
        particle.material.opacity = opacity*(i%3===0?.64:.86);
      } else {
        const radius = (.045+(i%6)*.016)*(.84+.34*age);
        particle.quaternion.setFromUnitVectors(up,axis);
        particle.scale.set(radius,radius*(acid?1.5:i%5===0?1.7:3.9),radius);
        particle.material.opacity = opacity*(i%5===0?.73:.91);
      }
    }
    for (const [i,ember] of embers.entries()) {
      const age = (t-.28-i*.012)/.53;
      ember.visible = age>0 && age<1;
      if (!ember.visible) continue;
      ember.position.copy(start).addScaledVector(ray,age*.89)
        .addScaledVector(side,Math.sin(i*2.4)*age*.97).addScaledVector(up,age*(.45+(i%4)*.23));
      ember.scale.setScalar(.035+.049*fade(age,.31,1));
      ember.material.opacity = fade(age,.48,1);
    }
  });
  const {group} = effect;
  const hot = new THREE.Color(0xffe28b), flame = new THREE.Color(0xf05b16), smoke = new THREE.Color(0x9d3618);
  const drop = fire ? null : new THREE.SphereGeometry(1,8,6);
  const liquid = acid ? [0x764694,0xaf68b6,0xd18dce,0xd9eb82] : [0x279cc4,0x46bddf,0x8de3ef,0xe0faff];
  const particles = Array.from({length:hit?22:fire?47:64},(_,i)=>{
    if (!fire) {
      const color = liquid[i%liquid.length];
      return mesh(group,drop,new THREE.MeshPhongMaterial({color,emissive:color,emissiveIntensity:.15,
        specular:0xdafaff,shininess:90,transparent:true,depthWrite:false}));
    }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:textures.flame,color:hot,transparent:true,depthWrite:false,toneMapped:false}));
    group.add(sprite);
    return sprite;
  });
  const emberGeometry = fire ? new THREE.OctahedronGeometry(1) : null;
  const embers = fire ? Array.from({length:20},(_,i)=>mesh(group,emberGeometry,basic(i%2?0xffba46:0xffe8ae))) : [];
  return effect;
}

function flameTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 96;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(96,96);
  for (let y=0; y<96; y++) for (let x=0; x<96; x++) {
    const u = (x-47.5)/47.5, v = (y-47.5)/47.5;
    const shape = Math.hypot(u,v) + .14*Math.sin(u*9+v*8) + .09*Math.sin(u*17-v*13);
    const alpha = fade(shape,.19,.94);
    const index = (y*96+x)*4;
    pixels.data[index] = pixels.data[index+1] = pixels.data[index+2] = 255;
    pixels.data[index+3] = alpha*255;
  }
  context.putImageData(pixels,0,0);
  return new THREE.CanvasTexture(canvas);
}

function impact(scene,key,target,textures) {
  const ice = key==='ice-beam';
  const [dark,light,white] = palettes[key];
  const ground = target.spritePosition.clone();
  ground.y = .52;
  const center = mouth(target);
  const effect = attach(scene,t=>{
    const spread = 1-Math.exp(-t*4);
    const visibility = fade(t,ice?.67:.48,1);
    groundGlow.scale.setScalar(.35+spread*(ice?1.58:1.16));
    groundGlow.material.opacity = visibility*(ice?.46:.39);
    shock.scale.setScalar(.12+spread*1.39);
    shock.material.opacity = fade(t,.10,.7)*.85;
    for (const [i,arc] of splash.entries()) {
      const lift = smoothstep(t,i*.024,.23+i*.019);
      arc.scale.set(.36+spread*.79,lift*(1.05-.48*t),.36+spread*.79);
    }
    if (splashMaterial) splashMaterial.opacity = smoothstep(t,0,.09)*fade(t,.28,.77)*.74;
    facets.forEach((item,i)=>{
      const a = i*2.399, radius = .28+spread*(.52+(i%4)*.23);
      const jump = Math.sin(Math.PI*clamp(t,0,1));
      item.position.set(ground.x+Math.cos(a)*radius,
        ground.y+(ice ? .19+jump*(.34+i%4*.22) : jump*(.64+i%5*.18)),
        ground.z+Math.sin(a)*radius);
      item.rotation.set(.23+i*.17,a,t*(ice?.9:4));
      const size = visibility*(.54+(i%5)*.12);
      item.scale.set(size,size*(ice?2.35:1.14),size);
    });
    flash.position.copy(center);
    flash.scale.setScalar(.25+spread*.67);
    flash.material.opacity = fade(t,.03,.31)*.68;
  });
  const {group} = effect;
  const groundGlow = lightDisc(group,ice?textures.ice:textures.ring,light);
  groundGlow.position.copy(ground);
  groundGlow.position.y += .018;
  const shock = mesh(group,new THREE.TorusGeometry(1,.035,6,42),basic(white));
  shock.rotation.x = -Math.PI/2;
  shock.position.copy(ground);
  shock.position.y += .035;
  const geometry = ice ? new THREE.OctahedronGeometry(.32) : new THREE.SphereGeometry(.13,8,6);
  const colors = [basic(dark,{opacity:.68}),basic(light,{opacity:.84}),basic(white,{opacity:.88})];
  const facets = Array.from({length:ice?13:21},(_,i)=>mesh(group,geometry,colors[i%3]));
  const splashMaterial = ice ? null : basic(light);
  const splash = ice ? [] : Array.from({length:8},(_,i)=>{
    const radius = 1.0+(i%3)*.18, height = .72+(i%4)*.16;
    const line = new THREE.CatmullRomCurve3([
      new THREE.Vector3(.12,.06,0),new THREE.Vector3(.42,height*.72,0),
      new THREE.Vector3(.69,height,0),new THREE.Vector3(radius,height*.69,0),
    ]);
    const arc = mesh(group,new THREE.TubeGeometry(line,13,.027+i%3*.006,5,false),splashMaterial);
    arc.position.copy(ground);
    arc.rotation.y = i*2.399;
    return arc;
  });
  const flash = mesh(group,new THREE.IcosahedronGeometry(.54,1),basic(white,{blending:THREE.AdditiveBlending}));
  return effect;
}

function travel(scene,recipe,source,target,textures) {
  const {family,form,count,scale,arc,key,signature,rhythm=1} = recipe;
  const [dark,light,white] = palettes[family];
  const start = mouth(source), end = mouth(target);
  const heading = end.clone().sub(start).setY(0).normalize();
  start.addScaledVector(heading,.38);
  end.addScaledVector(heading,-.26);
  const mouthJoint = source.visual?.model.getObjectByName('EffMouth01');
  const sideways = new THREE.Vector3(-heading.z,0,heading.x);
  const aim = new THREE.Vector3(), velocity = new THREE.Vector3();
  const bolt = form==='bolt' || form==='strike-down';
  const leechSeed = signature==='vines';
  const seed = leechSeed || signature==='seed';
  const ring = (form==='wave' || form==='drain') && !['pulse-orb','air-blades','venom-cloud','pollen','web'].includes(signature);
  const sphere = ['bubbles','pulse-orb','sludge-glob','shadow-orb','dragon-orb','venom-cloud','pollen'].includes(signature);
  const geometry = signature==='coins' ? new THREE.CylinderGeometry(.24,.24,.055,18) :
    signature==='air-blades' ? new THREE.TorusGeometry(.45,.063,6,26,Math.PI*.75) :
    signature==='boomerang' ? new THREE.TorusGeometry(.36,.10,7,20,Math.PI*1.22) :
    signature==='web' ? new THREE.IcosahedronGeometry(.56,1) :
    signature==='fire-star' ? new THREE.TorusGeometry(.38,.12,7,5) :
    ['icicles','ice-shard','needles','spikes'].includes(signature) ? new THREE.ConeGeometry(signature==='ice-shard'?.22:.12,signature==='icicles'?1.15:.75,5) :
    seed ? new THREE.SphereGeometry(.32,8,6).scale(.72,1.28,.72) : sphere ? new THREE.SphereGeometry(.37,14,10) :
    ring ? new THREE.TorusGeometry(.46,.053,7,30) :
    ['ice','poison'].includes(family) ? new THREE.ConeGeometry(.29,.87,6) :
      new THREE.IcosahedronGeometry(signature==='boulder'?.48:.37,family==='stone'?0:2);
  const surface = ['fire','poison','spirit','dragon'].includes(family);
  const effect = attach(scene,t=>{
    if (mouthJoint && !bolt) mouthJoint.getWorldPosition(start).addScaledVector(heading,.07);
    const ready = smoothstep(t,.02,.18)*fade(t,.31,.53);
    charge.position.copy(start);
    charge.scale.setScalar((.28+ready*.4)*scale);
    charge.material.opacity = ready*.69;
    for (const [i,shot] of shots.entries()) {
      const interval = signature==='bubbles'?.045:signature==='wisps'?.11:.055;
      const launch = .20+i*interval, finish = launch+.48*rhythm;
      const progress = smoothstep(t,launch,finish);
      shot.visible = t>launch && t<finish+.095;
      if (!shot.visible) continue;
      const strength = smoothstep(t,launch,launch+.075)*fade(t,finish,finish+.095);
      const returning = signature==='boomerang' && i===1;
      const reversed = form==='drain' || returning;
      shot.position.copy(reversed?end:start).lerp(reversed?start:end,progress);
      const lift = Math.sin(Math.PI*progress);
      const falling = ['rockfall','meteors'].includes(signature);
      if (falling) shot.position.copy(end).addScaledVector(sideways,(i-(count-1)/2)*.48);
      shot.position.y += falling ? (1-progress)*(3.2+arc+i*.29) : lift*arc;
      shot.position.addScaledVector(sideways,lift*(i-(count-1)*.5)*(signature==='mud-fan'?.94:.37));
      if (signature==='wisps' || signature==='sap' || signature==='sap-burst') shot.position.y += Math.sin(progress*12+i)*.42;
      if (signature==='triad') shot.position.addScaledVector(sideways,(i-1)*lift*.68);
      if (signature==='cinders') shot.position.y += (i%3)*lift*.19;
      velocity.copy(aim).addScaledVector(up,Math.cos(Math.PI*progress)*arc*3.14).normalize();
      shot.quaternion.setFromUnitVectors(ring ? forward : up,velocity);
      if (seed || ['dragon-orb','boulder'].includes(signature)) shot.rotateX(t*8+i);
      if (['coins','boomerang','fire-star','air-blades'].includes(signature)) shot.rotateZ(t*(signature==='coins'?24:12)+i);
      const expand = ring || signature==='web' ? .54+progress*1.03 : .74+.18*Math.sin(progress*Math.PI);
      shot.scale.setScalar(Math.max(.001,scale*strength*expand));
      shot.material.opacity = strength*.96;
      if (surface && !ring) {
        shot.material.uniforms.clock.value = t*1.5+i*.15;
        shot.material.uniforms.alpha.value = strength;
      }
    }
    for (const [i,{core,edge}] of arcs.entries()) {
      const age = t-i*(signature==='branching-bolts'?.044:.065);
      const strength = smoothstep(age,.18,.26)*fade(age,.40,.76)*(.72+.28*Math.sin(age*66)**2);
      edge.material.opacity = strength*.71;
      core.material.opacity = strength;
      const length = core.geometry.index.count;
      const shown = Math.floor(smoothstep(age,.14,.34)*length/6)*6;
      edge.geometry.setDrawRange(0,shown);
      core.geometry.setDrawRange(0,shown);
    }
  });
  const {group} = effect;
  const vines = leechSeed ? localEffect(scene,recipe,source,target,textures) : null;
  const charge = mesh(group,new THREE.IcosahedronGeometry(1,1),basic(light,{blending:THREE.AdditiveBlending}));
  const forward = new THREE.Vector3(0,0,1);
  aim.subVectors(end,start);
  const shots = bolt ? [] : Array.from({length:count},(_,i)=>{
    const color = key==='tri-attack' ? [0xff7048,0xa5e7ff,0xffde64][i] : signature==='coins'?0xf6ca52:light;
    const material = surface && !ring ? flowMaterial(dark,color,textures.flow,1) :
      basic(color,{wireframe:signature==='web',...(signature==='bubbles'?{opacity:.65}: {})});
    return mesh(group,geometry,material);
  });
  if (bolt) geometry.dispose();
  const arcs = !bolt ? [] : Array.from({length:count},(_,i)=>{
    const origin = signature==='sky-strike' ? end.clone().add(new THREE.Vector3(.65*i,6.5,.28*i)) :
      signature==='short-sparks' ? start.clone().lerp(end,.16) : start;
    const points = Array.from({length:13},(_,j)=>{
      const point = origin.clone().lerp(end,j/12);
      if (j>0 && j<12) {
        const spread = signature==='electric-front' ? Math.sin(j*Math.PI/12)*i*.8 : 0;
        point.addScaledVector(sideways,Math.sin(j*11.2+i*4.4)*(.37+i*.19)+spread);
        point.y += Math.cos(j*8.4+i*2.6)*(.27+i*.12);
      }
      return point;
    });
    const path = new THREE.CatmullRomCurve3(points);
    const radius = i===0?.064:.039;
    const edge = mesh(group,new THREE.TubeGeometry(path,32,radius*1.72,5,false),basic(dark));
    const core = mesh(group,new THREE.TubeGeometry(path,32,radius,5,false),basic(i===0?white:light));
    core.renderOrder = 1;
    return {core,edge};
  });
  if (!vines) return effect;
  group.add(vines.group);
  return {
    group,
    animate(t) {
      effect.animate(t);
      vines.animate(clamp((t-.59)/.41,0,1));
    },
    dispose() {
      vines.dispose();
      effect.dispose();
    },
  };
}

function localEffect(scene,recipe,source,target,textures,{hit=false,ability=false}={}) {
  const {form,family,key,signature,count=3,scale=1,rhythm=1} = recipe;
  const [dark,light,white] = palettes[family];
  const striking = form==='strike' || form==='slash';
  const anchor = target ?? source;
  const origin = anchor.spritePosition.clone().setY(.54);
  const trace = !hit && source && (['field','mark'].includes(form) || (ability && target && ['cloud','flow','ward'].includes(form)));
  const start = trace ? source.spritePosition.clone().setY(.54) : origin;
  const direction = target && source ? target.spritePosition.clone().sub(source.spritePosition).setY(0) : null;
  const rising = ['heal','sun','flare','gather'].includes(form);
  const ward = form==='ward';
  const cloud = form==='cloud';
  const focus = form==='focus' || form==='mark';
  const current = form==='flow';
  const quake = form==='field' && family==='stone';
  const tide = signature==='surf' || signature==='cascade';
  const terrain = quake || tide;
  const blades = ['claws','cross-cut','wing-arc','tail-wave','rapid-cuts','return-arc','chop'].includes(signature);
  const heavy = ['rush','slam','stomp','recoil-rush','counter','broken-stone','headbutt','punch','horn','great-horn'].includes(signature);
  const jaws = signature==='jaws' || signature==='dark-jaws';
  const bodyBlows = ['palm','clap','flurry','kicks','jabs','bone-strikes'].includes(signature);
  const whirl = ['tornado','wind-spiral','venom-cloud','sludge-front','heat-front'].includes(signature);
  const cascade = signature==='cascade';
  const dew = signature==='dew';
  const vines = signature==='vines';
  const offset = ['knock-away','snatch','tongue'].includes(signature);
  const bolster = ['shell','helping-light','swords'].includes(signature);
  const fieldFront = signature==='ground-front';
  const psychic = ['mind-ripples','psychic-pressure','hex-rings','static-rings','electric-front'].includes(signature);
  const effect = attach(scene,t=>{
    const reveal = smoothstep(t,hit?0:.09,hit?.12:.31);
    const strength = reveal*fade(t,hit?.46:.64,1);
    const spread = smoothstep(t,.08,.82);
    group.position.copy(start);
    if (trace) group.position.lerp(origin,spread);
    if (offset && direction?.lengthSq()>0) group.position.addScaledVector(direction,Math.sin(spread*Math.PI)*.12);
    if (striking && !hit) group.visible = t>.31;
    disc.material.opacity = strength*(quake?.15:ability?.52:.44);
    disc.scale.setScalar(scale*(.62+spread*(terrain?2.34:1.05)));
    if (panel) {
      panel.material.opacity = strength*(cloud?.54:.66);
      panel.scale.setScalar(scale*(cloud?.70+spread*1.57:.72+reveal*.57));
      panel.rotation.y = t*(focus?2.1:.8);
      panel.rotation.z = focus?t*1.9:0;
      if (signature==='screen') panel.rotation.set(0,0,0);
      if (signature==='moon') panel.rotation.set(0,0,-.35);
    }
    if (wave) {
      wave.position.y = cascade ? 3.2-spread*2.7 : .4;
      wave.scale.set(scale*(.78+spread*.54),scale*(.24+strength*(cascade?2.1:.83)),scale);
      wave.material.uniforms.clock.value = t*2.2;
      wave.material.uniforms.alpha.value = strength*1.08;
    }
    for (const [i,crack] of cracks.entries()) {
      const age = clamp((t-i*.026)/.50,0,1);
      crack.geometry.setDrawRange(0,Math.floor(age*crack.geometry.index.count/6)*6);
      crack.material.opacity = fade(t,.51,.98)*smoothstep(t,.06,.22)*.86;
    }
    for (const [i,band] of bands.entries()) {
      const age = clamp((t-i*.085)/(.77*rhythm),0,1);
      const pulse = Math.sin(Math.PI*age);
      const radius = scale*(terrain?.34+age*(signature==='faults'?2.47:2.04):current?1.5-age*.85:rising?1.3-age*.46:heavy?.28+age*1.35:.51+age*.78);
      band.scale.set(radius,radius,Math.max(.16,radius*.69));
      band.position.y = striking ? .77+i*.15 : rising || current ? .24+age*1.55 : .10+i*.18;
      if (fieldFront) band.position.z = age*1.25;
      if (psychic) band.position.y = .38+i*.24;
      band.rotation.set(striking?.44+i*.21:current?-1.12+i*.31:-Math.PI/2, striking?i*.66:0, t*2.6+i*2.31);
      if (blades) band.rotation.set(.2,i*.32,signature==='cross-cut'?(i%2===0?.74:-.74):.56+i*.18);
      if (bodyBlows) {
        band.position.x = (i%2===0?1:-1)*.33*(1-age);
        band.position.y = signature==='kicks' ? .47+i*.33 : .87+i*.17;
        band.rotation.set(.30,i*.37,(i%2===0?1:-1)*.83);
      }
      if (jaws) {
        band.position.y = 1.03 + (i%2===0?1:-1)*(.61-.53*smoothstep(age,.11,.48));
        band.rotation.set(i%2===0?.28:-.28,0,Math.PI*i);
      }
      if (whirl) {
        band.position.y = .14+i*.36+age*.62;
        band.rotation.z += age*8;
      }
      if (vines) band.rotation.set(.25+i*.63,t*2+i,Math.PI*.28);
      if (bolster) band.position.y = .28+i*.30+age*.94;
      if (signature==='reticle') band.rotation.set(0,0,i*Math.PI/2);
      band.material.uniforms.clock.value = t*1.7+i*.21;
      band.material.uniforms.alpha.value = pulse*(striking?1.2:.97);
    }
    for (const [i,shard] of accents.entries()) {
      const a = i*2.399+(rising?t*2:0);
      const r = scale*(rising?1.22-spread*.57:.35+spread*(terrain?1.70+(i%4)*.17:1.14));
      const rise = dew ? (1-spread)*(1.4+i%5*.18) : signature==='spires' ? Math.sin(spread*Math.PI)*(1+i%5*.27) : quake ? Math.sin(spread*Math.PI)*(.20+i%5*.14)-.19 : rising ? spread*1.85 : Math.sin(Math.PI*spread)*.64;
      shard.position.set(Math.cos(a)*r,.12+rise+(i%4)*.09,Math.sin(a)*r);
      shard.rotation.set(i*.49,t*4+i*.93,i*.26);
      const size = strength*scale*(.59+(i%5)*.14);
      shard.scale.set(size,size*(signature==='spires'?3.1:signature==='frost'?1.9:1),size);
    }
  });
  const {group} = effect;
  if (direction?.lengthSq()>0) group.rotation.y = Math.atan2(direction.x,direction.z);
  const disc = lightDisc(group,textures.ring,light);
  disc.position.y = .023;
  const panel = signature==='screen' ? mesh(group,new THREE.PlaneGeometry(2.1,1.65),basic(light,{side:THREE.DoubleSide,alphaMap:textures.flow})) :
    signature==='portal' || signature==='moon' || signature==='omen' ? mesh(group,new THREE.RingGeometry(.56,.78,40),basic(light,{side:THREE.DoubleSide})) :
    ward ? mesh(group,new THREE.IcosahedronGeometry(1,1),basic(light,{wireframe:true})) :
    focus ? mesh(group,new THREE.TorusGeometry(.79,.035,7,signature==='reticle'?4:signature==='seal'?6:24),basic(white,{blending:THREE.AdditiveBlending})) :
    cloud ? mesh(group,new THREE.SphereGeometry(.76,16,12),basic(dark,{alphaMap:textures.flow})) : null;
  if (panel) panel.position.y = signature==='moon'?2.05:cloud?.54:.92;
  const wave = tide ? mesh(group,new THREE.CylinderGeometry(1,1.37,1,28,8,true,0,Math.PI*1.15),
    flowMaterial(dark,white,textures.flow,1)) : null;
  if (wave) {
    wave.position.y = .4;
    wave.rotation.y = -Math.PI*.59;
    wave.material.side = THREE.DoubleSide;
  }
  const cracks = quake ? Array.from({length:signature==='faults'?9:4},(_,i)=>{
    const yaw = i*2.399;
    const points = Array.from({length:7},(_,j)=>{
      const angle = yaw+Math.sin(i*6.9+j*3.23)*.22;
      const radius = scale*(.19+j*.31)*(1+i%4*.11);
      return new THREE.Vector3(Math.cos(angle)*radius,-.24,Math.sin(angle)*radius);
    });
    return mesh(group,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),18,.023,4,false),basic(0x493127));
  }) : [];
  const bandCount = jaws || ['cross-cut','clap'].includes(signature) ? 2 : ['pose','strike'].includes(form) ? Math.min(4,count) : Math.max(2,Math.min(count,4));
  const bands = Array.from({length:bandCount},(_,i)=>mesh(group,
    new THREE.TorusGeometry(1,striking?.086:.063,7,42,striking?Math.PI*1.19:Math.PI*(1.38+i*.16)),
    flowMaterial(dark,white,striking?textures.shock:textures.flow,3)));
  const plant = family==='leaf' || family==='pollen';
  const heart = new THREE.Shape();
  if (signature==='hearts' || signature==='kiss') {
    heart.moveTo(0,-.22);
    heart.bezierCurveTo(-.71,.23,-.34,.56,0,.28);
    heart.bezierCurveTo(.34,.56,.71,.23,0,-.22);
  }
  const accentGeometry = dew || signature==='splash' ? new THREE.SphereGeometry(.115,9,7) :
    heart.curves.length ? new THREE.ShapeGeometry(heart) : plant ? new THREE.PlaneGeometry(.55,.71) :
    signature==='spires' || signature==='frost' || signature==='swords' ? new THREE.ConeGeometry(.20,.66,5) :
      new THREE.DodecahedronGeometry(cloud?.38:terrain?.24:.12,0);
  const accentMaterial = quake ? new THREE.MeshStandardMaterial({color:dark,roughness:.88,flatShading:true}) :
    plant ? basic(light,{alphaMap:textures.leaf,side:THREE.DoubleSide}) : basic(light,{opacity:cloud?.28:.87});
  const accents = Array.from({length:key==='splash'?5:terrain?14:10},()=>mesh(group,accentGeometry,accentMaterial));
  return effect;
}

function trait(scene,key,source,textures,steady=false) {
  const fire = key==='blaze';
  const [dark,light,white] = palettes[key];
  const floor = source.spritePosition.clone().setY(.53);
  const effect = attach(scene,t=>{
    const power = steady ? .46+.05*Math.sin(t*4.2) : smoothstep(t,.04,.25)*fade(t,fire?.52:.73,.99);
    if (steady) source.modelSlot.getWorldPosition(effect.group.position).setY(floor.y);
    const drawIn = smoothstep(t,.16,.81);
    disc.scale.setScalar(fire ? .55+power*1.19 : 1.8-drawIn*1.47);
    disc.material.opacity = power*.75;
    ribbons.forEach((ribbon,i)=>{
      const phase = t*7+i*1.9;
      const radius = fire ? .65+power*.83-i*.22 : 1.7-drawIn*1.37-i*.12;
      const rise = steady ? .08+.05*Math.sin(phase) : t*.41;
      ribbon.position.set(0,fire?.23+i*.37+rise:.29+i*.35+drawIn*.82,0);
      ribbon.rotation.set(Math.PI/2+(fire?.34:.24)*Math.sin(i*1.7+phase),.18+i*.27,phase);
      ribbon.scale.set(radius,radius,fire?1.36:.87);
      ribbon.material.uniforms.clock.value = t*1.2+i*.21;
      ribbon.material.uniforms.alpha.value = power*(fire?.9:1.16);
    });
    flames.forEach((flame,i)=>{
      const angle = i*turn/flames.length;
      const flicker = .70+.30*Math.sin(t*31+i*2.399);
      flame.scale.set(.61+power*.36,1.6*power*flicker,.61+power*.36);
      flame.position.y = .16+flame.scale.y*.44;
      flame.position.x = Math.cos(angle)*(.79+power*.42);
      flame.position.z = Math.sin(angle)*(.79+power*.42);
      flame.material.uniforms.clock.value = t*1.45+i*.19;
      flame.material.uniforms.alpha.value = power*.91;
    });
    sparks.forEach((spark,i)=>{
      const phase = (t*(fire?2.0:1.3)+i/sparks.length)%1;
      const a = i*2.399+t*(fire?3.9:7.7);
      const radius = fire ? .70+phase*.85 : 1.74-drawIn*1.39+phase*.39;
      spark.position.set(Math.cos(a)*radius,.14+phase*(fire?2.1:1.24)+(!fire?drawIn*.48:0),Math.sin(a)*radius);
      spark.scale.setScalar(power*(.36+Math.sin(phase*Math.PI)*.70));
    });
    glow.position.y = fire?.85:1.14;
    glow.scale.setScalar(fire ? .75+power*.50 : .45+drawIn*.50);
    glow.material.opacity = fire ? power*.22 : power*drawIn*.46;
  });
  effect.group.position.copy(floor);
  const {group} = effect;
  const disc = lightDisc(group,textures.ring,light);
  const ribbons = Array.from({length:steady?2:3},(_,i)=>{
    const material = flowMaterial(dark,light,textures.flow,3);
    if (!fire) material.blending = THREE.AdditiveBlending;
    return mesh(group,new THREE.TorusGeometry(1,fire?.18:.135,9,42,Math.PI*(1.08+i*.18)),material);
  });
  const flames = fire ? Array.from({length:steady?6:8},(_,i)=>{
    const material = flowMaterial(dark,white,textures.flow,4);
    material.side = THREE.DoubleSide;
    const flame = mesh(group,new THREE.PlaneGeometry(1,1,5,9),material);
    flame.rotation.y = -i*turn/(steady?6:8);
    return flame;
  }) : [];
  const geo = fire ? new THREE.OctahedronGeometry(.13).scale(.62,1.8,.62) : new THREE.SphereGeometry(.11,8,6);
  const colors = [basic(light,{opacity:.85}),basic(white,{opacity:.82})];
  const sparks = Array.from({length:steady?8:18},(_,i)=>mesh(group,geo,colors[i%2]));
  const glow = mesh(group,new THREE.IcosahedronGeometry(.77,2),basic(light,{blending:THREE.AdditiveBlending}));
  return effect;
}

export function createMoveEffects(scene) {
  const loader = new THREE.TextureLoader();
  const textures = Object.fromEntries(['ice','flow','ring','leaf','laser','shock'].map(name=>[
    name,loader.load(`/battle-move-art/${name}.png`),
  ]));
  textures.flame = flameTexture();
  return {
    createSteadyBlaze(source) { return trait(scene,'blaze',source,textures,true); },
    create(recipe,kind,source,target) {
      const {key,form,signature} = recipe;
      if (kind==='ability') {
        if (!source) return null;
        if (key==='blaze' || key==='water-absorb') return trait(scene,key,source,textures);
        if (source!==target && target && key==='static') {
          return travel(scene,{...recipe,form:'bolt',count:3,scale:.76,arc:0},source,target,textures);
        }
        if (source!==target && target && key==='poison-point') {
          return travel(scene,{...recipe,form:'volley',count:2,scale:.62,arc:.45},source,target,textures);
        }
        return localEffect(scene,recipe,source,target,textures,{ability:true});
      }
      if (kind==='hit' && target) {
        if (key==='flamethrower' && source) return spray(scene,recipe,source,target,textures,true);
        return key==='ice-beam' || key==='water-gun' ? impact(scene,key,target,textures) :
          localEffect(scene,recipe,source,target,textures,{hit:true});
      }
      if (!source || !target) return null;
      if (source!==target) {
        if (['water-stream','fire-stream','acid-stream'].includes(signature)) return spray(scene,recipe,source,target,textures);
        if (form==='beam') return stream(scene,recipe,source,target,textures);
        if (['volley','wave','bolt','strike-down','drain'].includes(form)) {
          return travel(scene,recipe,source,target,textures);
        }
      }
      const center = ['heal','ward','field','mark','strike','slash','drain'].includes(form) ? target : null;
      return localEffect(scene,recipe,source,center,textures);
    },
    dispose() { for (const texture of Object.values(textures)) texture.dispose(); },
  };
}
