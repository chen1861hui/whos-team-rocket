import * as THREE from '/vendor/three.module.js';
import {RADIO_GOAL, teamRoles} from './match-mode.js';

const floorY = .235;
const wallRadius = 15.8;
const bayCount = 16;
const bayWidth = 2*wallRadius*Math.tan(Math.PI/bayCount);
const teamLights = [0x61c7be,0xf49b79];
const standbyLights = [0x365d63,0x694f49];

function paintTexture(width,height,paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function windowTexture() {
  return paintTexture(128,256,ctx=>{
    ctx.fillStyle = '#7191b410';
    ctx.fillRect(0,0,128,256);
    const reflection = ctx.createLinearGradient(0,10,0,190);
    reflection.addColorStop(0,'#a4c2ed2a');
    reflection.addColorStop(.34,'#a4c2ed08');
    reflection.addColorStop(1,'#a4c2ed00');
    ctx.fillStyle = reflection;
    ctx.fillRect(0,0,128,190);
    ctx.fillStyle = '#adcaef24';
    ctx.fillRect(2,7,1,240);
    ctx.fillStyle = '#ffe0b317';
    ctx.fillRect(19,15,84,2);
    ctx.fillRect(29,18,64,1);
  });
}

function facadeTexture(band, variant) {
  const colors = ['#263447','#304159','#41536a'];
  return paintTexture(128,128,ctx=>{
    ctx.fillStyle = colors[band];
    ctx.fillRect(0,0,128,128);
    const columns = 4+variant, rows = 6+variant*2;
    const width = 110/columns, height = 112/rows;
    for (let row=0;row<rows;row++) {
      for (let col=0;col<columns;col++) {
        const light = (row*11+col*7+row*col+variant*13)%17;
        ctx.fillStyle = light<4 ? ['#957c63','#73808d','#806e5c','#678491'][light] : '#1e2e414e';
        ctx.fillRect(9+col*width,8+row*height,width*.59,height*.36);
      }
    }
  });
}

export function createRadioTerrain(scene, renderer, key) {
  const room = new THREE.Group();
  scene.add(room);
  const textures = [];
  function keep(texture) {
    textures.push(texture);
    return texture;
  }
  const loader = new THREE.TextureLoader();
  function artwork(url) {
    const texture = keep(loader.load(url));
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  const surface = (color, props={}) => new THREE.MeshStandardMaterial({color,roughness:.84,...props});
  const concrete = artwork('/radio-floor.webp');
  concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping;
  concrete.repeat.set(7,7);
  concrete.anisotropy = 4;
  const floor = surface(0xaeb1b0,{map:concrete,bumpMap:concrete,bumpScale:.052,roughness:.66});
  const steel = surface(0x535454,{metalness:.25,roughness:.65});
  const graphite = surface(0x323737,{metalness:.21,roughness:.75});
  const dark = surface(0x202426,{metalness:.12});
  const cream = surface(0xc5bc9f,{roughness:.57});
  const groove = surface(0x282c2b);
  const copper = surface(0x8c5a40,{metalness:.26,roughness:.51});
  const lampShade = surface(0xe2be83,{emissive:0xffd6a4,emissiveIntensity:2.35});
  const monitor = surface(0x2b3c45,{emissive:0x759991,emissiveIntensity:.36});
  const rackLight = surface(0x5e4935,{emissive:0xffa468,emissiveIntensity:.98});
  const glass = new THREE.MeshBasicMaterial({map:keep(windowTexture()),side:THREE.DoubleSide,transparent:true,depthWrite:false});
  const cube = new THREE.BoxGeometry(1,1,1);
  function place(parent,geometry,material,x,y,z) {
    const object = new THREE.Mesh(geometry,material);
    object.position.set(x,y,z);
    parent.add(object);
    return object;
  }
  function box(parent,material,w,h,d,x,y,z) {
    const object = place(parent,cube,material,x,y,z);
    object.scale.set(w,h,d);
    return object;
  }
  function circle(geometry,material,y) {
    const object = place(room,geometry,material,0,y,0);
    object.rotation.x = -Math.PI/2;
    object.receiveShadow = true;
    return object;
  }

  renderer.toneMappingExposure = 1.10;
  key.intensity = 1.25;
  key.color.setHex(0xffe9ce);
  key.position.set(-4,12,-4);
  key.shadow.normalBias = .025;
  key.shadow.bias = -.00027;
  const ambient = scene.children.find(child=>child.isHemisphereLight);
  ambient.color.setHex(0xbdc8df);
  ambient.groundColor.setHex(0x777173);
  ambient.intensity = 1.35;
  const rim = new THREE.DirectionalLight(0xa9c1e6,.83);
  rim.position.set(2,4,-12);
  room.add(rim);
  const frontFill = new THREE.DirectionalLight(0xd2d9ed,.48);
  frontFill.position.set(4,5,10);
  room.add(frontFill);
  scene.background.setHex(0x172330);
  scene.fog = new THREE.Fog(0x2b3b50,39,110);

  const panoramaMap = artwork('/radio-city.webp');
  panoramaMap.wrapS = THREE.MirroredRepeatWrapping;
  panoramaMap.repeat.x = 4;
  const panorama = place(room,new THREE.CylinderGeometry(59,59,35,96,1,true),
    new THREE.MeshBasicMaterial({map:panoramaMap,side:THREE.BackSide,fog:false,toneMapped:false}),0,8.2,0);
  panorama.rotation.y = -Math.PI*.1;

  function spot(parent,color,intensity,position,target,angle) {
    const light = new THREE.SpotLight(color,intensity,21,angle,.83,2);
    light.position.set(...position);
    light.target.position.set(...target);
    parent.add(light,light.target);
  }
  spot(room,0xffdfb8,165,[-2.55,7.35,-4.55],[-2.1,.24,-.7],.85);
  spot(room,0xffe5c8,160,[2.55,7.35,-4.55],[2.1,.24,-.7],.85);
  spot(room,0xe0ecff,105,[0,8.1,6.9],[.5,.24,5.9],.87);

  const diffuserMap = keep(paintTexture(64,64,ctx=>{
    const glow = ctx.createRadialGradient(32,32,1,32,32,32);
    glow.addColorStop(0,'#ffffff9e');
    glow.addColorStop(.42,'#ffffff45');
    glow.addColorStop(1,'#ffffff00');
    ctx.fillStyle = glow;
    ctx.fillRect(0,0,64,64);
  }));
  const diffuser = new THREE.SpriteMaterial({map:diffuserMap,color:0xffcb9d,opacity:.19,
    blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
  function lampHalo(parent,x,y,z,width,height) {
    const glow = new THREE.Sprite(diffuser);
    glow.position.set(x,y,z);
    glow.scale.set(width,height,1);
    parent.add(glow);
  }

  const ceiling = new THREE.Group();
  room.add(ceiling);
  const ceilingFinish = surface(0x737977,{map:concrete,emissive:0x30322f,emissiveIntensity:.48});
  place(ceiling,new THREE.CircleGeometry(wallRadius+.3,80),ceilingFinish,0,8.76,0).rotation.x = Math.PI/2;
  for (const z of [-11.2,-6.8,-2.4,2.4,6.8,11.2]) {
    const span = 2*Math.sqrt((wallRadius-.2)**2-z*z);
    box(ceiling,graphite,span,.40,.72,0,8.52,z);
    box(ceiling,steel,span,.09,.96,0,8.26,z);
    box(ceiling,copper,span*.92,.044,.050,0,8.22,z+.31);
  }
  for (const x of [-4.4,4.4]) {
    box(ceiling,dark,.085,1.34,.085,x,8.02,-4.55);
  }
  box(ceiling,graphite,9.65,.24,.84,0,7.44,-4.55);
  box(ceiling,steel,9.38,.07,.67,0,7.30,-4.55);
  for (const x of [-3.52,-1.17,1.17,3.52]) {
    box(ceiling,lampShade,2.25,.032,.46,x,7.25,-4.55);
    lampHalo(ceiling,x,7.21,-4.51,2.85,.35);
  }
  const ceilingBounce = new THREE.PointLight(0xffc58e,14,5.7);
  ceilingBounce.position.set(0,7.32,-4.2);
  room.add(ceilingBounce);

  circle(new THREE.CircleGeometry(wallRadius+2,96),floor,floorY);
  const joints = [];
  for (let offset=-13.5;offset<=13.5;offset+=4.5) {
    const span = Math.sqrt((wallRadius+.8)**2-offset*offset);
    joints.push(-span,floorY+.003,offset,span,floorY+.003,offset,
      offset,floorY+.003,-span,offset,floorY+.003,span);
  }
  const jointsGeometry = new THREE.BufferGeometry();
  jointsGeometry.setAttribute('position',new THREE.Float32BufferAttribute(joints,3));
  room.add(new THREE.LineSegments(jointsGeometry,new THREE.LineBasicMaterial({color:0x25282a,transparent:true,opacity:.45})));
  circle(new THREE.RingGeometry(11.10,11.29,96),copper,floorY+.006);
  circle(new THREE.RingGeometry(11.13,11.24,96),groove,floorY+.009);
  circle(new THREE.RingGeometry(5.20,5.25,72),copper,floorY+.007);
  circle(new THREE.RingGeometry(5.02,5.06,72),groove,floorY+.006);
  for(let index=0;index<36;index++) {
    const angle = index*Math.PI/18;
    const screw = box(room,copper,.13,.006,.022,Math.sin(angle)*11.2,floorY+.016,Math.cos(angle)*11.2);
    screw.rotation.y = angle;
  }
  box(room,dark,3.91,.08,1.50,0,floorY+.025,0);
  const outline = new THREE.Shape();
  outline.moveTo(-1.78,-.43);
  for(const [x,z] of [[-1.58,-.64],[1.58,-.64],[1.78,-.43],[1.78,.43],[1.58,.64],[-1.58,.64],[-1.78,.43]]) outline.lineTo(x,z);
  outline.closePath();
  const shell = new THREE.ExtrudeGeometry(outline,{depth:.21,bevelSize:.055,bevelThickness:.052,bevelSegments:1,steps:1});
  shell.rotateX(-Math.PI/2);
  const console = place(room,shell,cream,0,floorY+.063,0);
  console.castShadow = true;
  box(room,graphite,3.05,.025,.81,0,floorY+.34,0);
  box(room,monitor,.84,.016,.37,0,floorY+.36,-.06);
  for (let line=0;line<4;line++) {
    box(room,steel,.42-line*.057,.004,.022,0,floorY+.371,-.17+line*.065);
  }
  for(const side of [-1,1]) {
    for(let button=0;button<4;button++) {
      box(room,button===0?copper:steel,.126,.043,.22,side*(.68+button*.19),floorY+.37,.05);
    }
    for(let slot=0;slot<7;slot++) {
      box(room,groove,.058,.088,.01,(slot-3)*.15,floorY+.15,side*.699);
    }
    for (const x of [-1.45,1.45]) box(room,copper,.060,.015,.060,x,floorY+.328,side*.45);
  }

  const banks = teamRoles.map((team, index)=>{
    const side = index===0 ? -1 : 1;
    const x = side*4.36;
    const color = teamLights[index];
    const standby = standbyLights[index];
    box(room,copper,1.55,.022,.45,x,floorY+.015,.51);
    box(room,dark,1.51,.028,.40,x,floorY+.027,.51);
    box(room,groove,1.73,.008,.036,side*2.70,floorY+.005,.51);
    const letter = keep(paintTexture(64,64,ctx=>{
      ctx.fillStyle = index===0 ? '#a2d2ce' : '#e1af9d';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(index===0?'A':'B',32,35);
    }));
    const badge = place(room,new THREE.PlaneGeometry(.26,.26),new THREE.MeshBasicMaterial({map:letter,transparent:true,depthWrite:false}),x+side*.53,floorY+.046,.51);
    badge.rotation.x = -Math.PI/2;
    const lamps = Array.from({length:RADIO_GOAL},(_,point)=>{
      const lamp = surface(standby,{emissive:color,emissiveIntensity:0,roughness:.47});
      box(room,lamp,.23,.023,.265,x+(point-(RADIO_GOAL-1)/2)*.275-side*.12,floorY+.052,.51);
      return lamp;
    });
    return {team,lamps};
  });

  const ventMap = keep(paintTexture(256,64,ctx=>{
    ctx.fillStyle = '#594a40';
    ctx.fillRect(0,0,256,64);
    for(let x=7;x<251;x+=12) {
      ctx.fillStyle = '#7e6552';
      ctx.fillRect(x,10,7,45);
      ctx.fillStyle = '#161d20';
      ctx.fillRect(x+1,11,5,43);
    }
    ctx.fillStyle = '#937b5e';
    ctx.fillRect(0,3,256,2);
    ctx.fillRect(0,59,256,2);
  }));
  const vent = surface(0xb6a28c,{map:ventMap,metalness:.17});
  const scopeMap = keep(paintTexture(128,72,ctx=>{
    ctx.fillStyle = '#182429';
    ctx.fillRect(0,0,128,72);
    ctx.strokeStyle = '#41615d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let x=8;x<=120;x+=14) { ctx.moveTo(x,9); ctx.lineTo(x,63); }
    for(let y=9;y<=63;y+=9) { ctx.moveTo(8,y); ctx.lineTo(120,y); }
    ctx.stroke();
    ctx.strokeStyle = '#8fc1a8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for(let x=8;x<=120;x++) {
      const signal = (Math.sin(x*.28)*.67+Math.sin(x*.79)*.33)*Math.sin((x-8)*Math.PI/112);
      const y = 38+signal*20;
      if (x===8) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
  }));
  const scopeFace = new THREE.MeshBasicMaterial({map:scopeMap,toneMapped:false});
  const conduit = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,.64,.09),new THREE.Vector3(0,1.16,.09),new THREE.Vector3(.27,1.65,.09),
    new THREE.Vector3(.29,2.26,.09),new THREE.Vector3(.29,5.54,.09),new THREE.Vector3(.37,6.04,.09),
    new THREE.Vector3(.75,6.58,.09),new THREE.Vector3(.79,7.1,.09),
  ]),24,.037,7,false);
  const bays = Array.from({length:bayCount},(_,index)=>{
    const angle = Math.PI*2*index/bayCount;
    const x = Math.sin(angle), z = Math.cos(angle);
    const bay = new THREE.Group();
    bay.position.set(x*wallRadius,0,z*wallRadius);
    bay.rotation.y = angle;
    room.add(bay);
    box(bay,graphite,bayWidth,1.12,.56,0,floorY+.56,0);
    box(bay,dark,bayWidth,.16,.73,0,floorY+.10,-.04);
    box(bay,steel,bayWidth,.16,.70,0,1.40,0);
    box(bay,copper,bayWidth,.065,.06,0,1.10,-.29);
    box(bay,steel,bayWidth,.36,.98,0,6.66,0);
    box(bay,graphite,bayWidth,2.5,.62,0,7.96,.04);
    box(bay,copper,bayWidth,.044,.065,0,6.82,-.46);
    box(bay,steel,bayWidth,.19,3.50,0,6.80,-1.85);
    const pillarX = -bayWidth/2+.09;
    box(bay,graphite,.43,5.23,.51,pillarX,3.99,-.04);
    box(bay,steel,.12,5.22,.28,0,3.99,0);
    box(bay,graphite,bayWidth,.095,.30,0,4.77,0);
    box(bay,graphite,bayWidth,.11,2.1,0,floorY-.058,1.28);
    box(bay,steel,bayWidth-.09,.065,.1,0,1.52,1.58);
    box(bay,graphite,bayWidth-.12,.043,.057,0,1.16,1.58);
    for(const x of [-2.52,0,2.52]) box(bay,steel,.051,1.1,.051,x,.94,1.57);
    const grille = place(bay,new THREE.PlaneGeometry(bayWidth-.16,.54),vent,0,floorY+.012,-2.16);
    grille.rotation.x = -Math.PI/2;
    if (index%2===0) {
      box(bay,dark,bayWidth*.74,.24,.37,0,6.73,-1.67);
      box(bay,lampShade,bayWidth*.68,.06,.24,0,6.59,-1.67);
      const brace = box(bay,steel,.23,2.40,.48,pillarX+.63,6.35,-.18);
      brace.rotation.z = -.61;
    }
    if (index%4===0) {
      for (const shift of [0,.105,.21]) place(bay,conduit,copper,pillarX+.28+shift,0,-.61);
      box(bay,dark,.30,.59,.15,pillarX+.06,3.85,-.37);
      box(bay,lampShade,.17,.41,.14,pillarX+.06,3.88,-.47);
      for(const y of [3.72,3.84,3.96,4.08]) box(bay,copper,.21,.021,.031,pillarX+.06,y,-.55);
      const wallLamp = new THREE.PointLight(0xffbc7b,29,6.3);
      wallLamp.position.set(pillarX+.12,3.82,-1.1);
      bay.add(wallLamp);
      lampHalo(bay,pillarX+.06,3.88,-.64,.56,.78);
    }
    const window = place(bay,new THREE.PlaneGeometry(bayWidth,5.12),glass,0,4.02,0);
    window.renderOrder = 1;
    if (index%4===2) {
      box(bay,steel,bayWidth-.44,.23,3.2,0,.34,1.50);
      box(bay,graphite,bayWidth-.5,4.53,.38,0,2.68,2.86);
      box(bay,lampShade,3.86,.10,.32,0,4.75,1.84);
      box(bay,graphite,4.95,.11,.32,0,4.91,1.82);
      for(const x of [-1.70,0,1.70]) {
        box(bay,steel,1.48,2.94,.46,x,1.91,2.42);
        box(bay,dark,1.22,2.56,.05,x,1.91,2.18);
        box(bay,steel,.96,.53,.09,x,2.82,2.14);
        const scope = place(bay,new THREE.PlaneGeometry(.77,.39),scopeFace,x,2.82,2.09);
        scope.rotation.y = Math.PI;
        box(bay,vent,1.0,.19,.06,x,3.19,2.13);
        for(const side of [-1,1]) box(bay,copper,.033,.82,.05,x+side*.63,1.86,2.105);
        for(let row=0;row<4;row++) {
          box(bay,groove,1.0,.14,.05,x,2.35-row*.43,2.13);
          box(bay,row%2===0 ? rackLight : monitor,.11,.059,.016,x-.35,2.35-row*.43,2.095);
          box(bay,copper,.33,.028,.025,x+.25,2.32-row*.43,2.095);
        }
      }
      const task = new THREE.PointLight(0xffb77c,41,6.9);
      task.position.set(0,4.43,1.55);
      bay.add(task);
    }
    return {bay,x,z};
  });

  const skyline = [];
  circle(new THREE.CircleGeometry(105,64),new THREE.MeshBasicMaterial({color:0x202e42}),-13.0);
  for(const [band,radius] of [29,46,63].entries()) {
    const amount = 23+band*7;
    const roof = new THREE.MeshBasicMaterial({color:[0x273345,0x2e4056,0x3c4d62][band]});
    const facades = Array.from({length:3},(_,variant)=>{
      const facade = new THREE.MeshBasicMaterial({map:keep(facadeTexture(band,variant))});
      return [facade,facade,roof,roof,facade,facade];
    });
    for(let index=0;index<amount;index++) {
      const angle = (index+band*.46)*Math.PI*2/amount;
      const x = Math.sin(angle), z = Math.cos(angle);
      const height = 4.5+((index*19+index*index*7+band*13)%24)*(.38+band*.12);
      const width = 2.8+((index*7+band*3)%9)*.35+band*.75;
      const base = -8.9-band*1.6;
      const facade = facades[(index+band)%facades.length];
      const building = new THREE.Group();
      building.position.set(x*radius,base,z*radius);
      building.rotation.y = angle;
      room.add(building);
      skyline.push({building,x,z,radius});
      box(building,facade,width,height,2.3+band,0,height/2,0);
      if (band===0 && index%4===0) {
        box(building,dark,width*.63,.54,1.21,0,height+.29,0);
        box(building,dark,.075,1.56,.075,0,height+1.25,0);
        box(building,rackLight,.10,.10,.10,0,height+2.05,0);
      }
    }
  }

  return {
    setObjective(radio) {
      for (const {team,lamps} of banks) {
        lamps.forEach((lamp,index)=>{
          lamp.emissiveIntensity = index<(radio?.goal ?? 0) && index<(radio?.scores[team] ?? 0) ? 1.7 : 0;
        });
      }
    },
    update(camera) {
      const {x,y,z} = camera.position;
      // Open the near wall when a wide or low camera would otherwise sit behind its glass.
      for (const entry of bays) entry.bay.visible = x*entry.x+z*entry.z<wallRadius-2.4;
      ceiling.visible = y<7.05;
      panorama.visible = y<26;
      for (const entry of skyline) entry.building.visible = y>10 && x*entry.x+z*entry.z<entry.radius-2;
    },
    dispose() {
      textures.forEach(texture=>texture.dispose());
    },
  };
}
