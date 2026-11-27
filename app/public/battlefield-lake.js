import * as THREE from '/vendor/three.module.js';

export const lakeSeatRadius = 8.9;

const turn = Math.PI*2;
const waterLevel = -.37;
const shoreScale = 1.34;
const bankProfile = {base:17.2,swell:1.85,inlet:1.1,edge:.48};
const fogRange = {near:26,far:70};

function seededRandom(seed) {
  return () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
}

function shoreRadius(angle) {
  return bankProfile.base + bankProfile.swell*Math.sin(3*angle+.56) +
    bankProfile.inlet*Math.cos(5*angle-.62) + bankProfile.edge*Math.sin(8*angle+.32);
}

function shoreHeight(distance, angle) {
  const rise = THREE.MathUtils.smoothstep(distance,-1.25,2.4);
  const undulation = .23*Math.sin(angle*11+distance*.51) + .19*Math.cos(angle*17-distance*.63);
  const hills = Math.max(0,distance-1.4)*(.085+.032*Math.sin(angle*4)**2);
  const hummocks = (.24*Math.sin(distance*.76+angle*12) + .14*Math.sin(distance*1.39-angle*27)) *
    THREE.MathUtils.smoothstep(distance,1.7,8);
  return -1.2 + rise*(1.67+undulation) + hills + hummocks;
}

