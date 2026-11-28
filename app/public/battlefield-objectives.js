import * as THREE from '/vendor/three.module.js';

const teamColors = {'team-a':0x54c9f4,'team-b':0xf39171,'team-c':0xc3acfa};
const floorHeight = .21;
const ceilingHeight = 9.12;

function roomReflections(fixtures) {
  const width = 256, height = 128;
  const data = new Uint16Array(width*height*4);
  const {toHalfFloat} = THREE.DataUtils;
  const emitters = fixtures.map(({x,y,z,w})=>({x,z:y,spanX:z-x,spanZ:w-y,lengthSq:(z-x)**2+(w-y)**2}));
  const opaque = toHalfFloat(1);
  function ceilingRadiance(dx,dy,dz) {
    if (dy<=.04) return 0;
    const distance = (ceilingHeight-2.45)/dy;
    const pointX = dx*distance, pointZ = dz*distance+.38;
    if (Math.abs(pointX)>14.7 || pointZ<-13.6 || pointZ>24.8) return 0;
    let light = 0;
    for (const {x,z,spanX,spanZ,lengthSq} of emitters) {
      const fraction = THREE.MathUtils.clamp(((pointX-x)*spanX+(pointZ-z)*spanZ)/lengthSq,0,1);
      const distanceSq = (pointX-x-fraction*spanX)**2+(pointZ-z-fraction*spanZ)**2;
      light = Math.max(light,4.85*Math.exp(-distanceSq/.113));
    }
    return light;
  }
  for (let row=0;row<height;row++) {
    const latitude = ((row+.5)/height-.5)*Math.PI;
    const dy = Math.sin(latitude), horizontal = Math.cos(latitude);
    const upper = THREE.MathUtils.smoothstep(dy,-.20,.83);
    for (let column=0;column<width;column++) {
      const azimuth = ((column+.5)/width-.5)*Math.PI*2;
      const dx = Math.cos(azimuth)*horizontal, dz = Math.sin(azimuth)*horizontal;
      const light = ceilingRadiance(dx,dy,dz);
      const wall = Math.max(0,-dz)*.041;
      const i = (row*width+column)*4;
      data[i] = toHalfFloat(.038+upper*.192+wall+light);
      data[i+1] = toHalfFloat(.044+upper*.212+wall*.94+light*.94);
      data[i+2] = toHalfFloat(.058+upper*.239+wall*.78+light*.85);
      data[i+3] = opaque;
    }
  }
  const environment = new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.HalfFloatType);
  environment.mapping = THREE.EquirectangularReflectionMapping;
  environment.colorSpace = THREE.LinearSRGBColorSpace;
  environment.minFilter = environment.magFilter = THREE.LinearFilter;
  environment.needsUpdate = true;
  return environment;
}

