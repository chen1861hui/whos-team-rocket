import * as THREE from '/vendor/three.module.js';

export const grassGymLeaderStation = {radius:11.85,height:.48};
const turn = Math.PI*2;

function randomFrom(seed) {
  return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
}

function grainMap(wood) {
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=256;
  const context=canvas.getContext('2d');
  const image=context.createImageData(256,256);
  const random=randomFrom(wood ? 47 : 63);
  for (let y=0;y<256;y++) for (let x=0;x<256;x++) {
    const i=(x+y*256)*4;
    const grain=wood
      ? 14*Math.sin(x*.26+1.8*Math.sin(y*.027))+8*Math.sin(x*.92+y*.015)
      : 7*Math.sin(x*.14+y*.056)*Math.cos(y*.17-x*.071)+8*Math.sin(x*.39+y*.34)*Math.cos(y*.24);
    const shade=213+grain+(random()-.5)*(wood ? 20 : 33);
    image.data.set([shade,shade,shade,255],i);
  }
  context.putImageData(image,0,0);
  const map=new THREE.CanvasTexture(canvas);
  map.colorSpace=THREE.SRGBColorSpace;
  map.wrapS=map.wrapT=THREE.RepeatWrapping;
  map.anisotropy=4;
  return map;
}

function leafShape() {
  const leaf=new THREE.Shape();
  leaf.moveTo(0,0);
  leaf.bezierCurveTo(-.34,.50,-.17,.95,.66,1.23);
  leaf.bezierCurveTo(.78,.55,.54,.14,0,0);
  return leaf;
}

