import * as THREE from '/vendor/three.module.js';
import {Reflector} from '/vendor/addons/objects/Reflector.js';
import {buildWaterArcade,waterGymSkerries,waterSurfaceWaves} from './battlefield-arcade.js';

const worldVertex = `
  varying vec2 texCoord;
  varying vec3 worldPoint;
  void main() {
    texCoord = uv;
    worldPoint = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(worldPoint, 1.0);
  }
`;

const horizonFragment = `
  uniform sampler2D panorama;
  uniform float panoramaReady;
  uniform float sceneryAngle;
  varying vec3 worldPoint;
  void main() {
    vec3 direction = normalize(worldPoint - cameraPosition);
    float yaw = atan(direction.x, -direction.z) + sceneryAngle;
    float elevation = asin(direction.y);
    // Give the angles used by the battle cameras more of the painted panorama.
    float paintedYaw = yaw + .75*sin(yaw);
    vec2 samplePoint = vec2(fract(.43 + paintedYaw / 6.2831853), .545 + elevation * .73);
    vec3 sky = mix(vec3(.34, .64, .88), vec3(.06, .30, .66), smoothstep(0.0, .75, elevation));
    vec3 ocean = mix(vec3(.027, .21, .39), vec3(.017, .40, .51), smoothstep(0.0, .42, -elevation));
    vec3 color = mix(ocean, sky, smoothstep(-.006, .003, elevation));
    float edges = smoothstep(.0, .14, samplePoint.y) * smoothstep(.0, .13, 1.0 - samplePoint.y);
    vec3 painted = texture2D(panorama, samplePoint).rgb;
    // Blend the two edges across the azimuth seam, behind the stands.
    float seam = .044;
    float edgeDistance = min(samplePoint.x, 1.0 - samplePoint.x);
    vec3 opposite = texture2D(panorama, vec2(1.0 - samplePoint.x, samplePoint.y)).rgb;
    painted = mix(painted, opposite, .5 * (1.0 - smoothstep(0.0, seam, edgeDistance)));
    float haze = .32 * (1.0 - smoothstep(.04,.29,elevation));
    vec3 atmospheric = mix(painted, vec3(.29,.50,.65), haze);
    gl_FragColor = vec4(mix(color, atmospheric, edges * panoramaReady), 1.0);
    #include <colorspace_fragment>
  }
`;

const seaVertex = `
  uniform mat4 textureMatrix;
  varying vec4 reflectionUv;
  varying vec3 worldPoint;
  void main() {
    worldPoint = (modelMatrix * vec4(position,1.0)).xyz;
    reflectionUv = textureMatrix * vec4(position,1.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  }
`;