export function createSilphTerrain(scene) {
  const ceilingFixtures = [];
  for (const side of [-1,1]) {
    for (const [x,z,length] of [[3.36,7.58,2.01],[4.11,2,2.69],[5.17,-5.59,3.02],[2.89,14,1.89]]) {
      ceilingFixtures.push(new THREE.Vector4(side*x-length/2,z,side*x+length/2,z));
    }
    ceilingFixtures.push(
      new THREE.Vector4(side*7.1,8.89,side*7.78,5.08),
      new THREE.Vector4(side*9.15,-.13,side*9.52,-2.79),
    );
  }
  const environment = roomReflections(ceilingFixtures);
  const textures = [environment];
  function texture(width,height,paint) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    paint(canvas.getContext('2d'),width,height);
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    textures.push(result);
    return result;
  }
  const grain = texture(128,128,(ctx,w,h)=>{
    const data = ctx.createImageData(w,h);
    let seed = 79;
    for (let i=0;i<data.data.length;i+=4) {
      seed = (Math.imul(seed,1664525)+1013904223)>>>0;
      const gray = 232+(seed>>>28);
      data.data[i] = data.data[i+1] = data.data[i+2] = gray;
      data.data[i+3] = 255;
    }
    ctx.putImageData(data,0,0);
  });
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(10,10);
  const falloff = texture(96,96,(ctx,w,h)=>{
    const gradient = ctx.createRadialGradient(w/2,h/2,1,w/2,h/2,w/2);
    gradient.addColorStop(0,'#fff');
    gradient.addColorStop(.26,'#ffffffbb');
    gradient.addColorStop(.57,'#ffffff4d');
    gradient.addColorStop(1,'#ffffff00');
    ctx.fillStyle = gradient;
    ctx.fillRect(0,0,w,h);
  });
  const wallWash = texture(128,128,(ctx,w,h)=>{
    const gradient = ctx.createRadialGradient(w/2,0,2,w/2,0,w/2);
    gradient.addColorStop(0,'#fff');
    gradient.addColorStop(.27,'#ffffff9e');
    gradient.addColorStop(.6,'#ffffff30');
    gradient.addColorStop(1,'#ffffff00');
    ctx.scale(1,2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0,0,w,h/2);
  });
  const stripScatter = texture(232,76,(ctx,w,h)=>{
    const data = ctx.createImageData(w,h);
    for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
      const horizontal = Math.abs((x+.5)/w-.5);
      const end = Math.max(0,horizontal-.26)*8.5;
      const height = ((y+.5)/h-.5)*5.65;
      const edge = Math.min(1,(.5-horizontal)*12);
      const fade = Math.max(0,Math.exp(-(end*end+height*height))-.022)*edge*edge;
      const i = (y*w+x)*4;
      data.data.set([255,255,255,Math.round(fade*255)],i);
    }
    ctx.putImageData(data,0,0);
  });
  const brushed = texture(384,80,(ctx,w,h)=>{
    const data = ctx.createImageData(w,h);
    for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
      const sheen = .23 + .77*Math.exp(-Math.pow((x/w+.13*y/h-.37)/.101,2));
      const gray = Math.min(255,Math.round(157+89*sheen+(y%4)*2.3));
      data.data.set([gray,gray,gray,255],(y*w+x)*4);
    }
    ctx.putImageData(data,0,0);
  });
  const status = texture(120,48,()=>{});
  const material = (color,extra={}) => new THREE.MeshStandardMaterial({color,roughness:.77,...extra});
  const dark = material(0x222631);
  const seam = material(0x282d38);
  const floor = material(0x414a58,{map:grain,roughness:.59,metalness:.145,envMap:environment,envMapIntensity:.73});
  const tileEdge = material(0x454d5a,{roughness:.82});
  const wall = material(0x424955,{metalness:.09,emissive:0x28303a,emissiveIntensity:.25});
  const sideCladding = material(0x505865,{roughness:.70,emissive:0x35404a,emissiveIntensity:.37});
  const wallInset = material(0x373f4d,{emissive:0x263442,emissiveIntensity:.18});
  const steel = material(0x606976,{roughness:.41,metalness:.22,emissive:0x323843,emissiveIntensity:.24,
    envMap:environment,envMapIntensity:.68});
  const galleryMetal = material(0x747e8b,{map:brushed,emissiveMap:brushed,
    roughness:.35,metalness:.24,emissive:0x58616c,emissiveIntensity:.34,envMap:environment,envMapIntensity:.81});
  const steelEdge = material(0x747d8a,{roughness:.35,metalness:.24,envMap:environment,envMapIntensity:.68});
  const ceiling = material(0x393f4c,{emissive:0x3c4551,emissiveIntensity:1.01});
  const ceilingReturn = material(0x354151,{emissive:0x34404e,emissiveIntensity:.69});
  const shoulder = material(0x4c5869,{roughness:.67,emissive:0x394453,emissiveIntensity:.76});
  const columnFace = material(0x657180,{roughness:.56,metalness:.15,emissive:0x34404f,emissiveIntensity:.4,
    envMap:environment,envMapIntensity:.68});
  const recess = material(0x18202a);
  const velvet = material(0x111620,{roughness:.96});
  const violet = new THREE.MeshPhysicalMaterial({color:0x7b2c66,roughness:.30,clearcoat:.44,clearcoatRoughness:.23,
    envMap:environment,envMapIntensity:.85});
  const shell = material(0xd6d4ce,{roughness:.33,envMap:environment,envMapIntensity:.53});
  const line = new THREE.MeshBasicMaterial({color:0xa5a8ad,transparent:true,opacity:.58,depthWrite:false});
  const lens = new THREE.MeshBasicMaterial({color:0xfff7ea,toneMapped:false});
  const lamp = new THREE.MeshBasicMaterial({color:0xffe8cc,toneMapped:false});
  const controlLight = new THREE.MeshBasicMaterial({color:0xa0b2bb,toneMapped:false});
  const readerFace = new THREE.MeshBasicMaterial({map:status,toneMapped:false});
  const glow = (color,opacity,map=falloff) => new THREE.MeshBasicMaterial({
    map,color,opacity,transparent:true,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending,
  });
  const contact = new THREE.MeshBasicMaterial({map:falloff,color:0x11141c,opacity:.63,
    transparent:true,depthWrite:false,toneMapped:false});
  const wallContact = new THREE.MeshBasicMaterial({map:stripScatter,color:0x121722,opacity:.38,
    transparent:true,depthWrite:false,toneMapped:false});
  const hallFill = glow(0xb2bfd6,.083);
  const seatGlow = glow(0xffe5ca,.25);
  const panelGlow = glow(0xffd6ab,.39,wallWash);
  const fixtureGlow = glow(0xffe6c9,.32,stripScatter);
  const walkwayGlow = glow(0xffdbc1,.40);
  const pylonGlow = glow(0xffdab6,.64,wallWash);
  const claddingGlow = glow(0xffd1a8,.29,wallWash);
  const ceilingGlow = glow(0xffeedc,.33,stripScatter);
  const controlGlow = glow(0xa0b2bb,.08,stripScatter);
  const controlBounce = glow(0xa0b2bb,.028);

  function glazing() {
    return new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
      uniforms:{
        ceilingFixtures:{value:ceilingFixtures},
      },
      vertexShader:`
        varying vec3 panelWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          panelWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader:`
        uniform vec4 ceilingFixtures[${ceilingFixtures.length}];
        varying vec3 panelWorld;
        void main() {
          vec3 sight = normalize(cameraPosition - panelWorld);
          vec3 normal = normalize(cross(dFdx(panelWorld), dFdy(panelWorld)));
          float fresnel = pow(1.0 - abs(dot(sight, normal)), 3.4);
          vec3 ray = reflect(-sight, normal);
          float distanceToRoof = (9.07 - panelWorld.y) / max(0.028, ray.y);
          vec2 roof = panelWorld.xz + ray.xz * distanceToRoof;
          float direct = 0.0;
          for (int index = 0; index < ${ceilingFixtures.length}; index++) {
            vec4 fixture = ceilingFixtures[index];
            vec2 segment = fixture.zw - fixture.xy;
            float t = clamp(dot(roof - fixture.xy, segment) / dot(segment, segment), 0.0, 1.0);
            float gap = length(roof - (fixture.xy + segment * t));
            direct = max(direct, 1.0 - smoothstep(0.065, 0.32, gap));
          }
          direct *= step(0.03, ray.y);
          float reflection = panelWorld.x + (panelWorld.y - 5.6) * .37 + sight.x * 2.15 + 11.2;
          float band = reflection / 1.04;
          float sill = (panelWorld.y - 4.49) / .40;
          float broad = exp(-band * band) * .78;
          float edge = exp(-sill * sill);
          vec3 cool = vec3(.068, .121, .168);
          vec3 silver = vec3(.324, .405, .448);
          vec3 color = mix(cool, silver, .34 + broad * .60);
          color = mix(color, vec3(.89, .86, .80), direct * .74);
          float opacity = .052 + fresnel * .35 + broad * .16 + direct * .38 + edge * .054;
          gl_FragColor = vec4(color, min(.74, opacity));
          #include <colorspace_fragment>
        }`,
    });
  }

  function mesh(geometry,surface,x,y,z,parent=scene,casts=false) {
    const result = new THREE.Mesh(geometry,surface);
    result.position.set(x,y,z);
    result.castShadow = casts;
    result.receiveShadow = true;
    parent.add(result);
    return result;
  }
  const box = (w,h,d,surface,x,y,z,parent) => mesh(new THREE.BoxGeometry(w,h,d),surface,x,y,z,parent);
  const cylinder = (top,bottom,h,sides,surface,x,y,z,parent) =>
    mesh(new THREE.CylinderGeometry(top,bottom,h,sides),surface,x,y,z,parent,true);
  function flat(w,h,surface,x,y,z,parent) {
    const part = mesh(new THREE.PlaneGeometry(w,h),surface,x,y,z,parent);
    part.rotation.x = -Math.PI/2;
    return part;
  }
  function outline(points,Shape=THREE.Shape) {
    const shape = new Shape();
    shape.moveTo(...points[0]);
    for (const point of points.slice(1)) shape.lineTo(...point);
    shape.closePath();
    return shape;
  }
  scene.fog = new THREE.Fog(0x262b35,53,125);
  scene.background.setHex(0x262b35);

  // The raised floor is a ring with a six-edged opening around the playable test court.
  const court = [[-16.4,-12.9],[16.4,-12.9],[16.4,6.8],[7.02,11.6],[-7.02,11.6],[-16.4,6.8]];
  const surround = outline([[-19.6,-19],[19.6,-19],[19.6,28],[-19.6,28]]);
  surround.holes.push(outline(court.map(([x,z])=>[x,-z]),THREE.Path));
  box(39.2,.47,43.8,dark,0,-.31,3.7);
  box(35.5,.17,26.2,floor,0,floorHeight-.085,-.7);
  const walkway = mesh(new THREE.ExtrudeGeometry(surround,{depth:.5,bevelEnabled:false}),floor,0,.09,0);
  walkway.rotation.x = -Math.PI/2;
  const curb = outline(court.map(([x,z])=>[x*1.025,-z*1.042]));
  curb.holes.push(outline(court.map(([x,z])=>[x,-z]),THREE.Path));
  mesh(new THREE.ExtrudeGeometry(curb,{depth:.029,bevelEnabled:false}),steel,0,.583,0).rotation.x = -Math.PI/2;

  for (let index=-5;index<=5;index++) {
    const x = index*2.68;
    box(.016,.008,25.3,tileEdge,x,floorHeight+.005,-.71);
    box(33,.009,.014,seam,0,floorHeight+.007,index*2.30);
    box(.021,.012,6.1,seam,x,.595,14.7);
  }
  const ring = mesh(new THREE.RingGeometry(7.45,7.507,112),line,0,floorHeight+.019,0);
  ring.rotation.x = -Math.PI/2;
  flat(22.3,16.7,hallFill,0,floorHeight+.011,.23).renderOrder = -2;
  flat(33.5,2.36,wallContact,0,floorHeight+.014,-12.09).renderOrder = -1;

  const gallery = new THREE.Group();
  scene.add(gallery);
  box(38.7,9.39,.37,dark,0,4.69,-16.55,gallery);
  box(35,3.72,.76,wall,0,2.01,-12.91,gallery);
  box(35.8,.19,.87,steel,0,4.025,-12.74,gallery);
  box(38.3,1.89,.70,wallInset,0,8.14,-13.55,gallery);
  for (let bay=0;bay<8;bay++) {
    const x = (bay-3.5)*4.38;
    box(4.30,3.33,.10,wallInset,x,2.15,-12.47,gallery);
    box(4.35,.13,.21,dark,x,.57,-12.38,gallery);
  }
  for (const x of [-13.65,-6.78,0,6.78,13.65]) {
    box(2.76,.05,.104,lamp,x,3.799,-12.28,gallery);
    mesh(new THREE.PlaneGeometry(6.62,3.43),panelGlow,x,2.072,-12.38,gallery);
    mesh(new THREE.PlaneGeometry(3.67,1.32),fixtureGlow,x,3.744,-12.20,gallery);
    flat(5.2,3.6,seatGlow,x,floorHeight+.022,-11.08,gallery);
  }
  const endReturn = new THREE.ExtrudeGeometry(outline([[15.51,.22],[15.96,.22],[15.29,4.15],[14.96,4.15]]),
    {depth:.36,bevelEnabled:false});
  for (const side of [-1,1]) mesh(endReturn,wall,0,0,-12.49,gallery).scale.x = side;

  // The folded bay and long window share each cross-section of the facade.
  const galleryProfiles = [
    [[-17.43,4.79,-9.60],[-17.33,5.12,-9.54],[-15.62,7.84,-9.00],[-15.07,9.71,-8.96]],
    [[-16.39,4.13,-9.04],[-16.11,5.06,-9.02],[-14.91,7.79,-8.75],[-14.57,9.71,-8.78]],
    [[-12.28,4.13,-7.20],[-12.12,5.00,-7.24],[-11.50,7.71,-7.24],[-11.07,9.56,-7.20]],
    [[-6.22,4.13,-11.91],[-5.91,4.46,-11.91],[-5.24,6.68,-11.91],[-5.01,8.15,-11.91]],
    [[16.98,4.13,-11.91],[16.71,4.46,-11.91],[17.98,6.68,-11.91],[18.36,8.15,-11.91]],
    [[17.50,4.13,-11.91],[17.28,4.46,-11.91],[18.51,6.68,-11.91],[18.75,8.15,-11.91]],
  ];
  const [base,lower,upper,head] = galleryProfiles[0].map((_,row)=>
    galleryProfiles.map(profile=>new THREE.Vector3(...profile[row])));
  const offsetDepth = (row,depth) => row.map(point=>point.clone().setZ(point.z+depth));
  const blendRows = (from,to,t) => from.map((point,index)=>point.clone().lerp(to[index],t));

  function galleryBand(bottom,top,surface) {
    const positions = [], uvs = [], indices = [];
    for (let i=0;i<bottom.length-1;i++) {
      const profile = [bottom[i],bottom[i+1],top[i+1],top[i]];
      for (const [corner,point] of profile.entries()) {
        positions.push(point.x,point.y,point.z);
        uvs.push((point.x+18)/38,corner<2 ? 0 : 1);
      }
      const start = i*4;
      indices.push(start,start+1,start+2,start,start+2,start+3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return mesh(geometry,surface,0,0,0,gallery);
  }

  const headerBreak = offsetDepth(blendRows(upper,head,.39),.06);
  const sillBreak = offsetDepth(blendRows(base,lower,.38),.09);
  galleryBand(base,sillBreak,steel);
  galleryBand(sillBreak,lower,galleryMetal);
  galleryBand(upper,headerBreak,galleryMetal);
  galleryBand(headerBreak,head,steel);
  galleryBand(base.map(point=>point.clone().setZ(-12.45)),base,steel);
  galleryBand(head,head.map(point=>point.clone().setZ(-13.41)),wall);
  for (const edge of [0,lower.length-2]) {
    galleryBand(lower.slice(edge,edge+2),upper.slice(edge,edge+2),galleryMetal);
  }

  const paneLower = offsetDepth(blendRows(lower,upper,.037).slice(1,-1),-.08);
  const paneUpper = offsetDepth(blendRows(upper,lower,.034).slice(1,-1),-.08);
  const bezelLower = lower.slice(1,-1);
  const bezelUpper = upper.slice(1,-1);
  galleryBand(bezelLower,paneLower,dark);
  galleryBand(paneUpper,bezelUpper,dark);
  galleryBand(paneLower,paneUpper,glazing()).renderOrder = 2;
  const leftReveal = [bezelLower[0],bezelUpper[0]];
  const rightReveal = [bezelLower.at(-1),bezelUpper.at(-1)];
  const cabinDepth = 3.92;
  galleryBand(offsetDepth(leftReveal,-cabinDepth),leftReveal,recess);
  galleryBand(rightReveal,offsetDepth(rightReveal,-cabinDepth),recess);

  const innerWall = texture(512,160,(ctx,w,h)=>{
    const gradient = ctx.createLinearGradient(0,0,0,h);
    gradient.addColorStop(0,'#171f2b');
    gradient.addColorStop(.48,'#384552');
    gradient.addColorStop(.79,'#465e6b');
    gradient.addColorStop(1,'#283945');
    ctx.fillStyle = gradient;
    ctx.fillRect(0,0,w,h);
  });
  const innerLower = offsetDepth(lower,-cabinDepth).map(point=>point.setY(4.26));
  const innerUpper = offsetDepth(upper,-cabinDepth).map(point=>point.setY(point.y+.26));
  galleryBand(innerLower,innerUpper,new THREE.MeshBasicMaterial({map:innerWall}));
  galleryBand(offsetDepth(innerLower,cabinDepth-.17),innerLower,recess);
  galleryBand(innerUpper,offsetDepth(innerUpper,cabinDepth-.17),recess);

  const cabinTrim = material(0x425563,{roughness:.58,emissive:0x293e4a,emissiveIntensity:.58});
  const equipment = material(0x243440,{emissive:0x223845,emissiveIntensity:.35});
  const consoleGlass = material(0x315462,{roughness:.37,emissive:0x47788c,emissiveIntensity:.48});
  const instrumentAccent = new THREE.MeshBasicMaterial({color:0x7399a7,toneMapped:false});
  const rearLight = new THREE.MeshBasicMaterial({color:0x94b3bd,toneMapped:false});
  const lightOnPartition = glow(0x9dc5db,.23,wallWash);
  const lightOnCeiling = glow(0xffedd1,.23,stripScatter);
  const profileGeometry = new THREE.SphereGeometry(1,12,8);

  const vertical = new THREE.Vector3(0,1,0);
  function mullion(bottom,top) {
    const span = top.clone().sub(bottom);
    const middle = top.clone().lerp(bottom,.5);
    const post = box(.10,span.length()+.03,.18,dark,middle.x,middle.y,middle.z+.095,gallery);
    post.quaternion.setFromUnitVectors(vertical,span.normalize());
  }

  let stationIndex = 0;
  for (const [section,panes] of [1,2,6].entries()) {
    const start = paneLower[section], end = paneLower[section+1];
    const topStart = paneUpper[section], topEnd = paneUpper[section+1];
    if (section>0) mullion(start,topStart);
    const span = Math.hypot(end.x-start.x,end.z-start.z)/panes;
    const yaw = -Math.atan2(end.z-start.z,end.x-start.x);
    const depth = (cabinDepth-.08)*Math.cos(yaw);
    for (let pane=0;pane<panes;pane++,stationIndex++) {
      if (pane>0) {
        const bottom = start.clone().lerp(end,pane/panes);
        const top = topStart.clone().lerp(topEnd,pane/panes);
        if (section===2) top.x = bottom.x;
        mullion(bottom,top);
      }
      const t = (pane+.50)/panes;
      const sillPoint = start.clone().lerp(end,t);
      const ceilingY = THREE.MathUtils.lerp(topStart.y,topEnd.y,t);
      const bay = new THREE.Group();
      bay.position.set(sillPoint.x,0,sillPoint.z);
      bay.rotation.y = yaw;
      gallery.add(bay);

      // Each bay has a desk near the glass and a lit recess beyond the aisle.
      const deskY = Math.max(4.70,sillPoint.y+.17);
      const deskDepth = depth*(stationIndex%3===1 ? .38 : .25);
      const equipmentDepth = depth*.86;
      const partitionX = stationIndex%2===0 ? -span*.40 : span*.40;
      box(.105,ceilingY-4.23,.79,cabinTrim,partitionX,(ceilingY+4.35)/2,-equipmentDepth+.18,bay);
      box(span*.82,.105,.48,equipment,0,4.65,-equipmentDepth+.18,bay);
      box(span*.79,.068,.36,equipment,0,ceilingY-.48,-equipmentDepth+.29,bay);
      if ([0,3,6,8].includes(stationIndex)) {
        const cabinetX = -partitionX*.47;
        box(.89,1.31,.56,equipment,cabinetX,5.19,-equipmentDepth+.30,bay);
        box(.71,.86,.031,cabinTrim,cabinetX,5.30,-equipmentDepth+.595,bay);
        box(.46,.021,.013,instrumentAccent,cabinetX,5.62,-equipmentDepth+.619,bay);
      } else {
        box(span*.61,.029,.066,rearLight,0,ceilingY-.54,-equipmentDepth+.37,bay);
        const washHeight = Math.min(1.73,ceilingY-4.65);
        mesh(new THREE.PlaneGeometry(span*.76,washHeight),
          lightOnPartition,0,ceilingY-.54-washHeight/2,-equipmentDepth-.045,bay);
      }

      const lampX = stationIndex%2===0 ? -span*.11 : span*.09;
      box(span*.74,.076,.49,equipment,lampX,ceilingY+.015,-depth*.35,bay);
      box(span*.56,.028,.091,lamp,lampX,ceilingY-.035,-depth*.35,bay);
      flat(span*.89,.87,lightOnCeiling,lampX,ceilingY-.053,-depth*.35,bay).rotation.x = Math.PI/2;

      box(span*.76,.104,.61,equipment,0,deskY,-deskDepth,bay);
      box(span*.67,.032,.062,cabinTrim,0,deskY+.014,-deskDepth+.31,bay);
      box(span*.55,deskY-4.26,.29,equipment,0,(deskY+4.26)/2,-deskDepth-.08,bay);
      const monitorX = stationIndex%2===0 ? -span*.19 : span*.10;
      const terminal = new THREE.Group();
      terminal.position.set(monitorX,deskY+.27,-deskDepth-.09);
      terminal.rotation.y = stationIndex%2===0 ? -.16 : .22;
      bay.add(terminal);
      box(.128,.17,.119,cabinTrim,0,-.17,0,terminal);
      box(.73,.406,.114,equipment,0,.031,0,terminal);
      box(.63,.289,.020,consoleGlass,0,.043,.062,terminal);
      box(.23,.013,.008,instrumentAccent,-.116,-.053,.074,terminal);

      if ([0,2,4,6,8].includes(stationIndex)) {
        const staffX = span*.14;
        const staffZ = -depth*(stationIndex===2 || stationIndex===6 ? .68 : .49);
        box(.41,.44,.13,equipment,staffX,deskY-.035,staffZ-.19,bay);
        mesh(profileGeometry,velvet,staffX,deskY+.23,staffZ,bay).scale.set(.29,.35,.17);
        mesh(profileGeometry,velvet,staffX-.032,deskY+.64,staffZ+.025,bay).scale.set(.156,.182,.143);
      }
    }
  }

  const columnFootY = .59, columnHeadY = 8.83, columnFrontZ = -7.21;
  const columnDepth = 1.20, columnBevel = .074;
  const columnFoot = [17.56,19.12], columnHead = [15.17,16.83];
  const columnSpan = y => columnFoot.map((x,index)=>THREE.MathUtils.lerp(x,columnHead[index],
    (y-columnFootY)/(columnHeadY-columnFootY)));
  const mainColumn = new THREE.ExtrudeGeometry(outline([
    [columnFoot[0],columnFootY],[columnFoot[1],columnFootY],
    [columnHead[1],columnHeadY],[columnHead[0],columnHeadY],
  ]),{depth:columnDepth,bevelEnabled:true,bevelSegments:1,bevelSize:.062,bevelThickness:columnBevel});
  const mainColumnGlow = glow(0xffd6ac,.40,wallWash);

  const wings = [-1,1].map(side=>{
    const wing = new THREE.Group();
    wing.scale.x = side;
    scene.add(wing);
    const sideProfile = outline([[18.85,.56],[19.77,.56],[19.77,9.31],[16.35,9.31],[17.19,7.04]]);
    mesh(new THREE.ExtrudeGeometry(sideProfile,{depth:37,bevelEnabled:false}),sideCladding,0,0,-14.7,wing);
    const lowerCladding = outline([[18.71,.61],[18.86,.61],[17.23,7.03],[17.05,7.03]]);
    const cladding = new THREE.ExtrudeGeometry(lowerCladding,{depth:3.81,bevelEnabled:false});
    for (const z of [-12.4,-8.52,-4.64,-.76,3.12,7,10.88,14.76,18.64]) {
      mesh(cladding,sideCladding,0,0,z,wing);
    }
    box(.31,.16,37,steel,18.75,.66,3.8,wing);
    mesh(mainColumn,[columnFace,steel],0,0,columnFrontZ-columnDepth-columnBevel,wing);
    for (const y of [3.08,6.60]) {
      const [inside,outside] = columnSpan(y);
      box(outside-inside-.03,.044,.032,seam,(inside+outside)/2,y,columnFrontZ+.017,wing);
    }
    const [washInside,washOutside] = columnSpan(2.99);
    const wash = mesh(new THREE.PlaneGeometry(1.48,5.05),mainColumnGlow,
      (washInside+washOutside)/2,2.99,columnFrontZ+.040,wing);
    wash.rotation.z = Math.PI+Math.atan2(2.34,columnHeadY-columnFootY);
    box(1.21,.047,.12,lamp,18.22,.659,columnFrontZ+.20,wing);
    flat(4.18,3.92,walkwayGlow,17.65,.611,columnFrontZ+.66,wing);
    const columnLight = new THREE.SpotLight(0xffdbb4,12,7.7,.49,.95,2);
    columnLight.position.set(18.24,.69,columnFrontZ+.42);
    columnLight.target.position.set(17.31,3.65,columnFrontZ-.035);
    wing.add(columnLight,columnLight.target);

    const pylon = outline([[18.56,.59],[19.45,.59],[18.66,9.24],[16.8,9.24],[17.53,6.82]]);
    const pylonGeometry = new THREE.ExtrudeGeometry(pylon,{depth:1.53,bevelEnabled:false});
    for (const z of [2.25,10.57,18.58]) {
      mesh(pylonGeometry,steel,0,0,z,wing);
      box(.12,.059,.84,lamp,18.48,.667,z+.84,wing);
      flat(4.35,4.4,walkwayGlow,17.51,.611,z+.80,wing);
      const wash = mesh(new THREE.PlaneGeometry(1.51,5.89),pylonGlow,18.06,3.40,z+.79,wing);
      wash.rotation.order = 'YXZ';
      wash.rotation.set(.164,-Math.PI/2,Math.PI);
      const sideWash = mesh(new THREE.PlaneGeometry(4.18,6.32),claddingGlow,17.88,3.69,z+.79,wing);
      sideWash.rotation.order = 'YXZ';
      sideWash.rotation.set(.253,-Math.PI/2,Math.PI);
    }
    for (const z of [3.09,11.41]) {
      const uplight = new THREE.SpotLight(0xffe6c9,11,7.3,.83,.92,2);
      uplight.position.set(18.07,.70,z);
      uplight.target.position.set(18.56,3.65,z);
      wing.add(uplight,uplight.target);
    }
    return wing;
  });

  const roof = new THREE.Group();
  scene.add(roof);
  box(23.84,.26,41.1,ceiling,0,ceilingHeight+.13,5.25,roof);
  const innerShoulder = outline([[11.76,9.32],[14.34,9.04],[14.41,8.73],[11.76,9.12]]);
  const outerShoulder = outline([[14.24,9.06],[16.41,9.08],[19.65,7.78],[19.65,7.43],[17.66,7.92],[14.24,8.75]]);
  const innerReturn = new THREE.ExtrudeGeometry(innerShoulder,{depth:41.1,bevelEnabled:false});
  const outerReturn = new THREE.ExtrudeGeometry(outerShoulder,{depth:41.1,bevelEnabled:false});
  for (const side of [-1,1]) {
    mesh(innerReturn,ceilingReturn,0,0,-15.3,roof).scale.x = side;
    mesh(outerReturn,shoulder,0,0,-15.3,roof).scale.x = side;
    box(.077,.098,40,seam,side*11.79,9.08,5.24,roof);
  }
  const rearCoffer = outline([[-14.95,9.22],[-12.85,9.22],[-12.85,8.81],[-13.17,8.61],[-14.95,8.61]]);
  mesh(new THREE.ExtrudeGeometry(rearCoffer,{depth:36.74,bevelEnabled:false}),
    ceilingReturn,18.37,0,0,roof).rotation.y = -Math.PI/2;
  box(35.68,.082,.21,shoulder,0,8.645,-13.13,roof);
  function ceilingStrip(fromX,fromZ,toX,toZ) {
    const x = (fromX+toX)/2, z = (fromZ+toZ)/2;
    const length = Math.hypot(toX-fromX,toZ-fromZ);
    const yaw = Math.atan2(fromZ-toZ,toX-fromX);
    const housing = box(length+.13,.021,.231,dark,x,ceilingHeight-.013,z,roof);
    const emitter = box(length,.012,.147,lens,x,ceilingHeight-.03,z,roof);
    const spill = flat(length+1.82,1.94,ceilingGlow,x,ceilingHeight-.041,z,roof);
    housing.rotation.y = emitter.rotation.y = yaw;
    spill.rotation.set(Math.PI/2,0,-yaw);
  }
  for (const x of [-9.31,-6.94,-1.21,4.54,9.31]) box(.018,.014,40,seam,x,ceilingHeight-.009,5.25,roof);
  for (const z of [-11.4,-5.62,1.97,7.55,13.97,20.83]) {
    box(23.8,.014,.019,seam,0,ceilingHeight-.009,z,roof);
  }
  for (const fixture of ceilingFixtures) ceilingStrip(fixture.x,fixture.y,fixture.z,fixture.w);

  flat(5.95,4.93,contact,0,floorHeight+.016,.01).renderOrder = -1;
  flat(6.65,5.02,controlBounce,0,floorHeight+.024,.1);
  for (const [top,bottom,h,y,surface] of [
    [2.15,2.36,.27,.352,dark],[2.26,2.30,.042,.389,controlLight],
    [1.63,2.09,.236,.533,steel],[1.24,1.58,.083,.65,steelEdge],
  ]) cylinder(top,bottom,h,6,surface,0,y,0).rotation.y = Math.PI/6;
  cylinder(.72,1.05,.208,12,recess,0,.675,0);
  const ballY = 1.44, radius = .694;
  mesh(new THREE.SphereGeometry(radius,40,20,0,Math.PI*2,0,Math.PI/2),violet,0,ballY,0,scene,true);
  mesh(new THREE.SphereGeometry(radius,40,20,0,Math.PI*2,Math.PI/2,Math.PI/2),shell,0,ballY,0,scene,true);
  cylinder(.698,.698,.085,40,velvet,0,ballY,0);
  cylinder(.199,.199,.08,26,velvet,0,ballY,.674).rotation.x = Math.PI/2;
  cylinder(.145,.145,.065,26,shell,0,ballY,.717).rotation.x = Math.PI/2;
  for (const x of [-3.57,3.57]) {
    box(2.50,.014,.13,dark,x,floorHeight+.016,0);
    box(2.35,.018,.05,controlLight,x,floorHeight+.027,0);
    flat(3.53,1.12,controlGlow,x,floorHeight+.035,0);
  }
  for (let index=0;index<3;index++) {
    const a = index*Math.PI*2/3;
    const reader = new THREE.Group();
    reader.position.set(Math.sin(a)*1.31,.664,Math.cos(a)*1.31);
    reader.rotation.y = a;
    scene.add(reader);
    box(.66,.05,.23,dark,0,0,0,reader);
    flat(.60,.194,readerFace,0,.027,0,reader);
  }

  let previousTeam;
  return {
    floorY:floorHeight,
    objectiveBounds:[
      new THREE.Box3(new THREE.Vector3(-radius,.74,-radius),new THREE.Vector3(radius,ballY+radius,.78)),
      new THREE.Box3(new THREE.Vector3(-2.36,.2,-2.08),new THREE.Vector3(2.36,.79,2.08)),
    ],
    createPokemonShadow(group) {
      const footShadow = flat(1.58,1.32,contact,0,floorHeight+.014-group.position.y,-.24,group);
      footShadow.renderOrder = -1;
      footShadow.visible = false;
      return footShadow;
    },
    createTrainerShadow(group) {
      const shadow = flat(.89,.69,contact,0,floorHeight+.012-group.position.y,0,group);
      shadow.renderOrder = -1;
      shadow.visible = false;
      return shadow;
    },
    setObjective(state) {
      const team = state?.control?.team ?? null;
      if (team===previousTeam) return;
      previousTeam = team;
      const color = teamColors[team] ?? 0x87939f;
      controlLight.color.setHex(color);
      controlGlow.color.setHex(color);
      controlGlow.opacity = team ? .30 : .075;
      controlBounce.color.setHex(color);
      controlBounce.opacity = team ? .18 : .028;
      const ctx = status.image.getContext('2d');
      ctx.fillStyle = '#192029';
      ctx.fillRect(0,0,120,48);
      ctx.fillStyle = `#${color.toString(16).padStart(6,'0')}`;
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(team ? team.at(-1).toUpperCase() : '–',60,25);
      status.needsUpdate = true;
    },
    update(camera,mode) {
      gallery.visible = camera.position.z > -11.8;
      wings[0].visible = camera.position.x > -17.4;
      wings[1].visible = camera.position.x < 17.4;
      roof.visible = mode!=='wide' && camera.position.y<ceilingHeight-.14 && gallery.visible &&
        Math.abs(camera.position.x)<17.4;
    },
    dispose() { for (const map of textures) map.dispose(); },
  };
}
