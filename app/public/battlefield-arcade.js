import * as THREE from '/vendor/three.module.js';

const halfBay = 2.84;
const spring = 2.25;
const inner = 2.12;
const outer = 2.64;
const sectors = 11;
const stoneColors = [0xe6ded0,0xd9d1c3,0xcac3b6,0xede3d3,0xdcd6ca];
const arcadeScale = 1.12;
const arcadeRadius = 17.6;
const arcadeBack = -arcadeRadius;
const bayPitch = .36;
const centralSpanScale = 1.65;
const firstBay = -6;
const lastBay = 4;
const mainHalfBays = 2;
const archRise = 1.37;
const outerDrop = 1.04;
const bayAngle = bay => (bay+Math.sign(bay)*(centralSpanScale-1)/2)*bayPitch;
const elevation = value => value*arcadeScale+.17;
const bayRise = bay => Math.abs(bay)<=mainHalfBays ? archRise : archRise-outerDrop/arcadeScale;

export const waterGymArcadeBounds = [bayAngle(firstBay-.5),bayAngle(lastBay+.5)];
export const waterGymSkerries = [
  {x:-23.8,z:-12.1,width:3.5,height:2.05,depth:2.4,yaw:-.46},
  {x:-8.4,z:-25.2,width:2.8,height:1.75,depth:1.75,yaw:.56},
  {x:12.4,z:-25.7,width:3.4,height:2.3,depth:2.1,yaw:.73},
  {x:23.2,z:-10.5,width:4.3,height:2.25,depth:1.65,yaw:-.45},
  {x:-21.7,z:10.5,width:2.45,height:1.32,depth:1.53,yaw:.24},
  {x:22.5,z:14.7,width:3.04,height:1.45,depth:1.46,yaw:-.63},
];
export const waterGymRearStation = {
  radius:14.15,
  baseHeight:.68,
  stairWidth:2*inner*arcadeScale*centralSpanScale*.88,
};

function stoneRecess(geometry, faceZ, backZ) {
  const vertices = geometry.attributes.position;
  const colors = new Float32Array(vertices.count*3);
  for (let i=0;i<vertices.count;i++) {
    const depth = THREE.MathUtils.smoothstep(vertices.getZ(i),backZ,faceZ);
    colors.set([.40+.60*depth,.51+.49*depth,.59+.41*depth],i*3);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  return geometry;
}

function voussoir() {
  const half = Math.PI/(2*sectors)-.004;
  const shape = new THREE.Shape();
  const point = (radius,angle)=>[Math.cos(angle)*radius,Math.sin(angle)*radius];
  shape.moveTo(...point(outer,-half));
  shape.absarc(0,0,outer,-half,half,false);
  shape.lineTo(...point(inner,half));
  shape.absarc(0,0,inner,half,-half,true);
  shape.closePath();
  return stoneRecess(new THREE.ExtrudeGeometry(shape,{
    depth:1.49,bevelSize:.021,bevelThickness:.026,bevelSegments:2,curveSegments:5,
  }).translate(0,0,-1.05),.41,-1.0);
}

function archBacking() {
  const shape = new THREE.Shape();
  shape.moveTo(-halfBay-.10,-.54);
  shape.lineTo(-inner,-.54);
  shape.lineTo(-inner,spring);
  shape.absarc(0,spring,inner,Math.PI,0,true);
  shape.lineTo(inner,-.54);
  shape.lineTo(halfBay+.10,-.54);
  shape.lineTo(halfBay+.10,5.08);
  shape.lineTo(-halfBay-.10,5.08);
  shape.closePath();
  return stoneRecess(new THREE.ExtrudeGeometry(shape,{
    depth:.78,bevelEnabled:false,curveSegments:24,
  }),1.13,-.08);
}

function weatheredStone(material, frequency) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 arcadeStoneWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      vec4 stonePoint = vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        stonePoint = instanceMatrix * stonePoint;
      #endif
      arcadeStoneWorld = (modelMatrix * stonePoint).xyz;
    `);
    shader.fragmentShader = `
      varying vec3 arcadeStoneWorld;
      float stoneHash(vec2 p) {
        vec3 q=fract(vec3(p.xyx)*.1031);
        q+=dot(q,q.yzx+33.33);
        return fract((q.x+q.y)*q.z);
      }
      float stoneNoise(vec2 p) {
        vec2 i=floor(p), f=fract(p);
        f=f*f*(3.0-2.0*f);
        return mix(mix(stoneHash(i),stoneHash(i+vec2(1,0)),f.x),
                   mix(stoneHash(i+vec2(0,1)),stoneHash(i+1.0),f.x),f.y);
      }
    `+shader.fragmentShader.replace('#include <map_fragment>',`
      #ifdef USE_MAP
        vec3 stoneUv = arcadeStoneWorld * ${frequency.toFixed(3)};
        vec3 stoneNormal = normalize(cross(dFdx(arcadeStoneWorld),dFdy(arcadeStoneWorld)));
        vec3 stoneBlend = pow(abs(stoneNormal),vec3(5.0));
        stoneBlend /= max(.001,stoneBlend.x+stoneBlend.y+stoneBlend.z);
        vec3 stoneSurface = texture2D(map,stoneUv.zy).rgb*stoneBlend.x
          +texture2D(map,stoneUv.xz).rgb*stoneBlend.y
          +texture2D(map,stoneUv.xy).rgb*stoneBlend.z;
        float stoneGray = dot(stoneSurface,vec3(.2126,.7152,.0722));
        diffuseColor.rgb *= mix(stoneSurface,stoneGray*vec3(.96,1.00,1.04),.76);
        vec3 point = arcadeStoneWorld;
        float mottling = stoneNoise(point.xz*.78+point.y*vec2(.14,.27));
        float grain = stoneNoise(point.xz*3.4+point.y*vec2(1.38,2.4));
        float upward = max(0.0,stoneNormal.y);
        float tide = 1.0-smoothstep(.38,1.92,point.y+(mottling-.5)*.83);
        float streaks = stoneNoise(vec2(point.x*.72+point.z*.57,point.y*.095))*grain;
        float damp = max(tide*.85,smoothstep(.20,.62,streaks)*(.60-.32*upward));
        float moss = smoothstep(.53,.82,mottling*.62+grain*.38)*max(tide*.84,upward*.76);
        float salt = smoothstep(.65,.91,grain)*smoothstep(.05,.35,tide)*(1.0-tide*.79);
        diffuseColor.rgb *= mix(vec3(.86,.83,.76),vec3(1.09,1.07,1.01),mottling);
        diffuseColor.rgb *= mix(vec3(1.0),vec3(.53,.60,.58),damp);
        diffuseColor.rgb = mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.49,.67,.31),moss);
        diffuseColor.rgb = mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.34,1.36,1.22),salt*.38);
      #endif
    `);
  };
  material.customProgramCacheKey = () => `coastal-masonry-${frequency}`;
}

function curvedCourse(innerRadius, outerRadius, thickness, sweep, joint=0) {
  const halfSlice=sweep/2;
  const shape = new THREE.Shape();
  shape.absarc(0,0,outerRadius,Math.PI/2-halfSlice+joint,Math.PI/2+halfSlice-joint,false);
  shape.absarc(0,0,innerRadius,Math.PI/2+halfSlice-joint,Math.PI/2-halfSlice+joint,true);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape,{
    depth:thickness,bevelEnabled:joint>0,bevelSize:joint*innerRadius*.65,
    bevelThickness:.012,bevelSegments:1,curveSegments:Math.max(4,Math.ceil(sweep*16)),
  }).rotateX(-Math.PI/2);
}

function semicircularBasin(outer, inner=0) {
  const shape = new THREE.Shape();
  shape.moveTo(outer,0);
  shape.absarc(0,0,outer,0,-Math.PI,true);
  if (inner) {
    shape.lineTo(-inner,0);
    shape.absarc(0,0,inner,-Math.PI,0,false);
  }
  shape.closePath();
  return shape;
}

function stoneFootprint(points, side=1) {
  return new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(side*x,-z)));
}

export const waterSurfaceWaves = `
  vec3 waterWave(vec2 p, vec2 direction, float frequency, float amplitude, float phase) {
    float angle=dot(p,direction)*frequency+phase;
    return vec3(direction*(amplitude*frequency*cos(angle)),amplitude*sin(angle));
  }
  vec3 waterWaves(vec2 p, float time) {
    vec2 warp=vec2(sin(dot(p,vec2(.19,.32))-time*.42),sin(dot(p,vec2(-.29,.16))+time*.26));
    vec2 q=p+warp*vec2(.88,.72);
    float footprint=length(fwidth(p));
    float fine=1.0-smoothstep(.10,.40,footprint);
    vec3 wave=waterWave(q,vec2(.93,.37),1.68,.061,-time*1.73);
    wave+=waterWave(q,vec2(-.40,.92),2.83,.032,-time*2.06);
    wave+=waterWave(q,vec2(.62,.78),4.66,.012,-time*2.83);
    wave+=fine*waterWave(q,vec2(-.85,.53),7.41,.0055,-time*3.70);
    wave+=fine*waterWave(q,vec2(.27,.96),11.26,.0025,-time*4.35);
    return wave;
  }
