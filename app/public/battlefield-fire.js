import * as THREE from '/vendor/three.module.js';

export const fireGymLeaderStation = {radius:11.9, height:.72};
const turn = 2*Math.PI;
const floorRadius = 11.5;
const floorHeight = .22;
const brass = 0xb88b51;

function randomFor(seed) {
  return () => {
    seed = (Math.imul(seed,1664525)+1013904223) >>> 0;
    return seed/4294967296;
  };
}

function outline(radius) {
  return Array.from({length:8},(_,index)=>{
    const angle = (index+.5)*turn/8;
    return new THREE.Vector2(Math.sin(angle)*radius,Math.cos(angle)*radius);
  });
}

function weathering(ctx,size,seed,layers = [[11,.40],[34,.27],[96,.19],[256,.16]]) {
  const random = randomFor(seed);
  const canvas = document.createElement('canvas');
  const layer = canvas.getContext('2d');
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  for (const [resolution,opacity] of layers) {
    canvas.width = canvas.height = resolution;
    const pixels = layer.createImageData(resolution,resolution);
    for (let i=0;i<pixels.data.length;i+=4) {
      const value = random()*255;
      pixels.data[i] = pixels.data[i+1] = pixels.data[i+2] = value;
      pixels.data[i+3] = 255;
    }
    layer.putImageData(pixels,0,0);
    ctx.globalAlpha = opacity;
    ctx.drawImage(canvas,0,0,size,size);
  }
  ctx.restore();
}

