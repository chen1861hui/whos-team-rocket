import * as THREE from '/vendor/three.module.js';
import {mergeGeometries} from '/vendor/addons/utils/BufferGeometryUtils.js';

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

function fieldNoise(x,y,mask=-1) {
  const ix=Math.floor(x), iy=Math.floor(y);
  const fx=x-ix, fy=y-iy;
  const u=fx*fx*(3-2*fx), v=fy*fy*(3-2*fy);
  const hash=(a,b)=>{
    let n=Math.imul(a&mask,15585457)^Math.imul(b&mask,10258977);
    n=Math.imul(n^(n>>>16),0x7feb352d);
    return ((n^(n>>>15))>>>0)/4294967296;
  };
  const first=THREE.MathUtils.lerp(hash(ix,iy),hash(ix+1,iy),u);
  const second=THREE.MathUtils.lerp(hash(ix,iy+1),hash(ix+1,iy+1),u);
  return THREE.MathUtils.lerp(first,second,v);
}

function flagstoneMaps() {
  const size=512, random=randomFrom(2087);
  const makeImage=()=>{
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=size;
    const paint=canvas.getContext('2d');
    return {canvas,paint,data:paint.createImageData(size,size)};
  };
  const surface=makeImage(), relief=makeImage();
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const u=x/size,v=y/size,offset=(x+y*size)*4;
    const mass=fieldNoise(u*8,v*8,7);
    const weather=fieldNoise((u+mass*.11)*32,(v-mass*.14)*32,31);
    const mineral=fieldNoise(u*128,v*128,127);
    const pores=fieldNoise(u*64+4.7,v*64-11.4,63);
    const pits=1-THREE.MathUtils.smoothstep(pores,.12,.25);
    const grit=(mineral-.5)*26+(random()-.5)*12;
    const light=202+(mass-.5)*26+(weather-.5)*41+grit-pits*24;
    const shade=surface.data.data, height=relief.data.data;
    shade[offset]=light+(weather-.5)*9;
    shade[offset+1]=light+3;
    shade[offset+2]=light+5-(mass-.5)*12;
    shade[offset+3]=255;
    const bump=134+(mass-.5)*12+(weather-.5)*46+(mineral-.5)*42-pits*42;
    height[offset]=height[offset+1]=height[offset+2]=bump;
    height[offset+3]=255;
  }
  const [albedo,bump]=[surface,relief].map(({canvas,paint,data})=>{
    paint.putImageData(data,0,0);
    const texture=new THREE.CanvasTexture(canvas);
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.anisotropy=8;
    return texture;
  });
  albedo.colorSpace=THREE.SRGBColorSpace;
  return {albedo,bump};
}

function forestFloorMaps() {
  const size=512;
  const makeCanvas=()=>{
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=size;
    return canvas.getContext('2d');
  };
  const paint=makeCanvas(), relief=makeCanvas();
  const colorPixels=paint.createImageData(size,size), heightPixels=relief.createImageData(size,size);
  const random=randomFrom(2903);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const u=x/size, v=y/size, i=(y*size+x)*4;
    const humus=fieldNoise(u*16,v*16,15);
    const aggregate=fieldNoise(u*64,v*64,63);
    const fine=fieldNoise(u*128,v*128,127);
    const damp=fieldNoise((u+.29)*8,(v+.63)*8,7)*.68+humus*.32;
    const grain=(humus-.5)*25+(aggregate-.5)*35+(fine-.5)*26+(random()-.5)*14;
    colorPixels.data[i]=99+grain-damp*9;
    colorPixels.data[i+1]=80+grain+damp*9;
    colorPixels.data[i+2]=58+grain+damp*3;
    colorPixels.data[i+3]=255;
    const height=131+(aggregate-.5)*51+(fine-.5)*33+(humus-.5)*19;
    heightPixels.data[i]=heightPixels.data[i+1]=heightPixels.data[i+2]=height;
    heightPixels.data[i+3]=255;
  }
  paint.putImageData(colorPixels,0,0);
  relief.putImageData(heightPixels,0,0);

  const leafSpecks=['#82674a','#a68a58','#62462e','#94754c','#b19a70','#654e34'];
  const stoneSpecks=['#aca38c','#787466','#9b9480','#c4b69b'];
  const mossSpecks=['#737f4d','#626e42','#889753','#56633b'];
  function scatter(count,colors,kind){
    for(let i=0;i<count;i++){
      const x=random()*size,y=random()*size,rotation=random()*turn;
      const scale=kind==='leaf' ? 3+random()**1.7*14 : 1.4+random()**1.8*(kind==='moss' ? 10 : 7);
      const width=scale*(.21+random()*.45);
      const color=colors[Math.floor(random()*colors.length)];
      const opacity=.35+random()*.46, extent=scale+2;
      const xOffsets=[0],yOffsets=[0];
      if(x<extent) xOffsets.push(size);
      if(x>size-extent) xOffsets.push(-size);
      if(y<extent) yOffsets.push(size);
      if(y>size-extent) yOffsets.push(-size);
      for(const dx of xOffsets) for(const dy of yOffsets){
        for(const [context,fill,alpha] of [[paint,color,opacity],[relief,'#c3c3c3',opacity*.72]]){
          context.save();
          context.translate(x+dx,y+dy);
          context.rotate(rotation);
          context.globalAlpha=alpha;
          context.fillStyle=fill;
          context.beginPath();
          context.moveTo(-scale*.47,0);
          if(kind==='stone'){
            context.lineTo(-scale*.20,-width);
            context.lineTo(scale*.39,-width*.61);
            context.lineTo(scale*.51,width*.27);
            context.lineTo(scale*.13,width*.85);
            context.lineTo(-scale*.37,width*.43);
          } else {
            context.quadraticCurveTo(-scale*.26,-width,scale*.55,-width*.10);
            context.quadraticCurveTo(scale*.19,width*1.08,-scale*.47,0);
          }
          context.closePath();
          context.fill();
          if(context===paint && kind==='leaf'){
            context.strokeStyle='#4b3727';
            context.lineWidth=.65;
            context.globalAlpha=opacity*.62;
            context.beginPath();
            context.moveTo(-scale*.41,0);
            context.quadraticCurveTo(scale*.06,-width*.15,scale*.41,-width*.09);
            context.stroke();
          }
          context.restore();
        }
      }
    }
  }
  scatter(1170,mossSpecks,'moss');
  scatter(910,leafSpecks,'leaf');
  scatter(1120,stoneSpecks,'stone');
  const albedo=new THREE.CanvasTexture(paint.canvas), bump=new THREE.CanvasTexture(relief.canvas);
  albedo.colorSpace=THREE.SRGBColorSpace;
  for(const texture of [albedo,bump]){
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.anisotropy=5;
  }
  return {albedo,bump};
}

function bankMossMap() {
  const canvas=document.createElement('canvas');
  const size=256;
  canvas.width=canvas.height=size;
  const paint=canvas.getContext('2d');
  const image=paint.createImageData(size,size);
  const random=randomFrom(1761);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const u=x/size,v=y/size,i=(y*size+x)*4;
    const bed=fieldNoise(u*8,v*8,7), tufts=fieldNoise(u*64,v*64,63);
    const green=(bed-.5)*24+(tufts-.5)*48+(random()-.5)*19;
    image.data[i]=81+green+bed*8;
    image.data[i+1]=95+green+tufts*17;
    image.data[i+2]=49+green*.76;
    image.data[i+3]=255;
  }
  paint.putImageData(image,0,0);
  const map=new THREE.CanvasTexture(canvas);
  map.colorSpace=THREE.SRGBColorSpace;
  map.wrapS=map.wrapT=THREE.RepeatWrapping;
  map.anisotropy=4;
  return map;
}

function turfSurfaceMap() {
  const canvas=document.createElement('canvas');
  const size=512;
  canvas.width=canvas.height=size;
  const paint=canvas.getContext('2d');
  const image=paint.createImageData(size,size);
  const random=randomFrom(5149);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const u=x/size,v=y/size,i=(y*size+x)*4;
    const shade=fieldNoise(u*8,v*8,7), tuft=fieldNoise(u*32,v*32,31);
    const blade=fieldNoise((u+tuft*.035)*128,(v-shade*.034)*128,127);
    const grain=(shade-.5)*24+(tuft-.5)*32+(blade-.5)*29+(random()-.5)*14;
    image.data[i]=82+grain+shade*7;
    image.data[i+1]=105+grain+blade*10;
    image.data[i+2]=50+grain*.70+tuft*11;
    image.data[i+3]=255;
  }
  paint.putImageData(image,0,0);
  const blades=['#5b7538','#71874b','#415931','#8c9b58','#a2ac63','#526d3a'];
  paint.lineCap='round';
  for(let i=0;i<7800;i++){
    const x=random()*size,y=random()*size,heading=random()*turn;
    const length=1.8+random()**1.9*8.4;
    const dx=Math.cos(heading)*length,dy=Math.sin(heading)*length;
    paint.strokeStyle=blades[Math.floor(random()*blades.length)];
    paint.lineWidth=.64+random()*1.40;
    paint.globalAlpha=.29+random()*.51;
    const xOffsets=[0],yOffsets=[0];
    if(x<length) xOffsets.push(size);
    if(x>size-length) xOffsets.push(-size);
    if(y<length) yOffsets.push(size);
    if(y>size-length) yOffsets.push(-size);
    for(const sx of xOffsets) for(const sy of yOffsets){
      const px=x+sx,py=y+sy;
      paint.beginPath();
      paint.moveTo(px,py);
      paint.quadraticCurveTo(px+dx*.39-dy*.18,py+dy*.39+dx*.18,px+dx,py+dy);
      paint.stroke();
    }
  }
  const map=new THREE.CanvasTexture(canvas);
  map.colorSpace=THREE.SRGBColorSpace;
  map.wrapS=map.wrapT=THREE.RepeatWrapping;
  map.anisotropy=6;
  return map;
}