`;

const waterFlowNoise = `
  float waterHash(vec2 p) {
    vec3 q=fract(vec3(p.xyx)*.1031);
    q+=dot(q,q.yzx+33.33);
    return fract((q.x+q.y)*q.z);
  }
  float waterNoise(vec2 p) {
    vec2 i=floor(p), f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(mix(waterHash(i),waterHash(i+vec2(1,0)),f.x),
               mix(waterHash(i+vec2(0,1)),waterHash(i+1.0),f.x),f.y);
  }
`;

const spillTravel = `
  float travelTime(float path) {
    const float lipSpeed=1.48;
    const float gravity=7.2;
    return path<0.0 ? path/lipSpeed : (sqrt(lipSpeed*lipSpeed+2.0*gravity*max(0.0,path))-lipSpeed)/gravity;
  }
`;

const waterfallVertex = `
  uniform float time;
  uniform float phase;
  uniform float spillHeight;
  attribute vec2 spillNormal;
  varying vec2 texCoord;
  ${spillTravel}
  void main() {
    texCoord=uv;
    vec3 point=position;
    float path=uv.y;
    float flow=time-travelTime(path);
    float billow=sin(uv.x*37.0+flow*5.3+phase)*.022+sin(uv.x*79.0-flow*8.8)*.009;
    float freeFall=smoothstep(.06,.55,path)*(1.0-smoothstep(spillHeight*.68,spillHeight,path));
    point.xz+=spillNormal*billow*freeFall;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(point,1.0);
  }