function pavingMaps() {
  const size = 1024;
  const colorCanvas = document.createElement('canvas');
  const heightCanvas = document.createElement('canvas');
  colorCanvas.width = colorCanvas.height = heightCanvas.width = heightCanvas.height = size;
  const ctx = colorCanvas.getContext('2d');
  const relief = heightCanvas.getContext('2d');
  const random = randomFor(53);
  const palette = ['#787678','#7e7a7a','#807c7c','#777578','#7c797a','#79767a'];
  ctx.fillStyle = '#666365';
  ctx.fillRect(0,0,size,size);
  relief.fillStyle = '#848484';
  relief.fillRect(0,0,size,size);
  const radius = 71;
  const spacing = Math.sqrt(3)*radius;
  for (let row=-1;row<=10;row++) {
    for (let col=-1;col<=9;col++) {
      const x = col*spacing + (row%2)*spacing*.5;
      const y = row*radius*1.5;
      const tile = new Path2D();
      const face = new Path2D();
      for (let corner=0;corner<6;corner++) {
        const angle = (corner+.5)*turn/6;
        const dx = Math.cos(angle), dy = Math.sin(angle);
        const chip = random() < .18 ? random()*3.1 : 0;
        const method = corner ? 'lineTo' : 'moveTo';
        tile[method](x+dx*(radius-.65-chip),y+dy*(radius-.65-chip));
        face[method](x+dx*(radius-1.54-chip),y+dy*(radius-1.54-chip));
      }
      tile.closePath();
      face.closePath();
      ctx.fillStyle = '#726f72';
      ctx.fill(tile);
      ctx.fillStyle = palette[Math.floor(random()*palette.length)];
      ctx.fill(face);
      relief.fillStyle = '#969696';
      relief.fill(tile);
      const height = 165 + Math.floor(random()*9);
      relief.fillStyle = 'rgb('+height+' '+height+' '+height+')';
      relief.fill(face);
      ctx.save();
      ctx.clip(face);
      for (let i=0;i<260;i++) {
        const px = x+(random()-.5)*radius*2;
        const py = y+(random()-.5)*radius*2;
        const grain = .55+random()*1.9;
        ctx.fillStyle = i%2 ? '#ded4cc32' : '#29262939';
        ctx.fillRect(px,py,grain,grain*.72);
      }
      if (random() < .43) {
        ctx.strokeStyle = '#3434434a';
        ctx.lineWidth = .9;
        ctx.beginPath();
        ctx.moveTo(x-radius*.94,y-radius*.44);
        ctx.lineTo(x-radius*.51,y-radius*.26);
        ctx.lineTo(x-radius*.34,y-radius*.29);
        ctx.lineTo(x-radius*.13,y-radius*.03);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  // The circular center stone takes the place of the tiles under the court emblem.
  const center = size*.5;
  const medallion = new Path2D();
  medallion.arc(center,center,154,0,turn);
  ctx.strokeStyle = '#676467';
  ctx.lineWidth = 2;
  ctx.fillStyle = '#7a777b';
  ctx.fill(medallion);
  ctx.stroke(medallion);
  relief.fillStyle = '#a9a9a9';
  relief.fill(medallion);
  const emblem = new Path2D();
  emblem.arc(center,center,139,0,turn);
  emblem.moveTo(center+42,center);
  emblem.arc(center,center,42,0,turn);
  emblem.moveTo(center-139,center);
  emblem.lineTo(center-42,center);
  emblem.moveTo(center+42,center);
  emblem.lineTo(center+139,center);
  ctx.strokeStyle = '#aaa3a0';
  ctx.lineWidth = 9;
  ctx.stroke(emblem);
  ctx.save();
  ctx.clip(medallion);
  for (let i=0;i<5200;i++) {
    const x = center+(random()-.5)*308;
    const y = center+(random()-.5)*308;
    ctx.fillStyle = i%2 ? '#d8ceca31' : '#29252b39';
    ctx.fillRect(x,y,.6+random()*1.7,.6+random()*1.4);
  }
  ctx.restore();
  weathering(ctx,size,79,[[23,.14],[76,.17],[227,.25],[512,.24]]);
  weathering(relief,size,184,[[76,.08],[240,.22],[512,.21]]);
  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(heightCanvas);
  map.anisotropy = bumpMap.anisotropy = 8;
  return {map,bumpMap};
}

function stoneMap() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const random = randomFor(205);
  ctx.fillStyle = '#babac0';
  ctx.fillRect(0,0,256,256);
  weathering(ctx,256,205);
  for (let i=0;i<1700;i++) {
    const shade = Math.floor(60+random()*183);
    ctx.fillStyle = `rgba(${shade},${shade},${shade},.16)`;
    ctx.fillRect(random()*256,random()*256,1+random()*10,1+random()*7);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  return map;
}

function lavaMaterial(pool = false) {
  return new THREE.ShaderMaterial({
    side:THREE.DoubleSide,
    uniforms:{time:{value:0},pool:{value:pool}},
    vertexShader:`
      varying vec2 surface;
      void main() {
        surface = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader:`
      uniform float time;
      uniform bool pool;
      varying vec2 surface;

      float hash(vec2 p) {
        vec3 q = fract(p.xyx * .1031);
        q += dot(q,q.yzx+33.33);
        return fract((q.x+q.y)*q.z);
      }

      float noise(vec2 p) {
        vec2 cell = floor(p);
        vec2 f = fract(p);
        vec2 blend = f*f*(3.0-2.0*f);
        return mix(mix(hash(cell),hash(cell+vec2(1,0)),blend.x),
          mix(hash(cell+vec2(0,1)),hash(cell+vec2(1,1)),blend.x),blend.y);
      }

      void main() {
        vec2 p = surface;
        if (pool) {
          float theta = p.y*6.2831853;
          vec2 drift = vec2(sin(theta),cos(theta))*(2.9+p.x*.93) + vec2(time*.047,-time*.031);
          vec2 flow = vec2(noise(drift*1.7),noise(drift*2.1+3.4))-.5;
          vec2 cell = (drift + flow*.56)*3.35;
          float skin = noise(cell)*.7 + noise(cell*2.45)*.24 + noise(cell*7.2)*.06;
          float seam = 1.0-smoothstep(.014,.095,abs(skin-.47));
          float glow = smoothstep(.16,.74,noise(drift*4.1));
          float shore = smoothstep(.04,.19,min(surface.x,1.0-surface.x));
          vec3 crust = mix(vec3(.11,.009,.004),vec3(.55,.054,.009),glow);
          vec3 molten = mix(vec3(.84,.12,.008),vec3(1.0,.55,.09),glow);
          gl_FragColor = vec4(mix(crust,molten,seam*.87)*mix(.50,1.0,shore),1.0);
          #include <colorspace_fragment>
          return;
        }
        float v = p.y + time*.16;
        float bend = noise(vec2(p.x*5.0,v*3.8))-.5;
        float u = p.x + bend*.19 + (noise(vec2(p.x*9.0,v*10.0))-.5)*.042;
        float body = noise(vec2(u*9.0,v*1.9));
        float folds = noise(vec2(u*28.0,v*4.0)+vec2(2.7,6.3));
        float flecks = noise(vec2(u*61.0,v*21.0));
        float heat = body*.57 + folds*.31 + flecks*.12;
        float bank = smoothstep(.015,.22,min(p.x,1.0-p.x));
        heat = heat*.87 + bank*.10;
        vec3 color = mix(vec3(.054,.003,.003),vec3(.65,.035,.006),smoothstep(.10,.53,heat));
        color = mix(color,vec3(1.0,.29,.032),smoothstep(.38,.71,heat));
        color = mix(color,vec3(1.0,.76,.27),smoothstep(.68,.88,heat));
        float wornEdge = smoothstep(.02,.25,bank + (noise(vec2(u*46.0,v*14.0))-.5)*.25);
        color *= mix(.25,1.0,wornEdge);
        gl_FragColor = vec4(color,1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

function flameShape() {
  const flame = new THREE.Shape();
  flame.moveTo(0,-.87);
  flame.bezierCurveTo(-.86,-.83,-.91,-.17,-.52,.21);
  flame.bezierCurveTo(-.52,-.06,-.35,-.07,-.32,.10);
  flame.bezierCurveTo(-.39,.52,.18,.66,.08,1.06);
  flame.bezierCurveTo(.66,.76,.61,.39,.48,.18);
  flame.bezierCurveTo(.65,.20,.72,.33,.72,.43);
  flame.bezierCurveTo(1.04,-.16,.72,-.80,0,-.87);
  return flame;
}

export function createFireGym(scene, sceneryAngle, refresh) {
  const random = randomFor(309);
  const group = new THREE.Group();
  group.rotation.y = sceneryAngle;
  scene.add(group);
  const paving = pavingMaps(), rockMap = stoneMap(), lava = lavaMaterial();
  const lavaPool = lavaMaterial(true);
  const poolLevel = -.73;
  const material = (color,options={}) => new THREE.MeshStandardMaterial({color,roughness:.83,...options});
  const metal = material(0x32343e,{metalness:.37,roughness:.58});
  const trim = material(brass,{metalness:.46,roughness:.51});
  const rock = material(0xffffff,{map:rockMap,bumpMap:rockMap,bumpScale:.11,flatShading:true});
  const dressedStone = material(0x77717a,{map:rockMap,bumpMap:rockMap,bumpScale:.084,roughness:.70});
  const hot = new THREE.MeshBasicMaterial({color:0xf85c15});
  const flag = material(0x872e22,{side:THREE.DoubleSide,roughness:1});
  const add = (geometry,mat,x=0,y=0,z=0,parent=group) => {
    const mesh = new THREE.Mesh(geometry,mat);
    mesh.position.set(x,y,z);
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (w,h,d,mat,x,y,z,parent) => add(new THREE.BoxGeometry(w,h,d),mat,x,y,z,parent);

  const floorShape = new THREE.Shape(outline(floorRadius));
  const slab = new THREE.ExtrudeGeometry(floorShape,{depth:.86,bevelEnabled:true,bevelSize:.12,
    bevelThickness:.09,bevelSegments:3}).rotateX(-Math.PI/2);
  const rimMetal = material(0xb17e48,{map:rockMap,bumpMap:rockMap,bumpScale:.043,metalness:.51,roughness:.43});
  const rimBacking = material(0x4d3a2c,{metalness:.48,roughness:.57});
  const rivet = new THREE.CylinderGeometry(.046,.047,.017,10);
  const slabStone = material(0x54535b,{map:rockMap,bumpMap:rockMap,bumpScale:.14});
  add(slab,slabStone,0,-.76,0);
  const footing = new THREE.CylinderGeometry(floorRadius*.988,floorRadius*1.012,1.12,8,1,false,turn/16);
  add(footing,slabStone,0,-1.22,0);
  const surface = new THREE.ShapeGeometry(floorShape);
  const {position,uv} = surface.attributes;
  for (let i=0;i<uv.count;i++) uv.setXY(i,.5+position.getX(i)/23,.5+position.getY(i)/23);
  surface.rotateX(-Math.PI/2);
  add(surface,material(0xffffff,{...paving,bumpScale:.047,roughness:.94}),0,floorHeight,0);

  // Set an inlaid metal band just inside the edge of the stone court.
  const rimRadius = 11.27;
  const courtBand = new THREE.Shape(outline(rimRadius));
  courtBand.holes.push(new THREE.Path(outline(rimRadius-.29).reverse()));
  add(new THREE.ExtrudeGeometry(courtBand,{depth:.018,bevelEnabled:true,bevelSize:.018,
    bevelThickness:.008,bevelSegments:2}).rotateX(-Math.PI/2),rimMetal,0,floorHeight-.013,0);
  const corners = outline(rimRadius-.145);
  for (let i=0;i<corners.length;i++) {
    const a = corners[i], b = corners[(i+1)%corners.length];
    for (const t of [.065,.34,.66,.935]) {
      add(rivet,rimBacking,THREE.MathUtils.lerp(a.x,b.x,t),floorHeight+.014,-THREE.MathUtils.lerp(a.y,b.y,t));
    }
  }

  // Blend the outer bank into the uneven cave floor. The inner edge overlaps the arena footing.
  const octagonEdge = angle => floorRadius*Math.cos(turn/16)/Math.cos(
    ((angle+turn/16)%(turn/8)+turn/8)%(turn/8)-turn/16);
  const poolShore = angle => 15.4+Math.sin(angle*3+.45)*.75+Math.sin(angle*7-1.4)*.42;
  const poolGeometry = new THREE.PlaneGeometry(1,1,10,160);
  const poolPoints = poolGeometry.attributes.position;
  const poolUv = poolGeometry.attributes.uv;
  for (let i=0;i<poolPoints.count;i++) {
    const across = poolUv.getX(i), angle = poolUv.getY(i)*turn;
    const radius = THREE.MathUtils.lerp(octagonEdge(angle)-.19,poolShore(angle)+.82,across);
    poolPoints.setXYZ(i,Math.sin(angle)*radius,poolLevel,Math.cos(angle)*radius);
  }
  poolGeometry.computeVertexNormals();
  const moltenRing = add(poolGeometry,lavaPool);
  moltenRing.receiveShadow = false;

  const groundGeometry = new THREE.PlaneGeometry(92,92,144,144).rotateX(-Math.PI/2);
  const groundPoints = groundGeometry.attributes.position;
  const groundUv = groundGeometry.attributes.uv;
  const groundTints = new Float32Array(groundPoints.count*3);
  const stoneTint = new THREE.Color();
  const raisedTint = new THREE.Color(0x555159);
  const groundHeight = (x,z) => {
    const distance = Math.hypot(x,z);
    const shelf = Math.sin(x*.47+z*.24)*Math.cos(z*.64-x*.19);
    const ridges = Math.abs(Math.sin(x*.91+z*.48+Math.cos(z*.29)));
    const apron = THREE.MathUtils.smoothstep(distance,10,16);
    const runout = THREE.MathUtils.smoothstep(Math.hypot((x+13.7)*1.16,(z+17.0)*.84),1.7,4.8);
    const shore = poolShore(Math.atan2(x,z));
    const bank = THREE.MathUtils.smoothstep(distance,shore-.8,shore+.65);
    const land = -1.47 + runout*(.24*shelf+apron*(.42*ridges+.19*Math.sin(z*1.48-x*.87)));
    const bankRise = Math.max(0,1-Math.abs(distance-shore-.55)/2.8);
    return THREE.MathUtils.lerp(-1.7,land+.94*bankRise,bank);
  };
  for (let i=0;i<groundPoints.count;i++) {
    const x = groundPoints.getX(i), z = groundPoints.getZ(i);
    const y = groundHeight(x,z);
    groundPoints.setY(i,y);
    groundUv.setXY(i,x*.29,z*.29);
    const grain = Math.sin(x*1.45+z*.36)*Math.cos(z*.94-x*.29);
    const stain = THREE.MathUtils.smoothstep(y,-1.62,-.92);
    stoneTint.setHex(0x3a3940).lerp(raisedTint,stain);
    stoneTint.multiplyScalar(.9+grain*.1);
    stoneTint.toArray(groundTints,i*3);
  }
  groundGeometry.setAttribute('color',new THREE.BufferAttribute(groundTints,3));
  groundGeometry.computeVertexNormals();
  add(groundGeometry,material(0xffffff,{map:rockMap,bumpMap:rockMap,bumpScale:.32,
    vertexColors:true,flatShading:true}));

  const stationSteel = material(0x51525b,{metalness:.44,roughness:.42});
  const stationStone = material(0x7d7980,{map:rockMap,bumpMap:rockMap,bumpScale:.12});
  function createStation(parent) {
    const station = new THREE.Group();
    parent.add(station);
    const height = .53;
    const radius = .77;
    const top = .409;
    const stone = add(new THREE.CylinderGeometry(radius*.91,radius,height-.07,6),stationStone,
      0,top-height*.5-.017,0,station);
    stone.castShadow = true;
    add(new THREE.CylinderGeometry(radius,radius*.98,.082,6),rimMetal,0,top-.066,0,station);
    add(new THREE.CylinderGeometry(radius*.81,radius*.86,.034,6),dressedStone,0,top-.017,0,station);
    const foot = add(new THREE.CylinderGeometry(radius*1.035,radius*1.065,.075,6),stationSteel,0,top-height+.037,0,station);
    foot.castShadow = true;
    for (let i=0;i<6;i++) {
      const angle = i*turn/6;
      const strut = box(radius*.12,height-.108,radius*.105,stationSteel,Math.sin(angle)*radius*.91,
        top-height*.5-.01,Math.cos(angle)*radius*.91,station);
      strut.rotation.y = angle;
      strut.rotation.x = -.09;
    }
    return station;
  }

  // Basalt prisms form three depth layers, including the open left flank.
  const columns = [];
  for (let row=0;row<3;row++) {
    const count = [32,41,48][row];
    for (let i=0;i<count;i++) {
      const angle = (i+.21*random())*turn/count;
      const x = Math.sin(angle), z = -Math.cos(angle);
      const isCascade = x<-.27 && x>-.84 && z<-.54;
      const r = 18.6+row*6.6+random()*2.8;
      const base = -2.3-random();
      const height = isCascade && row<2 ? 1.1+row*1.65+random()*1.7 : 3.4+row*4.5+random()*(5+row*2);
      columns.push({x:x*r,z:z*r,y:base+height/2,h:height,r:.95+row*.25+random()*.95,angle,
        color:[0x343747,0x41495e,0x535c70,0x393c4b,0x484659][i%5]});
    }
  }
  for (let i=0;i<24;i++) {
    const x = (i-11.5)*.94;
    const z = -18.5-random()*2.3;
    const h = 4.8+random()*6.8+(Math.abs(x)<5 ? 1.2 : 0);
    columns.push({x,z,y:h/2-1.05,h,r:.52+random()*.65,angle:random(),color:i%2 ? 0x484d63 : 0x555b70});
  }
  const prismProfile = [
    new THREE.Vector2(.94,-.5),new THREE.Vector2(1,-.43),new THREE.Vector2(.97,-.19),new THREE.Vector2(.91,-.16),
    new THREE.Vector2(.95,.16),new THREE.Vector2(.90,.20),new THREE.Vector2(.82,.45),new THREE.Vector2(.68,.5),
    new THREE.Vector2(0,.5),
  ];
  const basalt = new THREE.LatheGeometry(prismProfile,7);
  const vertices = basalt.attributes.position;
  for (let i=0;i<vertices.count;i++) {
    const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i);
    const angle=Math.atan2(z,x);
    const irregularity=1+.08*Math.cos(angle*3+y*4)+.045*Math.sin(angle*2-y*13);
    vertices.setXYZ(i,x*irregularity,y+.037*x+.02*z,z*irregularity);
  }
  basalt.computeVertexNormals();
  const prisms = new THREE.InstancedMesh(basalt,rock,columns.length);
  const transform = new THREE.Object3D(), color = new THREE.Color();
  columns.forEach(({x,y,z,h,r,angle,color:tint},index)=>{
    transform.position.set(x,y,z); transform.rotation.set(0,angle,(random()-.5)*.13);
    transform.scale.set(r,h,r*.93); transform.updateMatrix();
    prisms.setMatrixAt(index,transform.matrix);
    prisms.setColorAt(index,color.setHex(tint));
  });
  prisms.receiveShadow = true;
  group.add(prisms);

  const ceiling = new THREE.Group();
  group.add(ceiling);
  const canopyRock = material(0x3b3b49,{map:rockMap,bumpMap:rockMap,bumpScale:.12,flatShading:true});
  const chunk = new THREE.IcosahedronGeometry(1,1);
  const rubbleRandom = randomFor(811);
  const rubble = new THREE.InstancedMesh(chunk,rock,165);
  for (let i=0;i<rubble.count;i++) {
    const angle = rubbleRandom()*turn;
    const radius = poolShore(angle)+.33+Math.pow(rubbleRandom(),1.55)*15;
    const x = Math.sin(angle)*radius, z = Math.cos(angle)*radius;
    const size = (.22+rubbleRandom()*.69)*(radius<16 ? .62 : 1.16);
    transform.position.set(x,groundHeight(x,z)+size*.04,z);
    transform.rotation.set(rubbleRandom()*.66,angle,rubbleRandom()*.47);
    transform.scale.set(size*1.44,size*.42,size);
    transform.updateMatrix();
    rubble.setMatrixAt(i,transform.matrix);
    rubble.setColorAt(i,color.setHex(i%3===0 ? 0x565159 : 0x3b3b44));
  }
  rubble.receiveShadow = true;
  group.add(rubble);

  for (let i=0;i<29;i++) {
    const a = (i-14)*.16;
    if (a>-.68 && a<-.19) continue;
    const r = 23+random()*6;
    const crag = add(chunk,canopyRock,Math.sin(a)*r,15.3+random()*3.6,-Math.cos(a)*r,ceiling);
    crag.scale.set(4+random()*3,2.0+random()*2.1,3+random()*3);
    crag.rotation.set(random()*.8,a,random()*.7);
  }
  const fissure = new THREE.Shape([
    [-2.4,.2],[-1.35,.75],[-.6,.48],[.24,.83],[1.1,.55],[2.5,.8],[2.06,-.12],
    [1.12,-.56],[.58,-.38],[-.29,-.79],[-.96,-.40],[-1.92,-.53],
  ].map(([x,y])=>new THREE.Vector2(x,y)));
  const skylightOpening = add(new THREE.ShapeGeometry(fissure),new THREE.MeshBasicMaterial({
    color:0x97c6fa,side:THREE.DoubleSide,toneMapped:false,
  }),-8.9,14.9,-19.8,ceiling);
  skylightOpening.rotation.x = -.55;
  skylightOpening.rotation.z = .22;
  for (let i=0;i<16;i++) {
    const x=-13+i*.69;
    if (x>-9.4 && x<-6.0) continue;
    const tooth=add(basalt,canopyRock,x,14.6+random()*2.2,-17.5+random()*2.2,ceiling);
    tooth.scale.set(.36+random()*.55,2.2+random()*3,.48+random()*.59);
    tooth.rotation.set(.1+random()*.23,random(),(random()-.5)*.31);
  }
  const beam = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending,
    vertexShader:`varying vec2 p; void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`
      varying vec2 p;
      void main(){
        float edge = 1.0-smoothstep(.05,.5,abs(p.x-.5));
        float fade = smoothstep(.02,.43,p.y);
        gl_FragColor = vec4(.38,.61,1.0,.29*edge*edge*fade);
      }`,
  });
  for (let i=0;i<4;i++) {
    const shaft = add(new THREE.PlaneGeometry(1.18+i*.61,18+i*.34),beam,-7.5+i*.62,9.1,-18.4+i*.52,ceiling);
    shaft.rotation.z = .43+i*.07;
    shaft.rotation.y = i*.21;
  }

  // This backdrop sits behind the near rocks and the wall. Its edges fade into the cave.
  let disposed = false;
  const cascadeMap = new THREE.TextureLoader().load('/fire-cascade.webp',()=>{
    if (disposed) return;
    cascade.visible = true;
    refresh?.();
  });
  cascadeMap.colorSpace = THREE.SRGBColorSpace;
  cascadeMap.anisotropy = 4;
  const cascadeMaterial = new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,toneMapped:false,
    uniforms:{image:{value:cascadeMap},time:{value:0}},
    vertexShader:`
      varying vec2 surface;
      void main() {
        surface = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader:`
      varying vec2 surface;
      uniform sampler2D image;
      uniform float time;
      void main() {
        vec2 p = surface;
        vec3 base = texture2D(image,p).rgb;
        float heat = smoothstep(.13,.64,base.r-base.b*1.25);
        float shimmer = sin(p.y*95.0+p.x*34.0+time*3.6)*.023;
        shimmer += sin(p.y*49.0-p.x*73.0+time*2.4)*.019;
        vec2 edge = min(p,1.0-p);
        float sideFade = smoothstep(.015,.19,edge.x);
        float roofFade = smoothstep(.015,.22,1.0-p.y);
        float floorFade = smoothstep(.0,.095,p.y);
        float rockMask = mix(smoothstep(.001,.043,max(base.r,base.b)),1.0,heat);
        float alpha = sideFade*roofFade*floorFade*rockMask;
        gl_FragColor = vec4(base*(.90+heat*(.10+shimmer)),alpha);
        #include <colorspace_fragment>
      }
    `,
  });
  const cascade = add(new THREE.PlaneGeometry(22,14.67),cascadeMaterial,-12.8,6.9,-24.5);
  cascade.rotation.y = .34;
  cascade.visible = false;
  cascade.receiveShadow = false;

  for (let i=0;i<21;i++) {
    const boulder=add(chunk,canopyRock,-18+random()*8,-.64+random()*.83,-21+random()*9);
    boulder.scale.set(.36+random()*1.34,.45+random()*1.21,.60+random()*1.36);
    boulder.rotation.set(random(),random()*turn,random());
  }

  // The portal and Blaine's station share the same local centreline.
  const portalZ = -15.2;
  const portal = new THREE.Group();
  portal.scale.set(1.25,1.16,1);
  group.add(portal);
  const opening = [[-3.54,-.66],[-3.54,1.08],[-2.11,4.56],[2.11,4.56],[3.54,1.08],[3.54,-.66]];
  const outside = [[-5.02,-.66],[-5.02,1.55],[-3.04,6.04],[3.04,6.04],[5.02,1.55],[5.02,-.66]];
  const interpolate = (a,b,t) => new THREE.Vector2(
    THREE.MathUtils.lerp(a[0],b[0],t),THREE.MathUtils.lerp(a[1],b[1],t));
  const archStrip = (i,from,to,inner,outer) => new THREE.Shape([
    interpolate(opening[i],outside[i],inner).lerp(interpolate(opening[i+1],outside[i+1],inner),from),
    interpolate(opening[i],outside[i],inner).lerp(interpolate(opening[i+1],outside[i+1],inner),to),
    interpolate(opening[i],outside[i],outer).lerp(interpolate(opening[i+1],outside[i+1],outer),to),
    interpolate(opening[i],outside[i],outer).lerp(interpolate(opening[i+1],outside[i+1],outer),from),
  ]);
  for (let side=0;side<opening.length-1;side++) {
    const backing = new THREE.ExtrudeGeometry(archStrip(side,0,1,0,1),{depth:1.63,bevelEnabled:false});
    add(backing,canopyRock,0,0,portalZ,portal);
    const courses = side===2 ? [0,.24,.50,.76,1] :
      (side===0 || side===4) ? [0,.52,1] : [0,.32,.68,1];
    for (let i=0;i<courses.length-1;i++) {
      const shape = archStrip(side,courses[i]+.005,courses[i+1]-.005,.26,1);
      const stone = new THREE.ExtrudeGeometry(shape,{depth:1.83,bevelEnabled:true,
        bevelSize:.033,bevelThickness:.038,bevelSegments:2});
      const uv = stone.attributes.uv;
      for (let j=0;j<uv.count;j++) uv.setXY(j,uv.getX(j)*.34,uv.getY(j)*.34);
      add(stone,dressedStone,0,0,portalZ,portal).castShadow = true;
    }
    const jamb = new THREE.ExtrudeGeometry(archStrip(side,0,1,0,.101),{depth:1.77,bevelEnabled:true,
      bevelSize:.027,bevelThickness:.028,bevelSegments:2});
    add(jamb,dressedStone,0,0,portalZ,portal);
    add(new THREE.ShapeGeometry(archStrip(side,0,1,.11,.245)),hot,0,0,portalZ+1.655,portal);
  }
  // There is no surface closing the portal. The basalt behind it supplies real parallax.
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 128;
  const glowContext = glowCanvas.getContext('2d');
  const glowGradient = glowContext.createRadialGradient(64,64,2,64,64,62);
  glowGradient.addColorStop(0,'rgba(255,112,45,.48)');
  glowGradient.addColorStop(.33,'rgba(236,69,22,.21)');
  glowGradient.addColorStop(1,'rgba(230,45,11,0)');
  glowContext.fillStyle = glowGradient;
  glowContext.fillRect(0,0,128,128);
  const glowMap = new THREE.CanvasTexture(glowCanvas);
  glowMap.colorSpace = THREE.SRGBColorSpace;
  const glow = add(new THREE.PlaneGeometry(7.3,3.6),new THREE.MeshBasicMaterial({
    map:glowMap,transparent:true,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending,
  }),0,.78,portalZ-2.65,portal);
  glow.receiveShadow = false;
  const cavernBounce = new THREE.PointLight(0xff6027,95,10,2);
  cavernBounce.position.set(0,.43,portalZ-1.65);
  group.add(cavernBounce);
  const badgeY = 6.04;
  const badge = add(new THREE.CylinderGeometry(1.27,1.36,.27,64),trim,0,badgeY,portalZ+1.94,portal);
  badge.rotation.x = Math.PI/2;
  add(new THREE.CircleGeometry(1.12,64),material(0x603622,{metalness:.28}),0,badgeY,portalZ+2.07,portal);
  add(new THREE.TorusGeometry(1.15,.061,8,64),trim,0,badgeY,portalZ+2.10,portal);
  const badgeFlame = add(new THREE.ExtrudeGeometry(flameShape(),{depth:.045,bevelEnabled:true,
    bevelSize:.033,bevelThickness:.018,bevelSegments:2,curveSegments:15}),
  material(0xf8a14c,{metalness:.36,emissive:0x903215,emissiveIntensity:.36}),0,badgeY-.02,portalZ+2.08,portal);
  badgeFlame.scale.setScalar(.84);

  const leaderStation = new THREE.Group();
  leaderStation.position.set(0,fireGymLeaderStation.height,-fireGymLeaderStation.radius);
  group.add(leaderStation);
  // Low apron bridges the arena edge to a broad, open standing deck.
  const platformBase = new THREE.Shape([
    [-2.02,-1.30],[2.02,-1.30],[2.31,-.84],[2.31,.92],[1.87,1.39],[-1.87,1.39],[-2.31,.92],[-2.31,-.84],
  ].map(([x,z])=>new THREE.Vector2(x,-z)));
  const deck = new THREE.ExtrudeGeometry(platformBase,{depth:.52,bevelEnabled:true,
    bevelSize:.08,bevelThickness:.06,bevelSegments:2}).rotateX(-Math.PI/2);
  add(deck,stationStone,0,-.18,0,leaderStation).castShadow = true;
  add(new THREE.ShapeGeometry(platformBase).rotateX(-Math.PI/2),rimMetal,0,.402,0,leaderStation);
  const topStone = add(new THREE.ShapeGeometry(platformBase).rotateX(-Math.PI/2),dressedStone,0,.409,0,leaderStation);
  topStone.scale.set(.946,1,.92);
  box(3.58,.25,2.80,slabStone,0,-.39,.62,leaderStation);
  box(3.72,.16,2.76,dressedStone,0,-.51,.87,leaderStation);
  box(3.65,1.05,2.25,slabStone,0,-1.01,.18,leaderStation);
  const faceTrim = new THREE.Shape([
    [-.92,.29],[.92,.29],[.63,-.15],[-.63,-.15],
  ].map(([x,y])=>new THREE.Vector2(x,y)));
  add(new THREE.ShapeGeometry(faceTrim),trim,0,0,1.405,leaderStation);
  add(new THREE.ShapeGeometry(faceTrim),stationStone,0,0,1.415,leaderStation).scale.set(.91,.81,1);
  for (const x of [-1.64,1.64]) {
    box(.11,.47,.074,rimMetal,x,.057,1.403,leaderStation);
    box(.031,.32,.019,hot,x,.065,1.447,leaderStation);
  }
  const seal = new THREE.Group();
  seal.position.set(0,.075,1.426);
  leaderStation.add(seal);
  add(new THREE.RingGeometry(.133,.156,32),trim,0,0,0,seal);
  box(.265,.017,.008,trim,0,0,.006,seal);
  add(new THREE.CircleGeometry(.037,20),trim,0,0,.014,seal);

  const podiumBase = new THREE.CylinderGeometry(1.25,1.32,.184,48);
  const podiumBezel = new THREE.CylinderGeometry(1.28,1.30,.055,48);
  const podiumInset = new THREE.CylinderGeometry(1.17,1.20,.034,48);
  const podiumStone = new THREE.CylinderGeometry(1.08,1.09,.025,48);
  function createPokemonPodium(parent,top) {
    add(podiumBase,rimBacking,0,top-.172,0,parent).castShadow = true;
    add(podiumBezel,rimMetal,0,top-.067,0,parent);
    add(podiumInset,stationSteel,0,top-.031,0,parent);
    add(podiumStone,slabStone,0,top-.0125,0,parent);
    for (let i=0;i<8;i++) {
      const angle = i*turn/8;
      const stud = add(rivet,rimMetal,Math.sin(angle)*1.29,top-.137,Math.cos(angle)*1.29,parent);
      stud.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(Math.sin(angle),0,Math.cos(angle)));
    }
  }

  const bowl = new THREE.CylinderGeometry(.48,.30,.24,16);
  const flames = [];
  const fire = new THREE.MeshBasicMaterial({color:0xff9b38,side:THREE.DoubleSide,toneMapped:false});
  const fireCore = new THREE.MeshBasicMaterial({color:0xffdb78,side:THREE.DoubleSide,toneMapped:false});
  const flameGeometry = new THREE.ShapeGeometry(flameShape());
  function mountTorch(parent,x,y,z) {
    add(bowl,metal,x,y+.11,z,parent);
    const burner = new THREE.Group();
    burner.position.set(x,y+.36,z);
    for (let i=0;i<3;i++) {
      const tongue = add(flameGeometry,fire,0,0,0,burner);
      tongue.rotation.y = i*Math.PI/3;
      const core = add(flameGeometry,fireCore,0,-.13,0,tongue);
      core.scale.set(.51,.68,.6);
      core.position.z = .012;
    }
    parent.add(burner);
    flames.push(burner);
  }
  const pennant = new THREE.Shape([
    [-.38,.60],[.38,.60],[.38,-.51],[0,-.78],[-.38,-.51],
  ].map(([x,y])=>new THREE.Vector2(x,y)));
  const bannerGeometry = new THREE.ShapeGeometry(pennant);
  const bannerBar = new THREE.CylinderGeometry(.032,.032,.99,10);
  function hangBanner(parent,x,y,z,scale,slope) {
    const banner = new THREE.Group();
    banner.position.set(x,y,z);
    banner.rotation.x = -Math.atan(slope);
    banner.scale.setScalar(scale);
    parent.add(banner);
    for (const side of [-1,1]) {
      box(.13,.18,.085,metal,side*.38,.64,.007,banner);
      box(.061,.064,.22,trim,side*.38,.64,.105,banner);
      box(.062,.14,.045,trim,side*.25,.565,.211,banner);
    }
    add(bannerBar,trim,0,.64,.207,banner).rotation.z = Math.PI/2;
    add(bannerGeometry,trim,0,0,.164,banner);
    add(bannerGeometry,flag,0,.021,.174,banner).scale.set(.87,.90,1);
    add(flameGeometry,trim,0,-.02,.185,banner).scale.setScalar(.29);
  }

  const wallSections = [];
  const wallFace = material(0x8b8280,{map:rockMap,bumpMap:rockMap,bumpScale:.13});
  const mortar = material(0x575155,{map:rockMap,bumpMap:rockMap,bumpScale:.10});
  const wallColors = [0x827b79,0x797371,0x877f7c,0x746e6e,0x807a77];
  const blockOutline = new THREE.Shape([
    [-.485,-.5],[.47,-.5],[.5,-.46],[.49,.46],[.46,.5],[-.46,.49],[-.5,.45],[-.49,-.46],
  ].map(([x,y])=>new THREE.Vector2(x,y)));
  const wallGeometry = new THREE.ExtrudeGeometry(blockOutline,{depth:.95,bevelEnabled:true,
    bevelSize:.013,bevelThickness:.025,bevelSegments:2,steps:1}).translate(0,0,-.475);

  const bays = [
    {from:19,to:38,levels:2,end:-1,torch:true},
    {from:38,to:65,levels:3,tower:true},
    {from:65,to:92,levels:3},
    {from:92,to:116,levels:3,tower:true},
    {from:116,to:135,levels:2,end:1,torch:true},
  ];
  const mirroredBays = bays.flatMap((bay,index)=>[-1,1].map(side=>({...bay,index,side})));
  for (const {from,to,levels,end,tower,torch,index,side} of mirroredBays) {
    const angle = side*(from+to)*turn/720;
    const halfArc = (to-from)*turn/720;
    const radius = 14.85;
    const section = new THREE.Group();
    section.position.set(Math.sin(angle)*radius,-1.20,-Math.cos(angle)*radius);
    section.rotation.y = -angle;
    group.add(section);
    wallSections.push({section,angle,halfArc});
    const length = 2*(radius+.88)*Math.tan(halfArc)+.25;
    const blocks = [];
    const lower = .96;
    const rise = 1.24;

    box(length,1.05,3.34,mortar,0,.51,-.09,section);
    box(length+.06,.23,3.48,wallFace,0,lower,-.09,section);
    for (let i=0;i<5;i++) {
      blocks.push({x:side*(i-2)*length*.2,y:.54,z:1.29,
        w:length*.2-.025,h:.77,d:.69,tint:wallColors[(i+index)%wallColors.length]});
    }
    for (let tier=0;tier<levels;tier++) {
      const y = lower+tier*rise;
      const front = .91-tier*.86;
      const depth = 2.67;
      const width = length-tier*.07;
      box(width+.08,rise+.05,depth,mortar,0,y+rise*.49,front-depth*.5-.13,section);
      for (let course=0;course<2;course++) {
        const cuts = course ? [0,.26,.51,.73,1] : [0,.16,.39,.64,.85,1];
        for (let i=0;i<cuts.length-1;i++) {
          const left = (cuts[i]-.5)*width, right = (cuts[i+1]-.5)*width;
          blocks.push({x:side*(left+right)/2,y:y+(course+.5)*rise/2,z:front-.24,
            w:right-left-.021,h:rise/2-.022,d:.62,tint:wallColors[(index+tier+course+i)%wallColors.length]});
        }
      }
      box(width+.06,.145,depth+.19,wallFace,0,y+rise-.025,front-depth*.5,section);
    }

    // Build a solid tapered pier from its front and rear slopes so the flag has an exact mounting face.
    function pier(x,width,height,baseFront,topFront,depth) {
      const shape = new THREE.Shape([
        [baseFront,0],[topFront,height],[topFront-depth,height],[baseFront-depth-.42,0],
      ].map(([z,y])=>new THREE.Vector2(z,y)));
      const geometry = new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:true,
        bevelSize:.059,bevelThickness:.06,bevelSegments:2});
      geometry.rotateY(-Math.PI/2);
      add(geometry,wallFace,x+width*.5,0,0,section).castShadow = true;
      box(width+.19,.21,depth+.20,wallFace,x,height+.05,topFront-depth*.5,section);
      box(width+.08,.115,.096,trim,x,height-.10,topFront+.091,section);
      return y => THREE.MathUtils.lerp(baseFront,topFront,y/height);
    }
    if (end) {
      const gateSide = index===0;
      pier(side*end*(length*.5-.67),gateSide ? 1.44 : 1.26,
        gateSide ? 4.47 : lower+levels*rise+.37,gateSide ? 2.23 : 1.85,.42,gateSide ? 2.19 : 1.80);
    }
    if (tower) {
      const x = side*.54;
      const height = lower+levels*rise+1.11;
      const baseFront = 1.77, topFront = .47;
      const frontAt = pier(x,2.08,height,baseFront,topFront,2.67);
      const centerY = height-1.57;
      const slope = (baseFront-topFront)/height;
      hangBanner(section,x,centerY,frontAt(centerY)+.058,1.82,slope);
      for (const y of [1.22,2.37,3.52]) {
        box(2.06,.026,.061,mortar,x,y,frontAt(y)+.059,section).rotation.x = -Math.atan(slope);
      }
    }
    if (tower || torch) {
      const x = -side*.31*length;
      pier(x,1.04,1.82,1.97,1.49,1.05);
      mountTorch(section,x,1.99,1.13);
    }

    const masonry = new THREE.InstancedMesh(wallGeometry,rock,blocks.length);
    for (const [i,{x,y,z,w,h,d,tint}] of blocks.entries()) {
      transform.position.set(x,y,z);
      transform.rotation.set(0,0,0);
      transform.scale.set(w,h,d);
      transform.updateMatrix();
      masonry.setMatrixAt(i,transform.matrix);
      masonry.setColorAt(i,color.setHex(tint));
    }
    masonry.receiveShadow = true;
    section.add(masonry);
  }

  const stoneFill = new THREE.DirectionalLight(0xadbdf4,.75);
  stoneFill.position.set(-7,9,11);
  group.add(stoneFill);
  for (const [x,z] of [[-10.5,-5.1],[-8.9,-10.8]]) {
    add(new THREE.CylinderGeometry(.38,.57,1.62,6),dressedStone,x,-.28,z);
    mountTorch(group,x,.55,z);
  }
  const poolGlow = new THREE.PointLight(0xff541b,85,12,2);
  poolGlow.position.set(-7.8,.25,9.5);
  group.add(poolGlow);
  const lavaBounce = new THREE.PointLight(0xff4f21,345,22,2);
  lavaBounce.position.set(-12.6,3,-18);
  group.add(lavaBounce);
  const skylight = new THREE.PointLight(0x91beff,245,23,2);
  skylight.position.set(-8,11,-10.5);
  group.add(skylight);
  for (const side of [-1,1]) {
    const wallBounce = new THREE.PointLight(0xff7742,100,12,2);
    wallBounce.position.set(side*8,1.1,-9);
    group.add(wallBounce);
  }
  const gateLight = new THREE.PointLight(0xff7733,73,11,2);
  gateLight.position.set(0,2.6,-14);
  group.add(gateLight);

  const viewPosition = new THREE.Vector3();
  return {
    update(time,reducedMotion,wide,cameraPosition) {
      const t = reducedMotion ? 0 : time*.001;
      lava.uniforms.time.value = t;
      lavaPool.uniforms.time.value = t;
      cascadeMaterial.uniforms.time.value = t;
      ceiling.visible = !wide;
      viewPosition.copy(cameraPosition).applyAxisAngle(scene.up,-sceneryAngle);
      // The camera can be behind the portal when looking from the leader's seat.
      portal.visible = wide || viewPosition.z>portalZ+1.25 || Math.abs(viewPosition.x)>Math.abs(viewPosition.z)*.53;
      const viewAngle = Math.atan2(viewPosition.x,-viewPosition.z);
      const nearWalls = Math.hypot(viewPosition.x,viewPosition.z)>12.1;
      for (const {section,angle,halfArc} of wallSections) {
        const offset = Math.atan2(Math.sin(viewAngle-angle),Math.cos(viewAngle-angle));
        section.visible = wide || !nearWalls || Math.abs(offset)>halfArc+.31;
      }
      for (const [i,burner] of flames.entries()) {
        burner.scale.set(.27+.028*Math.sin(t*7+i),.49+.075*Math.sin(t*9+i*2),.27);
        burner.rotation.y = i+t*.31;
      }
    },
    createStation,
    createPokemonPodium,
    dispose() {
      disposed = true;
      paving.map.dispose();
      paving.bumpMap.dispose();
      rockMap.dispose();
      cascadeMap.dispose();
      glowMap.dispose();
    },
  };
}
