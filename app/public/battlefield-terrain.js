import * as THREE from '/vendor/three.module.js';
import {createCoastalScenery} from './battlefield-coast.js';
import {createFireGym} from './battlefield-fire.js';
import {createGrassGym} from './battlefield-grass.js';

const fullTurn = Math.PI * 2;
const floorRadius = 11.2;
const surfaceHeight = .22;
const design = {
  water:{seed:71, tiles:['#bcb09a','#c4bba8','#b6aa95','#cfc1a9','#c5b59f'], seam:'#82796a', inlay:'#507b83', base:0x62594c, edge:0xb7a48a},
  grass:{seed:31, tiles:['#537448','#617d49','#69854e','#71894f','#5d7849'], seam:'#4b6941', inlay:'#c8b476', base:0x3e5038, edge:0x7a804f},
};

function randomFor(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function polygon(context, vertices) {
  context.beginPath();
  vertices.forEach(([x,y], index) => index ? context.lineTo(x,y) : context.moveTo(x,y));
  context.closePath();
}

function canvasMap(size, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  paint(canvas.getContext('2d'));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function inlay(context, theme, palette) {
  context.save();
  context.translate(384,384);
  context.strokeStyle = palette.inlay;
  context.fillStyle = palette.inlay;
  context.lineWidth = 2.7;
  context.globalAlpha = .7;
  for (let i=0;i<6;i++) {
    context.save();
    context.rotate(i*fullTurn/6);
    context.beginPath();
    context.arc(0,0,319,-.43,.43);
    context.stroke();
    polygon(context,[[318,-11],[332,0],[318,11],[309,0]]);
    context.stroke();
    context.restore();
  }
  context.globalAlpha = .54;
  context.beginPath();
  context.arc(0,0,100,0,fullTurn);
  context.stroke();
  context.setLineDash([3,7]);
  context.beginPath();
  context.arc(0,0,112,0,fullTurn);
  context.stroke();
  context.setLineDash([]);
  context.lineWidth = 3.5;
  context.beginPath();
  if (theme === 'water') {
    context.moveTo(0,-70);
    context.bezierCurveTo(15,-45,51,-13,51,14);
    context.bezierCurveTo(51,75,-51,75,-51,14);
    context.bezierCurveTo(-51,-13,-15,-45,0,-70);
    for (const y of [15,31]) {
      context.moveTo(-31,y);
      context.bezierCurveTo(-16,y-15,14,y+15,31,y);
    }
  } else {
    context.moveTo(-50,45);
    context.quadraticCurveTo(-73,-44,51,-60);
    context.quadraticCurveTo(63,66,-50,45);
    context.moveTo(-60,60);
    context.quadraticCurveTo(-24,10,33,-37);
    context.moveTo(-21,15);
    context.lineTo(-35,-23);
    context.moveTo(-5,-1);
    context.lineTo(31,8);
  }
  context.stroke();
  context.restore();
}

function floorMap(theme, palette) {
  const random = randomFor(palette.seed);
  return canvasMap(768, context => {
    context.fillStyle = palette.seam;
    context.fillRect(0,0,768,768);
    if (theme === 'grass') {
      for (let i=0;i<620;i++) {
        const x = random()*768, y = random()*768, radius = 6+random()*39;
        context.fillStyle = palette.tiles[i%5];
        context.globalAlpha = .27;
        context.beginPath();
        context.ellipse(x,y,radius*1.8,radius,random()*fullTurn,0,fullTurn);
        context.fill();
      }
      context.globalAlpha = 1;
      const clearing = context.createRadialGradient(370,383,42,384,384,395);
      clearing.addColorStop(0,'#a39862');
      clearing.addColorStop(.58,'#968959e6');
      clearing.addColorStop(1,'#76884a00');
      context.fillStyle = clearing;
      context.fillRect(0,0,768,768);
      for (let i=0;i<47;i++) {
        const a = i*fullTurn/47, r = 298+random()*85;
        const x = 384+Math.cos(a)*r, y = 384+Math.sin(a)*r;
        const w = 7+random()*15;
        polygon(context,[[x-w,y-5],[x-1,y-10],[x+w,y-4],[x+w-2,y+6],[x-4,y+9],[x-w,y+2]]);
        context.fillStyle = i%3 ? '#858064' : '#a39a76';
        context.fill();
        context.strokeStyle = '#4d593c';
        context.stroke();
      }
    } else {
      const step = 62;
      for (let row=0;row<16;row++) {
        for (let col=0;col<16;col++) {
          const x = col*step-(row%2)*step*.5, y = row*step;
          const bevel = 3;
          polygon(context,[[x+bevel,y+2],[x+step-5,y+2],[x+step-2,y+bevel],
            [x+step-2,y+step-bevel],[x+step-bevel,y+step-2],[x+3,y+step-2],[x+2,y+bevel]]);
          context.fillStyle = palette.tiles[Math.floor(random()*5)];
          context.fill();
          context.strokeStyle = '#f2f1cb50';
          context.lineWidth = 1.5;
          context.stroke();
          if (theme==='water') {
            context.save();
            context.clip();
            const tint = context.createLinearGradient(x,y,x+step,y+step);
            tint.addColorStop(0,'#ffedcc55');
            tint.addColorStop(.42,'#ebe1cc00');
            tint.addColorStop(1,'#6f635b35');
            context.fillStyle = tint;
            context.fillRect(x,y,step,step);
            context.restore();
          }
        }
      }
      context.strokeStyle = '#2c697d80';
      context.lineWidth = 2;
      for (let i=0;i<12;i++) {
        const a = i*fullTurn/12;
        for (let j=0;j<4;j++) {
          context.beginPath();
          context.arc(384+Math.cos(a)*294,384+Math.sin(a)*294,11+j*6,a+.35,a+fullTurn-.35);
          context.stroke();
        }
      }
    }
    for (let i=0;i<5200;i++) {
      const x = random()*768, y = random()*768;
      context.fillStyle = i%2 ? '#ffeac329' : '#20252032';
      context.fillRect(x,y,1+random()*3,1+random()*2);
    }
    inlay(context,theme,palette);
  });
}

function grassLandscape(scene, terrainMaterial, random) {
  const shapes = {};
  const rock = shapes.rock = {geometry:new THREE.DodecahedronGeometry(1), instances:[]};
  const column = shapes.column = {geometry:new THREE.CylinderGeometry(.84,1,1,6), instances:[]};
  const crown = shapes.crown = {geometry:new THREE.IcosahedronGeometry(1,1), instances:[]};
  const blade = shapes.blade = {geometry:new THREE.ConeGeometry(.32,1,3), instances:[]};
  const plant = (shape,x,y,z,sx,sy,sz,color,lean=0) =>
    shape.instances.push({x,y,z,sx,sy,sz,color,lean,angle:random()*fullTurn});
  const shades = [0x58634e,0x738063,0x414f43];

  // Layered silhouettes frame the rear. The near edge stays open for trainer view.
  for (let i=0;i<31;i++) {
    const a = (i-15)*.09, r = 18+random()*10;
    const x = Math.sin(a)*r, z = -Math.cos(a)*r;
    const height = 1.5+random()*4.6;
    plant(column,x,height*.55-1.1,z,.46,height*1.25,.49,0x635641,.14);
    plant(crown,x,height*1.06,z,1.9,1.15,1.7,0x477d50);
    plant(crown,x+.85,height*.92,z+.62,1.52,.93,1.2,0x5e9452);
    plant(crown,x-.94,height*1.08,z-.34,1.23,1.13,1.4,0x366f54);
  }

  for (let i=0;i<52;i++) {
    const a = i*fullTurn/52, r = 11.35+random()*3.1;
    const x = Math.sin(a)*r, z = Math.cos(a)*r;
    const h = .14+random()*.44;
    plant(rock,x,-.74+h*.25,z,.28+random()*.62,h,.3+random()*.44,shades[i%3]);
    for (let j=0;j<4;j++) {
      const flower = j===3 && i%2===0;
      plant(flower?crown:blade,x+(random()-.5)*.92,-.57+random()*.26,z+(random()-.5)*.92,
        flower?.09:.45,flower?.12:.47+random()*.42,flower?.1:.45,
        flower ? (i%4===0?0xe0a1ae:0xf4ce7d) : (j%2?0x639d50:0x426d3e),(j-1)*.18);
    }
  }
  for (const x of [-9.7,9.7]) {
    plant(rock,x,-.17,-7.5,1.7,.75,1.13,0x827c60);
    for (let i=0;i<8;i++) {
      plant(crown,x+(random()-.5)*1.55,.22,-7.5+(random()-.5)*1.5,.35,.15,.31,0x598746);
    }
  }
  for (const sign of [-1,1]) {
    for (let i=0;i<8;i++) {
      const x = sign*(12.1+i*.46), z = 4.8-i*.62;
      plant(crown,x,-.59,z,.76,.36,.63,i%2 ? 0x6c8d49 : 0x53784a);
      plant(crown,x-sign*.24,-.35,z-.12,.15,.17,.17,i%2 ? 0xe5b0bc : 0xf6d58c);
    }
  }

  const transform = new THREE.Object3D(), tint = new THREE.Color();
  for (const {geometry,instances} of Object.values(shapes)) {
    if (!instances.length) {
      geometry.dispose();
      continue;
    }
    const batch = new THREE.InstancedMesh(geometry,terrainMaterial,instances.length);
    instances.forEach(({x,y,z,sx,sy,sz,color,lean,angle},index) => {
      transform.position.set(x,y,z);
      transform.scale.set(sx,sy,sz);
      transform.rotation.set(0,angle,lean);
      transform.updateMatrix();
      batch.setMatrixAt(index,transform.matrix);
      batch.setColorAt(index,tint.setHex(color));
    });
    batch.instanceMatrix.needsUpdate = true;
    batch.instanceColor.needsUpdate = true;
    batch.castShadow = true;
    batch.receiveShadow = true;
    scene.add(batch);
  }

}

function wetLimestone(map) {
  const material = new THREE.MeshPhysicalMaterial({
    map,roughness:.74,specularIntensity:.44,clearcoat:.33,clearcoatRoughness:.46,
  });
  // Reflect the sky and low sun into the wet patches without a second planar pass.
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 pavingWorld;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\npavingWorld = (modelMatrix * vec4(transformed,1.0)).xyz;'
    );
    shader.fragmentShader = `
      varying vec3 pavingWorld;
      float pavingHash(vec2 p) {
        vec3 q = fract(vec3(p.xyx)*.1031);
        q += dot(q,q.yzx+33.33);
        return fract((q.x+q.y)*q.z);
      }
      float pavingNoise(vec2 p) {
        vec2 i=floor(p), f=fract(p);
        f=f*f*(3.0-2.0*f);
        return mix(mix(pavingHash(i),pavingHash(i+vec2(1,0)),f.x),
                   mix(pavingHash(i+vec2(0,1)),pavingHash(i+1.0),f.x),f.y);
      }
    `+shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
      #include <roughnessmap_fragment>
      vec2 p = pavingWorld.xz;
      float seepage = pavingNoise(p*.26+2.1)*.72+pavingNoise(p*.91)*.20+pavingNoise(p*3.8)*.08;
      float wet = smoothstep(.35,.68,seepage + .12*smoothstep(5.0,11.0,length(p)));
      roughnessFactor = mix(roughnessFactor,.45,wet);
      float limestone = dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
      diffuseColor.rgb = mix(diffuseColor.rgb,limestone*vec3(.92,1.0,1.07),.18+.24*wet);
      diffuseColor.rgb *= 1.0-.16*wet;
      float worn = pavingNoise(p*.57+vec2(5.0,3.0));
      float pits = pavingNoise(p*7.8);
      float rim = smoothstep(7.4,11.2,length(p));
      float algae = smoothstep(.55,.79,worn*.61+pits*.39)*rim;
      float salt = smoothstep(.65,.91,pits)*wet;
      diffuseColor.rgb *= mix(vec3(.79,.78,.72),vec3(1.09,1.05,.96),worn);
      diffuseColor.rgb *= mix(vec3(1.0),vec3(.55,.65,.43),algae*.65);
      diffuseColor.rgb *= 1.0+salt*.14;
    `).replace('#include <opaque_fragment>',`
      vec3 eye = normalize(cameraPosition-pavingWorld);
      vec3 mirror = reflect(-eye,vec3(0,1,0));
      vec2 clouds = mirror.xz/(max(0.0,mirror.y)+.40)*2.2;
      float brokenSky = pavingNoise(clouds+vec2(7,12))*.68+pavingNoise(clouds*2.1)*.32;
      vec3 sky = mix(vec3(.060,.11,.17),vec3(.23,.32,.43),smoothstep(.36,.73,brokenSky));
      vec3 skyOpening = normalize(vec3(.32,.46,-.83));
      // Warm skylight from the open side of the arcade, interrupted by the worn stone.
      float glint = pow(max(0.0,dot(mirror,skyOpening)),25.0);
      float grazing = .13+.51*pow(1.0-clamp(eye.y,0.0,1.0),2.2);
      float grain = .62+.38*pavingNoise(p*17.0);
      outgoingLight += wet*grazing*grain*(sky+vec3(1.75,1.24,.80)*glint);
      #include <opaque_fragment>
    `);
  };
  material.customProgramCacheKey = () => 'coastal-wet-limestone';
  return material;
}

export function createGymTerrain(scene, theme, refresh, sceneryAngle=0) {
  if (theme==='fire') return createFireGym(scene,sceneryAngle,refresh);
  if (theme==='grass') return createGrassGym(scene,sceneryAngle,refresh);
  const palette = design[theme];
  const random = randomFor(palette.seed+24);
  const add = (geometry,material,x,y,z,shadow=true) => {
    const mesh = new THREE.Mesh(geometry,material);
    mesh.position.set(x,y,z);
    mesh.receiveShadow = true;
    mesh.castShadow = shadow;
    scene.add(mesh);
    return mesh;
  };
  const map = floorMap(theme,palette);
  const side = new THREE.MeshStandardMaterial({color:palette.base,roughness:.92});
  const edging = new THREE.MeshStandardMaterial({color:palette.edge,roughness:.78});
  const floor = theme==='water'
    ? wetLimestone(map)
    : new THREE.MeshStandardMaterial({map,roughness:.86});
  let disposed = false;
  const coastalStone = theme==='water' ? new THREE.TextureLoader().load('/coastal-stone.webp',texture=>{
    if (disposed) return;
    floor.map = texture;
    floor.bumpMap = texture;
    floor.bumpScale = .038;
    floor.needsUpdate = true;
    refresh?.();
  }) : null;
  if (coastalStone) {
    coastalStone.colorSpace = THREE.SRGBColorSpace;
    coastalStone.anisotropy = 8;
  }
  const sides = theme==='water' ? 128 : 20;
  const outline = new THREE.Shape();
  for (let i=0;i<sides;i++) {
    const a = (i+.5)*fullTurn/sides;
    const radius = floorRadius + (theme==='grass' ? (random()-.5)*.52 : 0);
    const x = Math.sin(a)*radius, y = Math.cos(a)*radius;
    if (i) outline.lineTo(x,y);
    else outline.moveTo(x,y);
  }
  outline.closePath();
  const water = theme === 'water';
  const slab = new THREE.ExtrudeGeometry(outline,{
    depth:water ? .55 : 1.12,bevelEnabled:true,bevelSize:water ? .19 : .29,bevelThickness:.10,bevelSegments:1,
  });
  const foundation = add(slab,side,0,water ? -.55 : -1.12,0);
  foundation.rotation.x = -Math.PI/2;
  const lip = new THREE.ExtrudeGeometry(outline,{
    depth:water ? .19 : .09,bevelEnabled:true,bevelSize:.17,bevelThickness:.027,bevelSegments:1,
  });
  const rim = add(lip,edging,0,water ? -.03 : .083,0);
  rim.rotation.x = -Math.PI/2;
  const ground = new THREE.ShapeGeometry(outline);
  const uv = ground.attributes.uv, position = ground.attributes.position;
  for (let i=0;i<uv.count;i++) uv.setXY(i,.5+position.getX(i)/23,.5+position.getY(i)/23);
  const paving = add(ground,floor,0,surfaceHeight,0,false);
  paving.rotation.x = -Math.PI/2;
  if (water) {
    // The circular outline reads as courses of coping stones even from a low camera.
    const count = 64;
    const sweep = fullTurn/count;
    const cut = .0038;
    const curbShape = new THREE.Shape();
    curbShape.absarc(0,0,floorRadius+.27,cut,sweep-cut,false);
    curbShape.absarc(0,0,floorRadius-.47,sweep-cut,cut,true);
    curbShape.closePath();
    const curb = new THREE.ExtrudeGeometry(curbShape,{
      depth:.22,bevelEnabled:true,bevelSize:.013,bevelThickness:.016,bevelSegments:1,curveSegments:2,
    }).rotateX(-Math.PI/2);
    const coping = new THREE.InstancedMesh(curb,new THREE.MeshStandardMaterial({roughness:.79}),count);
    const stone = new THREE.Color();
    const transform = new THREE.Matrix4();
    const tints = [0xbfb59f,0xd6c9af,0xc5bba6,0xb5ad9f,0xcfc6b4];
    for (let i=0;i<count;i++) {
      transform.makeRotationY(i*sweep);
      transform.setPosition(0,.015+(i%3)*.005,0);
      coping.setMatrixAt(i,transform);
      coping.setColorAt(i,stone.setHex(tints[(i*7+Math.floor(i/3))%tints.length]));
    }
    coping.castShadow = coping.receiveShadow = true;
    // The paving and its emblem share the arcade's orientation across seats.
    const platform = new THREE.Group();
    platform.rotation.y = sceneryAngle;
    for (const mesh of [foundation,rim,paving,coping]) {
      mesh.layers.enable(1);
      platform.add(mesh);
    }
    scene.add(platform);
  }

  const coast = theme==='water' ? createCoastalScenery(scene,{add,canvasMap,random,refresh,sceneryAngle}) : null;
  if (!coast) {
    const surround = new THREE.MeshStandardMaterial({color:0x445943,roughness:.72});
    add(new THREE.PlaneGeometry(172,172),surround,0,-1.16,0,false).rotation.x = -Math.PI/2;
    grassLandscape(scene,new THREE.MeshStandardMaterial({roughness:.94}),random);
  }

  const motes = Array.from({length:48},() => ({
    angle:random()*fullTurn,radius:11.4+random()*8.0,height:random()*3,phase:random(),
  }));
  const drift = new THREE.Float32BufferAttribute(new Float32Array(motes.length*3),3);
  drift.setUsage(THREE.DynamicDrawUsage);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',drift);
  const particles = new THREE.Points(geometry,new THREE.PointsMaterial({
    color:theme==='water'?0xd3f7fc:0xf6e49b,
    size:.10, transparent:true, opacity:.64,depthWrite:false,toneMapped:false,
  }));
  particles.frustumCulled = false;
  scene.add(particles);

  function update(time, reducedMotion, hideRearStation, waterMotion) {
    const t = reducedMotion ? 0 : time*.001;
    coast?.update(t,hideRearStation,waterMotion ? time*.001 : t);
    particles.visible = !reducedMotion;
    if (reducedMotion) return;
    motes.forEach(({angle,radius,height,phase},index) => {
      const a = angle+t*.053;
      const y = height+.25*Math.sin(t+phase*fullTurn)-.36;
      drift.setXYZ(index,Math.sin(a)*radius,y,Math.cos(a)*radius);
    });
    drift.needsUpdate = true;
  }
  return {update,dispose() {
    disposed = true;
    map.dispose();
    coastalStone?.dispose();
    coast?.dispose();
  }};
}
