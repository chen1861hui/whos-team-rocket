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

function caveWall() {
  const random = randomFor(1297);
  const positions = [], uvs = [], colors = [];
  const perimeter = 130;
  const levels = [-2.6,-.3,1.5,3.2,5.1,6.8,8.4,10.3,12.1,14.4,16.7,19.4,21.8,24];
  const faces = [0x454a61,0x50556b,0x353b51,0x53576a,0x41465a].map(tint=>new THREE.Color(tint));
  const rows = levels.map((height,row)=>Array.from({length:perimeter},(_,i)=>{
    const angle = (i+(row%2)*.47+(random()-.5)*.39)*turn/perimeter;
    const strata = Math.sin(angle*5+.8)*1.7+Math.sin(angle*11-height*.24)*.83;
    const recess = Math.cos(angle*3+row*.26)*1.5;
    const radius = 29+strata+recess+(random()-.5)*1.86-Math.max(0,height-12)*.57;
    return [Math.sin(angle)*radius,height+(random()-.5)*1.56,-Math.cos(angle)*radius];
  }));
  function triangle(a,b,c) {
    const tint = faces[Math.floor(random()*faces.length)];
    const verticalFace = Math.abs(a[0]-b[0])>Math.abs(a[2]-b[2]);
    for (const point of [a,b,c]) {
      positions.push(...point);
      uvs.push((verticalFace ? point[0] : point[2])*.27,point[1]*.31);
      colors.push(tint.r,tint.g,tint.b);
    }
  }
  for (let row=0;row<rows.length-1;row++) {
    for (let i=0;i<perimeter;i++) {
      const next = (i+1)%perimeter;
      const lower = rows[row], upper = rows[row+1];
      triangle(lower[i],lower[next],upper[i]);
      triangle(lower[next],upper[next],upper[i]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  return geometry;
}

function lavaRibbon(rows) {
  const geometry = new THREE.PlaneGeometry(1,1,12,rows.length-1);
  const {position,uv} = geometry.attributes;
  const lengths = [0];
  for (let i=1;i<rows.length;i++) {
    const [x,y,z] = rows[i], [previousX,previousY,previousZ] = rows[i-1];
    lengths.push(lengths[i-1]+Math.hypot(x-previousX,y-previousY,z-previousZ));
  }
  const length = lengths.at(-1);
  for (let i=0;i<position.count;i++) {
    const row = Math.round((1-uv.getY(i))*(rows.length-1));
    const [x,y,z,width] = rows[row];
    const u = uv.getX(i), across = u*2-1;
    position.setXYZ(i,x+across*width,y+Math.sin(across*5+y)*width*.07,z-across*across*width*.16);
    uv.setXY(i,u,1-lengths[row]/length);
  }
  return geometry;
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
  const palette = ['#65636b','#6b6770','#6c696f','#605f66','#67656b','#626169'];
  ctx.fillStyle = '#3b3941';
  ctx.fillRect(0,0,size,size);
  relief.fillStyle = '#727272';
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
        const chip = random() < .20 ? random()*3.7 : 0;
        const method = corner ? 'lineTo' : 'moveTo';
        tile[method](x+dx*(radius-1.18-chip),y+dy*(radius-1.18-chip));
        face[method](x+dx*(radius-2.35-chip),y+dy*(radius-2.35-chip));
      }
      tile.closePath();
      face.closePath();
      ctx.fillStyle = '#817a81';
      ctx.fill(tile);
      ctx.fillStyle = palette[Math.floor(random()*palette.length)];
      ctx.fill(face);
      relief.fillStyle = '#969696';
      relief.fill(tile);
      const height = 179 + Math.floor(random()*9);
      relief.fillStyle = 'rgb('+height+' '+height+' '+height+')';
      relief.fill(face);
      ctx.save();
      ctx.clip(face);
      for (let i=0;i<260;i++) {
        const px = x+(random()-.5)*radius*2;
        const py = y+(random()-.5)*radius*2;
        const grain = .35+random()*1.45;
        ctx.fillStyle = i%2 ? '#ded4cc23' : '#2926292b';
        ctx.fillRect(px,py,grain,grain*.72);
      }
      for (let vein=0;vein<4;vein++) {
        let px = x+(random()-.5)*radius*1.7;
        let py = y+(random()-.5)*radius*1.7;
        const path = new Path2D();
        path.moveTo(px,py);
        for (let segment=0;segment<6;segment++) {
          px += 2+random()*10;
          py += (random()-.38)*12;
          path.lineTo(px,py);
        }
        ctx.strokeStyle = vein%2 ? '#a49aa018' : '#38323c48';
        ctx.lineWidth = vein%2 ? 1.6 : .82;
        ctx.stroke(path);
      }
      ctx.restore();
    }
  }
  // The circular center stone takes the place of the tiles under the court emblem.
  const center = size*.5;
  const medallion = new Path2D();
  medallion.arc(center,center,154,0,turn);
  ctx.strokeStyle = '#494750';
  ctx.lineWidth = 2.6;
  ctx.fillStyle = '#656169';
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
  ctx.strokeStyle = '#847c80';
  ctx.lineWidth = 4.6;
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
  weathering(ctx,size,79,[[13,.14],[38,.13],[103,.11],[280,.15],[512,.15]]);
  weathering(relief,size,184,[[76,.053],[240,.095],[512,.10]]);
  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(heightCanvas);
  map.anisotropy = bumpMap.anisotropy = 8;
  return {map,bumpMap};
}