export function createGrassGym(scene,sceneryAngle,refresh) {
  const root=new THREE.Group();
  root.rotation.y=sceneryAngle;
  scene.add(root);
  const random=randomFrom(143);
  let disposed=false;
  const timber=grainMap(true), grit=grainMap(false);
  const mat=(color,opts={})=>new THREE.MeshStandardMaterial({color,roughness:.82,...opts});
  const mortar=mat(0x8d857e);
  const add=(geometry,material,x=0,y=0,z=0,parent=root,shadow=false)=>{
    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.set(x,y,z);
    mesh.castShadow=shadow;
    mesh.receiveShadow=true;
    parent.add(mesh);
    return mesh;
  };
  const box=(w,h,d,material,x,y,z,parent=root,shadow=true)=>add(new THREE.BoxGeometry(w,h,d),material,x,y,z,parent,shadow);
  const cylinder=(top,bottom,height,material,x,y,z,parent=root,sides=48)=>add(
    new THREE.CylinderGeometry(top,bottom,height,sides),material,x,y,z,parent,true);
  const horizontal=new THREE.Vector3(0,1,0);
  function join(a,b,width,material,parent=root,sides=7) {
    const start=new THREE.Vector3(...a), end=new THREE.Vector3(...b), axis=end.clone().sub(start);
    const mid=start.addScaledVector(axis,.5);
    const part=cylinder(width*.71,width,axis.length(),material,mid.x,mid.y,mid.z,parent,sides);
    part.quaternion.setFromUnitVectors(horizontal,axis.normalize());
    return part;
  }

  // Shallow concentric courses, with staggered stone joints and a flush leaf medallion.
  const floorY=.22;
  const apronRadius=angle=>11.32+.37*Math.sin(angle*3+.35)+.24*Math.sin(angle*7+.6);
  function apronCourse(radiusOffset,y,depth,material){
    const points=Array.from({length:112},(_,i)=>{
      const a=i*turn/112,r=apronRadius(a)+radiusOffset;
      return new THREE.Vector2(Math.sin(a)*r,Math.cos(a)*r);
    });
    const footing=new THREE.ExtrudeGeometry(new THREE.Shape(points),{depth,bevelEnabled:true,
      bevelSize:.045,bevelThickness:.035,bevelSegments:2}).rotateX(-Math.PI/2);
    add(footing,material,0,y,0);
  }
  apronCourse(-.12,-.48,.56,mortar);
  const paving=Array.from({length:7},(_,i)=>mat([0xbdbab3,0xb2b0aa,0xc0bcb5,0xa9a89f,0xb7b4ad,0xc1bbb0,0xaaa99e][i],
    {map:grit,bumpMap:grit,bumpScale:.036}));
  // Irregular flagstones are clipped against their neighbours and the apron.
  const apron=[];
  for(let i=0;i<112;i++){
    const a=i*turn/112,r=apronRadius(a);
    apron.push([Math.sin(a)*r,Math.cos(a)*r]);
  }
  const flagstoneRandom=randomFrom(415);
  const seeds=[];
  for(let row=-6;row<=6;row++) for(let col=-6;col<=6;col++){
    const x=(col+(row%2)*.47)*2.18+(flagstoneRandom()-.5)*1.03;
    const z=row*1.99+(flagstoneRandom()-.5)*.83;
    if(Math.hypot(x,z)<13.8) seeds.push({x,z});
  }
  function cutStone(polygon,dx,dz,offset){
    const result=[];
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i], b=polygon[(i+1)%polygon.length];
      const h=offset-dx*a[0]-dz*a[1], k=offset-dx*b[0]-dz*b[1];
      if(h>=0) result.push(a);
      if((h>=0)!==(k>=0)){
        const t=h/(h-k);
        result.push([THREE.MathUtils.lerp(a[0],b[0],t),THREE.MathUtils.lerp(a[1],b[1],t)]);
      }
    }
    return result;
  }
  apronCourse(.015,floorY-.133,.066,mortar);
  for(const seed of seeds){
    if(Math.hypot(seed.x,seed.z)<2.10) continue;
    let polygon=apron;
    for(const other of seeds){
      if(other===seed) continue;
      const dx=other.x-seed.x,dz=other.z-seed.z,dist=Math.hypot(dx,dz);
      const offset=(other.x**2+other.z**2-seed.x**2-seed.z**2)*.5-dist*.019;
      polygon=cutStone(polygon,dx,dz,offset);
      if(polygon.length<3) break;
    }
    if(polygon.length<3) continue;
    const outline=new THREE.Shape();
    for(let i=0;i<polygon.length;i++){
      const [x,z]=polygon[i], [nextX,nextZ]=polygon[(i+1)%polygon.length];
      if(i===0) outline.moveTo(x,z); else outline.lineTo(x,z);
      const wobble=(flagstoneRandom()-.5)*.076;
      outline.lineTo((x+nextX)*.5+(nextZ-z)*wobble,(z+nextZ)*.5-(nextX-x)*wobble);
    }
    outline.closePath();
    const geometry=new THREE.ShapeGeometry(outline);
    const {position,uv}=geometry.attributes;
    for(let i=0;i<uv.count;i++) uv.setXY(i,position.getX(i)*.51,position.getY(i)*.51);
    geometry.rotateX(-Math.PI/2);
    add(geometry,paving[Math.floor(flagstoneRandom()*paving.length)],0,floorY-(flagstoneRandom()-.5)*.009,0);
  }
  const inlay=mat(0x93988a,{map:grit,side:THREE.DoubleSide});
  const vein=mat(0xc5bbaa,{map:grit,side:THREE.DoubleSide});
  cylinder(3.43,3.43,.031,paving[2],0,floorY-.001,0);
  add(new THREE.RingGeometry(3.03,3.23,96).rotateX(-Math.PI/2),inlay,0,floorY+.017,0);
  const floorLeaf=new THREE.Shape();
  floorLeaf.moveTo(-1.75,.87);
  floorLeaf.bezierCurveTo(-2.04,-.66,-.34,-1.25,1.50,-1.46);
  floorLeaf.bezierCurveTo(1.24,.15,.20,1.35,-1.75,.87);
  add(new THREE.ShapeGeometry(floorLeaf).rotateX(-Math.PI/2),inlay,0,floorY+.019,0);
  const leafVeins=[
    [[-1.32,.90],[-.55,.28],[.21,-.34],[1.09,-1.04]],
    [[-.52,.25],[-.91,-.01],[-1.09,-.42]],
    [[.03,-.18],[.08,-.51],[.19,-.83]],
    [[.33,-.44],[.69,-.41],[1.00,-.49]],
  ];
  for(const points of leafVeins){
    const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,floorY+.024,z)));
    add(new THREE.TubeGeometry(curve,10,.021,5,false),vein);
  }

  const shadeCanvas=document.createElement('canvas');
  shadeCanvas.width=shadeCanvas.height=256;
  const shadeContext=shadeCanvas.getContext('2d');
  const dapple=randomFrom(494);
  for(let i=0;i<620;i++){
    const angle=dapple()*turn;
    const r=Math.sqrt(dapple());
    const x=128+Math.cos(angle)*124*r;
    const y=128+Math.sin(angle)*118*r;
    const size=2.5+dapple()*13;
    const spot=shadeContext.createRadialGradient(x,y,0,x,y,size);
    spot.addColorStop(0,'rgba(52,61,79,'+(.10+(1-r)*.26)+')');
    spot.addColorStop(1,'rgba(52,61,79,0)');
    shadeContext.fillStyle=spot;
    shadeContext.fillRect(x-size,y-size,size*2,size*2);
  }
  const shadeMap=new THREE.CanvasTexture(shadeCanvas);
  shadeMap.colorSpace=THREE.SRGBColorSpace;
  const shadow=add(new THREE.PlaneGeometry(13.8,14.3).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({
    map:shadeMap,transparent:true,opacity:.58,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,
  }),-6.02,floorY+.005,3.9);
  shadow.rotation.y=-.37;

  const stoneSurfaces=[];
  const rockMap=new THREE.TextureLoader().load('/coastal-limestone.webp',texture=>{
    if(disposed) return;
    const neutral=document.createElement('canvas');
    neutral.width=texture.image.width;
    neutral.height=texture.image.height;
    const paint=neutral.getContext('2d');
    paint.filter='grayscale(94%) brightness(112%)';
    paint.drawImage(texture.image,0,0);
    texture.image=neutral;
    texture.needsUpdate=true;
    for(const surface of stoneSurfaces) {
      surface.map=texture;
      surface.bumpMap=texture;
    }
    refresh?.();
  });
  rockMap.colorSpace=THREE.SRGBColorSpace;
  rockMap.wrapS=rockMap.wrapT=THREE.RepeatWrapping;
  rockMap.anisotropy=5;
  function stoneSurface(color,bumpScale=.08) {
    const surface=mat(color,{map:grit,bumpMap:grit,bumpScale,roughness:.93});
    stoneSurfaces.push(surface);
    return surface;
  }
  for(const surface of paving) stoneSurfaces.push(surface);
  const limestone=stoneSurface(0xc8bfb0,.095);
  const stoneColors=[0xb1afa8,0xa09f95,0xbdbab3,0xa6a499,0xb4b0a5];
  const moss=mat(0x657447,{map:grit,bumpMap:grit,bumpScale:.096});
  const soil=mat(0x586140,{map:grit,bumpMap:grit,bumpScale:.10});
  const bark=mat(0x9c8069,{map:timber,bumpMap:timber,bumpScale:.16});
  const barkMap=new THREE.TextureLoader().load('/grass-bark.webp',texture=>{
    if(disposed) return;
    bark.map=texture;
    bark.bumpMap=texture;
    refresh?.();
  });
  barkMap.colorSpace=THREE.SRGBColorSpace;
  barkMap.wrapS=barkMap.wrapT=THREE.RepeatWrapping;
  barkMap.anisotropy=5;
  function trailCenter(z){return 2.12*Math.sin(Math.max(0,-z-12)*.24);}
  function groundHeight(x,z){
    const r=Math.hypot(x,z), a=Math.atan2(x,z);
    const shoulder=THREE.MathUtils.smoothstep(r,11.3,15.55);
    const hills=.83+.72*Math.sin(a*3+.64)**2+.58*Math.cos(a*5-1.14)**2;
    const fade=1-THREE.MathUtils.smoothstep(r,27,49);
    const trailCut=z<-11.7 ? 1-THREE.MathUtils.smoothstep(Math.abs(x-trailCenter(z)),1.5,3.55) : 0;
    const coarse=Math.sin(x*.43+z*.34)*Math.cos(z*.38-x*.17);
    const fine=Math.sin(x*1.13+z*.75)*Math.cos(z*.87-x*.51);
    return -.66+(1-trailCut*.94)*shoulder*(hills*fade+.31*coarse+.105*fine);
  }
  const hills=new THREE.PlaneGeometry(112,112,186,186).rotateX(-Math.PI/2);
  const hillsPosition=hills.attributes.position, hillsUv=hills.attributes.uv;
  const terrainColors=new Float32Array(hillsPosition.count*3);
  const turfLight=new THREE.Color(0x9b9d67), turfDark=new THREE.Color(0x555d38);
  const terrainTint=new THREE.Color();
  for(let i=0;i<hillsPosition.count;i++){
    const x=hillsPosition.getX(i),z=hillsPosition.getZ(i);
    hillsPosition.setY(i,groundHeight(x,z));
    hillsUv.setXY(i,x*.61,z*.61);
    const patch=.5+.24*Math.sin(x*.48+z*.614)+.21*Math.cos(x*1.29-z*.86);
    terrainTint.copy(turfDark).lerp(turfLight,patch);
    terrainTint.toArray(terrainColors,i*3);
  }
  hills.setAttribute('color',new THREE.BufferAttribute(terrainColors,3));
  hills.computeVertexNormals();
  add(hills,mat(0xffffff,{map:grit,bumpMap:grit,bumpScale:.21,vertexColors:true}));

  const chipped=new THREE.Shape([
    [-.48,-.35],[-.39,-.49],[.42,-.47],[.50,-.37],[.48,.36],[.31,.48],[-.39,.46],[-.51,.31],
  ].map(([x,y])=>new THREE.Vector2(x,y)));
  const rockBlock=new THREE.ExtrudeGeometry(chipped,{depth:.88,bevelEnabled:true,bevelSize:.052,
    bevelThickness:.051,bevelSegments:2}).translate(0,0,-.44);
  const masonry=stoneColors.map(color=>stoneSurface(color,.105));
  function block(parent,x,y,z,w,h,d,index){
    const stone=add(rockBlock,masonry[index%masonry.length],x,y,z,parent,true);
    stone.scale.set(w,h,d);
    stone.rotation.z=(random()-.5)*.065;
    return stone;
  }

  // The ring of voussoirs remains a real, open doorway from every seat.
  const arch=new THREE.Group();
  arch.position.z=-13.40;
  arch.scale.set(1.34,1.35,1.08);
  root.add(arch);
  const inner=3.27, outer=5.31, spring=2.04;
  function archCourse(inside,outside,z,depth,count,offset){
    for(let i=0;i<count;i++){
      const a=i*Math.PI/count+.011,b=(i+1)*Math.PI/count-.011;
      const bulge=.061*Math.sin(i*4.2+offset);
      const outsideEdge=outside+bulge;
      const wedge=new THREE.Shape();
      wedge.moveTo(Math.cos(a)*inside,spring+Math.sin(a)*inside);
      wedge.absarc(0,spring,inside,a,b,false);
      wedge.lineTo(Math.cos(b)*outsideEdge,spring+Math.sin(b)*outsideEdge);
      wedge.absarc(0,spring,outsideEdge,b,a,true);
      wedge.closePath();
      const shape=new THREE.ExtrudeGeometry(wedge,{depth:depth+random()*.052,bevelEnabled:true,
        bevelSize:.075,bevelThickness:.055,bevelSegments:2,curveSegments:8});
      const uv=shape.attributes.uv;
      for(let j=0;j<uv.count;j++) uv.setXY(j,uv.getX(j)*.57,uv.getY(j)*.57);
      add(shape,masonry[(i+offset)%masonry.length],0,0,z,arch,true);
    }
  }
  // A wide load-bearing ring, a proud face course, and a recessed lining give the opening depth.
  archCourse(inner+.12,outer,-1.68,2.33,13,0);
  archCourse(inner+.27,outer-.03,.60,.57,11,1);
  archCourse(inner,inner+.43,-1.74,2.04,15,3);
  archCourse(inner+.07,inner+.30,.23,.27,15,2);
  for(const side of [-1,1]){
    for(let row=0;row<3;row++){
      const width=1.96+(.15*(2-row));
      block(arch,side*(4.19+.12*(2-row)),.05+row*.80,-.43,width,.80,2.49,row+2);
      block(arch,side*(4.30+.07*(2-row)),.04+row*.80,.87,width-.10,.78,.70,row+3);
      block(arch,side*3.46,.04+row*.80,-.58,.39,.75,1.94,row+1);
    }
    block(arch,side*4.25,-.38,.03,2.56,.57,3.06,3);
    block(arch,side*4.24,1.99,.10,2.14,.36,2.74,1);
    const footing=block(arch,side*5.26,.34,.28,1.16,1.37,1.87,4);
    footing.rotation.z=side*.11;
  }
  const crest=new THREE.Group();
  crest.position.set(0,6.75,1.30);
  arch.add(crest);
  const patina=mat(0x3c6a59,{map:grit,metalness:.26,roughness:.69,bumpMap:grit,bumpScale:.091});
  const bronze=mat(0x9b865d,{map:grit,metalness:.30,roughness:.54,bumpMap:grit,bumpScale:.049});
  const relief=mat(0x9cb489,{map:grit,metalness:.16,roughness:.60,bumpMap:grit,bumpScale:.039,emissive:0x33472a,emissiveIntensity:.24});
  cylinder(1.30,1.34,.31,masonry[1],0,0,-.087,crest,64).rotation.x=Math.PI/2;
  cylinder(1.205,1.248,.235,bronze,0,0,.080,crest,64).rotation.x=Math.PI/2;
  cylinder(1.096,1.117,.084,patina,0,0,.205,crest,64).rotation.x=Math.PI/2;
  add(new THREE.TorusGeometry(1.102,.049,10,72),bronze,0,0,.242,crest,true);
  add(new THREE.TorusGeometry(1.003,.012,6,72),bronze,0,0,.257,crest);
  for(let i=0;i<20;i++){
    const a=i*turn/20;
    const stud=add(new THREE.SphereGeometry(.014,8,6),bronze,Math.sin(a)*1.155,Math.cos(a)*1.155,.212,crest);
    stud.scale.z=.55;
  }
  // The Grass type icon is a single pointed blade with a diagonal stem and six veins.
  const emblem=new THREE.Shape();
  emblem.moveTo(-.70,-.58);
  emblem.bezierCurveTo(-.76,-.25,-.64,.16,-.26,.44);
  emblem.bezierCurveTo(.01,.65,.39,.72,.74,.72);
  emblem.bezierCurveTo(.75,.35,.68,.02,.46,-.27);
  emblem.bezierCurveTo(.19,-.63,-.30,-.72,-.70,-.58);
  emblem.closePath();
  const castLeaf=new THREE.ExtrudeGeometry(emblem,{depth:.066,bevelEnabled:true,bevelSize:.031,
    bevelThickness:.029,bevelSegments:3,curveSegments:12});
  add(castLeaf,relief,0,0,.258,crest,true);
  const veins=[
    [[-.78,-.71],[-.48,-.46],[-.15,-.18],[.16,.13],[.54,.51]],
    [[-.50,-.45],[-.56,-.29],[-.56,-.17]], [[-.32,-.30],[-.37,-.08],[-.35,.03]],
    [[-.10,-.13],[-.11,.14],[-.08,.26]], [[.13,.09],[.14,.29],[.18,.41]],
    [[-.36,-.34],[-.10,-.32],[.07,-.30]], [[-.10,-.14],[.13,-.15],[.34,-.10]],
    [[.16,.11],[.33,.07],[.49,.14]],
  ];
  for(const [index,points] of veins.entries()){
    const curve=new THREE.CatmullRomCurve3(points.map(([x,y])=>new THREE.Vector3(x,y,.345)));
    add(new THREE.TubeGeometry(curve,9,index ? .009 : .021,6,false),bronze,0,0,0,crest);
  }

  // A broad landing keeps Erika on the arch's centerline, in front of the trail.
  const platformY=grassGymLeaderStation.height+.41;
  box(3.92,.19,2.58,limestone,0,platformY-.095,-11.95);
  for(let i=0;i<3;i++){
    const height=(i+1)*(platformY-.19)/3;
    box(4.20-i*.14,height,2.0-i*.47,masonry[(i+1)%masonry.length],0,height*.5,-10.42-i*.23);
  }
  const dirt=mat(0xa99874,{map:grit,bumpMap:grit,bumpScale:.19,vertexColors:true});
  const trail=new THREE.PlaneGeometry(1,1,18,78);
  const trailPositions=trail.attributes.position, trailUv=trail.attributes.uv;
  const trailColors=new Float32Array(trailPositions.count*3);
  const trailTint=new THREE.Color(), dirtDark=new THREE.Color(0x89836c);
  for(let i=0;i<trailPositions.count;i++){
    const across=trailUv.getX(i), travel=1-trailUv.getY(i);
    const z=-12.71-travel*23;
    const edge=.15*Math.sin(z*2.8)+.13*Math.sin(z*4.3+across*6);
    const x=trailCenter(z)+(across-.5)*(3.80-travel*1.09+edge);
    const entrance=(1-THREE.MathUtils.smoothstep(travel,0,.16))*.65;
    trailPositions.setXYZ(i,x,groundHeight(x,z)+.036+entrance,z);
    trailUv.setXY(i,x*.55,z*.55);
    const margin=THREE.MathUtils.smoothstep(Math.abs(across-.5),.23,.5);
    trailTint.setHex(0xe1d5b2).lerp(dirtDark,margin*.85);
    trailTint.toArray(trailColors,i*3);
  }
  trail.setAttribute('color',new THREE.BufferAttribute(trailColors,3));
  trail.setIndex(Array.from(trail.index.array).reverse());
  trail.computeVertexNormals();
  add(trail,dirt);

  // Low steps wrap around the apron. The higher retaining rows are set into the banks behind.
  for(let i=0;i<63;i++){
    const a=i*turn/63;
    const angle=Math.atan2(Math.sin(a),Math.cos(a));
    if(Math.abs(Math.PI-Math.abs(angle))<.21) continue;
    const r=apronRadius(a)+.44;
    const x=Math.sin(a)*r,z=Math.cos(a)*r;
    const tread=block(root,x,-.025+.06*Math.sin(a*5),z,1.24,.31,.92,i);
    tread.rotation.y=a+(random()-.5)*.044;
    const skirt=block(root,Math.sin(a)*(r+.53),-.30,Math.cos(a)*(r+.53),1.28,.28,.84,i+2);
    skirt.rotation.y=a;
  }

  // Curved, low retaining walls with uneven upper courses and planted ledges.
  for(const side of [-1,1]){
    for(let i=0;i<16;i++){
      const angle=(19+i*9.94)*Math.PI/180;
      const span=new THREE.Group();
      const radius=13.29+.32*Math.sin(i*.81+side);
      span.position.set(side*Math.sin(angle)*radius,0,-Math.cos(angle)*radius);
      span.rotation.y=-side*angle;
      root.add(span);
      const rows=i<3 ? 4 : i<7 ? (i%2 ? 3 : 5) : i<11 ? 3 : i<14 ? 2 : 1;
      for(let row=0;row<rows;row++){
        const n=row%2 ? 3 : 2;
        for(let j=0;j<n;j++) block(span,(j+.5-n/2)*2.42/n,.02+row*.60,-row*.12,
          2.42/n+.02,.60,.93,(j+i+row)%5);
      }
      if(i%2===0) {
        const cap=add(new THREE.DodecahedronGeometry(1,0),moss,.22,.14+rows*.60,-.14,span);
        cap.scale.set(.91,.15,.44);
      }
    }
  }

  const object=new THREE.Object3D(), color=new THREE.Color();
  const boulder=new THREE.DodecahedronGeometry(1,1);
  const rubble=new THREE.InstancedMesh(boulder,mat(0xffffff,{map:grit,bumpMap:grit,bumpScale:.14}),156);
  for(let i=0;i<rubble.count;i++){
    const a=i*2.39996,r=i<96 ? 12.3+random()*6.2 : 20+random()*18;
    let x=Math.sin(a)*r;
    const z=Math.cos(a)*r;
    if(z<-12.7 && Math.abs(x-trailCenter(z))<2.1) x=trailCenter(z)+(x<trailCenter(z) ? -2.15 : 2.15);
    const size=.22+random()*.80;
    object.position.set(x,groundHeight(x,z)+size*.06,z);
    object.scale.set(size*1.35,size*.70,size);
    object.rotation.set(random(),a,random()*.4);
    object.updateMatrix();
    rubble.setMatrixAt(i,object.matrix);
    rubble.setColorAt(i,color.setHex(i%3 ? 0x777b56 : 0x969083));
  }
  rubble.receiveShadow=true;
  root.add(rubble);

  const clusters=[];
  const crowns=[];
  // Two close trunks bookend the arch; the remaining trees carry the same foliage into every seat's view.
  const trees=[[-13.4,-9.7,1.62,12.20],[13.3,-10.8,1.56,12.55]];
  const smallerTrees=[
    [-9.8,-19.4,.66,7.5],[-16.8,-16.1,.48,8.8],[-14.2,-20.7,.54,6.8],
    [7.8,-20.9,.61,8.5],[12.2,-19.2,.50,7.2],[17.7,-17.3,.67,9.15],
    [-17.9,-7.4,.53,8.0],[18.1,-5.8,.38,6.45],[19.1,1.4,.61,9.1],
    [-17.4,5.2,.58,9.4],[16.8,10.9,.48,8.2],[-14.2,14.3,.63,8.45],
  ];
  trees.push(...smallerTrees);
  for(let i=0;i<21;i++){
    const a=i*2.39996,r=23.2+random()*12.3;
    const x=Math.sin(a)*r,z=Math.cos(a)*r;
    if(z<-13 && Math.abs(x)<4.15) continue;
    trees.push([x,z,.33+random()*.43,6.7+random()*6.4]);
  }
  function taper(points,width,endWidth,phase) {
    const curve=new THREE.CatmullRomCurve3(points.map(point=>new THREE.Vector3(...point)));
    const steps=18, sides=12;
    const geometry=new THREE.TubeGeometry(curve,steps,1,sides,false);
    const position=geometry.attributes.position, uv=geometry.attributes.uv;
    const vertex=new THREE.Vector3();
    for(let ring=0;ring<=steps;ring++) {
      const t=ring/steps, center=curve.getPointAt(t);
      for(let side=0;side<=sides;side++) {
        const i=ring*(sides+1)+side;
        const ridges=1+.085*Math.cos(side*turn/sides*5+phase)+.038*Math.cos(side*turn/sides*3+t*4);
        const radius=THREE.MathUtils.lerp(width,endWidth,t)*ridges*(1+.21*Math.exp(-t*12));
        vertex.fromBufferAttribute(position,i).sub(center).multiplyScalar(radius).add(center);
        position.setXYZ(i,vertex.x,vertex.y,vertex.z);
        uv.setXY(i,side/sides*2.05,t*2.46);
      }
    }
    geometry.computeVertexNormals();
    return add(geometry,bark,0,0,0,root,true);
  }
  function trunk(x,z,r,h) {
    const mature=r>1;
    const lean=mature ? -Math.sign(x)*2.23 : (random()-.5)*2.85;
    const roll=(random()-.5)*1.75;
    const start=groundHeight(x,z)-.16;
    const points=[[x,start,z],[x+lean*.16,start+h*.24,z+roll*.22],
      [x+lean*.49,start+h*.52,z+roll*.43],[x+lean*.91,start+h*.80,z+roll],
      [x+lean,start+h,z+roll*1.25]];
    taper(points,r,mature ? r*.15 : r*.062,x+z);
    const rootCount=mature ? 7 : 3;
    for(let i=0;i<rootCount;i++){
      const theta=i*turn/rootCount+x*.14,d=r*(1.72+random()*.95);
      const dx=Math.cos(theta)*d,dz=Math.sin(theta)*d;
      taper([[x,start+r*.56,z],[x+dx*.50,groundHeight(x+dx*.5,z+dz*.5)+r*.16,z+dz*.5],
        [x+dx,groundHeight(x+dx,z+dz)-.15,z+dz]],r*.48,r*.067,theta);
    }
    const count=mature ? 9 : 5+Math.floor(random()*3);
    const turnOffset=random()*turn;
    for(let i=0;i<count;i++){
      const a=i*2.39996+turnOffset+random()*.57;
      const reach=mature ? 3.0+random()*2.0 : 1.44+random()*1.92;
      const origin=points[i===0 ? 1 : i%3===0 ? 3 : 2];
      const xTip=x+lean*.67+Math.cos(a)*reach;
      const yTip=start+h*(.65+random()*.37);
      const zTip=z+roll*.46+Math.sin(a)*reach;
      const tip=[xTip,yTip,zTip];
      const elbow=[origin[0]+(xTip-origin[0])*.58,origin[1]+(yTip-origin[1])*.37,origin[2]+(zTip-origin[2])*.56];
      taper([origin,elbow,tip],r*(mature ? .37 : .40),r*.049,a);
      const branchTip=[xTip+Math.cos(a+.87)*reach*.41,yTip-reach*.13,zTip+Math.sin(a+.87)*reach*.43];
      taper([elbow,[(elbow[0]+branchTip[0])*.5,branchTip[1]-reach*.32,(elbow[2]+branchTip[2])*.5],
        branchTip],r*.136,r*.018,a+.87);
      crowns.push([...branchTip,reach*.51]);
      crowns.push([...tip,reach*.72]);
      if(!mature && i%2===0) {
        const lower=[elbow[0]+(branchTip[0]-elbow[0])*.73,elbow[1]+(branchTip[1]-elbow[1])*.64,
          elbow[2]+(branchTip[2]-elbow[2])*.79];
        crowns.push([...lower,reach*.45]);
      }
    }
    crowns.push([...points.at(-1),mature ? 1.58 : 1.03]);
  }
  for(const [x,z,r,h] of trees) trunk(x,z,r,h);

  // Smaller curved blades with a raised midrib. Many overlapping sprays build each crown.
  function canopyBlade() {
    const vertices=[], uv=[], triangles=[];
    const sections=7;
    for(let i=0;i<=sections;i++){
      const t=i/sections;
      const width=Math.sin(Math.PI*t)**.84*(.29+.038*Math.sin(t*43));
      const curl=.19*t*t+.06*Math.sin(t*Math.PI);
      vertices.push(-width,t,curl-.064,0,t,curl+.038,width,t,curl-.064);
      uv.push(0,t,.5,t,1,t);
      if(i===0) continue;
      const j=i*3;
      triangles.push(j-3,j-2,j,j-2,j+1,j,j-2,j-1,j+1,j-1,j+2,j+1);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geometry.setIndex(triangles);
    geometry.computeVertexNormals();
    return geometry;
  }
  const herb=new THREE.ShapeGeometry(leafShape());
  const foliage=mat(0xffffff,{side:THREE.DoubleSide,roughness:.89,emissive:0x29300b,emissiveIntensity:.22});
  const canopyMaterial=mat(0xffffff,{side:THREE.DoubleSide,roughness:.84,emissive:0x303713,emissiveIntensity:.28});
  const sprayCount=r=>r>1.95 ? 11 : r>1.10 ? 8 : 6;
  const leavesPerSpray=12;
  const leafCount=crowns.reduce((sum,[,,,radius])=>sum+sprayCount(radius)*leavesPerSpray,0);
  const broadleaf=new THREE.InstancedMesh(canopyBlade(),canopyMaterial,leafCount);
  const canopyColors=[0x5c7135,0x758840,0x92a04e,0x687d38,0x9ca958,0x4d6634];
  let leafIndex=0;
  for(const [index,[x,y,z,r]] of crowns.entries()) for(let i=0;i<sprayCount(r);i++){
    const azimuth=i*2.39996+random()*.54;
    const spread=Math.sqrt((i+.5)/sprayCount(r))*r*(.71+random()*.39);
    const dx=Math.sin(azimuth),dz=Math.cos(azimuth);
    const sprayX=x+dx*spread, sprayZ=z+dz*spread;
    const sprayY=y+(1-spread/r)*r*.35+(random()-.53)*r*.91;
    for(let j=0;j<leavesPerSpray;j++){
      const t=j/(leavesPerSpray-1);
      const side=j%2===0 ? -1 : 1;
      const size=(.17+random()*.17)*(r>1.95 ? 1.23 : 1);
      const shift=(t-.5)*(.57+r*.19);
      const across=side*(.052+random()*.21);
      object.position.set(sprayX+dx*shift+dz*across,sprayY+Math.sin(t*Math.PI)*.21+random()*.18,
        sprayZ+dz*shift-dx*across);
      object.scale.set(size*(.85+random()*.26),size,1);
      object.rotation.set(-1.35+random()*1.59,azimuth+side*(.59+random()*.72),side*(.17+random()*.44),'YXZ');
      object.updateMatrix();
      broadleaf.setMatrixAt(leafIndex,object.matrix);
      broadleaf.setColorAt(leafIndex++,color.setHex(canopyColors[(index+i+Math.floor(random()*3))%canopyColors.length]));
    }
  }
  broadleaf.castShadow=true;
  broadleaf.receiveShadow=true;
  root.add(broadleaf);

  // Ivy climbs the outer edges, leaving the lit stone ring and badge readable.
  for(const side of [-1,1]){
    for(let i=0;i<17;i++){
      const t=i/16;
      const angle=side<0 ? Math.PI-t*1.13 : t*1.13;
      const radius=5.03+(random()-.5)*.52;
      clusters.push([Math.cos(angle)*radius,spring+Math.sin(angle)*radius,1.28,.52]);
    }
    for(let i=0;i<7;i++) clusters.push([side*(4.56+random()*.56),.2+i*.27,1.37,.49]);
  }
  const ivyCount=clusters.length;
  for(let i=0;i<203;i++){
    const a=i*2.39996,r=12.33+random()*11.3;
    const x=Math.sin(a)*r,z=Math.cos(a)*r;
    if(z<-12 && Math.abs(x-trailCenter(z))<2.18) continue;
    clusters.push([x,groundHeight(x,z)-.02,z,.72+random()*.70]);
  }
  function plantCreepers(start,end,parent){
    const creepers=new THREE.InstancedMesh(herb,foliage,(end-start)*31);
    for(let index=start;index<end;index++) for(let i=0;i<31;i++){
      const [x,y,z,r]=clusters[index];
      const onArch=index<ivyCount;
      const a=random()*turn,d=Math.sqrt(random())*r;
      object.position.set(x+Math.cos(a)*d,y+random()*.44,z+Math.sin(a)*d*(onArch ? .20 : 1));
      object.scale.setScalar(.19+random()*(onArch ? .20 : .38));
      object.rotation.set(onArch ? (random()-.5)*.92 : -random()*1.38,a,(random()-.5)*1.65,'YXZ');
      object.updateMatrix();
      const id=(index-start)*31+i;
      creepers.setMatrixAt(id,object.matrix);
      creepers.setColorAt(id,color.setHex([0x617a3c,0x789247,0x52703a,0x93a559][(index+i)%4]));
    }
    parent.add(creepers);
  }
  plantCreepers(0,ivyCount,arch);
  plantCreepers(ivyCount,clusters.length,root);

  const fernGeometry=canopyBlade();
  const ferns=new THREE.InstancedMesh(fernGeometry,foliage,52*6*18);
  let fernLeaf=0;
  for(let i=0;i<52;i++){
    const theta=i*2.39996,r=13.15+random()*4.2;
    let x=Math.sin(theta)*r;
    const z=Math.cos(theta)*r;
    if(z<-12.7 && Math.abs(x-trailCenter(z))<2.4) x=trailCenter(z)+(x<0 ? -2.65 : 2.65);
    const ground=groundHeight(x,z);
    for(let frond=0;frond<6;frond++){
      const a=theta+frond*turn/6, reach=.50+random()*.64;
      for(let j=0;j<9;j++) for(const side of [-1,1]){
        const t=(j+1)/10;
        object.position.set(x+Math.sin(a)*reach*t,ground+.08+Math.sin(t*2.12)*reach*.57,z+Math.cos(a)*reach*t);
        object.scale.set(.13,.10+Math.sin(Math.PI*t)*reach*.38,1);
        object.rotation.set(-1.04,a+side*(1.22-t*.54),side*.14,'YXZ');
        object.updateMatrix();
        ferns.setMatrixAt(fernLeaf,object.matrix);
        ferns.setColorAt(fernLeaf++,color.setHex([0x7c9440,0x687e37,0xa4ad52,0x617f40][(i+j)%4]));
      }
    }
  }
  root.add(ferns);

  const flower=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),mat(0xf1eada),960);
  for(let i=0;i<192;i++){
    const a=i*2.39996,r=12.46+random()*5.1, x=Math.sin(a)*r,z=Math.cos(a)*r,y=groundHeight(x,z)+.21+random()*.22;
    for(let j=0;j<5;j++){
      const theta=j*turn/5;
      object.position.set(x+Math.cos(theta)*.049,y,z+Math.sin(theta)*.049);
      object.scale.set(.057,.026,.048);
      object.rotation.set(.2,theta,0);
      object.updateMatrix();
      flower.setMatrixAt(i*5+j,object.matrix);
    }
  }
  root.add(flower);

  const mossCanvas=document.createElement('canvas');
  mossCanvas.width=mossCanvas.height=128;
  const mossContext=mossCanvas.getContext('2d');
  for(let i=0;i<1950;i++){
    const a=random()*turn,r=Math.sqrt(random()),x=64+Math.cos(a)*61*r,y=64+Math.sin(a)*61*r;
    mossContext.fillStyle=i%3 ? 'rgba(89,101,50,'+((1-r)*.38)+')' : 'rgba(122,127,67,'+((1-r)*.52)+')';
    mossContext.fillRect(x,y,1.2+random()*5,1.2+random()*4);
  }
  const mossMap=new THREE.CanvasTexture(mossCanvas);
  mossMap.colorSpace=THREE.SRGBColorSpace;
  const mossDecal=new THREE.MeshBasicMaterial({map:mossMap,transparent:true,depthWrite:false,
    polygonOffset:true,polygonOffsetFactor:-1});
  const patch=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);
  for(let i=0;i<74;i++){
    const a=i*2.39996;
    const r=i<63 ? apronRadius(a)-.15-random()*1.40 : 5.1+random()*4.5;
    const stain=add(patch,mossDecal,Math.sin(a)*r,floorY+.003,Math.cos(a)*r);
    stain.rotation.y=a;
    stain.scale.set(.60+random()*1.85,1,.33+random()*.95);
  }
  const grassBlade=new THREE.ShapeGeometry(new THREE.Shape([
    new THREE.Vector2(-.052,0),new THREE.Vector2(-.016,.66),new THREE.Vector2(.15,.98),
    new THREE.Vector2(.069,.52),new THREE.Vector2(.062,0),
  ]));
  const blades=new THREE.InstancedMesh(grassBlade,foliage,9500);
  let bladeIndex=0;
  for(let i=0;i<1330;i++){
    const a=i*2.39996,r=12.27+random()*22.6, x=Math.sin(a)*r,z=Math.cos(a)*r;
    if(z<-12 && Math.abs(x-trailCenter(z))<1.82) continue;
    for(let j=0;j<7;j++){
      const theta=j*turn/7;
      const px=x+Math.sin(theta)*.21,pz=z+Math.cos(theta)*.22;
      const size=.25+random()*.66;
      object.position.set(px,groundHeight(px,pz)-.035,pz);
      object.rotation.set(-.27-random()*.38,theta,(random()-.5)*.45,'YXZ');
      object.scale.setScalar(size);
      object.updateMatrix();
      blades.setMatrixAt(bladeIndex,object.matrix);
      blades.setColorAt(bladeIndex++,color.setHex([0x788e48,0x526c3d,0x92a356,0x779151][(i+j)%4]));
    }
  }
  blades.count=bladeIndex;
  blades.receiveShadow=true;
  root.add(blades);

  const forestMap=new THREE.TextureLoader().load('/grass-forest.webp',()=>{
    if(disposed) return;
    skyline.visible=true;
    refresh?.();
  });
  forestMap.colorSpace=THREE.SRGBColorSpace;
  forestMap.anisotropy=4;
  forestMap.wrapS=THREE.MirroredRepeatWrapping;
  const skyline=new THREE.Group();
  skyline.visible=false;
  root.add(skyline);
  const radius=49,repeats=4;
  const back=new THREE.CylinderGeometry(radius,radius,radius*turn/(repeats*1.5),112,1,true);
  const uv=back.attributes.uv;
  for(let i=0;i<uv.count;i++) uv.setX(i,uv.getX(i)*repeats);
  add(back,new THREE.MeshBasicMaterial({map:forestMap,side:THREE.BackSide,fog:false,toneMapped:false}),
    0,8.57,0,skyline).rotation.y=Math.PI/4;

  const top=stoneSurface(0xc2bbad,.072);
  const edge=stoneSurface(0xa5a28d,.085);
  const green=mat(0x718754,{map:grit});
  function createPokemonPodium(parent,y) {
    cylinder(1.29,1.36,.185,edge,0,y-.162,0,parent);
    cylinder(1.29,1.30,.071,top,0,y-.045,0,parent);
    add(new THREE.RingGeometry(1.055,1.147,64).rotateX(-Math.PI/2),green,0,y-.006,0,parent);
  }
  function createStation(parent) {
    const dais=new THREE.Group();
    parent.add(dais);
    cylinder(.62,.74,.32,edge,0,.16,0,dais,10);
    cylinder(.69,.69,.09,top,0,.365,0,dais,10);
    return dais;
  }

  const localCamera=new THREE.Vector3();
  return {
    update(time,reduced,wide,cameraPosition) {
      localCamera.copy(cameraPosition).applyAxisAngle(horizontal,-sceneryAngle);
      skyline.position.set(localCamera.x*.55,0,localCamera.z*.55);
      arch.visible=wide || localCamera.z>-12.4 || Math.abs(localCamera.x)>6.85;
    },
    createPokemonPodium,createStation,
    dispose(){disposed=true;timber.dispose();grit.dispose();shadeMap.dispose();forestMap.dispose();rockMap.dispose();barkMap.dispose();mossMap.dispose();},
  };
}