const seaFragment = `
  uniform float time;
  uniform sampler2D tDiffuse;
  uniform vec2 coastTurn;
  uniform vec4 skerryBounds[${waterGymSkerries.length}];
  uniform vec2 skerryTurns[${waterGymSkerries.length}];
  varying vec4 reflectionUv;
  varying vec3 worldPoint;
  ${waterSurfaceWaves}
  void main() {
    vec2 p = worldPoint.xz;
    vec3 view = normalize(cameraPosition - worldPoint);
    float distanceToEye = distance(cameraPosition,worldPoint);
    float overhead = smoothstep(.50,.87,view.y);
    float detail = 1.0-smoothstep(mix(27.0,66.0,overhead),mix(62.0,112.0,overhead),distanceToEye);
    vec3 wave = waterWaves(p,time);
    vec2 slope = -wave.xy*mix(.60,1.0,detail);
    vec3 normal = normalize(vec3(slope.x,1.0,slope.y));
    float facing = clamp(dot(normal,view),0.0,1.0);
    float fresnel = .073 + .54 * pow(1.0-facing,3.55);
    vec2 uv = reflectionUv.xy/reflectionUv.w + slope*.038*detail;
    vec2 spread = vec2(.0024,.0014)*(1.0+2.3*length(slope));
    vec3 reflected = texture2D(tDiffuse,clamp(uv,.002,.998)).rgb*.56;
    reflected += texture2D(tDiffuse,clamp(uv+spread,.002,.998)).rgb*.22;
    reflected += texture2D(tDiffuse,clamp(uv-spread,.002,.998)).rgb*.22;
    float radius = length(p);
    float shore = exp(-.34*abs(radius-12.1));
    float current = sin(dot(p,vec2(.22,-.34))+.58*sin(p.x*.26+time*.29)-time*.41);
    vec2 coastPoint = mat2(coastTurn.x,coastTurn.y,-coastTurn.y,coastTurn.x)*p;
    float shallows = 0.0;
    float shoreFoam = 0.0;
    for (int i=0;i<${waterGymSkerries.length};i++) {
      vec4 bounds = skerryBounds[i];
      vec2 offset = coastPoint-bounds.xy;
      if (dot(offset,offset)>bounds.z*bounds.z*3.6) continue;
      vec2 turn = skerryTurns[i];
      vec2 local = mat2(turn.x,turn.y,-turn.y,turn.x)*offset;
      float edgeDist = length(local/bounds.zw) + .095*sin(local.x*3.4+local.y*2.9) + wave.z*.5;
      shallows = max(shallows,1.0-smoothstep(.84,1.69,edgeDist));
      float crest = 1.0-smoothstep(.015,.105,abs(edgeDist-1.03));
      shoreFoam = max(shoreFoam,crest*smoothstep(.018,.094,wave.z+current*.035));
    }
    float shoals = sin(dot(p,vec2(.27,.17))+1.3*sin(dot(p,vec2(-.16,.29)))) *
      sin(dot(p,vec2(.12,-.28))+.8*sin(p.x*.21));
    float tint = .27+shore*.60+current*.052+wave.z*.42;
    tint += overhead*detail*(shoals*.21+current*.06+wave.z*.88) + shallows*.46;
    vec3 water = mix(vec3(.009,.085,.135),vec3(.029,.24,.226),clamp(tint,0.0,1.0));
    vec3 color = mix(water,reflected*vec3(.78,.90,.94),fresnel);
    vec3 sun = normalize(vec3(-16.0,11.5,9.0));
    float light = pow(max(0.0,dot(normal,normalize(sun+view))),65.0);
    color += vec3(.86,.80,.67)*light*mix(.30,.085,overhead)*detail;
    float sheen = smoothstep(.025,.19,dot(slope,vec2(.81,.59)));
    color += vec3(.067,.15,.16)*sheen*detail*(.065+.095*shore);
    float crest = smoothstep(.066,.104,wave.z+current*.018);
    color += vec3(.095,.22,.23)*overhead*detail*(sheen*.12+crest*.12);
    float edge = 1.0-smoothstep(.045,.34,abs(radius-11.55+wave.z*.94));
    float foam = edge*smoothstep(.019,.103,wave.z+current*.023)*detail;
    color = mix(color,vec3(.52,.70,.69),max(foam*.39,shoreFoam*detail*.26));
    float opacity = 1.0-smoothstep(mix(40.0,80.0,overhead),mix(69.0,120.0,overhead),distanceToEye);
    gl_FragColor = vec4(color,opacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function leafGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0,0);
  shape.quadraticCurveTo(-.26,.08,-.37,.45);
  shape.quadraticCurveTo(-.23,.42,-.19,.52);
  shape.quadraticCurveTo(-.14,.77,0,1);
  shape.quadraticCurveTo(.19,.77,.19,.55);
  shape.quadraticCurveTo(.27,.48,.40,.51);
  shape.quadraticCurveTo(.34,.14,0,0);
  return new THREE.ShapeGeometry(shape,5);
}

function addBatch(scene, geometry, material, placements, castShadow) {
  const batch = new THREE.InstancedMesh(geometry,material,placements.length);
  const pose = new THREE.Object3D(), tint = new THREE.Color();
  for (const [index, item] of placements.entries()) {
    pose.position.set(item.x,item.y,item.z);
    pose.scale.set(item.width,item.height,item.depth);
    pose.rotation.set(item.pitch,item.yaw,item.roll);
    pose.updateMatrix();
    batch.setMatrixAt(index,pose.matrix);
    batch.setColorAt(index,tint.setHex(item.color));
  }
  batch.castShadow = castShadow;
  batch.receiveShadow = true;
  scene.add(batch);
  return batch;
}

export function createCoastalScenery(scene, {add, canvasMap, random, refresh, sceneryAngle}) {
  const firstCoastalObject = scene.children.length;
  const textures = [];
  function loadMap(url, ready) {
    const texture = new THREE.TextureLoader().load(url,()=>{
      ready.value = 1;
      refresh?.();
    });
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    textures.push(texture);
    return texture;
  }
  const panoramaReady = {value:0};
  const panorama = loadMap('/coastal-panorama.webp',panoramaReady);
  panorama.wrapS = THREE.RepeatWrapping;
  const horizonMaterial = new THREE.ShaderMaterial({
    uniforms:{panorama:{value:panorama},panoramaReady,sceneryAngle:{value:sceneryAngle}},
    vertexShader:worldVertex,fragmentShader:horizonFragment,side:THREE.BackSide,
  });
  add(new THREE.SphereGeometry(96,32,20),horizonMaterial,0,0,0,false);
  const arcade = buildWaterArcade(scene,{add,addBatch,canvasMap,leafGeometry,random,refresh});
  const sea = new Reflector(new THREE.PlaneGeometry(168,112),{
    clipBias:.003,textureWidth:512,textureHeight:320,multisample:0,
    shader:{
      uniforms:{
        time:{value:0},tDiffuse:{value:null},color:{value:null},textureMatrix:{value:null},
        coastTurn:{value:new THREE.Vector2(Math.cos(sceneryAngle),Math.sin(sceneryAngle))},
        skerryBounds:{value:waterGymSkerries.map(({x,z,width,depth})=>new THREE.Vector4(x,z,width,depth))},
        skerryTurns:{value:waterGymSkerries.map(({yaw})=>new THREE.Vector2(Math.cos(yaw),Math.sin(yaw)))},
      },
      vertexShader:seaVertex,fragmentShader:seaFragment,
    },
  });
  sea.getRenderTarget().texture.type = THREE.UnsignedByteType;
  sea.material.transparent = true;
  sea.material.depthWrite = false;
  sea.position.set(0,-.22,-6);
  sea.rotation.x = -Math.PI/2;
  sea.renderOrder = -1;
  scene.add(sea);
  const reflect = sea.onBeforeRender;
  const previousCamera = new THREE.Matrix4();
  let lastReflection = -Infinity;
  sea.onBeforeRender = (renderer,world,camera)=>{
    const now = performance.now();
    const moved = !previousCamera.equals(camera.matrixWorld);
    if (!moved && now-lastReflection < 135) return;
    sea.getReflectionCamera(camera).layers.set(1);
    reflect.call(sea,renderer,world,camera);
    lastReflection = now;
    previousCamera.copy(camera.matrixWorld);
  };

  const scenery = new THREE.Group();
  scenery.rotation.y = sceneryAngle;
  for (const object of scene.children.slice(firstCoastalObject)) {
    object.traverse(part=>part.layers.enable(1));
    scenery.add(object);
  }
  scene.add(scenery);
  for (const object of scene.children) if (object.isLight) object.layers.enable(1);
  return {
    update(seconds, hideRearStation, waterSeconds) {
      sea.material.uniforms.time.value=waterSeconds;
      arcade.update(seconds,hideRearStation,waterSeconds);
    },
    dispose() {
      textures.forEach(texture=>texture.dispose());
      sea.dispose();
      sea.geometry.dispose();
      sea.removeFromParent();
      arcade.dispose();
    },
  };
}