function buildBank() {
  const segments = 160, rows = 32;
  const positions = [], indices = [];
  for (let i=0;i<=segments;i++) {
    const angle = i/segments*turn;
    for (let j=0;j<=rows;j++) {
      const distance = -1.82 + (j/rows)**1.55*41;
      const radius = shoreRadius(angle)+distance;
      positions.push(Math.sin(angle)*radius,shoreHeight(distance,angle),Math.cos(angle)*radius);
      if (i<segments && j<rows) {
        const a = i*(rows+1)+j, b = a+rows+1;
        indices.push(a,a+1,b,b,a+1,b+1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// Broken edges and two inset layers give each piece a continuous, walkable cap.
function rockGeometry(seed, outline, bottom = -1) {
  const random = seededRandom(seed);
  const contour = outline ?? Array.from({length:9},(_,i)=>{
    const angle = (i+(random()-.5)*.45)/9*turn;
    const radius = .82+random()*.22;
    return [Math.cos(angle)*radius,Math.sin(angle)*radius];
  });
  const positions = [], colors = [];
  const height = -bottom;
  const cap = contour.map(([x,z])=>[x*.87,0,z*.88]);
  const lip = contour.map(([x,z])=>[x,-height*(.13+random()*.12),z]);
  const seam = contour.map(([x,z])=>[x*.94,bottom+height*(.30+random()*.16),z*1.02]);
  const foot = contour.map(([x,z])=>[x*1.02,bottom,z*.94]);
  const triangle = (a,b,c,value)=>{
    positions.push(...a,...b,...c);
    colors.push(value,value,value,value,value,value,value,value,value);
  };
  for (let i=0;i<contour.length;i++) {
    const next = (i+1)%contour.length;
    triangle([0,0,0],cap[next],cap[i],.90+random()*.10);
    for (const [high,low,shade] of [[cap,lip,.83],[lip,seam,.64],[seam,foot,.52]]) {
      const value = shade+random()*.16;
      triangle(high[i],high[next],low[i],value);
      triangle(high[next],low[next],low[i],value*.95);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  return geometry;
}

const noise = `
  float lakeHash(vec2 p) {
    vec3 q = fract(p.xyx * .1031);
    q += dot(q,q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }
  float lakeNoise(vec2 p) {
    vec2 cell = floor(p), f = fract(p);
    vec2 w = f*f*(3. - 2.*f);
    return mix(mix(lakeHash(cell),lakeHash(cell+vec2(1.,0.)),w.x),
      mix(lakeHash(cell+vec2(0.,1.)),lakeHash(cell+vec2(1.)),w.x),w.y);
  }
`;

const shorelineShader = `
  float distanceFromShore(vec2 point) {
    float angle = atan(point.x,point.y);
    float bank = ${bankProfile.base} + ${bankProfile.swell}*sin(3.*angle+.56)
      + ${bankProfile.inlet}*cos(5.*angle-.62) + ${bankProfile.edge}*sin(8.*angle+.32);
    return length(point)-bank;
  }
`;

const surfaceRelief = `
  vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
  vec3 rx = cross(sy,normal), ry = cross(normal,sx);
  float basis = dot(sx,rx)*faceDirection;
  vec3 gradient = sign(basis)*(dFdx(relief)*rx + dFdy(relief)*ry);
  normal = normalize(abs(basis)*normal - gradient);
`;

function useWorldPosition(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>','#include <common>\nvarying vec3 lakePosition;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\nlakePosition = (modelMatrix * vec4(transformed,1.)).xyz;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>',`#include <common>\nvarying vec3 lakePosition;\n${noise}`);
}

function slateSurface(color,moss) {
  const material = new THREE.MeshPhysicalMaterial({color,vertexColors:true,roughness:.49,
    metalness:.06,clearcoat:.32,clearcoatRoughness:.37});
  const mossColor = new THREE.Color(moss);
  material.onBeforeCompile = shader=>{
    shader.uniforms.slateMoss = {value:mossColor};
    useWorldPosition(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>','#include <common>\nuniform vec3 slateMoss;')
      .replace('#include <color_fragment>',`
        #include <color_fragment>
        vec2 grainPoint = lakePosition.xz + vec2(lakePosition.y*.73,-lakePosition.y*1.24);
        float grain = lakeNoise(grainPoint*13.);
        float plates = lakeNoise(grainPoint*2.7);
        float seam = lakePosition.y*15. + lakePosition.x*1.28 - lakePosition.z*.48 + plates*1.95;
        float strata = smoothstep(.65,.98,sin(seam));
        float wet = smoothstep(.32,.67,lakeNoise(grainPoint*1.8+grain*.16));
        vec3 skyNormal = transformDirectionByInverseViewMatrix(normalize(vNormal),viewMatrix);
        float lichen = smoothstep(.56,.79,plates + grain*.14) *
          smoothstep(.24,.94,skyNormal.y) * smoothstep(-.26,.08,lakePosition.y);
        diffuseColor.rgb *= .67 + .38*grain + .21*plates - strata*.19 - wet*.16;
        diffuseColor.rgb += vec3(.020,.035,.050)*strata*(.30+.34*wet);
        diffuseColor.rgb = mix(diffuseColor.rgb,slateMoss,lichen*.72);
      `)
      .replace('#include <roughnessmap_fragment>',`
        #include <roughnessmap_fragment>
        roughnessFactor = mix(.65,.29,wet*(1.-lichen));
      `)
      .replace('#include <normal_fragment_maps>',`
        #include <normal_fragment_maps>
        float relief = .006*grain + .021*plates + .009*strata;
        ${surfaceRelief}
      `);
  };
  return material;
}

function forestFloor() {
  const material = new THREE.MeshStandardMaterial({roughness:.87,transparent:true,depthWrite:false});
  material.onBeforeCompile = shader=>{
    useWorldPosition(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',`#include <common>\n${shorelineShader}`)
      .replace('#include <color_fragment>',`
        #include <color_fragment>
        vec2 p = lakePosition.xz;
        float shore = distanceFromShore(p);
        float inland = smoothstep(.12,2.9,shore);
        float clusters = lakeNoise(p*.49+.12*lakeNoise(p*1.8));
        float cover = lakeNoise(p*1.34+clusters*1.9);
        float grit = lakeNoise(p*13.5);
        float pebbles = smoothstep(.65,.91,lakeNoise(p*5.9));
        float moss = smoothstep(.29,.69,clusters*.74+cover*.38);
        float litter = smoothstep(.51,.76,cover*.63+grit*.46);
        vec3 soil = mix(vec3(.041,.034,.028),vec3(.071,.050,.030),clusters);
        vec3 needleBed = vec3(.109,.068,.034);
        vec3 mossBed = mix(vec3(.027,.047,.023),vec3(.072,.099,.038),cover);
        vec3 gravel = mix(vec3(.033,.044,.047),vec3(.078,.085,.078),pebbles);
        vec3 bed = mix(mix(soil,needleBed,litter*.71),mossBed,moss*.85);
        float tide = 1.-smoothstep(.07,1.9,shore+cover*.26);
        float wet = tide*.61 + (1.-moss)*.32*smoothstep(.23,.59,cover);
        float needles = lakeNoise((mat2(.82,.57,-.57,.82)*p)*vec2(14.,72.));
        float closeDetail = 1.-smoothstep(13.,32.,distance(cameraPosition,lakePosition));
        bed *= .77+.25*grit + (.19*litter+.13*moss)*closeDetail*needles;
        bed += vec3(.032,.027,.016)*litter*pebbles*.48;
        diffuseColor.rgb *= mix(gravel,bed,inland)*mix(1.,.62,wet);
        diffuseColor.a *= 1.-smoothstep(36.,54.,length(p));
      `)
      .replace('#include <roughnessmap_fragment>',`
        #include <roughnessmap_fragment>
        roughnessFactor = mix(.93,.40,wet);
      `)
      .replace('#include <normal_fragment_maps>',`
        #include <normal_fragment_maps>
        float relief = .034*cover + .019*pebbles + .009*grit*closeDetail;
        ${surfaceRelief}
      `);
  };
  return material;
}

function dockSurface(color) {
  const material = new THREE.MeshStandardMaterial({color,roughness:.39,metalness:.10});
  material.onBeforeCompile = shader=>{
    useWorldPosition(shader);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      vec2 treeGrain = mat2(.93,.37,-.37,.93)*lakePosition.xz;
      treeGrain.y += abs(lakePosition.y)*.72;
      float pores = lakeNoise(treeGrain*vec2(3.4,61.));
      float grain = lakeNoise(treeGrain*vec2(.89,29.) + vec2(0.,pores*.64));
      diffuseColor.rgb *= .64 + .42*grain + .18*pores;
      diffuseColor.rgb += vec3(.026,.029,.032)*smoothstep(.69,.94,grain)*.36;
    `);
  };
  return material;
}

function waterSurface(clock, signal) {
  const material = new THREE.MeshStandardMaterial({color:0xffffff,roughness:.36,metalness:.06});
  material.onBeforeCompile = shader=>{
    shader.uniforms.lakeClock = clock;
    shader.uniforms.lakeSignal = signal;
    useWorldPosition(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',`
        #include <common>
        ${shorelineShader}
        uniform float lakeClock;
        uniform vec3 lakeSignal;
      `)
      .replace('#include <color_fragment>',`
        #include <color_fragment>
        vec2 p = lakePosition.xz;
        float distanceToBank = -distanceFromShore(p);
        vec3 view = normalize(cameraPosition-lakePosition);
        float grazing = pow(1.-clamp(view.y,0.,1.),2.9);
        float pooled = lakeNoise(p*.52-vec2(0.,lakeClock*.048));
        float ripple = lakeNoise(vec2(p.x*2.55,p.y*6.1) + vec2(pooled*1.38,lakeClock*.36));
        float refractDepth = (1.-exp(-max(distanceToBank+.2,0.)*.24));
        vec2 floorPoint = p + vec2(pooled-.5,ripple-.5)*.21;
        float shoal = 1.-smoothstep(.30,4.8,distanceToBank+pooled*.48);
        float pebbles = 0.;
        if (shoal > .01) {
          vec2 shaleBed = mat2(.85,.53,-.53,.85)*floorPoint*vec2(1.66,2.15);
          shaleBed += vec2(lakeNoise(floorPoint*1.07),lakeNoise(floorPoint*.93+11.))*1.54;
          vec2 rockCell = floor(shaleBed-.5);
          for (int j=0; j<2; j++) {
            for (int i=0; i<2; i++) {
              vec2 cell = rockCell + vec2(float(i),float(j));
              float size = lakeHash(cell+7.1);
              vec2 offset = .22+.56*vec2(lakeHash(cell+3.4),lakeHash(cell+9.1));
              vec2 piece = abs(shaleBed-cell-offset);
              float shape = max(piece.x*.84+piece.y*.18,piece.y*.85+piece.x*.26);
              pebbles = max(pebbles,(.35+.65*size)*(1.-smoothstep(.18+size*.12,.30+size*.15,shape)));
            }
          }
        }
        vec3 bottom = mix(vec3(.028,.090,.088),vec3(.104,.161,.139),pebbles*.68);
        vec3 openWater = mix(vec3(.016,.060,.080),vec3(.028,.105,.115),pooled*.77 + ripple*.23);
        vec3 color = mix(openWater,bottom,shoal*(1.-grazing*.54));
        color = mix(color,vec3(.147,.223,.267),grazing*(.32+.20*refractDepth));

        // Broken silhouettes echo the far spruce line and slate across the water.
        vec2 horizon = vec2(p.x*.91+.14*ripple,p.y*.38);
        float reflectedTree = lakeNoise(vec2(horizon.x*2.5,horizon.y*.43))+lakeNoise(horizon*.63)*.35;
        float farBank = smoothstep(4.8,15.5,-p.y)*(1.-shoal*.4);
        float reflection = smoothstep(.47,.88,reflectedTree)*farBank*grazing;
        color = mix(color,vec3(.012,.040,.050),reflection*.67);
        color += vec3(.079,.143,.167) * farBank*grazing *
          smoothstep(.75,.98,lakeNoise(vec2(p.x*.92,p.y*11.) + ripple*.83))*.64;
        float skyBreak = exp(-.032*pow(p.x+2.6+.21*p.y,2.));
        float line = sin(p.y*14.6 + p.x*1.9 + pooled*6.1 - lakeClock*1.43);
        float bright = smoothstep(.50,.95,line)*smoothstep(.61,.94,ripple);
        color += vec3(.129,.192,.218)*bright*(.35+skyBreak*.75)*(.51+grazing*.61);
        float lap = exp(-abs(distanceToBank-.48+pooled*.38)*6.4);
        color += vec3(.081,.127,.133)*lap*(.16+ripple*.65);

        vec2 dropGrid = p*2.12;
        vec2 cell = floor(dropGrid);
        vec2 drop = .25 + .50*vec2(lakeHash(cell+3.1),lakeHash(cell+19.));
        float cycle = fract(lakeClock*.60 + lakeHash(cell+4.9));
        float impact = length(fract(dropGrid)-drop);
        float ringDistance = abs(impact - .06 - cycle*.27);
        float ring = (1.-smoothstep(.01,.034+cycle*.011,ringDistance))*(1.-cycle);
        float splash = (1.-smoothstep(.013,.063,impact))*(1.-smoothstep(.05,.22,cycle));
        color += vec3(.103,.162,.186)*(ring*.28 + splash*.51) *
          smoothstep(.25,.76,lakeHash(cell))*smoothstep(.06,.35,view.y);
        float lampTrack = exp(-pow((p.x-1.36 + ripple*.13)*5.3,2.)) *
          smoothstep(.35,1.25,p.y)*(1.-smoothstep(1.7,3.9,p.y));
        color += lakeSignal*lampTrack*smoothstep(.30,.88,ripple)*.14;
        diffuseColor.rgb *= color;
      `);
  };
  return material;
}

function addRainAndMist(root, place, clock) {
  const random = seededRandom(10833);
  const streaks = [], lengths = [];
  for (let i=0;i<1050;i++) {
    const x = (random()-.5)*62, z = (random()-.63)*62, y = random()*12;
    if (z>10 && Math.abs(x)<3.8 && i%3!==0) continue;
    const length = .11+random()*.29;
    streaks.push(x,y,z,x,y,z);
    lengths.push(0,length);
  }
  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute('position',new THREE.Float32BufferAttribute(streaks,3));
  rainGeometry.setAttribute('tail',new THREE.Float32BufferAttribute(lengths,1));
  const rain = new THREE.LineSegments(rainGeometry,new THREE.ShaderMaterial({
    uniforms:{lakeClock:clock,tint:{value:new THREE.Color(0xc9e3ee)}},
    vertexShader:`
      attribute float tail;
      uniform float lakeClock;
      varying float opacity;
      void main() {
        float phase = mod(position.y - lakeClock*9.3,12.);
        vec3 point = vec3(position.x + phase*.11 - tail*.11,phase-.45-tail,position.z + phase*.05);
        vec4 viewPoint = modelViewMatrix*vec4(point,1.);
        opacity = smoothstep(.0,1.4,phase)*(1.-smoothstep(10.0,12.,phase)) *
          smoothstep(1.4,6.4,-viewPoint.z)*(1.-smoothstep(24.,48.,-viewPoint.z));
        gl_Position = projectionMatrix*viewPoint;
      }
    `,
    fragmentShader:`
      uniform vec3 tint;
      varying float opacity;
      void main() {
        gl_FragColor = vec4(tint,opacity*.22);
        #include <colorspace_fragment>
      }
    `,
    transparent:true,depthWrite:false,
  }));
  rain.frustumCulled = false;
  rain.renderOrder = 4;
  root.add(rain);

  const fog = new THREE.ShaderMaterial({
    uniforms:{lakeClock:clock,tint:{value:new THREE.Color(0xabc0cc)}},
    vertexShader:`
      varying vec2 mistUV;
      void main() {
        mistUV = uv;
        gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.);
      }
    `,
    fragmentShader:`
      varying vec2 mistUV;
      uniform float lakeClock;
      uniform vec3 tint;
      ${noise}
      void main() {
        vec2 p = mistUV;
        float cloud = lakeNoise(vec2(p.x*5.2-lakeClock*.032,p.y*2.5));
        float filament = lakeNoise(vec2(p.x*11.8-lakeClock*.047,p.y*3.2+cloud*1.4));
        float edge = smoothstep(0.,.18,p.x)*(1.-smoothstep(.79,1.,p.x));
        float height = smoothstep(0.,.18,p.y)*(1.-smoothstep(.22,.98,p.y));
        gl_FragColor = vec4(tint, edge*height*(.065 + cloud*.21 + filament*.14));
        #include <colorspace_fragment>
      }
    `,
    transparent:true,depthWrite:false,side:THREE.DoubleSide,
  });
  for (const [x,y,z,w,h,yaw] of [
    [0,1.0,-14.1,24,3.7,.05],[-13.2,1.45,-13.8,13,4.4,.53],[13.4,1.1,-12.5,13,3.8,-.53],
    [-6.5,4.15,-22.5,26,5.7,.14],[9.5,4.9,-24.1,25,6.3,-.11],[.8,6.5,-31,36,7.2,.12],
    [-7.2,3.2,21.2,21,4.6,-.17],[8.9,3.8,23.8,24,5.4,.20],
  ]) {
    const veil = place(new THREE.PlaneGeometry(w*shoreScale,h),fog,x*shoreScale,y,z*shoreScale);
    veil.rotation.y = yaw;
    veil.renderOrder = 2;
  }
  return rain;
}

function addOvercastSky(place,onReady) {
  const backdropReady = {value:0};
  const backdrop = new THREE.TextureLoader().load('/lake-forest-panorama.webp',()=>{
    backdropReady.value = 1;
    onReady();
  });
  backdrop.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.ShaderMaterial({
    uniforms:{
      horizon:{value:new THREE.Color(0x8fa8b5)}, clouds:{value:new THREE.Color(0x536775)},
      silver:{value:new THREE.Color(0xc0cdd3)}, backdrop:{value:backdrop}, backdropReady,
    },
    vertexShader:`
      varying vec3 direction;
      void main() {
        direction = position;
        gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.);
      }
    `,
    fragmentShader:`
      varying vec3 direction;
      uniform vec3 horizon, clouds, silver;
      uniform sampler2D backdrop;
      uniform float backdropReady;
      ${noise}
      void main() {
        vec3 d = normalize(direction);
        float y = max(d.y,0.);
        vec2 p = d.xz/(.30+y);
        float cloud = lakeNoise(p*1.51)*.62 + lakeNoise(p*3.26+4.2)*.25 + lakeNoise(p*8.5)*.13;
        vec3 color = mix(horizon,clouds,smoothstep(.005,.71,y)*.64);
        color = mix(color,silver,smoothstep(.26,.77,cloud)*(.65-y*.21));
        color *= .86 + .19*cloud;
        if (backdropReady > .5) {
          // Mirror the panorama around the dome so the free camera can turn through its edges.
          float azimuth = atan(d.x,-d.z);
          float u = 1.-abs(fract(azimuth*.15915494+.24)*2.-1.);
          float v = (d.y+.085)/.43;
          float blend = smoothstep(0.,.20,v)*(1.-smoothstep(.76,1.,v));
          vec3 ridges = texture2D(backdrop,vec2(u,clamp(v,0.,1.))).rgb;
          color = mix(color,ridges,blend*.94);
        }
        gl_FragColor = vec4(color,1.);
        #include <colorspace_fragment>
      }
    `,
    side:THREE.BackSide,depthWrite:false,
  });
  place(new THREE.SphereGeometry(98,32,16),material,0,0,0).renderOrder = -5;
  return backdrop;
}

function buildForest(root) {
  const random = seededRandom(90817);
  const trees = [];
  const bands = [
    {count:92,start:2.2,spread:4.9,height:2.6,variation:4.1,entrySetback:6.1,cliffSetback:3.1,color:0x24443a},
    {count:122,start:6.4,spread:6.4,height:3.9,variation:4.6,entrySetback:3.9,cliffSetback:1.3,color:0x2b483d},
    {count:140,start:12,spread:10.8,height:4.6,variation:4.5,entrySetback:1.7,cliffSetback:0,color:0x375451},
  ];
  bands.forEach(({count,start,spread,height,variation,entrySetback,cliffSetback,color},row)=>{
    for (let i=0;i<count;i++) {
      const angle = (i+random()*.93+row*.37)/count*turn;
      const entry = THREE.MathUtils.smoothstep(Math.cos(angle),.73,.975);
      const cliff = THREE.MathUtils.smoothstep(-Math.cos(angle-.14),.61,.97);
      const grouping = .54*Math.sin(angle*13+row*.93)+.37*Math.sin(angle*22-row*1.08);
      const distance = start + random()*spread + grouping + entry*entrySetback + cliff*cliffSetback;
      const radius = shoreRadius(angle)+distance;
      const stature = (height+random()*variation+grouping*.55)*(1-entry*.41);
      trees.push({
        x:Math.sin(angle)*radius,y:shoreHeight(distance,angle)-.14,z:Math.cos(angle)*radius,
        height:stature,rotation:random()*turn,spread:.80+random()*.38,color,
      });
    }
  });
  for (let i=0;i<75;i++) {
    const angle = (i+random())/75*turn;
    const entry = THREE.MathUtils.smoothstep(Math.cos(angle),.84,.98);
    const distance = 2.1+random()*5.1+entry*3.4;
    const radius = shoreRadius(angle)+distance;
    trees.push({
      x:Math.sin(angle)*radius,y:shoreHeight(distance,angle)-.10,z:Math.cos(angle)*radius,
      height:1.12+random()*2.40,rotation:random()*turn,spread:.85+random()*.48,color:0x304a36,
    });
  }
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  const bark = new THREE.MeshStandardMaterial({color:0x574a42,roughness:.92});
  const needles = new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,flatShading:true});
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.048,.12,1,6),bark,trees.length);
  const crown = new THREE.ConeGeometry(1,1,11,2);
  const position = crown.attributes.position;
  for (let i=0;i<position.count;i++) {
    const angle = Math.atan2(position.getX(i),position.getZ(i));
    const shape = 1+.18*Math.sin(5*angle)+.12*Math.cos(3*angle+.6);
    position.setX(i,position.getX(i)*shape);
    position.setZ(i,position.getZ(i)*shape);
    if (position.getY(i)<-.1) position.setY(i,position.getY(i)+.15*Math.cos(4*angle));
  }
  crown.computeVertexNormals();
  const boughs = new THREE.InstancedMesh(crown,needles,trees.length*5);
  trees.forEach(({x,y,z,height,rotation,spread,color:shade},i)=>{
    dummy.rotation.set(0,rotation,0);
    dummy.position.set(x,y+height*.34,z);
    dummy.scale.set(height*.46,height*.70,height*.46);
    dummy.updateMatrix();
    trunks.setMatrixAt(i,dummy.matrix);
    for (let j=0;j<5;j++) {
      const width = height*(.228-j*.034)*spread*(.82+random()*.31);
      dummy.rotation.set(.071*Math.sin(rotation+j),rotation+j*.54,.07*Math.cos(rotation+j));
      dummy.position.set(x+Math.cos(rotation)*j*.055,y+height*(.43+j*.13),z+Math.sin(rotation)*j*.055);
      dummy.scale.set(width,height*(.52-j*.041),width*.88);
      dummy.updateMatrix();
      const index = i*5+j;
      boughs.setMatrixAt(index,dummy.matrix);
      color.setHex(shade).multiplyScalar(.72+random()*.49+j*.042);
      boughs.setColorAt(index,color);
    }
  });
  root.add(trunks,boughs);
}

function addGroundCover(place) {
  const random = seededRandom(72909);
  const positions = [], colors = [];
  const color = new THREE.Color();
  const clumps = 258;
  for (let i=0;i<clumps;i++) {
    const angle = (i+random())/clumps*turn;
    const distance = .94+random()*4.4;
    const radius = shoreRadius(angle)+distance;
    const x = Math.sin(angle)*radius, z = Math.cos(angle)*radius;
    const height = shoreHeight(distance,angle)-.03;
    for (let j=0;j<13;j++) {
      const a = random()*turn, spread = random()**.5*.43;
      const dx = Math.sin(a), dz = Math.cos(a);
      const px = x+dx*spread, pz = z+dz*spread;
      const h = .13+random()*.39, lean = .10+random()*.16, w = .013+random()*.018;
      positions.push(px-dz*w,height,pz+dx*w,px+dz*w,height,pz-dx*w,px+dx*lean,height+h,pz+dz*lean);
      color.setHex([0x586138,0x355443,0x69724c][j%3]).multiplyScalar(.74+random()*.48);
      colors.push(color.r*.54,color.g*.54,color.b*.54,color.r*.69,color.g*.69,color.b*.69,color.r,color.g,color.b);
    }
  }
  const ferns = 204;
  for (let i=0;i<ferns;i++) {
    const angle = (i+random())/ferns*turn;
    const distance = 2.4+random()**1.35*11;
    const radius = shoreRadius(angle)+distance;
    const x = Math.sin(angle)*radius, z = Math.cos(angle)*radius;
    const y = shoreHeight(distance,angle)-.025;
    const scale = .54+random()*.76;
    const spin = random()*turn;
    for (let j=0;j<7;j++) {
      const direction = spin+j*turn/7+(random()-.5)*.42;
      const dx = Math.sin(direction), dz = Math.cos(direction);
      const length = scale*(.34+random()*.33);
      const peak = scale*(.15+random()*.28);
      const width = scale*(.058+random()*.072);
      const mx = x+dx*length*.53, mz = z+dz*length*.53;
      const tip = [x+dx*length,y+peak*.57,z+dz*length];
      const mid = [mx,y+peak,mz];
      const left = [mx-dz*width,y+peak*.68,mz+dx*width];
      const right = [mx+dz*width,y+peak*.72,mz-dx*width];
      positions.push(x,y,z,...left,...mid, x,y,z,...mid,...right, ...left,...tip,...mid, ...mid,...tip,...right);
      color.setHex([0x3d5a3c,0x50673c,0x627649][(i+j)%3]).multiplyScalar(.82+random()*.32);
      for (const shade of [.46,.75,1,.50,1,.84,.75,.92,1,1,.92,.84]) {
        colors.push(color.r*shade,color.g*shade,color.b*shade);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  const cover = place(geometry,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.88}),0,0,0);
  cover.receiveShadow = true;
}

export function createLakeTerrain(scene,onBackdropReady) {
  scene.background = new THREE.Color(0x8399a5);
  const fog = new THREE.Fog(0x647e8a,fogRange.near,fogRange.far);
  scene.fog = fog;
  const root = new THREE.Group();
  scene.add(root);
  const clock = {value:0};
  const signal = {value:new THREE.Color()};
  const material = (color,options={})=>new THREE.MeshStandardMaterial({color,roughness:.8,...options});
  const place = (geometry,surface,x,y,z,parent=root)=>{
    const mesh = new THREE.Mesh(geometry,surface);
    mesh.position.set(x,y,z);
    parent.add(mesh);
    return mesh;
  };
  const cube = new THREE.BoxGeometry(1,1,1);
  const block = (w,h,d,surface,x,y,z,parent)=>{
    const mesh = place(cube,surface,x,y,z,parent);
    mesh.scale.set(w,h,d);
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  };
  const rock = slateSurface(0x4a5659,0x3e5036);
  const darkRock = slateSurface(0x404c51,0x354634);
  const mossyRock = slateSurface(0x46544a,0x56623b);
  const rockShapes = [31,43,57,79,113].map(seed=>rockGeometry(seed));
  const random = seededRandom(44701);
  const stone = (x,y,z,w,h,d,surface=rock,tilt=0,shadows=true)=>{
    const slab = place(rockShapes[Math.floor(random()*rockShapes.length)],surface,x,y,z);
    slab.scale.set(w,h,d);
    slab.rotation.set(tilt*.31,random()*turn,tilt);
    slab.castShadow = slab.receiveShadow = shadows;
    return slab;
  };

  const backdrop = addOvercastSky(place,onBackdropReady);
  const waterRadius = bankProfile.base+bankProfile.swell+bankProfile.inlet+bankProfile.edge+4;
  const water = place(new THREE.CircleGeometry(waterRadius,128).rotateX(-Math.PI/2),waterSurface(clock,signal),0,waterLevel,0);
  water.receiveShadow = true;
  place(buildBank(),forestFloor(),0,0,0).receiveShadow = true;

  const shoreRocks = 108;
  for (let i=0;i<shoreRocks;i++) {
    const angle = (i+random())/shoreRocks*turn;
    const distance = -.78+random()*3.4;
    const radius = shoreRadius(angle)+distance;
    const size = .42+random()*1.14;
    const mat = [rock,darkRock,mossyRock][i%3];
    stone(Math.sin(angle)*radius,shoreHeight(distance,angle)+.15+random()*.51,Math.cos(angle)*radius,
      size*(1.05+random()*.58),size*(.39+random()*.37),size*(.59+random()*.38),mat,(random()-.5)*.26,i%3!==0);
  }

  // Stepped slate rises behind the encounter, with the high crest toward the right shore.
  for (const [x,y,z,w,h,d,tilt,yaw] of [
    [-12.9,.63,-12.3,4.4,1.45,2.7,.12,.3],[-8.8,1.22,-15.6,5.3,2.01,2.6,.13,-.24],
    [-4.35,2.08,-16.45,5.36,3.13,2.78,.15,-.22],[1.3,2.56,-17.4,5.45,3.46,3.39,.17,-.28],
    [7.55,3.63,-17.25,6.52,4.68,3.36,.18,-.20],[11.45,2.25,-15.28,3.82,3.12,2.22,.22,.21],
    [14.16,1.39,-12.5,3.9,2.18,2.45,.13,.5],[-2.2,1.11,-13.84,4.5,1.86,1.95,.11,-.28],
    [3.8,1.36,-14.18,5.2,2.07,1.7,.13,-.22],[8.66,1.43,-12.84,4.4,2.1,2.05,.17,.15],
    [12.42,.79,-10.82,2.95,1.5,2.32,.14,.5],[-11.75,.73,-8.67,2.47,1.26,1.66,.10,.34],
  ]) {
    const slab = stone(x*shoreScale,y*1.12,z*shoreScale,w*1.18,h*1.12,d*1.26,rock,tilt);
    slab.rotation.y = yaw;
  }
  for (const [x,y,z,w,h,d,tilt] of [
    [6.95,.48,11.3,2.8,1.24,1.72,.14],[8.52,1.02,12.2,3.32,1.67,2.13,.17],
    [11.8,1.34,10.7,2.65,1.52,2.24,-.09],[-9.95,.82,12.5,2.3,1.29,1.76,-.11],
    [-11.25,1.27,15.5,2.84,1.6,2.31,.09],[6.15,.33,14.9,2.58,1.19,1.39,.06],
    [3.7,.35,16.2,2.62,1.1,1.71,-.06],[-2.75,.33,16.3,2.64,1.15,1.61,.09],
    [-7.09,.14,11.83,2.14,.85,1.61,.05],[-8.28,.20,11.02,2.1,.91,1.37,-.08],
  ]) stone(x*shoreScale,y,z*shoreScale,w*1.12,h,d*1.14,rock,tilt);

  const dock = new THREE.Group();
  dock.position.set(-7.82,.28,12.98);
  dock.rotation.y = -.38;
  root.add(dock);
  const wood = [0x51433c,0x625047,0x564a41,0x6a574a].map(dockSurface);
  const rope = material(0x85715a,{roughness:.91});
  const wroughtIron = material(0x303c40,{metalness:.35,roughness:.48});
  for (let i=0;i<14;i++) {
    const plank = block(2.6+(random()-.5)*.16,.105,.277,wood[i%wood.length],(random()-.5)*.10,0,(i-6.5)*.304,dock);
    plank.rotation.y = (random()-.5)*.032;
  }
  for (const side of [-1,1]) {
    block(.18,.20,4.26,wood[0],side*.88,-.12,0,dock);
    for (const z of [-1.78,1.75]) {
      const post = place(new THREE.CylinderGeometry(.108,.137,1.06,9),wood[1],side*1.12,.05,z,dock);
      post.castShadow = post.receiveShadow = true;
      for (let i=0;i<3;i++) {
        const lash = place(new THREE.TorusGeometry(.118,.018,5,12),rope,side*1.12,.21+i*.037,z,dock);
        lash.rotation.set(Math.PI/2,0,i*.31);
      }
      block(.076,.045,.075,wroughtIron,side*.87,.053,z,dock);
    }
  }

  buildForest(root);
  addGroundCover(place);
  const rain = addRainAndMist(root,place,clock);

  const mast = new THREE.Group();
  mast.position.set(1.18,.14,-.30);
  root.add(mast);
  stone(1.03,.105,-.36,2.17,.96,1.57,rock,.025).rotation.y = -.12;
  stone(-.32,-.12,-.16,.70,.60,.58,mossyRock,.08);
  stone(2.41,-.09,-.70,.66,.54,.46,rock,-.06);
  const casePaint = material(0x804738,{metalness:.20,roughness:.48,emissive:0x3c1a11,emissiveIntensity:.20});
  const light = material(0xffae5d,{emissive:0xff8b39,emissiveIntensity:1.2,roughness:.37});
  block(1.04,.12,.81,wroughtIron,0,.073,0,mast);
  block(.91,.64,.71,casePaint,0,.43,0,mast);
  block(1.01,.065,.79,wroughtIron,0,.78,0,mast);
  block(.07,.53,.058,wroughtIron,-.35,.45,.377,mast);
  block(.07,.53,.058,wroughtIron,.35,.45,.377,mast);
  for (let i=0;i<4;i++) block(.22,.022,.023,wroughtIron,.13,.29+i*.044,.367,mast);
  const lens = place(new THREE.SphereGeometry(.101,14,8),light,.18,.60,.36,mast);
  lens.scale.z = .54;
  const antenna = place(new THREE.CylinderGeometry(.020,.039,1.02,8),wroughtIron,.25,1.23,-.17,mast);
  antenna.rotation.z = -.10;
  place(new THREE.SphereGeometry(.044,9,6),wroughtIron,.30,1.74,-.17,mast);

  const pokemonStand = rockGeometry(108,null,-.76);
  const trainerFooting = rockGeometry(127,[[-2.51,-.35],[-1.64,-.68],[-.83,-.53],[.33,-.65],
    [.91,-.17],[.81,.84],[.37,1.23],[-.64,1.45],[-1.78,1.38],[-2.54,1.03],[-2.72,.47]],-.78);
  return {
    transmitterAnchor:lens.getWorldPosition(new THREE.Vector3()),
    freeCameraRadius(position) {
      // Leave room behind the entry dock and keep low orbits inside the wooded banks.
      const angle = Math.atan2(position.x,position.z);
      const entry = THREE.MathUtils.smoothstep(Math.cos(angle),.30,.85);
      const lowLimit = shoreRadius(angle)-1.8+entry*6.6;
      const heightBlend = THREE.MathUtils.smoothstep(position.y,4.5,11.5);
      return THREE.MathUtils.lerp(lowLimit,Math.hypot(position.x,position.z),heightBlend);
    },
    update(time,reducedMotion,camera) {
      clock.value = reducedMotion ? 0 : time*.001;
      rain.visible = !reducedMotion;
      // Fog follows the edge of the playable area as a narrow camera backs away.
      const fogOffset = camera.aspect < .9 ? Math.max(0,camera.position.length()-25) : 0;
      fog.near = fogRange.near+fogOffset;
      fog.far = fogRange.far+fogOffset;
    },
    createSeat(group,top,boss) {
      if (!boss) {
        const shelf = place(trainerFooting,darkRock,-.02,0,0,group);
        shelf.castShadow = shelf.receiveShadow = true;
      }
      const stand = place(pokemonStand,rock,0,top,0,group);
      stand.scale.set(boss ? 1.99 : 1.37,boss ? 1.31 : 1.17,boss ? 1.64 : 1.34);
      stand.castShadow = stand.receiveShadow = true;
    },
    setObjective(state) {
      const color = state?.transmitter===false ? 0x458f8c : state?.phase===2 ? 0xff4c3c : 0xff9a4e;
      light.color.setHex(color);
      light.emissive.setHex(color);
      light.emissiveIntensity = state?.transmitter===false ? .56 : 1.32;
      signal.value.setHex(color).multiplyScalar(state?.transmitter===false ? .20 : 1);
    },
    dispose() { backdrop.dispose(); },
  };
}