function leafShape() {
  const leaf=new THREE.Shape();
  leaf.moveTo(0,0);
  leaf.bezierCurveTo(-.13,.10,-.31,.10,-.49,.26);
  leaf.quadraticCurveTo(-.49,.39,-.60,.53);
  leaf.quadraticCurveTo(-.36,.56,-.24,.49);
  leaf.quadraticCurveTo(-.24,.76,0,1);
  leaf.quadraticCurveTo(.24,.76,.24,.49);
  leaf.quadraticCurveTo(.40,.57,.58,.54);
  leaf.quadraticCurveTo(.48,.39,.47,.27);
  leaf.bezierCurveTo(.29,.11,.12,.10,0,0);
  return leaf;
}

export function createGrassGym(scene,sceneryAngle,refresh) {
  const root=new THREE.Group();
  root.rotation.y=sceneryAngle;
  scene.add(root);
  const random=randomFrom(143);
  let disposed=false;
  const vegetationClip=new THREE.Plane(new THREE.Vector3(0,1,0),150);
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
  const carvedStone=flagstoneMaps();
  const paving=[0xbfbab3,0xb5b3b0,0xc0bcb6,0xadaea8,0xb9b4ac,0xbdb9b1,0xadaaa1].map(color=>mat(color,
    {map:carvedStone.albedo,bumpMap:carvedStone.bump,bumpScale:.138,roughness:.93}));
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
  const jointStone=mat(0x8b8174,{map:carvedStone.albedo,bumpMap:carvedStone.bump,bumpScale:.08});
  apronCourse(.015,floorY-.123,.066,jointStone);
  const slabGroups=paving.map(()=>[]);
  const fissurePositions=[], fissureIndices=[];
  const stoneDetails=randomFrom(1199);
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
      const wobble=(flagstoneRandom()-.5)*.043;
      outline.lineTo((x+nextX)*.5+(nextZ-z)*wobble,(z+nextZ)*.5-(nextX-x)*wobble);
    }
    outline.closePath();
    const geometry=new THREE.ExtrudeGeometry(outline,{depth:.048,bevelEnabled:true,bevelSize:.016,
      bevelOffset:-.016,bevelThickness:.016,bevelSegments:1,curveSegments:1});
    const {position,uv}=geometry.attributes;
    const slabIndex=Math.floor(flagstoneRandom()*paving.length);
    const lift=(flagstoneRandom()-.5)*.012;
    const tiltX=(stoneDetails()-.5)*.010, tiltZ=(stoneDetails()-.5)*.010;
    const textureShift=stoneDetails();
    const offsetAt=(x,z)=>Math.min(.010,lift+(x-seed.x)*tiltX+(z-seed.z)*tiltZ);
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),z=position.getY(i);
      uv.setXY(i,(x*.88+z*.48)*.43+textureShift,(z*.88-x*.48)*.43+textureShift*.37);
      position.setZ(i,position.getZ(i)-.064+offsetAt(x,z));
    }
    geometry.rotateX(-Math.PI/2);
    geometry.computeVertexNormals();
    slabGroups[slabIndex].push(geometry);

    if(Math.hypot(seed.x,seed.z)<3.8 || stoneDetails()>.44) continue;
    const edge=Math.floor(stoneDetails()*polygon.length);
    const [ax,az]=polygon[edge], [bx,bz]=polygon[(edge+1)%polygon.length];
    const along=.25+stoneDetails()*.46;
    const x=THREE.MathUtils.lerp(ax,bx,along),z=THREE.MathUtils.lerp(az,bz,along);
    const dx=seed.x-x,dz=seed.z-z;
    const length=Math.hypot(dx,dz);
    if(length<.26) continue;
    const nx=-dz/length,nz=dx/length;
    const reach=.31+stoneDetails()*.38;
    const start=fissurePositions.length/3;
    for(let step=0;step<=5;step++){
      const t=step/5;
      const curve=step ? (stoneDetails()-.5)*.14*Math.sin(t*Math.PI) : 0;
      const px=x+dx*(.041+t*reach)+nx*curve,pz=z+dz*(.041+t*reach)+nz*curve;
      const width=(.008+stoneDetails()*.009)*(1-t*.92);
      const y=offsetAt(px,pz)+.0007;
      fissurePositions.push(px+nx*width,y,-pz-nz*width,px-nx*width,y,-pz+nz*width);
      if(step){
        const i=start+step*2;
        fissureIndices.push(i-2,i-1,i,i-1,i+1,i);
      }
    }
  }
  for(const [i,slabs] of slabGroups.entries()){
    if(!slabs.length) continue;
    const mesh=mergeGeometries(slabs);
    add(mesh,paving[i],0,floorY,0);
    for(const slab of slabs) slab.dispose();
  }
  const fissures=new THREE.BufferGeometry();
  fissures.setAttribute('position',new THREE.Float32BufferAttribute(fissurePositions,3));
  fissures.setIndex(fissureIndices);
  fissures.computeVertexNormals();
  add(fissures,mat(0x7f776a,{side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,
    polygonOffsetUnits:-1}),0,floorY,0);
  // All layers use the same floor coordinates and fixed draw depth across camera modes.
  const medallion=new THREE.Group();
  medallion.name='grass-floor-medallion';
  root.add(medallion);
  const inlay=mat(0x909284,{map:grit,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const vein=mat(0xc4bfb1,{map:grit,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const inlayY=floorY+.0145;
  cylinder(3.43,3.43,.031,paving[2],0,floorY-.001,0,medallion);
  add(new THREE.RingGeometry(2.94,3.12,96).rotateX(-Math.PI/2),inlay,0,inlayY,0,medallion);
  const floorLeaf=new THREE.Shape();
  floorLeaf.moveTo(-1.75,.87);
  floorLeaf.bezierCurveTo(-2.04,-.66,-.34,-1.25,1.50,-1.46);
  floorLeaf.bezierCurveTo(1.24,.15,.20,1.35,-1.75,.87);
  add(new THREE.ShapeGeometry(floorLeaf).rotateX(-Math.PI/2),inlay,0,inlayY,0,medallion);
  const leafVeins=[
    [[-1.32,.90],[-.55,.28],[.21,-.34],[1.09,-1.04]],
    [[-.52,.25],[-.91,-.01],[-1.09,-.42]],
    [[.03,-.18],[.08,-.51],[.19,-.83]],
    [[.33,-.44],[.69,-.41],[1.00,-.49]],
  ];
  for(const [index,points] of leafVeins.entries()){
    const curve=new THREE.CatmullRomCurve3(points.map(([x,y])=>new THREE.Vector3(x,y,0)));
    const edges=[[],[]];
    for(let step=0;step<=12;step++){
      const t=step/12, point=curve.getPoint(t), tangent=curve.getTangent(t);
      const w=(index===0 ? .066 : .033)*(1-t*.89);
      edges[0].push(new THREE.Vector2(point.x-tangent.y*w,point.y+tangent.x*w));
      edges[1].push(new THREE.Vector2(point.x+tangent.y*w,point.y-tangent.x*w));
    }
    const ribbon=new THREE.Shape([...edges[0],...edges[1].reverse()]);
    add(new THREE.ShapeGeometry(ribbon).rotateX(-Math.PI/2),vein,0,inlayY,0,medallion);
  }

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
  const limestone=stoneSurface(0xc8bfb0,.095);
  const stoneColors=[0xb1afa8,0xa09f95,0xbdbab3,0xa6a499,0xb4b0a5];
  const soil=mat(0x586140,{map:grit,bumpMap:grit,bumpScale:.10});
  const bark=mat(0xffffff,{map:timber,bumpMap:timber,bumpScale:.15,vertexColors:true,clippingPlanes:[vegetationClip]});
  const barkMap=new THREE.TextureLoader().load('/grass-bark.webp',texture=>{
    if(disposed) return;
    bark.map=texture;
    bark.bumpMap=texture;
    refresh?.();
  });
  barkMap.colorSpace=THREE.SRGBColorSpace;
  barkMap.wrapS=barkMap.wrapT=THREE.RepeatWrapping;
  barkMap.anisotropy=5;
  const banks=[
    [-13.4,-10.8,6.5,6.1,2.52], [-10.1,-17.6,5.25,7.0,1.12],
    [13.4,-11.7,5.8,6.8,2.92], [9.5,-19.6,5.0,8.8,1.31],
  ];
  function bankRise(x,z,r=Math.hypot(x,z)){
    if(r<13.45) return 0;
    let rise=0;
    for(const [cx,cz,spanX,spanZ,height] of banks){
      const u=(x-cx)/spanX,v=(z-cz)/spanZ;
      const distance=u*u+v*v;
      rise+=height*(1-THREE.MathUtils.smoothstep(distance,.08,1.33));
    }
    return rise*THREE.MathUtils.smoothstep(r,13.45,16.6);
  }
  function trailCenter(z){return 2.12*Math.sin(Math.max(0,-z-12)*.24);}
  function trailHalfWidth(z){
    const narrowing=THREE.MathUtils.smoothstep(-z,13.1,35.5);
    const edge=fieldNoise(z*1.15+2.2,6.7)-.5;
    return 1.73-narrowing*.43+edge*.37;
  }
  function groundHeight(x,z){
    const r=Math.hypot(x,z), a=Math.atan2(x,z);
    const shoulder=THREE.MathUtils.smoothstep(r,11.3,15.55);
    const hills=.83+.72*Math.sin(a*3+.64)**2+.58*Math.cos(a*5-1.14)**2;
    const fade=1-THREE.MathUtils.smoothstep(r,27,49);
    const coarse=Math.sin(x*.43+z*.34)*Math.cos(z*.38-x*.17);
    const fine=Math.sin(x*1.13+z*.75)*Math.cos(z*.87-x*.51);
    const rise=bankRise(x,z,r);
    const erosion=rise>0
      ? (fieldNoise(x*.51+12,z*.51-1.5)-.5)*.31+(fieldNoise(x*1.15,z*1.15)-.5)*.14
      : 0;
    const edge=THREE.MathUtils.smoothstep(r,11.8,13.2);
    const textureRelief=edge*fade*((fieldNoise(x*1.38+3.7,z*1.38-6.2)-.5)*.23+
      (fieldNoise(x*2.16,z*2.16)-.5)*.08);
    const outerBank=THREE.MathUtils.smoothstep(r,14.6,18.8)*(1-THREE.MathUtils.smoothstep(r,27,38));
    const undulation=THREE.MathUtils.smoothstep(fieldNoise(x*.30+8.2,z*.30-8.1),.30,.78)-.28;
    const surface=-.66+shoulder*(hills*fade+.31*coarse+.105*fine)+rise*(1+erosion)+textureRelief+
      outerBank*undulation*.78;
    if(z>=-11.8) return surface;
    const depth=-z, across=Math.abs(x-trailCenter(z));
    const trailWidth=trailHalfWidth(z);
    const pathCut=THREE.MathUtils.smoothstep(depth,11.8,12.75)*
      (1-THREE.MathUtils.smoothstep(across,trailWidth+.18,trailWidth+2.32));
    const pathGrade=.71-1.12*THREE.MathUtils.smoothstep(depth,12.7,17.5)
      +.76*THREE.MathUtils.smoothstep(depth,18,35)+.055*Math.sin((depth-13)*.47);
    return THREE.MathUtils.lerp(surface,pathGrade,pathCut);
  }
  const groundSize=112, groundSegments=224;
  const hills=new THREE.PlaneGeometry(groundSize,groundSize,groundSegments,groundSegments).rotateX(-Math.PI/2);
  const hillsPosition=hills.attributes.position, hillsUv=hills.attributes.uv;
  const terrainColors=new Float32Array(hillsPosition.count*3);
  const materialWeights=new Float32Array(hillsPosition.count*4);
  const contacts=new Float32Array(hillsPosition.count);
  const mossContacts=new Float32Array(hillsPosition.count);
  const forestFloor=forestFloorMaps();
  const bankMoss=bankMossMap();
  const turfCover=turfSurfaceMap();
  function groundCover(x,z){
    const moisture=fieldNoise(x*.32+16.2,z*.32-3.4);
    const fine=fieldNoise(x*.90-6.8,z*.90+12.9);
    return THREE.MathUtils.smoothstep(moisture*.73+fine*.27,.21,.77);
  }
  // Stamp soft contact tones where the geometry actually touches the ground.
  const step=groundSize/groundSegments, half=groundSize/2, stride=groundSegments+1;
  function terrainSurface(x,z){
    const u=(x+half)/step,v=(z+half)/step;
    const column=Math.floor(u),row=Math.floor(v);
    const fx=u-column,fz=v-row;
    const a=row*stride+column;
    const nextX=hillsPosition.getY(a+1), nextZ=hillsPosition.getY(a+stride);
    // Follow the same diagonal as the rendered ground triangles.
    if(fx+fz<=1){
      const start=hillsPosition.getY(a);
      return start+(nextX-start)*fx+(nextZ-start)*fz;
    }
    const end=hillsPosition.getY(a+stride+1);
    return end+(nextX-end)*(1-fz)+(nextZ-end)*(1-fx);
  }
  function shadeGround(x,z,radius,strength,mossStrength=0){
    const firstX=Math.max(0,Math.ceil((x-radius+half)/step));
    const lastX=Math.min(groundSegments,Math.floor((x+radius+half)/step));
    const firstZ=Math.max(0,Math.ceil((z-radius+half)/step));
    const lastZ=Math.min(groundSegments,Math.floor((z+radius+half)/step));
    for(let row=firstZ;row<=lastZ;row++) for(let col=firstX;col<=lastX;col++){
      const i=row*stride+col;
      const dx=col*step-half-x, dz=row*step-half-z;
      const weight=Math.max(0,1-(dx*dx+dz*dz)/(radius*radius));
      contacts[i]=Math.max(contacts[i],strength*weight**1.45);
      mossContacts[i]=Math.max(mossContacts[i],mossStrength*weight);
    }
  }
  for(let i=0;i<hillsPosition.count;i++){
    const x=hillsPosition.getX(i),z=hillsPosition.getZ(i);
    hillsPosition.setY(i,groundHeight(x,z));
    hillsUv.setXY(i,(.91*x+.42*z)*.194,(-.42*x+.91*z)*.194);
  }
  hills.setAttribute('color',new THREE.BufferAttribute(terrainColors,3));
  hills.setAttribute('bankMaterial',new THREE.BufferAttribute(materialWeights,4));
  hills.computeVertexNormals();
  const bankSurface=mat(0xffffff,{map:forestFloor.albedo,bumpMap:forestFloor.bump,bumpScale:.153,vertexColors:true});
  bankSurface.onBeforeCompile=shader=>{
    shader.uniforms.bankMoss={value:bankMoss};
    shader.uniforms.bankRock={value:rockMap};
    shader.uniforms.turfCover={value:turfCover};
    shader.vertexShader=shader.vertexShader.replace('#include <common>',
      '#include <common>\nattribute vec4 bankMaterial;\nvarying vec4 vBankMaterial;')
      .replace('#include <color_vertex>','#include <color_vertex>\nvBankMaterial = bankMaterial;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
      '#include <common>\nvarying vec4 vBankMaterial;\nuniform sampler2D bankMoss;\nuniform sampler2D bankRock;\nuniform sampler2D turfCover;')
      .replace('#include <map_fragment>',`
        vec3 earthColor = texture2D(map, vMapUv).rgb;
        vec3 leafBed = texture2D(map, vec2(vMapUv.y, -vMapUv.x) * 0.63 + vec2(0.21, 0.37)).rgb;
        earthColor = mix(earthColor, leafBed, 0.31);
        vec3 mossColor = texture2D(bankMoss, vMapUv * 1.31).rgb;
        vec3 rockSample = texture2D(bankRock, vMapUv * 1.11).rgb;
        vec3 rockColor = rockSample * vec3(0.39, 0.41, 0.35);
        vec2 layers = smoothstep(vec2(0.10), vec2(0.91), vBankMaterial.xy + (earthColor.gr - 0.09) * 1.62);
        float path = smoothstep(0.10, 0.88, vBankMaterial.z + (earthColor.r - 0.09) * 0.63);
        vec3 bankColor = mix(mix(earthColor, rockColor, layers.x), mossColor, layers.y);
        vec3 turfColor = texture2D(turfCover, vMapUv * 1.17).rgb;
        float turf = smoothstep(0.11, 0.90, vBankMaterial.w) *
          (1.0 - smoothstep(0.37, 0.93, layers.x) * 0.86);
        vec3 greenBank = mix(bankColor, mix(turfColor, mossColor, layers.y * 0.22), turf);
        vec3 pathColor = earthColor * vec3(1.93, 1.62, 1.28) + vec3(0.029, 0.016, 0.008);
        diffuseColor.rgb *= mix(greenBank, pathColor, path);
      `).replace('#include <roughnessmap_fragment>',`
        #include <roughnessmap_fragment>
        float bankRoughness = mix(mix(0.93, 0.78, layers.x), 0.97, layers.y);
        roughnessFactor = mix(mix(bankRoughness, 0.96, turf), 0.89, path);
      `).replace('#include <normal_fragment_maps>',`
        #include <normal_fragment_maps>
        #ifdef USE_BUMPMAP
          float stoneRelief = rockSample.r * layers.x * (1.0 - layers.y) * 0.106;
          float mossRelief = mossColor.g * layers.y * 0.073;
          float grassRelief = turfColor.g * 0.112;
          float relief = mix(stoneRelief + mossRelief, grassRelief, turf) * (1.0 - path);
          normal = perturbNormalArb(-vViewPosition, normal, vec2(dFdx(relief), dFdy(relief)), faceDirection);
        #endif
      `);
  };
  add(hills,bankSurface);

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
  const ledges=[];
  const wallMaterial=stoneSurface(0xffffff,.145);
  wallMaterial.vertexColors=true;
  const wallDry=new THREE.Color(0xb8afa1), wallDamp=new THREE.Color(0x827c69);
  const wallMoss=new THREE.Color(0x777f4e), wallTint=new THREE.Color();
  const wallStoneShapes=Array.from({length:6},(_,variant)=>{
    const wear=randomFrom(811+variant*71);
    const shape=new THREE.Shape([
      [-.47,-.37],[-.37,-.49],[.20,-.49],[.43,-.45],[.49,-.31],
      [.47,.30],[.31,.46],[-.28,.48],[-.47,.32],
    ].map(([x,y])=>new THREE.Vector2(x+(wear()-.5)*.085,y+(wear()-.5)*.085)));
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:.87,bevelEnabled:true,bevelSize:.039,
      bevelThickness:.041,bevelSegments:1}).translate(0,0,-.435);
    const vertices=geometry.attributes.position;
    const tint=new Float32Array(vertices.count*3);
    for(let i=0;i<vertices.count;i++){
      const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i);
      const weathering=fieldNoise(x*4.15+variant*.87,y*4.23+z*1.08+variant*1.7);
      const seam=THREE.MathUtils.smoothstep(Math.abs(x)*.49+Math.abs(y)*.68+weathering*.37,.28,.64);
      const growth=THREE.MathUtils.smoothstep(weathering*.64+y*.25,.25,.73);
      wallTint.copy(wallDry).lerp(wallDamp,seam*.61).lerp(wallMoss,growth*.79).multiplyScalar(.87+variant*.027);
      wallTint.toArray(tint,i*3);
    }
    geometry.setAttribute('color',new THREE.BufferAttribute(tint,3));
    return geometry;
  });
  const wallCore=mat(0x676556,{map:grit,bumpMap:grit,bumpScale:.071});
  for(const side of [-1,1]){
    for(let i=0;i<16;i++){
      const angle=(19+i*9.94)*Math.PI/180;
      const span=new THREE.Group();
      const radius=13.29+.32*Math.sin(i*.81+side);
      span.position.set(side*Math.sin(angle)*radius,0,-Math.cos(angle)*radius);
      span.rotation.y=-side*angle;
      root.add(span);
      const rows=i<3 ? 4 : i<7 ? (i%2 ? 3 : 5) : i<11 ? 3 : i<14 ? 2 : 1;
      if(rows>1){
        const coreHeight=(rows-1)*.60+.39;
        box(2.34,coreHeight,.44,wallCore,0,coreHeight*.5-.23,-.58,span,false);
      }
      for(let row=0;row<rows;row++){
        const n=row%2 ? 3 : 2;
        for(let j=0;j<n;j++){
          const wear=random();
          if(row===rows-1 && rows>=3 && (i+side+3)%5===0 && j===(side===1 ? 0 : n-1)) continue;
          const index=(i*3+row*5+j+side+6)%wallStoneShapes.length;
          const x=(j+.5-n/2)*2.42/n+(wear-.5)*.09;
          const y=.02+row*.60+(wear-.5)*.065, z=-row*.12+(wear-.5)*.092;
          const stone=add(wallStoneShapes[index],wallMaterial,x,y,z,span,true);
          stone.scale.set(2.42/n*(.97+wear*.10),.61+(wear-.5)*.09,.96+(wear-.5)*.13);
          stone.rotation.set((wear-.5)*.10,Math.sin(i+j+row)*.069,(wear-.5)*.08);
        }
      }
      if(i>0 && (i+side+3)%5!==0){
        const ledgeRadius=radius+(rows-1)*.12;
        const offset=(i%3-1)*.027;
        ledges.push([side*Math.sin(angle+offset)*ledgeRadius,.60*rows-.27,-Math.cos(angle+offset)*ledgeRadius,.38]);
      }
      if(i>1 && i%3===0){
        const baseRadius=radius-.58;
        const x=side*Math.sin(angle)*baseRadius,z=-Math.cos(angle)*baseRadius;
        if(baseRadius>apronRadius(Math.atan2(x,z))+.21){
          ledges.push([x,Math.max(-.09,terrainSurface(x,z))+.036,z,.26]);
        }
      }
    }
  }

  const object=new THREE.Object3D(), color=new THREE.Color();
  const boulder=new THREE.DodecahedronGeometry(1,1);
  const ledgeRock=boulder.clone();
  const ledgeVertices=ledgeRock.attributes.position;
  const ledgeTints=new Float32Array(ledgeVertices.count*3);
  const stoneTint=new THREE.Color(), weatheredStone=new THREE.Color(0xa49b85), rockMoss=new THREE.Color(0x778246);
  for(let i=0;i<ledgeVertices.count;i++){
    const x=ledgeVertices.getX(i),y=ledgeVertices.getY(i),z=ledgeVertices.getZ(i);
    const fracture=fieldNoise((x+z)*4.6+3.1,(z-y)*4.4+1.7);
    const profile=1+(fracture-.5)*.29;
    ledgeVertices.setXYZ(i,x*profile,THREE.MathUtils.clamp(y*profile,-.78,.68)+x*.14,z*profile);
    const mossOnStone=THREE.MathUtils.smoothstep(y*.20+fracture*.81,.35,.80);
    stoneTint.copy(weatheredStone).lerp(rockMoss,mossOnStone*.81).multiplyScalar(.88+fracture*.27);
    stoneTint.toArray(ledgeTints,i*3);
  }
  ledgeRock.setAttribute('color',new THREE.BufferAttribute(ledgeTints,3));
  ledgeRock.computeVertexNormals();
  const ledgeMaterial=stoneSurface(0xffffff,.14);
  ledgeMaterial.vertexColors=true;
  ledgeMaterial.roughness=.84;
  const hillStones=[
    [-10.77,-10.24,1.52,.96,.88,.39],[-10.24,-11.02,1.12,.66,.83,.31],
    [-12.41,-7.44,1.26,.64,.81,-.14],[-15.23,-7.68,1.63,.86,1.07,.59],
    [-16.11,-7.99,1.19,.63,.76,.49],[-14.92,-11.18,1.35,.80,.98,-.17],
    [-8.45,-15.43,1.22,.59,.74,-.86],[-7.88,-19.46,1.18,.70,.91,.72],
    [10.84,-11.40,1.14,.88,.72,-.47],[11.06,-10.37,.84,1.02,.69,-.29],
    [11.51,-9.78,.97,.75,.67,-.26],[12.48,-8.64,1.47,.94,.98,.22],
    [13.61,-8.00,1.17,.67,.83,.27],[15.37,-8.03,1.58,1.02,1.06,-.60],
    [16.32,-7.67,1.12,.62,.96,-.43],[14.70,-10.64,1.08,.74,.88,.41],
    [7.92,-15.52,1.24,.64,.86,.73],[8.96,-20.73,1.47,.81,.98,-.33],
  ];
  for(const [x,z,width,height,depth,turn] of hillStones){
    const slopeX=groundHeight(x+.5,z)-groundHeight(x-.5,z);
    const slopeZ=groundHeight(x,z+.5)-groundHeight(x,z-.5);
    const tuck=Math.min(.31,(Math.abs(slopeX)*width+Math.abs(slopeZ)*depth)*.15);
    const rock=add(ledgeRock,ledgeMaterial,x,groundHeight(x,z)-height*.21-tuck,z,root,true);
    rock.scale.set(width,height,depth);
    rock.rotation.set(-.29*Math.atan(slopeZ),turn,.33*Math.atan(slopeX));
    shadeGround(x,z,width*1.38,.34,.82);
  }
  const rubble=new THREE.InstancedMesh(boulder,stoneSurface(0xffffff,.11),156);
  const stoneGround=[];
  const rockTints=[0x918775,0xa19a88,0x858271,0x817e64,0x889075];
  for(let i=0;i<rubble.count;i++){
    const a=i*2.39996,r=i<96 ? 12.3+random()*6.2 : 20+random()*18;
    let x=Math.sin(a)*r;
    const z=Math.cos(a)*r;
    if(z<-12.7 && Math.abs(x-trailCenter(z))<2.1) x=trailCenter(z)+(x<trailCenter(z) ? -2.15 : 2.15);
    const size=.22+random()*.80;
    object.position.set(x,groundHeight(x,z)-size*.06,z);
    object.scale.set(size*1.35,size*.70,size);
    object.rotation.set(random(),a,random()*.4);
    object.updateMatrix();
    rubble.setMatrixAt(i,object.matrix);
    rubble.setColorAt(i,color.setHex(rockTints[i%rockTints.length]));
    shadeGround(x,z,size*1.65+.21,.42);
    if(i<96) stoneGround.push([x,z,size]);
  }
  rubble.castShadow=true;
  rubble.receiveShadow=true;
  root.add(rubble);

  const gravelRandom=randomFrom(571);
  const gravel=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),rubble.material,stoneGround.length*6);
  let gravelCount=0;
  for(const [x,z,size] of stoneGround) for(let i=0;i<6;i++){
    const direction=gravelRandom()*turn, radius=size*(1.1+gravelRandom()*1.47)+.14;
    const px=x+Math.sin(direction)*radius, pz=z+Math.cos(direction)*radius;
    if(Math.hypot(px,pz)<11.8 || (pz<-12 && Math.abs(px-trailCenter(pz))<1.62)) continue;
    const chip=.045+gravelRandom()**2*.16;
    object.position.set(px,groundHeight(px,pz)-.006,pz);
    object.scale.set(chip*(1.02+gravelRandom()*.9),chip*.44,chip);
    object.rotation.set(gravelRandom()*.35,direction,gravelRandom()*.5);
    object.updateMatrix();
    gravel.setMatrixAt(gravelCount,object.matrix);
    gravel.setColorAt(gravelCount++,color.setHex(rockTints[(i+1)%rockTints.length]));
  }
  gravel.count=gravelCount;
  gravel.receiveShadow=true;
  root.add(gravel);

  const clusters=[];
  const crowns=[];
  const archTrees=[
    {
      placement:[-13.4,-9.7,1.62,13.05],
      stem:[[0,0,0],[.48,.25,-.21],[1.54,.49,-.63],[2.86,.73,-.77],[3.72,1,-1.37]],
      roots:[
        {width:.89,track:[[.63,.65,1.08],[1.44,1.25,.39],[2.15,1.06,.20],[2.78,.63,.13],[3.40,.53,-.14]]},
        {width:.72,track:[[-.15,.86,.90],[-.85,1.79,.29],[-1.93,2.13,.13],[-2.83,2.26,-.15]]},
        {width:.62,track:[[.97,-.43,.72],[1.66,-1.27,.30],[2.49,-1.58,.13],[3.36,-1.39,-.16]]},
        {width:.51,track:[[-.79,-.74,.67],[-1.49,-1.48,.22],[-2.36,-2.41,-.13]]},
      ],
      // Offsets are horizontal world units and a vertical fraction of tree height.
      limbs:[
        {at:.30,offset:[-4.30,.34,.81],width:.49,fork:[.63,-1.38,.12,-2.08]},
        {at:.43,offset:[3.95,.33,-1.72],width:.41,fork:[.62,.80,.14,-2.10]},
        {at:.64,offset:[2.84,.27,1.73],width:.29,fork:[.64,-.85,.12,2.12]},
        {at:.77,offset:[-1.78,.21,-2.82],width:.21},
      ],
    },
    {
      placement:[13.3,-10.8,1.69,12.55],
      stem:[[0,0,0],[.37,.22,.19],[.08,.47,-.21],[-1.06,.72,-.77],[-2.36,1,-.42]],
      roots:[
        {width:.93,track:[[-.73,.55,.94],[-1.46,1.05,.38],[-2.35,1.06,.16],[-2.82,1.15,-.16]]},
        {width:.72,track:[[.57,.84,.87],[.72,1.72,.35],[1.50,2.42,.12],[2.42,3.06,-.14]]},
        {width:.65,track:[[-.95,-.51,.69],[-1.92,-.76,.29],[-2.40,-1.34,.14],[-3.12,-1.77,-.14]]},
        {width:.54,track:[[.91,-.38,.65],[1.80,-1.05,.26],[2.73,-1.32,-.15]]},
      ],
      limbs:[
        {at:.37,offset:[-4.86,.38,1.85],width:.52,fork:[.57,-.77,.17,-2.91]},
        {at:.54,offset:[3.98,.37,-1.32],width:.38,fork:[.63,1.39,.08,2.25]},
        {at:.70,offset:[1.41,.23,2.93],width:.22},
        {at:.81,offset:[-2.86,.22,-1.13],width:.18},
      ],
    },
  ];
  // Keep the court open and carry the woodland around the entire bank.
  const trees=[[-16.1,7.6,1.08,10.8],[15.5,10.8,.97,11.3],[-7.2,17.4,1.13,10.3],[7.0,18.6,.91,11.15],
    [-9.8,-19.4,.66,7.5],[-16.8,-16.1,.48,8.8],[-14.2,-20.7,.54,6.8],
    [7.8,-20.9,.61,8.5],[12.2,-19.2,.50,7.2],[17.7,-17.3,.67,9.15],
    [-17.9,-7.4,.53,8.0],[18.1,-5.8,.38,6.45],[19.1,1.4,.61,9.1],
    [-21.5,5.2,.58,9.4],[19.1,14.9,.48,8.2],[-14.2,14.3,.63,8.45],
    [-2.7,21.4,.43,7.8],[3.4,22.0,.55,9.8],[-5.5,-26.7,.48,11.0],[4.9,-28.8,.39,10.8],
  ];
  const treeRandom=randomFrom(281);
  for(let i=0;i<31;i++){
    const a=i*2.39996,r=23.2+treeRandom()*14.7;
    const x=Math.sin(a)*r,z=Math.cos(a)*r;
    if(z<-13 && Math.abs(x-trailCenter(z))<3.45) continue;
    trees.push([x,z,.28+treeRandom()*.43,6.7+treeRandom()*6.4]);
  }
  const barkColor=new THREE.Color(0xa5947b), barkMoss=new THREE.Color(0x7c8454);
  const woodTint=new THREE.Color();
  function woodCurve(points) {
    return new THREE.CatmullRomCurve3(points.map(point=>new THREE.Vector3(...point)));
  }
  function taper(curve,width,endWidth,phase,detail,flare=0,rootProfile=false) {
    const steps=detail ? 16 : 8, sides=detail ? 12 : 7;
    const geometry=new THREE.TubeGeometry(curve,steps,1,sides,false);
    const position=geometry.attributes.position, uv=geometry.attributes.uv;
    const tint=new Float32Array(position.count*3);
    const vertex=new THREE.Vector3();
    for(let ring=0;ring<=steps;ring++) {
      const t=ring/steps, center=curve.getPointAt(t);
      for(let side=0;side<=sides;side++) {
        const i=ring*(sides+1)+side;
        const a=side*turn/sides;
        const fluting=Math.cos(a*5+phase+t*1.6), irregular=Math.sin(a*3+phase-t*3.2);
        const ridge=1+fluting*.094+irregular*.053;
        const radius=THREE.MathUtils.lerp(width,endWidth,1-(1-t)**(flare ? 1.68 : 1.26))*ridge*
          (1+flare*Math.exp(-t*13)*(.95+irregular*.34));
        vertex.fromBufferAttribute(position,i).sub(center).multiplyScalar(radius);
        if(rootProfile) vertex.y*=.75;
        vertex.add(center);
        const earth=groundHeight(vertex.x,vertex.z);
        if(flare && !rootProfile && t<.18){
          const embed=1-THREE.MathUtils.smoothstep(t,0,.18);
          vertex.y=THREE.MathUtils.lerp(vertex.y,Math.min(vertex.y,earth-.28),embed);
        }
        position.setXYZ(i,vertex.x,vertex.y,vertex.z);
        uv.setXY(i,side/sides*2,t*2.65);
        const damp=1-THREE.MathUtils.smoothstep(vertex.y-earth,.12,1.75);
        const mossCover=damp*(rootProfile ? .82+irregular*.16 : .64+irregular*.24);
        woodTint.copy(barkColor).lerp(barkMoss,mossCover).multiplyScalar(.94+fluting*.105);
        woodTint.toArray(tint,i*3);
      }
    }
    geometry.setAttribute('color',new THREE.BufferAttribute(tint,3));
    geometry.computeVertexNormals();
    const normal=geometry.attributes.normal;
    for(let ring=0;ring<=steps;ring++) {
      const first=ring*(sides+1), last=first+sides;
      vertex.fromBufferAttribute(normal,first).add(centerNormal.fromBufferAttribute(normal,last)).normalize();
      normal.setXYZ(first,vertex.x,vertex.y,vertex.z);
      normal.setXYZ(last,vertex.x,vertex.y,vertex.z);
    }
    return geometry;
  }
  const centerNormal=new THREE.Vector3();
  function trunk(x,z,r,h,shape) {
    const mature=r>.9;
    const near=Math.hypot(x,z)<23;
    const castsShade=near && z<8;
    const heading=treeRandom()*turn;
    const lean=(mature ? 1.55 : .65)+treeRandom()*(mature ? 1.85 : 1.57);
    const leanX=Math.cos(heading)*lean, leanZ=Math.sin(heading)*lean;
    const bend=(treeRandom()-.5)*(mature ? 2.25 : 1.48);
    const start=groundHeight(x,z)-.16;
    shadeGround(x,z,r*2.06+.22,.48,shape ? .95 : .55);
    const stem=shape?.stem ?? [[0,0,0],[leanX*.10,.24,leanZ*.10],
      [leanX*.41+Math.sin(heading)*bend,.50,leanZ*.41-Math.cos(heading)*bend],
      [leanX*.81,.76,leanZ*.81],[leanX,1,leanZ]];
    const axis=woodCurve(stem.map(([dx,y,dz])=>[x+dx,start+h*y,z+dz]));
    const wood=[taper(axis,r,r*.084,x+z,near,mature ? .43 : .22)];
    const rootCount=mature ? 6 : near ? 3 : 0;
    for(let i=0;i<rootCount;i++){
      const theta=i*turn/rootCount+heading+(treeRandom()-.5)*.67,d=r*(1.42+treeRandom()*1.23);
      const rootWidth=r*(.28+treeRandom()*.20);
      const exposed=shape?.roots?.[i];
      if(exposed){
        const points=[[x,start+r*.83,z],...exposed.track.map(([dx,dz,lift])=>[x+dx,groundHeight(x+dx,z+dz)+lift,z+dz])];
        const curve=woodCurve(points);
        for(let sample=2;sample<=12;sample++){
          const t=sample/12,point=curve.getPointAt(t);
          shadeGround(point.x,point.z,exposed.width*(1.55-t*.62),.34*(1-t*.55),.83*(1-t*.34));
        }
        wood.push(taper(curve,exposed.width,r*.031,theta,true,.1,true));
        continue;
      }
      const dx=Math.cos(theta)*d,dz=Math.sin(theta)*d;
      const px=x+dx*.56-dz*.11,pz=z+dz*.56+dx*.11;
      const rootCurve=woodCurve([[x,start+r*.81,z],[px,groundHeight(px,pz)+r*.16,pz],
        [x+dx,groundHeight(x+dx,z+dz)-.18,z+dz]]);
      wood.push(taper(rootCurve,rootWidth,r*.037,theta,near));
    }
    function growLimb(origin,[dx,rise,dz],width,sweep) {
      const [ox,oy,oz]=origin.toArray();
      const dy=rise*h, angle=Math.atan2(dz,dx);
      const tip=[ox+dx,oy+dy,oz+dz];
      const curve=woodCurve([
        [ox,oy,oz],
        [ox+dx*.20-dz*sweep*.44,oy+dy*.26,oz+dz*.20+dx*sweep*.44],
        [ox+dx*.65-dz*sweep,oy+dy*.61,oz+dz*.65+dx*sweep],
        tip,
      ]);
      wood.push(taper(curve,width,width*.083,angle,near));
      return curve;
    }
    const limbs=shape?.limbs ?? [];
    if(!shape) {
      const spread=1.68+treeRandom()*.61;
      const count=near ? 4 : 3;
      const first=.34+treeRandom()*.18;
      for(let i=0;i<count;i++){
        const at=first+(i/(count-1))*(.81-first)+(treeRandom()-.5)*.048;
        const angle=heading+i*spread+(treeRandom()-.5)*.49;
        const reach=(mature ? 2.78 : 1.38)+treeRandom()*(mature ? 1.75 : 1.38);
        const rise=(1-at)*(.67+treeRandom()*.34);
        const forkAngle=angle+(i%2 ? -1 : 1)*(.88+treeRandom()*.50);
        const forkReach=reach*(.40+treeRandom()*.27);
        const fork=near || i===1 ? [.53+treeRandom()*.14,Math.cos(forkAngle)*forkReach,rise*.45,
          Math.sin(forkAngle)*forkReach] : null;
        limbs.push({at,offset:[Math.cos(angle)*reach,rise,Math.sin(angle)*reach],
          width:(.40-i*.065)*(.90+treeRandom()*.25),fork});
      }
    }
    let bendDirection=1;
    for(const {at,offset,width,fork} of limbs){
      const sweep=(.08+treeRandom()*.11)*bendDirection;
      const limb=growLimb(axis.getPointAt(at),offset,r*width,sweep);
      const [dx,,dz]=offset;
      const reach=Math.hypot(dx,dz);
      const angle=Math.atan2(dz,dx);
      addCrown(limb.getPointAt(1),reach*.70,angle);
      if(shape && width>.36) addCrown(limb.getPointAt(.82),reach*.35,angle);
      if(fork){
        const [joint,fx,fy,fz]=fork;
        const forkCurve=growLimb(limb.getPointAt(joint),[fx,fy,fz],r*width*.31,-sweep*.68);
        addCrown(forkCurve.getPointAt(1),Math.hypot(fx,fz)*.65+.40,Math.atan2(fz,fx));
      }
      bendDirection*=-1;
    }
    function addCrown(endpoint,radius,angle) {
      crowns.push({tip:endpoint.toArray(),radius,angle,near,castsShade});
    }
    addCrown(axis.getPointAt(1),mature ? 2.44 : 1.46,heading);
    const geometry=mergeGeometries(wood);
    for(const part of wood) part.dispose();
    add(geometry,bark,0,0,0,root,castsShade);
  }
  for(const tree of archTrees) trunk(...tree.placement,tree);
  for(const [x,z,r,h] of trees) trunk(x,z,r,h);

  function canopyBlade(sections) {
    const vertices=[], triangles=[], colors=[];
    for(let i=0;i<=sections;i++){
      const t=i/sections;
      const profile=Math.sin(Math.PI*t)**.81;
      const width=profile*(.29+.032*Math.sin(t*24));
      const curl=Math.sin(t*Math.PI)*.14-t*t*.19;
      vertices.push(-width,t,curl-profile*.075,0,t,curl+profile*.035,width,t,curl-profile*.048);
      const red=.69+t*.24, green=.75+t*.22, blue=.66+t*.26;
      colors.push(red,green,blue,red*1.06,green*1.02,blue*.97,red,green,blue);
      if(i===0) continue;
      const j=i*3;
      triangles.push(j-3,j-2,j,j-2,j+1,j,j-2,j-1,j+1,j-1,j+2,j+1);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.setIndex(triangles);
    geometry.computeVertexNormals();
    return geometry;
  }
  const herb=new THREE.ShapeGeometry(leafShape());
  const foliage=mat(0xffffff,{side:THREE.DoubleSide,roughness:.89,emissive:0x29300b,emissiveIntensity:.22});
  const texturedFoliage=mat(0xffffff,{side:THREE.DoubleSide,roughness:.88,emissive:0x29380f,
    emissiveIntensity:.31,vertexColors:true,clippingPlanes:[vegetationClip]});
  const shadedLeaves=new THREE.Color(0x496330), litLeaves=new THREE.Color(0xa3b95b);
  const crownRandom=randomFrom(723);
  const sprayCount=radius=>radius>1.8 ? 15 : radius>1.1 ? 11 : 8;
  function addCanopy(near,castsShade) {
    const layer=crowns.filter(crown=>crown.near===near && crown.castsShade===castsShade);
    const leavesPerSpray=near ? 14 : 10;
    const leafCount=layer.reduce((sum,{radius})=>sum+sprayCount(radius)*leavesPerSpray,0);
    const canopy=new THREE.InstancedMesh(canopyBlade(near ? 5 : 3),texturedFoliage,leafCount);
    let leafIndex=0;
    for(const {tip:[x,y,z],radius,angle} of layer) {
      const sprays=sprayCount(radius);
      const hue=crownRandom()*.24;
      const dx=Math.cos(angle), dz=Math.sin(angle);
      for(let i=0;i<sprays;i++){
        const azimuth=i*2.39996+(crownRandom()-.5)*.46;
        const spread=Math.sqrt((i+.5)/sprays)*radius;
        const along=Math.cos(azimuth)*spread, across=Math.sin(azimuth)*spread*.71;
        const sprayX=x+dx*along-dz*across, sprayZ=z+dz*along+dx*across;
        const elevation=(1-spread/radius)*.42+(crownRandom()-.36)*.58;
        const sprayY=y+elevation*radius;
        const twig=angle+azimuth+(crownRandom()-.5)*1.14;
        const tx=Math.cos(twig), tz=Math.sin(twig);
        const reach=(.35+radius*.41)*(near ? 1 : 1.2);
        for(let j=0;j<leavesPerSpray;j++){
          const t=Math.floor(j/2)/(leavesPerSpray/2-1);
          const side=j%2===0 ? -1 : 1;
          const forward=(t-.40)*reach;
          const lateral=side*(.055+crownRandom()*.13)*Math.sin(t*2.5+.5);
          object.position.set(sprayX+tx*forward-tz*lateral,sprayY+(t-.44)*reach*.36+(crownRandom()-.5)*.19,
            sprayZ+tz*forward+tx*lateral);
          const size=(.20+crownRandom()*.20)*(near ? 1 : 1.36)*(1.08-t*.19);
          object.scale.set(size*(.77+crownRandom()*.33),size,size);
          object.rotation.set(-.73-crownRandom()*.75,-twig+side*(.69-t*.41),side*(.31+crownRandom()*.63),'YXZ');
          object.updateMatrix();
          canopy.setMatrixAt(leafIndex,object.matrix);
          color.copy(shadedLeaves).lerp(litLeaves,THREE.MathUtils.clamp(hue+elevation*.53+crownRandom()*.26,0,1));
          canopy.setColorAt(leafIndex++,color);
        }
      }
    }
    canopy.instanceMatrix.needsUpdate=true;
    canopy.instanceColor.needsUpdate=true;
    canopy.castShadow=castsShade;
    canopy.receiveShadow=true;
    root.add(canopy);
  }
  addCanopy(true,true);
  addCanopy(true,false);
  addCanopy(false,false);

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
  for(let i=0;i<380;i++){
    const a=i*2.39996,r=12.62+random()*12.9;
    const x=Math.sin(a)*r,z=Math.cos(a)*r;
    if((z<-12 && Math.abs(x-trailCenter(z))<2.22) || groundCover(x,z)<.34) continue;
    clusters.push([x,groundHeight(x,z)-.03,z,.51+random()*.74]);
  }
  const ledgeStart=clusters.length;
  clusters.push(...ledges);
  const understory=canopyBlade(4);
  function plantCreepers(start,end,parent){
    const onArch=parent===arch;
    const leaves=onArch ? 21 : 17;
    const creepers=new THREE.InstancedMesh(onArch ? herb : understory,onArch ? foliage : texturedFoliage,(end-start)*leaves);
    for(let index=start;index<end;index++) for(let i=0;i<leaves;i++){
      const [x,y,z,r]=clusters[index];
      const a=random()*turn,d=Math.sqrt(random())*r;
      const px=x+Math.cos(a)*d,pz=z+Math.sin(a)*d*(onArch ? .18 : 1);
      object.position.set(px,onArch ? y+(random()-.55)*.57 : index>=ledgeStart ? y : groundHeight(px,pz)+.015,pz);
      const size=(onArch ? .13 : .16)+random()*(onArch ? .21 : .38);
      object.scale.set(size*(onArch ? 1 : 1.56),size,size);
      object.rotation.set(onArch ? (random()-.5)*.83 : -.52-random()*.62,onArch ? (random()-.5)*.87 : a,
        (random()-.5)*1.55,'YXZ');
      object.updateMatrix();
      const id=(index-start)*leaves+i;
      creepers.setMatrixAt(id,object.matrix);
      creepers.setColorAt(id,color.setHex([0x617a3c,0x789247,0x52703a,0x93a559][(index+i)%4]));
    }
    creepers.receiveShadow=true;
    parent.add(creepers);
  }
  plantCreepers(0,ivyCount,arch);
  plantCreepers(ivyCount,clusters.length,root);

  const fernLocations=[[-12.4,-8.9],[12.5,-9.2],[-7.5,-12.8],[7.1,-12.7],[-4.3,-15.7],[3.2,-17.1],
    [-13.3,2.1],[13.7,3.1],[-11.5,8.8],[10.9,10.4],[-6.1,12.1],[5.6,13.2]];
  for(let i=0;i<64;i++){
    const theta=i*2.39996,r=13.3+random()*7.1;
    const x=Math.sin(theta)*r,z=Math.cos(theta)*r;
    if(z<-12.7 && Math.abs(x-trailCenter(z))<2.6) continue;
    fernLocations.push([x,z]);
  }
  fernLocations.push([-11.52,-9.47],[-14.45,-7.77],[10.53,-10.73],[14.26,-8.48]);
  const ferns=new THREE.InstancedMesh(understory,texturedFoliage,fernLocations.length*6*18);
  let fernLeaf=0;
  for(const [i,[x,z]] of fernLocations.entries()){
    const theta=i*2.39996;
    const ground=groundHeight(x,z);
    shadeGround(x,z,.86,.13,.42);
    for(let frond=0;frond<6;frond++){
      const a=theta+frond*turn/6, reach=.53+random()*.76;
      for(let j=0;j<9;j++) for(const side of [-1,1]){
        const t=(j+1)/10;
        object.position.set(x+Math.sin(a)*reach*t,ground+.055+Math.sin(t*2.42)*reach*.52,z+Math.cos(a)*reach*t);
        object.scale.set(.14*(1-t*.64),.05+Math.sin(Math.PI*t**.84)*reach*.34,.27);
        object.rotation.set(1.23,a+side*(1.14-t*.42),side*.18,'YXZ');
        object.updateMatrix();
        ferns.setMatrixAt(fernLeaf,object.matrix);
        ferns.setColorAt(fernLeaf++,color.setHex([0x7c9440,0x687e37,0xa4ad52,0x617f40][(i+j)%4]));
      }
    }
  }
  ferns.receiveShadow=true;
  root.add(ferns);

  const blooms=[];
  for(let i=0;i<192;i++){
    const a=i*2.39996,r=12.46+random()*5.1, x=Math.sin(a)*r,z=Math.cos(a)*r;
    const height=.15+random()*.20;
    if(z<-12 && Math.abs(x-trailCenter(z))<trailHalfWidth(z)+.14) continue;
    blooms.push([x,z,height,.042]);
  }
  const bloomRandom=randomFrom(1853);
  const flowersByBank=[
    [-11.03,-9.12,.68],[-14.73,-7.28,.83],[11.67,-8.83,.70],[14.63,-8.36,.82],
    [trailCenter(-15.6)-2.18,-15.6,.72],[trailCenter(-17.6)+2.17,-17.6,.83],
    [trailCenter(-21.1)-2.11,-21.1,.90],[trailCenter(-23.4)+2.26,-23.4,.88],
  ];
  for(const [cx,cz,radius] of flowersByBank) for(let i=0;i<18;i++){
    const direction=bloomRandom()*turn, spread=Math.sqrt(bloomRandom())*radius;
    const x=cx+Math.sin(direction)*spread,z=cz+Math.cos(direction)*spread;
    if(z<-12 && Math.abs(x-trailCenter(z))<trailHalfWidth(z)+.15) continue;
    if(hillStones.some(([sx,sz,w,,d])=>((x-sx)/w)**2+((z-sz)/d)**2<.51)) continue;
    blooms.push([x,z,.16+bloomRandom()*.26,.047+bloomRandom()*.027]);
  }
  const flower=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),mat(0xf1eada),blooms.length*5);
  const stems=new THREE.InstancedMesh(new THREE.CylinderGeometry(.011,.019,1,5),mat(0x65743b),blooms.length);
  const sprigLeaves=new THREE.InstancedMesh(understory,texturedFoliage,blooms.length*2);
  for(const [i,[x,z,height,petal]] of blooms.entries()){
    const ground=groundHeight(x,z);
    const heading=i*2.39996;
    object.position.set(x,ground+height*.44,z);
    object.scale.set(1,height,1);
    object.rotation.set(0,heading,0);
    object.updateMatrix();
    stems.setMatrixAt(i,object.matrix);
    for(let side=0;side<2;side++){
      object.position.set(x,ground+height*(.29+side*.22),z);
      object.scale.set(petal*.96,height*.39,petal);
      object.rotation.set(1.08,heading+side*2.67,side*.27,'YXZ');
      object.updateMatrix();
      const leaf=i*2+side;
      sprigLeaves.setMatrixAt(leaf,object.matrix);
      sprigLeaves.setColorAt(leaf,color.setHex(side ? 0x7c8a48 : 0x68783d));
    }
    for(let j=0;j<5;j++){
      const theta=heading+j*turn/5;
      object.position.set(x+Math.cos(theta)*petal*.86,ground+height,z+Math.sin(theta)*petal*.86);
      object.scale.set(petal,petal*.34,petal*.73);
      object.rotation.set(.23,theta,0);
      object.updateMatrix();
      flower.setMatrixAt(i*5+j,object.matrix);
    }
  }
  flower.receiveShadow=true;
  stems.receiveShadow=true;
  sprigLeaves.receiveShadow=true;
  root.add(flower,stems,sprigLeaves);

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
  const grassVertices=[], grassFaces=[], grassColors=[];
  for(let i=0;i<=4;i++){
    const t=i/4, width=.052*(1-t)**.73, bend=t*t*.43;
    grassVertices.push(-width,t,bend,width,t,bend);
    const tint=.57+.38*t;
    grassColors.push(tint,tint+.043,tint,tint,tint+.043,tint);
    const vertex=i*2;
    if(i>0) grassFaces.push(vertex-2,vertex-1,vertex,vertex-1,vertex+1,vertex);
  }
  const grassBlade=new THREE.BufferGeometry();
  grassBlade.setAttribute('position',new THREE.Float32BufferAttribute(grassVertices,3));
  grassBlade.setAttribute('color',new THREE.Float32BufferAttribute(grassColors,3));
  grassBlade.setIndex(grassFaces);
  grassBlade.computeVertexNormals();
  const blades=new THREE.InstancedMesh(grassBlade,texturedFoliage,1900*6);
  const grassDark=new THREE.Color(0x4b6236), grassLight=new THREE.Color(0x99a75b);
  const grassRandom=randomFrom(517);
  let bladeIndex=0;
  for(let i=0;i<1900;i++){
    const a=i*2.39996,r=12.1+grassRandom()**1.7*24.6, x=Math.sin(a)*r,z=Math.cos(a)*r;
    const cover=groundCover(x,z);
    if((z<-12 && Math.abs(x-trailCenter(z))<2.06) || grassRandom()>.19+cover*.80) continue;
    const tall=.17+cover*.29+grassRandom()*.20;
    shadeGround(x,z,.36+tall,.13,.26);
    const heading=grassRandom()*turn;
    for(let j=0;j<6;j++){
      const theta=heading+j*turn/6;
      const spread=.06+grassRandom()*.17;
      const px=x+Math.sin(theta)*spread,pz=z+Math.cos(theta)*spread;
      const size=tall*(.55+grassRandom()*.61);
      object.position.set(px,terrainSurface(px,pz)-.023,pz);
      object.rotation.set(.10+grassRandom()*.38,theta,(grassRandom()-.5)*.38,'YXZ');
      object.scale.set(size*(.56+grassRandom()*.70),size,size);
      object.updateMatrix();
      blades.setMatrixAt(bladeIndex,object.matrix);
      color.copy(grassDark).lerp(grassLight,cover*.46+grassRandom()*.46);
      blades.setColorAt(bladeIndex++,color);
    }
  }
  blades.count=bladeIndex;
  blades.receiveShadow=true;
  root.add(blades);

  // Short, overlapping blades give the continuous turf a visible edge in low camera views.
  const carpetRandom=randomFrom(4309);
  const groundFoliage=texturedFoliage.clone();
  // Low cover stays visible below the near-side clipping plane used for taller scenery.
  groundFoliage.clippingPlanes=null;
  const turfClumpCount=6800, bladesPerClump=5;
  const carpet=new THREE.InstancedMesh(grassBlade,groundFoliage,turfClumpCount*bladesPerClump);
  const seedlings=new THREE.InstancedMesh(understory,groundFoliage,Math.ceil(turfClumpCount/5)*5);
  const carpetDark=new THREE.Color(0x4c6737), carpetLight=new THREE.Color(0x8fa454);
  const seedlingRandom=randomFrom(1901);
  let carpetIndex=0, seedlingIndex=0;
  for(let i=0;i<turfClumpCount;i++){
    const a=i*2.39996, radius=apronRadius(a)+.96+carpetRandom()**1.81*11.9;
    const x=Math.sin(a)*radius,z=Math.cos(a)*radius;
    if(z<-12 && Math.abs(x-trailCenter(z))<trailHalfWidth(z)+.45) continue;
    const cover=groundCover(x,z), tuft=fieldNoise(x*.78+3.2,z*.78-2.4);
    if(carpetRandom()>.39+cover*.32+tuft*.22) continue;
    const height=.115+cover*.133+carpetRandom()*.11;
    const heading=carpetRandom()*turn;
    shadeGround(x,z,.40,.08,.58);
    for(let blade=0;blade<bladesPerClump;blade++){
      const angle=heading+blade*2.39, spread=.045+carpetRandom()*.22;
      const px=x+Math.sin(angle)*spread,pz=z+Math.cos(angle)*spread;
      object.position.set(px,terrainSurface(px,pz)-.019,pz);
      object.rotation.set(.32+carpetRandom()*.46,angle,(carpetRandom()-.5)*.46,'YXZ');
      const size=height*(.62+carpetRandom()*.60);
      object.scale.set(size*(1.57+carpetRandom()*1.25),size,size);
      object.updateMatrix();
      carpet.setMatrixAt(carpetIndex,object.matrix);
      color.copy(carpetDark).lerp(carpetLight,cover*.31+carpetRandom()*.50);
      carpet.setColorAt(carpetIndex++,color);
    }
    if(i%5!==0 || cover+tuft*.18<.60) continue;
    const seedlingSize=.21+seedlingRandom()*.23;
    for(let leaf=0;leaf<5;leaf++){
      const angle=heading+leaf*turn/5, spread=.025+seedlingRandom()*.079;
      const px=x+Math.sin(angle)*spread,pz=z+Math.cos(angle)*spread;
      object.position.set(px,terrainSurface(px,pz)-.024,pz);
      object.rotation.set(1.01+seedlingRandom()*.32,angle,(seedlingRandom()-.5)*.36,'YXZ');
      object.scale.set(seedlingSize*(.77+seedlingRandom()*.37),seedlingSize,seedlingSize*.69);
      object.updateMatrix();
      seedlings.setMatrixAt(seedlingIndex,object.matrix);
      color.copy(grassDark).lerp(grassLight,.34+seedlingRandom()*.39);
      seedlings.setColorAt(seedlingIndex++,color);
    }
  }
  carpet.count=carpetIndex;
  seedlings.count=seedlingIndex;
  carpet.receiveShadow=true;
  seedlings.receiveShadow=true;
  root.add(carpet,seedlings);

  // Irregular planted pockets break up exposed banks between the trees and the retaining wall.
  const bedSpots=[
    [-17.9,-5.5,1.3],[-16.5,-2.7,1.1],[-14.8,3.4,1.3],[-16.4,7.3,1.8],
    [-11.9,11.8,1.2],[-8.4,13.9,1.15],[-3.2,16.5,1.65],[2.3,16.2,1.28],
    [7.8,15.3,1.49],[12.5,12.4,1.41],[15.8,7.1,1.34],[16.9,1.7,1.46],
    [15.5,-4.8,1.38],[16.8,-8.7,1.21],[-13.3,-18.3,1.24],[12.1,-18.0,1.24],
    [trailCenter(-17.0)+2.71,-17.0,.84],[trailCenter(-21.4)-2.56,-21.4,.96],
    [-20.2,3.7,2.2],[-21.6,7.4,1.7],[-17.9,12.9,2.3],[-13.2,17.1,1.94],
    [-6.3,21.2,2.1],[.6,20.2,2.28],[8.0,21.6,1.87],[13.4,19.1,2.15],
    [19.7,13.7,1.68],[21.5,6.8,2.2],[20.1,-.1,1.72],[20.4,-9.1,1.87],
  ];
  const bedRandom=randomFrom(5071);
  const bedPlants=new THREE.InstancedMesh(understory,groundFoliage,bedSpots.length*12*5);
  const bedShade=new THREE.Color(0x5a7139), bedSun=new THREE.Color(0x9ba459);
  let bedIndex=0;
  for(const [cx,cz,radius] of bedSpots) for(let plant=0;plant<12;plant++){
    const bearing=bedRandom()*turn, spread=Math.sqrt(bedRandom())*radius;
    const x=cx+Math.cos(bearing)*spread,z=cz+Math.sin(bearing)*spread*.70;
    if(z<-12 && Math.abs(x-trailCenter(z))<trailHalfWidth(z)+.41) continue;
    const level=terrainSurface(x,z), size=.30+bedRandom()**1.4*.53;
    shadeGround(x,z,size+.25,.15,.64);
    for(let leaf=0;leaf<5;leaf++){
      const angle=bearing+leaf*turn/5;
      const height=size*(.75+bedRandom()*.30);
      object.position.set(x,level-.018,z);
      object.scale.set(height*.92,height,height);
      object.rotation.set(.71+bedRandom()*.55,angle,(bedRandom()-.5)*.38,'YXZ');
      object.updateMatrix();
      bedPlants.setMatrixAt(bedIndex,object.matrix);
      color.copy(bedShade).lerp(bedSun,bedRandom()*.73);
      bedPlants.setColorAt(bedIndex++,color);
    }
  }
  bedPlants.count=bedIndex;
  bedPlants.receiveShadow=true;
  root.add(bedPlants);

  const litter=new THREE.InstancedMesh(understory,groundFoliage,1860);
  const litterColors=[0x876944,0xa28353,0x6c573b,0xad905e,0x9d7547];
  let litterIndex=0;
  for(let i=0;i<1860;i++){
    const a=i*2.39996,r=12.36+grassRandom()**1.8*13;
    const x=Math.sin(a)*r,z=Math.cos(a)*r;
    if((z<-12 && Math.abs(x-trailCenter(z))<1.35) || groundCover(x,z)>grassRandom()) continue;
    object.position.set(x,terrainSurface(x,z)+.024,z);
    object.rotation.set(Math.PI/2+(grassRandom()-.5)*.45,grassRandom()*turn,0,'YXZ');
    const size=.10+grassRandom()*.21;
    object.scale.set(size,size,.08);
    object.updateMatrix();
    litter.setMatrixAt(litterIndex,object.matrix);
    litter.setColorAt(litterIndex++,color.setHex(litterColors[i%litterColors.length]));
  }
  litter.count=litterIndex;
  litter.receiveShadow=true;
  root.add(litter);

  const terrainNormal=hills.attributes.normal;
  for(let i=0;i<hillsPosition.count;i++){
    const x=hillsPosition.getX(i),z=hillsPosition.getZ(i);
    const cover=groundCover(x,z);
    const tint=1-contacts[i];
    const offset=i*3;
    terrainColors[offset]=tint*(1.04-cover*.14);
    terrainColors[offset+1]=tint*(.91+cover*.18);
    terrainColors[offset+2]=tint*(.85+cover*.15);
    const onBank=THREE.MathUtils.smoothstep(bankRise(x,z),.18,1.35);
    const steepness=1-terrainNormal.getY(i);
    const weathering=fieldNoise(x*.64+7.7,z*.64-9.4);
    const weights=i*4;
    materialWeights[weights]=onBank*THREE.MathUtils.smoothstep(steepness+weathering*.24,.18,.51);
    materialWeights[weights+1]=Math.max(mossContacts[i],cover*(.27+onBank*.54))*(1-steepness*.54);
    materialWeights[weights+3]=THREE.MathUtils.smoothstep(Math.hypot(x,z),11.66,12.32);
    if(z<-12.6){
      const distance=Math.abs(x-trailCenter(z)), width=trailHalfWidth(z);
      const entrance=THREE.MathUtils.smoothstep(-z,12.60,13.38);
      const end=1-THREE.MathUtils.smoothstep(-z,35,43);
      materialWeights[weights+2]=entrance*end*(1-THREE.MathUtils.smoothstep(distance,width*.56,width+.49));
    }
  }
  hills.attributes.color.needsUpdate=true;
  hills.attributes.bankMaterial.needsUpdate=true;

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

  const top=mat(0xc2bbad,{map:carvedStone.albedo,bumpMap:carvedStone.bump,bumpScale:.088});
  const edge=stoneSurface(0xa5a28d,.085);
  const green=mat(0x718754,{map:grit});
  const podiumCore=new THREE.CylinderGeometry(1.23,1.29,.225,48);
  const podiumCap=new THREE.CylinderGeometry(1.158,1.17,.071,64);
  const podiumInlay=new THREE.RingGeometry(1.055,1.147,64).rotateX(-Math.PI/2);
  const podiumMortar=mat(0x817b6d,{map:carvedStone.albedo});
  const rimStone=mat(0xffffff,{map:carvedStone.albedo,bumpMap:carvedStone.bump,
    bumpScale:.073,roughness:.94,vertexColors:true});
  const rimRandom=randomFrom(761);
  const rimCount=12;
  const rimAngles=Array.from({length:rimCount},(_,i)=>(i+(rimRandom()-.5)*.24)*turn/rimCount);
  const rimPatches=[];
  const rimTint=new THREE.Color(),rimMoss=new THREE.Color(0x859060),rimVertexTint=new THREE.Color();
  const rimPalette=[0xc1b9ac,0xaca89e,0xbdb7aa,0xb7b0a3];
  for(let i=0;i<rimCount;i++){
    const a=rimAngles[i]+.014,b=(rimAngles[i+1] ?? rimAngles[0]+turn)-.014;
    const inner=1.135,outer=1.295+(rimRandom()-.5)*.025;
    const shape=new THREE.Shape();
    shape.moveTo(Math.cos(a)*outer,Math.sin(a)*outer);
    shape.absarc(0,0,outer,a,b,false);
    shape.lineTo(Math.cos(b)*inner,Math.sin(b)*inner);
    shape.absarc(0,0,inner,b,a,true);
    shape.closePath();
    const height=.211+rimRandom()*.008;
    const patch=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:true,
      bevelSize:.018,bevelOffset:-.018,bevelThickness:.014,bevelSegments:1,curveSegments:7});
    const {position,uv}=patch.attributes;
    const colors=new Float32Array(position.count*3);
    rimTint.set(rimPalette[i%rimPalette.length]);
    const textureShift=rimRandom(),mossAmount=.22+rimRandom()*.59;
    for(let j=0;j<position.count;j++){
      const y=position.getZ(j);
      const lower=1-THREE.MathUtils.smoothstep(y,-.012,height*.54);
      const taper=1+lower*.045;
      const x=position.getX(j)*taper,z=position.getY(j)*taper;
      position.setXYZ(j,x,z,y-height-.027);
      uv.setXY(j,uv.getX(j)*.87+textureShift,uv.getY(j)*.87+textureShift*.53);
      const variation=fieldNoise(x*23+z*11,y*35,19);
      rimVertexTint.copy(rimTint).lerp(rimMoss,mossAmount*lower*variation).toArray(colors,j*3);
    }
    patch.setAttribute('color',new THREE.BufferAttribute(colors,3));
    patch.rotateX(-Math.PI/2);
    patch.computeVertexNormals();
    rimPatches.push(patch);
  }
  const podiumRim=mergeGeometries(rimPatches);
  for(const patch of rimPatches) patch.dispose();
  function createPokemonPodium(parent,y) {
    add(podiumCore,podiumMortar,0,y-.141,0,parent,true);
    add(podiumCap,top,0,y-.045,0,parent,true);
    add(podiumRim,rimStone,0,y,0,parent,true);
    add(podiumInlay,green,0,y-.006,0,parent);
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
    setVegetationClip(normal,distance) { vegetationClip.set(normal,distance); },
    createPokemonPodium,createStation,
    dispose(){
      disposed=true;
      for(const texture of [timber,grit,forestMap,rockMap,barkMap,mossMap,bankMoss,forestFloor.albedo,forestFloor.bump,
        carvedStone.albedo,carvedStone.bump,turfCover]){
        texture.dispose();
      }
    },
  };
}