function stoneMaps() {
  const size = 512;
  const canvas = document.createElement('canvas'), height = document.createElement('canvas');
  canvas.width = canvas.height = height.width = height.height = size;
  const ctx = canvas.getContext('2d'), relief = height.getContext('2d');
  const random = randomFor(205);
  ctx.fillStyle = '#c6c3c3';
  ctx.fillRect(0,0,size,size);
  relief.fillStyle = '#a4a4a4';
  relief.fillRect(0,0,size,size);
  weathering(ctx,size,205,[[8,.23],[24,.25],[63,.24],[181,.22],[512,.22]]);
  weathering(relief,size,593,[[34,.15],[101,.24],[280,.27],[512,.24]]);
  for (let i=0;i<3100;i++) {
    const x = random()*size, y = random()*size, width = 1+random()*4;
    const light = i%3===0;
    ctx.fillStyle = light ? '#fff1e83b' : '#40374748';
    ctx.fillRect(x,y,width,1+random()*1.7);
    relief.fillStyle = light ? '#ededed4b' : '#4f4f4f57';
    relief.fillRect(x,y,width,1.7);
  }
  for (let i=0;i<90;i++) {
    let x = random()*size, y = random()*size;
    const fault = new Path2D();
    fault.moveTo(x,y);
    const direction = random()*turn;
    const span = 2+random()*12;
    for (let j=0;j<6;j++) {
      x += Math.cos(direction)*span+(random()-.5)*8;
      y += Math.sin(direction)*span+(random()-.5)*8;
      fault.lineTo(x,y);
    }
    ctx.strokeStyle = '#71697760';
    ctx.lineWidth = .72;
    ctx.stroke(fault);
    relief.strokeStyle = '#5555558d';
    relief.lineWidth = 1.15;
    relief.stroke(fault);
  }
  const bumpMap = new THREE.CanvasTexture(height);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const texture of [map,bumpMap]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
  }
  return {map,bumpMap};
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
          float seam = 1.0-smoothstep(.012,.078,abs(skin-.47));
          float glow = smoothstep(.16,.74,noise(drift*4.1));
          float shore = smoothstep(.04,.19,min(surface.x,1.0-surface.x));
          vec3 crust = mix(vec3(.055,.005,.004),vec3(.39,.045,.009),glow);
          vec3 molten = mix(vec3(.94,.20,.006),vec3(1.0,.64,.08),glow);
          gl_FragColor = vec4(mix(crust,molten,seam*.96)*mix(.58,1.0,shore),1.0);
          #include <colorspace_fragment>
          return;
        }
        float v = p.y + time*.23;
        float u = p.x + (noise(vec2(p.x*4.5,p.y*5.7))-.5)*.14;
        float body = noise(vec2(u*6.0,p.y*4.0));
        float folds = noise(vec2(u*18.0,v*3.8))*.58;
        folds += noise(vec2(u*45.0,v*8.5)+vec2(2.7,6.3))*.29;
        folds += noise(vec2(u*92.0,v*23.0))*.13;
        float bank = smoothstep(.005,.21,min(p.x,1.0-p.x));
        float heat = body*.31 + folds*.58 + bank*.21;
        vec3 color = mix(vec3(.14,.008,.003),vec3(.82,.07,.003),smoothstep(.09,.41,heat));
        color = mix(color,vec3(1.0,.34,.008),smoothstep(.35,.68,heat));
        color = mix(color,vec3(1.0,.78,.21),smoothstep(.64,.86,heat));
        color *= mix(.29,1.0,bank);
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