`;

const waterfallFragment = `
  uniform float time;
  uniform float phase;
  uniform float flowStrength;
  uniform float spillHeight;
  uniform float approachWidth;
  uniform sampler2D cascade;
  uniform float cascadeReady;
  varying vec2 texCoord;
  ${waterFlowNoise}
  ${spillTravel}
  void main() {
    vec2 uv = texCoord;
    float path=uv.y;
    float fall=max(0.0,path/spillHeight);
    float flow=time-travelTime(path);
    float shear=waterNoise(vec2(phase+uv.x*6.0,flow*2.6));
    float u=uv.x+(shear-.5)*(.004+.014*fall);
    float ropes=waterNoise(vec2(u*22.0+phase*3.2,flow*2.8));
    float filaments=waterNoise(vec2(u*65.0+phase*2.1,flow*7.1));
    float churn=waterNoise(vec2(u*25.0+phase,flow*16.0));
    float channels=waterNoise(vec2(uv.x*36.0,phase*2.0));
    float textureU=fract(.11+phase*.084+u*.17);
    float sampleWater=texture2D(cascade,vec2(textureU,fract(flow*.31+phase*.17))).g;
    float lip=exp(-abs(path)*7.5);
    float white=smoothstep(.20,.72,ropes*.49+filaments*.23+churn*.16+sampleWater*.13*cascadeReady
                                      +.13*lip+.19*pow(fall,4.0));
    vec3 color=mix(vec3(.17,.38,.49),vec3(.94,1.06,1.13),white);
    float edge=smoothstep(-.018,.061,u)*(1.0-smoothstep(.937,1.02,u));
    float broken=smoothstep(.05,.71,ropes*.62+filaments*.38+.13*fall);
    float start=smoothstep(-approachWidth,-.035,path);
    float landing=mix(.44,1.0,1.0-smoothstep(.91,1.0,fall));
    color=mix(color,vec3(.87,.98,1.06),lip*(.31+.29*filaments));
    gl_FragColor=vec4(color,start*edge*landing*flowStrength*(.14+broken*.58+lip*.30)*mix(.61,1.11,channels));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const basinVertex = `
  varying vec2 texCoord;
  varying vec2 basinPoint;
  varying vec3 basinWorld;
  void main() {
    texCoord=uv;
    basinPoint=position.xy;
    basinWorld=(modelMatrix*vec4(position,1.0)).xyz;
    gl_Position=projectionMatrix*viewMatrix*vec4(basinWorld,1.0);
  }
`;

const basinFragment = `
  uniform float time;
  uniform float receiving;
  uniform vec2 spillCircle;
  varying vec2 texCoord;
  varying vec2 basinPoint;
  varying vec3 basinWorld;
  ${waterSurfaceWaves}
  ${waterFlowNoise}
  void main() {
    vec2 p=texCoord;
    vec3 wave=waterWaves(basinWorld.xz*1.28,time*.84);
    vec3 view=normalize(cameraPosition-basinWorld);
    vec3 normal=normalize(vec3(-wave.x*.83,1.0,-wave.y*.83));
    float facing=clamp(dot(normal,view),0.0,1.0);
    float fresnel=.035+.50*pow(1.0-facing,4.0);
    float sky=clamp(reflect(-view,normal).y,0.0,1.0);
    vec3 color=mix(vec3(.028,.15,.158),vec3(.054,.235,.235),clamp(.55+wave.z*2.1,0.0,1.0));
    color=mix(color,mix(vec3(.39,.53,.58),vec3(.21,.39,.55),sky),fresnel);
    float sheen=smoothstep(.035,.19,dot(wave.xy,vec2(-.62,.78)));
    color+=vec3(.036,.089,.10)*sheen*.19;
    vec3 sun=normalize(vec3(-16.0,11.5,9.0));
    color+=vec3(.56,.54,.44)*.21*pow(max(0.0,dot(normal,normalize(sun+view))),70.0);
    float impact=abs(length(vec2(basinPoint.x,-basinPoint.y-spillCircle.x))-spillCircle.y);
    float bubbles=waterNoise(vec2(basinPoint.x*8.4+basinPoint.y*.82,impact*6.8-time*2.05));
    float foam=exp(-impact*impact*6.4)*smoothstep(.28,.83,bubbles)*.59;
    color=mix(color,vec3(.66,.83,.84),receiving*foam);
    float lip=smoothstep(.976,.999,length(vec2(2.0*p.x-1.0,1.0-p.y)));
    color=mix(color,vec3(.49,.74,.79),(1.0-receiving)*lip*(.52+wave.z));
    gl_FragColor=vec4(color,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const runoffFoamVertex = `
  varying vec2 texCoord;
  void main() {
    texCoord=uv;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
  }
`;

const runoffFoamFragment = `
  uniform float time;
  varying vec2 texCoord;
  ${waterFlowNoise}
  void main() {
    vec2 p=texCoord;
    float travel=p.y*5.7-time*2.2;
    float froth=waterNoise(vec2(p.x*24.0,travel));
    float grain=waterNoise(vec2(p.x*64.0,travel*2.6));
    float pulse=sin(p.y*29.0-time*4.9+froth*2.1);
    float edge=smoothstep(0.0,.13,p.x)*(1.0-smoothstep(.87,1.0,p.x));
    float spread=1.0-smoothstep(.03,1.0,p.y);
    float foam=smoothstep(.29,.79,froth*.58+grain*.24+pulse*.18);
    gl_FragColor=vec4(.73,.88,.90,edge*spread*(.14+.51*foam));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// The two contours of the Let's Go Water symbol, sized independently of its blue disc.
function waterSymbol(shape,width,height,cutout = false) {
  const x = value => (value-29.5)*width/25;
  const y = value => (30-value)*height/36;
  const move = (a,b) => shape.moveTo(x(a),y(b));
  const curve = (a,b,c,d,e,f) => shape.bezierCurveTo(x(a),y(b),x(c),y(d),x(e),y(f));
  if (cutout) {
    move(24,31);
    curve(25.5,31,24,38.5,31,39);
    curve(34,39.3,35.5,36.7,37,37.5);
    curve(40,39,34.5,46,29.5,45.5);
    curve(21,46,18.5,35,24,31);
  } else {
    move(29.5,11.5);
    curve(30,11.5,43,25,43,36.5);
    curve(43,44,36.5,49,29.5,49);
    curve(22,49,16,44,16,36.5);
    curve(16,26,29,11.5,29.5,11.5);
  }
  shape.closePath();
}

function bannerMap(canvasMap) {
  return canvasMap(512,context=>{
    function outline(left,top,right,shoulder,tip) {
      context.beginPath();
      context.moveTo(left,top);
      context.lineTo(right,top);
      context.lineTo(right,shoulder);
      context.lineTo(256,tip);
      context.lineTo(left,shoulder);
      context.closePath();
    }
    outline(12,8,500,430,508);
    context.clip();
    const fabric=context.createLinearGradient(0,18,450,510);
    fabric.addColorStop(0,'#4190a2');
    fabric.addColorStop(.45,'#235878');
    fabric.addColorStop(.82,'#183855');
    fabric.addColorStop(1,'#31758b');
    context.fillStyle=fabric;
    context.fillRect(0,0,512,512);
    for (let line=0;line<512;line+=4) {
      context.fillStyle=line%8 ? '#e4ffef12' : '#080e3025';
      context.fillRect(line,0,2,512);
      context.fillRect(0,line,512,1);
    }
    const trim=context.createLinearGradient(0,0,500,510);
    trim.addColorStop(0,'#fcdfaa');
    trim.addColorStop(.40,'#9c623a');
    trim.addColorStop(.76,'#e6be78');
    trim.addColorStop(1,'#f9e5a2');
    context.strokeStyle=trim;
    context.lineWidth=16;
    outline(29,24,483,423,492);
    context.stroke();
    context.lineWidth=4;
    outline(58,46,454,407,467);
    context.stroke();
    context.strokeStyle='#e6c791b8';
    for (const x of [87,425]) {
      for (const y of [91,393]) {
        context.save();
        context.translate(x,y);
        context.rotate(Math.PI/4);
        context.strokeRect(-14,-14,28,28);
        context.strokeRect(-7,-7,14,14);
        context.restore();
      }
    }
    context.save();
    context.translate(256,258);
    context.scale(1,-1);
    context.beginPath();
    waterSymbol(context,154,175);
    const dye=context.createLinearGradient(-67,83,71,-70);
    dye.addColorStop(0,'#c1e4e3');
    dye.addColorStop(1,'#4fa3b8');
    context.fillStyle=dye;
    context.fill();
    context.strokeStyle='#efcf94';
    context.lineWidth=5;
    context.stroke();
    context.beginPath();
    waterSymbol(context,154,175,true);
    context.fillStyle='#23516f';
    context.fill();
    context.restore();
  });
}

export function buildWaterArcade(scene,{add,addBatch,canvasMap,leafGeometry,random,refresh}) {
  let disposed = false;
  const masonry = new THREE.MeshStandardMaterial({
    color:0xf0ebdf,roughness:.81,
  });
  const cliffStone = new THREE.MeshStandardMaterial({color:0xd5d3c6,roughness:.96,vertexColors:true});
  const facade = new THREE.MeshStandardMaterial({color:0xeee7db,roughness:.88});
  const blueGranite = new THREE.MeshStandardMaterial({color:0x76969d,roughness:.82});
  const graniteCoping = new THREE.MeshStandardMaterial({color:0x9eb6b7,roughness:.73});
  const recessStone = facade.clone();
  recessStone.vertexColors = true;
  const archStone = masonry.clone();
  archStone.vertexColors = true;
  for (const material of [masonry,archStone]) weatheredStone(material,.62);
  for (const material of [facade,recessStone]) weatheredStone(material,.36);
  for (const material of [blueGranite,graniteCoping]) weatheredStone(material,1.3);
  const loadStone = (url, materials, bump, repeat) => {
    const texture = new THREE.TextureLoader().load(url,map=>{
      if (disposed) return;
      for (const material of materials) {
        material.map = map;
        material.bumpMap = map;
        material.bumpScale = bump;
        material.needsUpdate = true;
      }
      refresh?.();
    });
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(...repeat);
    return texture;
  };
  const texture = loadStone('/coastal-limestone.webp',[masonry,archStone,blueGranite,graniteCoping],.043,[.64,.74]);
  const wallMap = loadStone('/coastal-masonry.webp',[facade,recessStone],.046,[1.35,.43]);
  const cliffMap = loadStone('/coastal-cliff.webp',[cliffStone],.24,[1.09,1.0]);

  const blocks = [], mortar = [], walls = [], arches = [], crestArch = [], backing = [], cliffs = [], crowns = [];
  const vineLeaves = [], vineStems = [], rockGrass = [];
  const ivyTints = [0x3d542b,0x526d32,0x61783b,0x74864a,0x879653];
  const place = (batch,x,y,z,width,height,depth,color,yaw=0,roll=0,pitch=0) => {
    batch.push({x,y,z,width,height,depth,color,yaw,roll,pitch});
  };
  const alongArc = angle => {
    const x = Math.sin(angle)*arcadeRadius;
    const z = -Math.cos(angle)*arcadeRadius;
    return (batch,u,y,w,width,height,depth,color,roll=0,pitch=0,yawOffset=0) =>
      place(batch,x+(Math.cos(angle)*u-Math.sin(angle)*w)*arcadeScale,elevation(y),
        z+(Math.sin(angle)*u+Math.cos(angle)*w)*arcadeScale,
        width*arcadeScale,height*arcadeScale,depth*arcadeScale,color,yawOffset-angle,roll,pitch);
  };
  const copingJoints = [];
  for (let bay=firstBay;bay<=lastBay;bay++) {
    const center = bay === 0;
    const span = center ? centralSpanScale : 1;
    const atBay = alongArc(bayAngle(bay));
    const local = (batch,u,y,w,width,height,depth,color) =>
      atBay(batch,u*span,y,w,width*span,height,depth,color);
    const rise = bayRise(bay);

    local(backing,0,rise,-.73,1,1,1,0xe7e2d7);
    for (let i=0;i<sectors;i++) {
      const angle = (i+.5)*Math.PI/sectors;
      const keystone = i === Math.floor(sectors/2);
      atBay(center ? crestArch : arches,0,spring+rise,keystone ? .063 : 0,1,1,1,
        stoneColors[THREE.MathUtils.euclideanModulo(i*3+bay,stoneColors.length)],angle);
    }
    // Straight masonry courses fill the shoulders without wrapping around the arch stones.
    for (let row=0;row<5;row++) {
      const bottom=spring+row*.53;
      const shoulder=Math.sqrt(Math.max(0,outer*outer-(bottom-spring)**2))+.015;
      const width=halfBay-shoulder;
      if (width<.06) continue;
      for (const side of [-1,1]) {
        const joints=Math.ceil(width*span/1.1);
        for (let i=0;i<joints;i++) {
          local(blocks,side*(shoulder+width*(i+.5)/joints),bottom+.26+rise,.07,
            width/joints-.016,.505,.46,stoneColors[THREE.MathUtils.euclideanModulo(row*2+bay+i,stoneColors.length)]);
        }
      }
    }
  }
  // A single cornice ties the five main openings together; the side wings start one level lower.
  const [leftEnd,rightEnd] = waterGymArcadeBounds;
  const mainEnd = bayAngle(mainHalfBays+.5);
  for (const [start,end,drop] of [[leftEnd,-mainEnd,outerDrop],[-mainEnd,mainEnd,0],[mainEnd,rightEnd,outerDrop]]) {
    const span = end-start;
    const yaw = -(start+end)/2;
    for (const [inner,outer,y,height,material,tint] of [
      [17.05,18.60,7.08,.47,facade,0xdfd9ce],
      [16.88,18.69,7.52,.16,masonry,0xd7d2c5],
      [17.02,18.57,7.64,1.15,facade,0xd8d0bf],
      [16.86,18.73,8.74,.15,masonry,0xe6ddcb],
    ]) {
      const course = [];
      place(course,0,y-drop,0,1,1,1,tint,yaw);
      addBatch(scene,curvedCourse(inner,outer,height,span),material,course,true);
    }
    const copingStones = [], graniteStones = [];
    const stones = Math.round(span/(bayPitch/6));
    const copingSweep = span/stones;
    for (let i=0;i<stones;i++) {
      const angle = start+(i+.5)*copingSweep;
      const wear = .024*Math.sin(i*2.31);
      if (i>0) copingJoints.push({angle:angle-copingSweep*.5,top:(9.07-drop+wear-.17)/arcadeScale});
      const batch = Math.abs(angle)<.34 ? graniteStones : copingStones;
      place(batch,0,8.88-drop+wear,0,1,1,1,stoneColors[i%stoneColors.length],-angle);
    }
    const cap = curvedCourse(16.72,18.83,.19,copingSweep,.00065);
    addBatch(scene,cap,masonry,copingStones,true);
    if (graniteStones.length) addBatch(scene,cap,graniteCoping,graniteStones,true);
  }

  for (let i=0;i<=lastBay-firstBay+1;i++) {
    const boundary = firstBay+i-.5;
    const pier = alongArc(bayAngle(boundary));
    const terminal = boundary<firstBay || boundary>lastBay;
    const rise = Math.max(bayRise(boundary-.5),bayRise(boundary+.5));
    pier(mortar,0,1.16+rise*.5,-.09,1.19,2.26+rise,1.42,0x665e4e);
    pier(blocks,0,.10,0,1.71,.25,1.92,0xc1b9a9);
    pier(blocks,0,.33,.02,1.54,.18,1.76,0xddd3c1);
    for (let course=0;course<5;course++) {
      const height=.31+rise/5;
      pier(blocks,(course%2-.5)*.024,.415+(course+.5)*height,0,1.32,height-.015,1.62,stoneColors[(i+course*3)%5]);
    }
    pier(blocks,0,2.05+rise,.02,1.51,.16,1.79,0xc6beaf);
    pier(blocks,0,2.20+rise,.03,1.64,.24,1.94,0xe3dac9);
    pier(walls,0,3.78+rise,-.12,1.11,2.94,1.58,0xd3cabb);
    pier(blocks,0,5.39+rise,-.13,terminal ? 1.68 : 1.39,.24,1.83,0xcfc8b8);
    pier(blocks,0,5.57+rise,-.12,terminal ? 1.87 : 1.61,.17,2.04,0xe4daca);
  }

  // Both the arches and the railing stand on the same concentric stone courses.
  const footing = [], coping = [], archSteps = [], parapet = [], handrail = [];
  const sliceCount = 72;
  const sweep = Math.PI*2/sliceCount;
  for (let i=0;i<sliceCount;i++) {
    const angle = i*sweep;
    const signedAngle = angle<=Math.PI ? angle : angle-2*Math.PI;
    const stone = stoneColors[i%stoneColors.length];
    place(footing,0,-.62,0,1,1,1,0xb8b0a1,-angle);
    place(coping,0,-.12,0,1,1,1,stone,-angle);
    if (signedAngle>leftEnd && signedAngle<rightEnd) {
      place(archSteps,0,-.25,0,1,1,1,stone,-angle);
      continue;
    }
    place(parapet,0,.14,0,1,1,1,stone,-angle);
    place(handrail,0,.75,0,1,1,1,stone,-angle);
    const x = Math.sin(angle)*arcadeRadius;
    const z = -Math.cos(angle)*arcadeRadius;
    place(blocks,x,.56,z,.21,.46,.35,stone,-angle);
    if (i%4===0 || Math.min(Math.abs(signedAngle-leftEnd),Math.abs(signedAngle-rightEnd))<sweep) {
      place(blocks,x,.57,z,.49,.69,.74,0xc9bfab,-angle);
      place(blocks,x,.94,z,.64,.13,.86,0xe0d5bf,-angle);
    }
  }
  addBatch(scene,curvedCourse(16.16,18.73,.53,sweep),facade,footing,true);
  addBatch(scene,curvedCourse(15.95,18.85,.26,sweep,.0007),masonry,coping,true);
  addBatch(scene,curvedCourse(15.42,16.23,.26,sweep,.0007),masonry,archSteps,true);
  addBatch(scene,curvedCourse(17.19,18.01,.24,sweep,.0007),masonry,parapet,true);
  addBatch(scene,curvedCourse(17.32,17.88,.16,sweep,.0007),masonry,handrail,true);

  // A dry landing and three rear steps join the station to the arcade's stone ring.
  const deck = waterGymRearStation;
  const stairTints = [0x9fa194,0xb3ad9a,0xbab4a1,0xc6bdab,0xd1c8b7];
  const stairFoundation = deck.baseHeight-1.10;
  const addSlab = (points,bottom,top,material,side=1) => {
    const geometry = new THREE.ExtrudeGeometry(stoneFootprint(points,side),{
      depth:top-bottom,bevelEnabled:false,
    }).rotateX(-Math.PI/2);
    return add(geometry,material,0,bottom,0);
  };
  const rearStairs = new THREE.Group();
  scene.add(rearStairs);
  for (const [step,tint] of stairTints.entries()) {
    const front = -deck.radius+2.39-step*.33;
    const back = -deck.radius-1.24+step*.04;
    const top = deck.baseHeight-.401+step*.20;
    const halfWidth = (deck.stairWidth-step*.24)/2;
    const shoulderZ = -12.14;
    const narrowZ = -12.58;
    const dryHalfWidth = 1.43;
    const widthAtFront = THREE.MathUtils.lerp(dryHalfWidth,halfWidth,
      THREE.MathUtils.clamp((front-narrowZ)/(shoulderZ-narrowZ),0,1));
    const outline = [[widthAtFront,front]];
    if (front>shoulderZ) outline.push([halfWidth,shoulderZ]);
    if (front>narrowZ) outline.push([dryHalfWidth,narrowZ]);
    outline.push([dryHalfWidth,back]);
    const shape = [...outline,...outline.slice().reverse().map(([x,z])=>[-x,z])];
    const stepStone = masonry.clone();
    stepStone.color.setHex(tint);
    stepStone.map = stepStone.bumpMap = texture;
    stepStone.bumpScale = .043;
    weatheredStone(stepStone,.62);
    rearStairs.add(addSlab(shape,stairFoundation,top,stepStone));
  }
  const bridgeWidth = deck.stairWidth*.73;
  const deckTop = deck.baseHeight+.399;
  const landingFront = -deck.radius-.91;
  const landingBack = -15.77;
  place(walls,0,(deckTop-.62)/2,(landingFront+landingBack)/2,
    bridgeWidth,deckTop+.62,landingFront-landingBack,0xb7b3a1);
  for (let step=0;step<3;step++) {
    const top = deckTop-(step+1)*.29;
    const z = landingBack-.30-step*.58;
    place(blocks,0,(top-.62)/2,z,bridgeWidth+.10*step,top+.62,.60,stoneColors[(step+1)%5]);
  }
  place(walls,0,-.18,-17.62,bridgeWidth+.25,.64,.70,0xb7b3a1);

  const upperRadius = 6.10;
  const upperCenterZ = -18.83;
  const upperWaterY = 8.73;
  // Keep the sheet clear of the .035 stone bevel below the waterline.
  const upperWaterRadius = upperRadius+.055;
  const lipZ = x => upperCenterZ+Math.sqrt(Math.max(0,upperRadius*upperRadius-x*x));
  const waterfallRim = u => {
    const x = THREE.MathUtils.lerp(1.69,5.94,u);
    return [x,upperCenterZ+Math.sqrt(upperWaterRadius*upperWaterRadius-x*x)];
  };
  const lowerWaterY = .92;
  const seaY = -.22;
  const lowerOutline = [[1.51,-12.59],[3.31,-12.67],[6.37,-15.32],[6.50,-17.72],
    [5.69,-17.96],[2.55,-15.63],[1.51,-13.46]];
  const [spillStart,spillEnd] = lowerOutline.slice(1,3);
  const spillDx = spillEnd[0]-spillStart[0], spillDz = spillEnd[1]-spillStart[1];
  const spillLength = Math.hypot(spillDx,spillDz);
  const spillNormal = [-spillDz/spillLength,spillDx/spillLength];
  const lowerSpillEdge = u => {
    const [ax,az] = spillStart, [bx,bz] = spillEnd;
    const offset = .178;
    return [THREE.MathUtils.lerp(ax,bx,u)+spillNormal[0]*offset,
      THREE.MathUtils.lerp(az,bz,u)+spillNormal[1]*offset];
  };

  // A solid backing closes the pool against the common cornice.
  place(walls,0,8.26,-17.97,11.66,1.21,1.91,0xc3c0b3);
  const addUpperCourse = (outer,inner,y,height,material) => {
    const geometry = new THREE.ExtrudeGeometry(semicircularBasin(outer,inner),{
      depth:height,bevelSize:.035,bevelThickness:.025,bevelSegments:1,curveSegments:28,
    }).rotateX(-Math.PI/2);
    add(geometry,material,0,y,upperCenterZ);
  };
  addUpperCourse(5.12,0,7.29,.20,blueGranite);
  addUpperCourse(5.48,0,7.49,.27,graniteCoping);
  addUpperCourse(5.79,0,7.76,.24,blueGranite);
  addUpperCourse(6.00,0,8.00,.14,graniteCoping);
  addUpperCourse(upperRadius,0,8.14,.37,blueGranite);
  addUpperCourse(upperRadius,5.58,8.50,.14,blueGranite);
  addUpperCourse(upperRadius,5.52,8.64,.065,graniteCoping);
  for (const side of [-1,1]) {
    for (const [y,z,depth] of [[7.33,-17.2,.90],[7.56,-16.92,1.42],[7.79,-16.63,1.98]]) {
      place(blocks,side*4.85,y,z,1.18,.23,depth,0xb3ae9d);
    }

    addSlab(lowerOutline,.43,.68,blueGranite,side);
    for (const [index,[ax,az]] of lowerOutline.entries()) {
      const [bx,bz] = lowerOutline[(index+1)%lowerOutline.length];
      const x = side*(ax+bx)/2, z = (az+bz)/2;
      const length = Math.hypot(bx-ax,bz-az);
      const yaw = -Math.atan2(bz-az,side*(bx-ax));
      const spill = index===1;
      place(walls,x,spill?.75:.88,z,length+.12,spill?.31:.46,.22,0x9aa497,yaw);
      place(blocks,x,spill?.87:1.12,z,length+.18,spill?.085:.15,.33,0xb5baaa,yaw);
    }
    for (const [supportX,z] of [[2.43,-13.27],[4.09,-14.57],[5.86,-16.59]]) {
      const x = side*supportX;
      place(blocks,x,-.12,z,.96,.31,.90,0x8e9486);
      place(walls,x,.19,z,.65,.48,.64,0x969b8c);
      place(blocks,x,.38,z,.86,.14,.79,0xb1ad99);
    }
  }

  for (const side of [-1,1]) {
    const headlands = side<0 ?
      [[21,-32,7.7,15.8,7.4],[32,-43,10.1,19.1,9.7],[40,-56,12.4,22.8,12.5]] :
      [[29,-40,7.5,12.3,7.4],[38,-51,10.1,15.7,9.5],[50,-62,12.8,19.8,13.1]];
    for (const [index,[x,z,width,height,depth]] of headlands.entries()) {
      const tint = [0xe0cdb0,0xc0c9c3,0x9fb4bc][index];
      place(cliffs,side*x,-2+height*.5,z,width,height,depth,tint,side*.14);
      place(cliffs,side*(x-width*.36),-2+height*.29,z+depth*.38,width*.70,height*.58,depth*.74,0x9baca1,side*-.26);
      place(cliffs,side*(x+width*.38),-2+height*.36,z+depth*.49,width*.59,height*.72,depth*.62,tint,side*.41);
      for (let rib=0;rib<5;rib++) {
        const rift=(rib-2)/2.5, rise=height*(.47+.36*Math.cos(rib*1.51+index)*.5);
        place(cliffs,side*(x+rift*width),-1.85+rise*.50,z+depth*(.75-.3*rift*rift),
          width*(.20+rib%2*.12),rise,depth*.31,rib%2 ? tint : 0x9a9f94,
          side*(.22+rift*.21),side*(rift*.13));
      }
      place(cliffs,side*(x-width*.38),-.8,z+depth*.75,width*.83,2.4,depth*.86,0x898d7b,side*.54);
      for (let i=0;i<15;i++) {
        const radius=.72+random()*1.1;
        const upper = i<9;
        place(crowns,side*(x+(random()-.5)*width*.83),-2+height*(upper?.98:.55)+random()*.43,
          z+(upper?0:depth*.44)+(random()-.5)*depth*.43,
          radius,.30+radius*.29,radius*.8,[0x587449,0x6e8650,0x8a9851][i%3],random()*Math.PI);
      }
    }
  }

  // Start each ivy patch in a coping joint and let the longest shoots follow the face of the stone.
  const ivyRoots = [
    {bay:-6.27,spread:-1.24,drape:1.91},{bay:-5.87,spread:.72,drape:.46},
    {bay:-5.02,spread:1.38,drape:0},{bay:-4.17,spread:-1.88,drape:1.34},
    {bay:-3.44,spread:-.61,drape:.37},{bay:-2.19,spread:1.42,drape:1.92},
    {bay:-1.76,spread:.97,drape:.72},{bay:-1.06,spread:-.58,drape:0},
    {bay:1.07,spread:.83,drape:.65},{bay:1.89,spread:-1.62,drape:1.59},
    {bay:3.11,spread:.86,drape:.32},{bay:3.76,spread:1.44,drape:1.94},
    {bay:4.31,spread:-.53,drape:0},
  ];
  const ivyBranches = [
    [.33,.06,1],[-.52,-.14,.54],[1,.13,0],[.65,-.38,.28],[-.27,.32,.74],[.08,-.64,0],
  ];
  const innerLip = (arcadeRadius-16.72)/arcadeScale;
  for (const {bay,spread,drape} of ivyRoots) {
    const target = bayAngle(bay);
    const {angle,top} = copingJoints.reduce((nearest,joint)=>(
      Math.abs(joint.angle-target)<Math.abs(nearest.angle-target) ? joint : nearest
    ));
    const atRoot = alongArc(angle);
    const colorBias = Math.floor(random()*3);
    const branches = Math.abs(spread)>1.2 ? ivyBranches.length : 3;
    for (let branch=0;branch<branches;branch++) {
      const [direction,rootOffset,fallRatio] = ivyBranches[branch];
      const run = spread*direction*(.78+random()*.34);
      const rootDepth = -.14+rootOffset+random()*.18;
      const fall = drape*fallRatio;
      const endDepth = fall ? innerLip+.025 : Math.min(innerLip-.07,rootDepth+.28+random()*.56);
      const roofLength = Math.hypot(run,endDepth-rootDepth);
      const shootLength = roofLength+fall;
      const count = Math.ceil(shootLength*14);
      const wave = random()*Math.PI*2;
      let prevU = 0, prevY = top, prevW = rootDepth;
      for (let j=1;j<=count;j++) {
        const t = j/count;
        const across = Math.min(1,t*shootLength/roofLength);
        const down = Math.max(0,t*shootLength-roofLength);
        const onFace = down>.025;
        const u = run*across + Math.sin(t*6.7+wave)*t*.17 + down*run*.32;
        const y = top+.012-down;
        const w = THREE.MathUtils.lerp(rootDepth,endDepth,across)-.24*THREE.MathUtils.smoothstep(down,.18,.38);
        const dx = Math.cos(angle)*(u-prevU)-Math.sin(angle)*(w-prevW);
        const dz = Math.sin(angle)*(u-prevU)+Math.cos(angle)*(w-prevW);
        const length = Math.hypot(dx,y-prevY,dz);
        const stemWidth = .016-.007*t;
        const roll = -Math.asin(THREE.MathUtils.clamp(dx/length,-1,1));
        const pitch = Math.atan2(dz,y-prevY);
        atRoot(vineStems,(u+prevU)/2,(y+prevY)/2,(w+prevW)/2,stemWidth,length+.005,stemWidth,0x485136,
          roll,pitch,angle);
        prevU = u;
        prevY = y;
        prevW = w;
        const side = j%2===0 ? -1 : 1;
        const size = (.19+random()*.23)*(1-.41*t);
        const tint = ivyTints[Math.min(4,colorBias+Math.floor(random()*3))];
        atRoot(vineLeaves,u,y+(onFace ? -.02 : .025),w+.018,size*1.14,size*(1.05+random()*.30),1,tint,
          side*(.52+random()*1.53),onFace ? -.18-random()*.49 : -1.12-random()*.43);
      }
    }
  }

  // Low skerries frame the ring from above and stay below the arcade sightline.
  const wetStone = [0x8e9c90,0xb0ac97,0x82958f,0x9aa294];
  for (const [index,{x,z,width,height,depth,yaw}] of waterGymSkerries.entries()) {
    place(cliffs,x,height*.5-.9,z,width,height,depth,wetStone[index%4],yaw);
    const alongX = Math.cos(yaw), alongZ = -Math.sin(yaw);
    for (let j=0;j<6;j++) {
      const offset = (j%3-1)*width*(.72+random()*.24);
      const cross = (j<3 ? -1 : 1)*depth*(.47+random()*.63);
      const size = .32+random()*1.02;
      const rise = .48+random()*.69;
      place(cliffs,x+alongX*offset-alongZ*cross,rise*.5-.61,z+alongZ*offset+alongX*cross,
        size,rise,size*(.54+random()*.54),wetStone[(index+j)%4],yaw+random()*.98);
    }
    const tufts = [4,0,5,3,0,2][index];
    const seam = index%2===0 ? .23 : -.28;
    for (let tuft=0;tuft<tufts;tuft++) {
      const offset = (tuft-(tufts-1)/2)*.14;
      const u = (offset+.095)*width;
      const v = (seam+offset*.46+Math.sin(tuft*2.3)*.052)*depth;
      const bladeHeight = .20+random()*.22;
      for (let blade=0;blade<10;blade++) {
        const heading = random()*Math.PI*2;
        const scatter = random()*.14;
        place(rockGrass,x+alongX*u-alongZ*v+Math.sin(heading)*scatter,height-.935,
          z+alongZ*u+alongX*v+Math.cos(heading)*scatter,
          bladeHeight,bladeHeight*(.57+random()*.65),bladeHeight,ivyTints[1+Math.floor(random()*4)],
          heading,(random()-.5)*.63,-.18-random()*.59);
      }
    }
  }
  addBatch(scene,new THREE.BoxGeometry(1,1,1),masonry,blocks,true);
  addBatch(scene,new THREE.BoxGeometry(1,1,1),facade,walls,true);
  addBatch(scene,new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({roughness:1}),mortar,false);
  addBatch(scene,archBacking(),recessStone,backing,true);
  const archStoneShape = voussoir();
  addBatch(scene,archStoneShape,archStone,arches,true);
  addBatch(scene,archStoneShape,archStone,crestArch,true).scale.x = centralSpanScale;
  const cliffGeometry = new THREE.CylinderGeometry(.74,1,1,25,16);
  const position = cliffGeometry.attributes.position;
  const rockColors = new Float32Array(position.count*3);
  for (let i=0;i<position.count;i++) {
    const x=position.getX(i), y=position.getY(i), z=position.getZ(i);
    const angle=Math.atan2(z,x);
    const rift = Math.sin(angle*6+y*.77)*.62+Math.cos(angle*9-y*1.51)*.38;
    const bedding = Math.sin((y+.024*Math.sin(angle*3))*54+2.0*Math.sin(y*13));
    const swell=1+rift*.19+bedding*.058+.14*Math.sin(angle*3+y*7);
    position.setXYZ(i,x*swell+y*.19,y+Math.hypot(x,z)*.050*Math.sin(angle*3.2+y*3.1),z*swell);
    const face=.79+rift*.18+bedding*.065;
    const foot=THREE.MathUtils.smoothstep(y,-.47,-.21);
    rockColors.set([face*(.76+.24*foot),face*(.84+.16*foot),face*(.88+.12*foot)],i*3);
  }
  cliffGeometry.computeVertexNormals();
  cliffGeometry.setAttribute('color',new THREE.BufferAttribute(rockColors,3));
  addBatch(scene,cliffGeometry,cliffStone,cliffs,true);
  const greens = new THREE.MeshStandardMaterial({roughness:.89});
  const canopy = new THREE.IcosahedronGeometry(1,2);
  const leaves = canopy.attributes.position;
  for (let i=0;i<leaves.count;i++) {
    const x=leaves.getX(i), y=leaves.getY(i), z=leaves.getZ(i);
    const clump=1+.105*Math.sin(x*17+z*5)*Math.cos(y*19-z*12);
    leaves.setXYZ(i,x*clump,y*clump,z*clump);
  }
  canopy.computeVertexNormals();
  const crownFallback = addBatch(scene,canopy,greens,crowns,false);
  addBatch(scene,new THREE.CylinderGeometry(.5,.5,1,5),greens,vineStems,false);
  const leaf = leafGeometry();
  const blades = leaf.attributes.position;
  for (let i=0;i<blades.count;i++) {
    const x=blades.getX(i), y=blades.getY(i);
    blades.setZ(i,.14*Math.sin(y*Math.PI)*(1.0-1.7*Math.abs(x)));
  }
  leaf.computeVertexNormals();
  const foliage = new THREE.MeshStandardMaterial({side:THREE.DoubleSide,roughness:.83});
  addBatch(scene,leaf,foliage,vineLeaves,true);
  const blade = new THREE.PlaneGeometry(.30,1,1,4).translate(0,.5,0);
  const bladePoints = blade.attributes.position;
  for (let i=0;i<bladePoints.count;i++) {
    const t = bladePoints.getY(i);
    bladePoints.setXYZ(i,bladePoints.getX(i)*(1-t*.98),t,t*t*.46);
  }
  blade.computeVertexNormals();
  addBatch(scene,blade,foliage,rockGrass,false);
  const leavesMaterial = new THREE.MeshStandardMaterial({
    side:THREE.DoubleSide,roughness:.78,alphaTest:.38,
    emissive:0x5d751f,emissiveIntensity:.10,
  });
  const cliffLeaves = crowns.flatMap((item,index)=>[0,1.57,2.36].map((angle,layer)=>({
    ...item,y:item.y+item.height*.12,width:item.width*2.44,height:Math.max(item.height*2.1,item.width*1.05),
    depth:1,yaw:item.yaw+angle,pitch:layer===2 ? -.77 : .08,roll:Math.sin(index*12.3+layer)*.24,
    color:[0xf1f0db,0xdbe3c0,0xcbd7a7][(index+layer)%3],
  })));
  const canopyCards = addBatch(scene,new THREE.PlaneGeometry(1,1),leavesMaterial,cliffLeaves,false);
  canopyCards.visible = false;
  const ivyMap = new THREE.TextureLoader().load('/coastal-ivy.webp',map=>{
    if (disposed) return;
    leavesMaterial.map = map;
    leavesMaterial.needsUpdate = true;
    canopyCards.visible = true;
    crownFallback.visible = false;
    refresh?.();
  });
  ivyMap.colorSpace = THREE.SRGBColorSpace;
  ivyMap.anisotropy = 4;

  const heraldry = bannerMap(canvasMap);
  const cloth = new THREE.MeshStandardMaterial({
    map:heraldry,roughness:.83,side:THREE.DoubleSide,alphaTest:.52,
  });
  const bronze = new THREE.MeshStandardMaterial({color:0xbb9155,metalness:.52,roughness:.36});
  const verdigris = new THREE.MeshStandardMaterial({color:0x4b817a,metalness:.34,roughness:.54});
  const enamel = new THREE.MeshStandardMaterial({color:0x32748b,metalness:.18,roughness:.39});
  const crestY = 7.69, crestZ = lipZ(0)+.28;
  const surround = add(new THREE.CylinderGeometry(1.61,1.68,.32,64),blueGranite,0,crestY,crestZ-.16);
  surround.rotation.x=Math.PI/2;
  add(new THREE.TorusGeometry(1.52,.106,12,64),graniteCoping,0,crestY,crestZ+.079);
  add(new THREE.TorusGeometry(1.435,.029,10,64),bronze,0,crestY,crestZ+.165);
  const disc = add(new THREE.CylinderGeometry(1.40,1.45,.39,56),verdigris,0,crestY,crestZ);
  disc.rotation.x=Math.PI/2;
  add(new THREE.CircleGeometry(1.19,56),enamel,0,crestY,crestZ+.207,false);
  for (const [radius,thickness,z,material] of [
    [1.29,.084,.222,bronze],[1.16,.042,.243,verdigris],[1.01,.023,.218,bronze],
  ]) {
    add(new THREE.TorusGeometry(radius,thickness,9,56),material,0,crestY,crestZ+z);
  }
  const drop = new THREE.Shape();
  waterSymbol(drop,.96,1.40);
  const cutout = new THREE.Path();
  waterSymbol(cutout,.96,1.40,true);
  drop.holes.push(cutout);
  const relief = new THREE.MeshStandardMaterial({color:0x76b8bb,metalness:.32,roughness:.33});
  add(new THREE.ExtrudeGeometry(drop,{
    depth:.081,bevelThickness:.028,bevelSize:.034,bevelSegments:3,curveSegments:18,
  }),relief,0,crestY,crestZ+.24);
  const studs = [];
  for (let index=0;index<16;index++) {
    const angle=index*Math.PI/8;
    place(studs,Math.sin(angle)*1.22,crestY+Math.cos(angle)*1.22,crestZ+.271,.047,.047,.040,0xf0d49f);
  }
  addBatch(scene,new THREE.IcosahedronGeometry(1,1),bronze,studs,false);
  const banners = [-1,1].map(side=>{
    const angle=side*mainEnd;
    const hanger = new THREE.Group();
    hanger.position.set(Math.sin(angle)*arcadeRadius,elevation(4.91+archRise),-Math.cos(angle)*arcadeRadius);
    hanger.rotation.y=-angle;
    scene.add(hanger);
    const mount = (geometry,material,x,y,z,shadow) => {
      const piece = add(geometry,material,x,y,z,shadow);
      hanger.add(piece);
      return piece;
    };
    const banner = mount(new THREE.PlaneGeometry(1.64,2.84,12,12),cloth,0,-1.46,1.12,false);
    const bar = mount(new THREE.CylinderGeometry(.058,.058,1.86,12),bronze,0,0,1.12);
    bar.rotation.z=Math.PI/2;
    for (const end of [-1,1]) {
      mount(new THREE.BoxGeometry(.22,.34,.15),verdigris,end*.49,0,.77);
      mount(new THREE.BoxGeometry(.095,.12,.40),bronze,end*.49,0,.96);
      mount(new THREE.SphereGeometry(.106,10,8),bronze,end*.94,0,1.12);
    }
    return banner;
  });

  const time = {value:0};
  const spillCircle = {value:new THREE.Vector2(upperCenterZ,upperWaterRadius)};
  const addBasinSurface = (geometry,x,y,z,receiving) => {
    const material = new THREE.ShaderMaterial({
      uniforms:{time,spillCircle,receiving:{value:receiving}},
      vertexShader:basinVertex,fragmentShader:basinFragment,
    });
    const surface = add(geometry,material,x,y,z,false);
    surface.rotation.x=-Math.PI/2;
  };
  const upperSurface = new THREE.ShapeGeometry(semicircularBasin(upperWaterRadius),96);
  const upperUv = upperSurface.attributes.uv;
  for (let i=0;i<upperUv.count;i++) {
    upperUv.setXY(i,.5+upperUv.getX(i)/(2*upperWaterRadius),1+upperUv.getY(i)/upperWaterRadius);
  }
  addBasinSurface(upperSurface,0,upperWaterY,upperCenterZ,0);
  for (const side of [-1,1]) {
    const waterOutline = lowerOutline.slice();
    waterOutline[1] = lowerSpillEdge(0);
    waterOutline[2] = lowerSpillEdge(1);
    const geometry = new THREE.ShapeGeometry(stoneFootprint(waterOutline,side));
    const uv = geometry.attributes.uv;
    for (let i=0;i<uv.count;i++) {
      uv.setXY(i,(Math.abs(uv.getX(i))-1.51)/5.05,1-(uv.getY(i)-12.5)/5.5);
    }
    addBasinSurface(geometry,0,lowerWaterY,0,1);
  }
  const cascadeReady = {value:0};
  const cascade = new THREE.TextureLoader().load('/coastal-waterfall.webp',()=>{
    if (disposed) return;
    cascadeReady.value=1;
    refresh?.();
  });
  cascade.colorSpace=THREE.SRGBColorSpace;
  const addSpill = (top,bottom,phase,flowStrength,approachWidth,profile) => {
    const height = top-bottom;
    const water = new THREE.ShaderMaterial({
      uniforms:{time,cascade:{value:cascade},cascadeReady,phase:{value:phase},flowStrength:{value:flowStrength},
        spillHeight:{value:height},approachWidth:{value:approachWidth}},
      vertexShader:waterfallVertex,fragmentShader:waterfallFragment,
      transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,
    });
    const curtain = new THREE.PlaneGeometry(1,1,72,30);
    const surface = curtain.attributes.position;
    const uv = curtain.attributes.uv;
    const normals = new Float32Array(surface.count*2);
    for (let i=0;i<surface.count;i++) {
      const u=uv.getX(i);
      const progress=1-uv.getY(i);
      const path=progress<.2 ? approachWidth*(progress/.2-1) : height*(progress-.2)/.8;
      const [x,z,nx,nz] = profile(u);
      const approach = Math.min(0,path);
      surface.setXYZ(i,x+nx*approach,.009-Math.max(0,path),z+nz*approach);
      normals.set([nx,nz],i*2);
      uv.setY(i,path);
    }
    curtain.setAttribute('spillNormal',new THREE.BufferAttribute(normals,2));
    curtain.computeBoundingSphere();
    const sheet = add(curtain,water,0,top,0,false);
    sheet.renderOrder=2;
  };
  const runoffFoam = new THREE.ShaderMaterial({
    uniforms:{time},vertexShader:runoffFoamVertex,fragmentShader:runoffFoamFragment,
    transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,
  });
  for (const side of [-1,1]) {
    // Each sheet follows the pool surface into the edge and continues vertically.
    addSpill(upperWaterY,lowerWaterY,side+1.9,1.06,.52,u=>{
      const [x,z] = waterfallRim(side>0 ? u : 1-u);
      return [side*x,z,side*x/upperWaterRadius,(z-upperCenterZ)/upperWaterRadius];
    });
    addSpill(lowerWaterY,seaY,side+5.5,.83,.42,u=>{
      const [x,z] = lowerSpillEdge(side>0 ? u : 1-u);
      return [side*x,z,side*spillNormal[0],spillNormal[1]];
    });
    const foamGeometry = new THREE.PlaneGeometry(1,1);
    const foamPosition = foamGeometry.attributes.position, foamUv = foamGeometry.attributes.uv;
    for (let i=0;i<foamPosition.count;i++) {
      const [x,z] = lowerSpillEdge(foamUv.getX(i));
      const distance = foamUv.getY(i)*.98;
      foamPosition.setXYZ(i,side*(x+spillNormal[0]*distance),0,z+spillNormal[1]*distance);
    }
    const ripple = add(foamGeometry,runoffFoam,0,seaY+.019,0,false);
    ripple.renderOrder=3;
  }
  const sprayMap = canvasMap(128,context=>{
    for (let i=0;i<19;i++) {
      const a=i*2.39996, spread=i ? 10+Math.sqrt(i)*6.4 : 0;
      const x=64+Math.cos(a)*spread, y=64+Math.sin(a)*spread*.77;
      const radius=17+13*(1-i/19);
      const cloud=context.createRadialGradient(x,y,0,x,y,radius);
      cloud.addColorStop(0,'#edfaff66');
      cloud.addColorStop(.42,'#d9f2fa43');
      cloud.addColorStop(1,'#cfeaf800');
      context.fillStyle=cloud;
      context.fillRect(x-radius,y-radius,radius*2,radius*2);
    }
  });
  const foam = new THREE.MeshBasicMaterial({
    map:sprayMap,transparent:true,depthWrite:false,toneMapped:false,opacity:.57,
    side:THREE.DoubleSide,forceSinglePass:true,
  });
  const mistCard = new THREE.PlaneGeometry(1,1);
  const splashes = Array.from({length:15},(_,i)=>{
    const ground=i>=11, side=i%2 ? 1 : -1;
    const [landingX,landingZ]=waterfallRim(.12+random()*.81);
    const x=side*landingX, y=lowerWaterY+(ground ? .018 : .19+random()*.61);
    const z=landingZ-.08+random()*.28;
    const width=ground?1.0+random()*.50:1.32+random()*1.12, height=ground?.73:.69+random()*.63;
    const patch=add(mistCard,foam,x,y,z,false);
    patch.rotation.set(ground?-Math.PI/2:0,ground?0:(random()-.5)*1.65,(random()-.5)*.5);
    patch.renderOrder=3;
    return {patch,x,y,z,width,height,ground};
  });
  const droplets = new THREE.BufferGeometry();
  const positions = new THREE.Float32BufferAttribute(new Float32Array(126*3),3);
  positions.setUsage(THREE.DynamicDrawUsage);
  const particlePaths = Array.from({length:positions.count},(_,i)=>{
    const [landingX,landingZ]=waterfallRim(.12+random()*.79);
    return {x:(i%2 ? 1 : -1)*landingX,z:landingZ,
      speed:.63+random()*.95,phase:random(),drift:(random()-.5)*1.02,depth:random()*.44};
  });
  droplets.setAttribute('position',positions);
  const splashPoints = new THREE.Points(droplets,new THREE.PointsMaterial({
    color:0xe1f7fa,map:sprayMap,size:.22,transparent:true,depthWrite:false,opacity:.64,toneMapped:false,
  }));
  splashPoints.frustumCulled=false;
  splashPoints.renderOrder=4;
  scene.add(splashPoints);
  return {
    update(seconds, hideRearStation, waterSeconds) {
      time.value=waterSeconds;
      rearStairs.visible = !hideRearStation;
      banners.forEach((banner,index)=>{
        const p=banner.geometry.attributes.position;
        for (let i=0;i<p.count;i++) {
          const drift=(1.42-p.getY(i))/2.84;
          p.setZ(i,Math.sin(p.getX(i)*6+drift*5-seconds*2.8+index)*drift*.075);
        }
        p.needsUpdate=true;
        banner.geometry.computeVertexNormals();
      });
      splashes.forEach(({patch,x,y,z,width,height,ground},i)=>{
        const drift=Math.sin(waterSeconds*1.52+i*2.31);
        patch.position.set(x+.19*drift,y+(ground?0:.13*drift),z+.14*Math.cos(waterSeconds*1.2+i));
        patch.scale.set(width*(1+.12*drift),height*(1+.16*drift),1);
      });
      particlePaths.forEach(({x,z,speed,phase,drift,depth},i)=>{
        const age=(waterSeconds*speed+phase)%1;
        positions.setXYZ(i,x+age*drift,lowerWaterY+2.5*age*(1-age)*speed,z+depth*age);
      });
      positions.needsUpdate=true;
    },
    dispose() {
      disposed=true;
      for (const map of [texture,wallMap,cliffMap,ivyMap,cascade,heraldry,sprayMap]) map.dispose();
    },
  };
}