export function createFireGym(scene, sceneryAngle) {
  const random = randomFor(309);
  const group = new THREE.Group();
  group.rotation.y = sceneryAngle;
  scene.add(group);
  const paving = pavingMaps(), stone = stoneMaps(), lava = lavaMaterial();
  const lavaPool = lavaMaterial(true);
  const poolLevel = -.36;
  const material = (color,options={}) => new THREE.MeshStandardMaterial({color,roughness:.83,...options});
  const metal = material(0x32343e,{metalness:.37,roughness:.58});
  const trim = material(brass,{metalness:.37,roughness:.47});
  const rock = material(0xffffff,{...stone,bumpScale:.11,flatShading:true});
  const dressedStone = material(0x77717a,{...stone,bumpScale:.084,roughness:.70});
  const hot = new THREE.MeshBasicMaterial({color:0xf76d17});
  const hotCore = new THREE.MeshBasicMaterial({color:0xffab3e});
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
  const slab = new THREE.ExtrudeGeometry(floorShape,{depth:.22,bevelEnabled:true,bevelSize:.064,
    bevelThickness:.039,bevelSegments:2}).rotateX(-Math.PI/2);
  const rimMetal = material(0xb68b54,{...stone,bumpScale:.025,metalness:.34,roughness:.43});
  const rimBacking = material(0x4d3a2c,{metalness:.48,roughness:.57});
  const rivet = new THREE.CylinderGeometry(.046,.047,.017,10);
  const slabStone = material(0x54535b,{...stone,bumpScale:.14});
  add(slab,slabStone,0,-.045,0);
  const surface = new THREE.ShapeGeometry(floorShape);
  const {position,uv} = surface.attributes;
  for (let i=0;i<uv.count;i++) uv.setXY(i,.5+position.getX(i)/23,.5+position.getY(i)/23);
  surface.rotateX(-Math.PI/2);
  add(surface,material(0xffffff,{...paving,bumpScale:.025,roughness:.67}),0,floorHeight,0);

  // Set an inlaid metal band just inside the edge of the stone court.
  const rimRadius = 11.27;
  function inlay(radius,width,mat) {
    const band = new THREE.Shape(outline(radius));
    band.holes.push(new THREE.Path(outline(radius-width).reverse()));
    add(new THREE.ExtrudeGeometry(band,{depth:.013,bevelEnabled:true,bevelSize:.009,
      bevelThickness:.006,bevelSegments:2}).rotateX(-Math.PI/2),mat,0,floorHeight-.007,0);
  }
  inlay(rimRadius,.21,rimMetal);
  inlay(4.52,.085,trim);
  const corners = outline(rimRadius-.145);
  for (let i=0;i<corners.length;i++) {
    const a = corners[i], b = corners[(i+1)%corners.length];
    for (const t of [.065,.34,.66,.935]) {
      add(rivet,rimBacking,THREE.MathUtils.lerp(a.x,b.x,t),floorHeight+.014,-THREE.MathUtils.lerp(a.y,b.y,t));
    }
  }

  // A narrow channel separates the retained paving from the outer bedrock.
  const octagonEdge = angle => floorRadius*Math.cos(turn/16)/Math.cos(
    ((angle+turn/16)%(turn/8)+turn/8)%(turn/8)-turn/16);
  const poolShore = angle => octagonEdge(angle)+.89+Math.sin(angle*5+.45)*.19+Math.sin(angle*11-1.4)*.12;
  const runoutX = z => -12.4 + (z+20)*.55 + Math.sin((z+20)*.44)*.43;
  const poolGeometry = new THREE.PlaneGeometry(1,1,10,160);
  const poolPoints = poolGeometry.attributes.position;
  const poolUv = poolGeometry.attributes.uv;
  for (let i=0;i<poolPoints.count;i++) {
    const across = poolUv.getX(i), angle = poolUv.getY(i)*turn;
    const radius = THREE.MathUtils.lerp(octagonEdge(angle)-.10,poolShore(angle)+.58,across);
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
  const raisedTint = new THREE.Color(0x65606a);
  const groundHeight = (x,z) => {
    const distance = Math.hypot(x,z);
    const angle = Math.atan2(x,z);
    const shore = poolShore(angle);
    const offset = distance-shore;
    const shelf = Math.sin(x*.51+z*.32)*Math.cos(z*.58-x*.24);
    const joints = Math.sin(x*1.24+z*.84+Math.cos(z*.43));
    const bank = THREE.MathUtils.smoothstep(offset,-.26,.47);
    const terraces = THREE.MathUtils.smoothstep(offset,1.6,7);
    const ledge = -.22+.19*shelf+.14*joints+
      terraces*(.42*shelf+.33*Math.sin(x*.29-z*.34)+.14*joints);
    const underCourt = 1-THREE.MathUtils.smoothstep(distance,octagonEdge(angle)-.24,octagonEdge(angle)+.18);
    const gully = (1-THREE.MathUtils.smoothstep(Math.abs(x-runoutX(z)),.38,1.20))*
      THREE.MathUtils.smoothstep(z,-21.6,-19.8)*(1-THREE.MathUtils.smoothstep(z,-10.3,-9.05));
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(-.76,ledge,bank),poolLevel-.24,gully)+.66*underCourt;
  };
  for (let i=0;i<groundPoints.count;i++) {
    const x = groundPoints.getX(i), z = groundPoints.getZ(i);
    const y = groundHeight(x,z);
    groundPoints.setY(i,y);
    groundUv.setXY(i,x*.29,z*.29);
    const grain = Math.sin(x*1.45+z*.36)*Math.cos(z*.94-x*.29);
    const stain = THREE.MathUtils.smoothstep(y,-.63,.29);
    stoneTint.setHex(0x3d3a44).lerp(raisedTint,stain);
    stoneTint.multiplyScalar(.9+grain*.1);
    stoneTint.toArray(groundTints,i*3);
  }
  groundGeometry.setAttribute('color',new THREE.BufferAttribute(groundTints,3));
  groundGeometry.computeVertexNormals();
  add(groundGeometry,material(0xffffff,{...stone,bumpScale:.32,
    vertexColors:true,flatShading:true}));

  const stationSteel = material(0x777680,{metalness:.33,roughness:.39});
  const stationStone = material(0x7d7980,{...stone,bumpScale:.12});
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
    const foot = add(new THREE.CylinderGeometry(radius*1.01,radius*1.035,.055,6),slabStone,0,top-height+.037,0,station);
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

  add(caveWall(),material(0xffffff,{...stone,bumpScale:.24,vertexColors:true}));

  // Clusters leave shadowed gullies between the wall, fractured talus and taller columns.
  const columns = [];
  const basaltTints = [0x454b61,0x525b75,0x5d657b,0x4d4e60,0x626377];
  const clusters = [-3.02,-2.62,-2.18,-1.76,-1.24,-.99,.59,.91,1.22,1.73,2.04,2.51,2.91];
  for (const [index,center] of clusters.entries()) {
    const count = 9+Math.floor(random()*6);
    for (let i=0;i<count;i++) {
      const angle = center+(random()-.5)*.37;
      const depth = random();
      const distance = 16.8+depth*11+Math.sin(center*3)*1.1;
      const x = Math.sin(angle)*distance, z = -Math.cos(angle)*distance;
      const base = groundHeight(x,z)-.75;
      let height = 1.2+depth*(7.2+index%3*1.55)+random()*(2.8+depth*4.4);
      if (x>-17.8 && x<-9.5 && z<-14.8 && z>-23.4) height *= .32;
      columns.push({x,z,y:base+height*.5,h:height,r:.55+random()*1.12+depth*.35,angle,
        lean:(random()-.5)*(.38-depth*.23),tint:basaltTints[i%basaltTints.length]});
    }
  }
  for (let i=0;i<31;i++) {
    const x = -6.2+i*.46+(random()-.5)*1.2;
    const z = -17.3-random()*5.8;
    // Central columns start above the tunnel's crown and remain clear of the passage.
    const base = Math.abs(x)<4.5 ? Math.max(4.3,6.1-Math.abs(x)*.39) : -.61;
    const crest = 12.6-Math.abs(x-.9)*.48+Math.sin(x*1.7)*1.13;
    const height = Math.max(1.2,crest-base-random()*3.7);
    columns.push({x,z,y:base+height*.5,h:height,r:.46+random()*.81,angle:random()*turn,
      lean:(random()-.5)*.14,tint:basaltTints[i%basaltTints.length]});
  }
  const shelves = [
    {z:-23.65,top:10.8,base:6.2,start:-18.1,count:13},
    {z:-21.95,top:6.65,base:2.3,start:-18.1,count:13},
    {z:-20.15,top:2.96,base:-.50,start:-16.9,count:11},
  ];
  for (const {z,top,base,start,count} of shelves) {
    for (let i=0;i<count;i++) {
      const h = top-base+(random()-.5)*1.1;
      columns.push({x:start+i*.86,z:z-.32-random()*.42,y:base+h*.5,h,r:.72+random()*.35,
        angle:random()*turn,lean:(random()-.5)*.12,tint:basaltTints[(i+2)%basaltTints.length]});
    }
  }
  const prismProfile = [
    [.74,-.5],[1,-.44],[.96,-.25],[.88,-.235],[.96,-.219],[.91,.015],[.85,.029],
    [.91,.049],[.88,.24],[.83,.25],[.88,.263],[.84,.43],[.70,.493],[.40,.51],[0,.495],
  ];
  const basalt = new THREE.LatheGeometry(prismProfile.map(([r,y])=>new THREE.Vector2(r,y)),6);
  const vertices = basalt.attributes.position;
  for (let i=0;i<vertices.count;i++) {
    const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i);
    const angle=Math.atan2(z,x);
    const irregularity=1+.13*Math.cos(angle*3+y*3)+.075*Math.sin(angle*2-y*13);
    vertices.setXYZ(i,x*irregularity+y*.12,y+.045*x+.026*z,z*irregularity);
  }
  basalt.computeVertexNormals();
  const prisms = new THREE.InstancedMesh(basalt,rock,columns.length);
  const transform = new THREE.Object3D(), color = new THREE.Color();
  columns.forEach(({x,y,z,h,r,angle,lean,tint},index)=>{
    transform.position.set(x,y,z);
    transform.rotation.set(lean,angle,lean*.71);
    transform.scale.set(r,h,r*(.78+random()*.38));
    transform.updateMatrix();
    prisms.setMatrixAt(index,transform.matrix);
    prisms.setColorAt(index,color.setHex(tint));
  });
  prisms.receiveShadow = true;
  group.add(prisms);

  const ceiling = new THREE.Group();
  group.add(ceiling);
  const canopyRock = material(0x50515e,{...stone,bumpScale:.17,flatShading:true});
  const chunk = new THREE.IcosahedronGeometry(1,0);
  const rubbleRandom = randomFor(811);
  const rubble = new THREE.InstancedMesh(chunk,rock,320);
  for (let i=0;i<rubble.count;i++) {
    const angle = rubbleRandom()*turn;
    const near = i<123;
    const radius = poolShore(angle)+(near ? .16+Math.pow(rubbleRandom(),2)*2.3 : .95+Math.pow(rubbleRandom(),.64)*16);
    const x = Math.sin(angle)*radius, z = Math.cos(angle)*radius;
    const size = near ? .16+rubbleRandom()*.60 : .33+rubbleRandom()*1.35;
    transform.position.set(x,groundHeight(x,z)+size*.10,z);
    transform.rotation.set(rubbleRandom()*.66,angle,rubbleRandom()*.47);
    transform.scale.set(size*1.54,size*(near ? .34 : .74),size*.85);
    transform.updateMatrix();
    rubble.setMatrixAt(i,transform.matrix);
    rubble.setColorAt(i,color.setHex(i%3===0 ? 0x625a63 : 0x4f4d5b));
  }
  rubble.receiveShadow = true;
  group.add(rubble);

  for (let i=0;i<54;i++) {
    const a = (i-27)*turn/54;
    if (a>-.70 && a<-.29) continue;
    const r = 18.7+random()*5.7;
    const crown = 14.2+1.62*Math.cos(a*2.7+.35)+random()*2.2;
    const crag = add(chunk,canopyRock,Math.sin(a)*r,crown,-Math.cos(a)*r,ceiling);
    crag.scale.set(2.5+random()*3.5,1.65+random()*2.5,2.6+random()*3.1);
    crag.rotation.set(random()*.75,a,random()*.81);
    if (i%3!==1) {
      const pendant = add(basalt,canopyRock,crag.position.x*.96,crown-1.8,crag.position.z*.96,ceiling);
      pendant.scale.set(.55+random()*.81,2+random()*3.3,.48+random()*.72);
      pendant.rotation.set(.21+random()*.44,random()*turn,Math.PI+(random()-.5)*.64);
    }
  }
  const fissure = new THREE.Shape([
    [-2.4,.2],[-1.35,.75],[-.6,.48],[.24,.83],[1.1,.55],[2.5,.8],[2.06,-.12],
    [1.12,-.56],[.58,-.38],[-.29,-.79],[-.96,-.40],[-1.92,-.53],
  ].map(([x,y])=>new THREE.Vector2(x,y)));
  const skylightOpening = add(new THREE.ShapeGeometry(fissure),new THREE.MeshBasicMaterial({
    color:0xc0e7ff,side:THREE.DoubleSide,toneMapped:false,
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
        float fade = smoothstep(.03,.46,p.y) * (1.0-smoothstep(.91,1.0,p.y));
        gl_FragColor = vec4(.43,.67,1.0,.21*edge*edge*fade);
      }`,
  });
  for (let i=0;i<5;i++) {
    const shaft = add(new THREE.PlaneGeometry(1.28+i*.38,15.0+i*.55),beam,-7.4+i*.69,8.25,-18.5+i*.38,ceiling);
    shaft.rotation.z = .28+i*.073;
    shaft.rotation.y = .12+i*.18;
  }

  // The curtains bend over two rock ledges and meet the narrow channel at the court.
  const falls = [
    [[-14.9,10.95,-24.8,2.87],[-14.2,10.91,-23.54,2.54],[-13.9,10.8,-22.95,1.79],[-13.83,10.30,-22.48,1.57],
      [-13.78,9.41,-22.35,1.47],[-13.72,7.56,-22.16,1.53],[-13.64,6.73,-21.92,1.84],
      [-13.38,6.70,-21.12,1.94],[-13.24,6.43,-20.85,1.65],[-13.2,5.47,-20.67,1.32],
      [-13.21,3.76,-20.42,1.24],[-13.18,3.05,-20.22,1.52],[-12.97,3.02,-19.24,1.38],
      [-12.83,2.69,-18.95,1.1],[-12.68,1.86,-18.77,.92],[-12.34,.49,-18.46,.80],
      [runoutX(-18.23),poolLevel+.04,-18.23,1.1]],
    [[-16.48,10.84,-23.95,.56],[-16.43,10.65,-22.97,.52],[-16.42,9.5,-22.44,.42],
      [-16.09,7.1,-22.01,.31],[-15.74,6.60,-21.28,.62],[-15.38,6.67,-21.16,.61]],
  ];
  for (const rows of falls) add(lavaRibbon(rows),lava).receiveShadow = false;
  const runoff = Array.from({length:29},(_,i)=>{
    const z = -18.36+i*.317;
    return [runoutX(z),poolLevel+.025,z,.48+Math.sin(i*.45)*.095+Math.max(0,10-i)*.04];
  });
  add(lavaRibbon(runoff),lavaPool).receiveShadow = false;

  for (let i=0;i<13;i++) {
    const x = -16.6+random()*6, z = -20.5+random()*7;
    if (Math.abs(x-runoutX(z))<.87) continue;
    const boulder=add(chunk,canopyRock,x,groundHeight(x,z)+.13,z);
    boulder.scale.set(.36+random()*.87,.24+random()*.72,.58+random()*.85);
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
    add(new THREE.ShapeGeometry(archStrip(side,0,1,.147,.185)),hotCore,0,0,portalZ+1.659,portal);
  }
  // The throat recedes into the chamber through overlapping rings of broken basalt.
  const tunnelStone = material(0x34313c,{...stone,bumpScale:.13,flatShading:true});
  for (let layer=0;layer<4;layer++) {
    const width = 4.23-layer*.43;
    for (let i=0;i<11;i++) {
      const angle = i*Math.PI/10;
      const x = Math.cos(angle)*width;
      const y = Math.sin(angle)*(4.16-layer*.50)+.30;
      const jamb = add(chunk,tunnelStone,x,y,portalZ-.70-layer*1.48-random()*.38,portal);
      jamb.scale.set(.64+random()*.43,.50+random()*.43,.86+random()*.65);
      jamb.rotation.set(random()*.81,random()*turn,angle+(random()-.5)*.9);
    }
  }
  add(chunk,tunnelStone,0,-.38,portalZ-6.55,portal).scale.set(2.7,.91,1.55);
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 128;
  const glowContext = glowCanvas.getContext('2d');
  const glowGradient = glowContext.createRadialGradient(64,64,2,64,64,62);
  glowGradient.addColorStop(0,'rgba(255,112,45,.32)');
  glowGradient.addColorStop(.33,'rgba(236,69,22,.12)');
  glowGradient.addColorStop(1,'rgba(230,45,11,0)');
  glowContext.fillStyle = glowGradient;
  glowContext.fillRect(0,0,128,128);
  const glowMap = new THREE.CanvasTexture(glowCanvas);
  glowMap.colorSpace = THREE.SRGBColorSpace;
  const glow = add(new THREE.PlaneGeometry(7.3,3.6),new THREE.MeshBasicMaterial({
    map:glowMap,transparent:true,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending,
  }),0,.78,portalZ-2.65,portal);
  glow.receiveShadow = false;
  const cavernBounce = new THREE.PointLight(0xff6027,37,6.5,2);
  cavernBounce.position.set(0,.16,portalZ-2.1);
  portal.add(cavernBounce);
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

  const bowl = new THREE.CylinderGeometry(.48,.30,.24,16);
  const flames = [];
  const fire = new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{time:{value:0}},
    vertexShader:`
      varying vec2 p;
      void main() { p=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
    `,
    fragmentShader:`
      varying vec2 p;
      uniform float time;
      float tongue(vec2 coord, float phase, float height, float width) {
        float y = clamp(coord.y/height,0.0,1.0);
        float axis = .11*y*sin(y*7.0-phase)+.066*y*sin(y*13.0+phase*1.7);
        float edge = width*(.26+.84*sin(y*3.14159))*pow(1.0-y,.58);
        return (1.0-smoothstep(edge*.30,edge+.012,abs(coord.x-axis))) *
          smoothstep(0.0,.13,y)*(1.0-smoothstep(.82,1.0,y));
      }
      void main() {
        vec2 uv = p-vec2(.5,0.0);
        float phase = time*5.7;
        float main = tongue(uv,phase,.92+.07*sin(phase),.23);
        float left = tongue(uv+vec2(.15,.03),phase+2.8,.58+.10*cos(phase*1.3),.14);
        float right = tongue(uv-vec2(.14,.035),phase+4.1,.55+.13*sin(phase*.83),.16);
        float flame = max(main,max(left,right));
        float core = smoothstep(.10,.76,flame)*(1.0-smoothstep(.18,.66,p.y));
        vec3 color = mix(vec3(1.0,.16,.007),vec3(1.0,.92,.39),core*.92);
        gl_FragColor = vec4(color,smoothstep(.018,.46,flame)*.97);
        #include <colorspace_fragment>
      }
    `,
  });
  const flameSheet = new THREE.PlaneGeometry(1.85,1.78).translate(0,.89,0);
  const flameGeometry = new THREE.ShapeGeometry(flameShape());
  function mountTorch(parent,x,y,z) {
    add(bowl,metal,x,y+.11,z,parent);
    const burner = new THREE.Group();
    burner.position.set(x,y+.20,z);
    for (let i=0;i<3;i++) {
      const sheet = add(flameSheet,fire,0,0,0,burner);
      sheet.rotation.y = i*Math.PI/3;
      sheet.receiveShadow = false;
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
  const wallFace = material(0x8b8280,{...stone,bumpScale:.13});
  const mortar = material(0x575155,{...stone,bumpScale:.10});
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

  const stoneFill = new THREE.DirectionalLight(0xb9c9ed,.65);
  stoneFill.position.set(-7,9,11);
  group.add(stoneFill);
  for (const [x,z] of [[-10.5,-5.1],[-8.9,-10.8]]) {
    add(new THREE.CylinderGeometry(.38,.57,1.62,6),dressedStone,x,-.28,z);
    mountTorch(group,x,.55,z);
  }
  const poolGlow = new THREE.PointLight(0xff6921,32,7.5,2);
  poolGlow.position.set(-7.8,-.12,9.5);
  group.add(poolGlow);
  const lavaBounce = new THREE.PointLight(0xff601e,177,13,2);
  lavaBounce.position.set(-13.4,5.4,-19.9);
  group.add(lavaBounce);
  const skylight = new THREE.PointLight(0x82b6ff,305,25,2);
  skylight.position.set(-6.7,13.3,-16.8);
  group.add(skylight);
  for (const side of [-1,1]) {
    const wallBounce = new THREE.PointLight(0xff8742,53,8,2);
    wallBounce.position.set(side*8,.75,-9.05);
    group.add(wallBounce);
  }
  const gateLight = new THREE.PointLight(0xff883d,34,8,2);
  gateLight.position.set(0,1.05,-13.05);
  group.add(gateLight);

  const viewPosition = new THREE.Vector3();
  return {
    update(time,reducedMotion,wide,cameraPosition) {
      const t = reducedMotion ? 0 : time*.001;
      lava.uniforms.time.value = t;
      lavaPool.uniforms.time.value = t;
      fire.uniforms.time.value = t;
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
        burner.scale.set(.50+.035*Math.sin(t*7+i),.61+.064*Math.sin(t*9+i*2),.50);
        burner.rotation.y = i+t*.31;
      }
    },
    floorY:floorHeight,
    createStation,
    dispose() {
      paving.map.dispose();
      paving.bumpMap.dispose();
      stone.map.dispose();
      stone.bumpMap.dispose();
      glowMap.dispose();
    },
  };
}
