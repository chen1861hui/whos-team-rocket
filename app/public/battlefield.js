import * as THREE from '/vendor/three.module.js';
import {seatLayout} from './battlefield-layout.js';

const colors = [0xec604a, 0x4599d5, 0xe4b643, 0x8b78c5, 0x3f9c85, 0xe289a0];
const palettes = {
  stadium: {sky:0xd8e8e6, ground:0x719a71, field:0x5d8e63, edge:0xe5e4cd, trim:0x213d42, seats:0xc65242},
  gym: {sky:0x162c41, ground:0x1b354a, field:0x32576b, edge:0x6e98ac, trim:0x112b3b, seats:0x497b95},
  floating: {sky:0xbcdbe7, ground:0x9ac2d3, field:0x83a784, edge:0xf1e6cc, trim:0x507886, seats:0xe6c396},
};

export function createBattlefield() {
  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:false, powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.domElement.className = 'battlefield-canvas';
  renderer.domElement.setAttribute('aria-hidden','true');
  const camera = new THREE.PerspectiveCamera(41, 1, 0.1, 150);
  let scene, host, config, geometryKey = '', pods = [], labelLayer, observer, disposed = false, lost = false, lastFrame = 0;

  function clearScene() {
    if (!scene) return;
    const geometries = new Set(), materials = new Set();
    scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m));
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    scene.clear();
  }
  function build() {
    clearScene(); pods = [];
    const p = palettes[config.theme] || palettes.stadium;
    scene = new THREE.Scene(); scene.background = new THREE.Color(p.sky);
    scene.fog = new THREE.Fog(p.sky, 45, 90);
    scene.add(new THREE.HemisphereLight(0xeafaff, 0x58705b, 2.5));
    const sun = new THREE.DirectionalLight(0xfff0d4, 3.2);
    sun.position.set(-12, 22, 8); sun.castShadow = true;
    sun.shadow.mapSize.set(1024,1024);
    Object.assign(sun.shadow.camera,{left:-17,right:17,top:17,bottom:-17,near:1,far:65});
    sun.shadow.bias = -0.001; scene.add(sun);
    const mat = (color, extra={}) => new THREE.MeshStandardMaterial({color, roughness:0.86, ...extra});
    const mesh = (geometry, material, x=0, y=0, z=0, parent=scene) => {
      const object = new THREE.Mesh(geometry,material); object.position.set(x,y,z);
      object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
    };
    const cylinder = (r,h,color,x=0,y=0,z=0,parent=scene,segments=64) => mesh(new THREE.CylinderGeometry(r,r,h,segments),mat(color),x,y,z,parent);
    const box = (w,h,d,color,x,y,z,parent=scene) => mesh(new THREE.BoxGeometry(w,h,d),mat(color),x,y,z,parent);
    const ring = (r,width,color,x=0,y=0,z=0,parent=scene) => {
      const object = mesh(new THREE.RingGeometry(r-width,r,96),new THREE.MeshBasicMaterial({color, side:THREE.DoubleSide}),x,y,z,parent);
      object.rotation.x=-Math.PI/2; object.castShadow=false; return object;
    };
    if (config.theme !== 'floating') {
      const ground=mesh(new THREE.PlaneGeometry(200,200),mat(p.ground),0,-1.2,0);
      ground.rotation.x=-Math.PI/2; ground.castShadow=false;
    } else {
      for(let i=0;i<12;i++) {
        const a=i*Math.PI/6;
        const cloud=mesh(new THREE.SphereGeometry(2.4,12,8),mat(0xf4f8f1),Math.sin(a)*16,-3-Math.cos(a),Math.cos(a)*15);
        cloud.scale.set(2.1,.5,1.1); cloud.castShadow=false;
      }
      mesh(new THREE.ConeGeometry(10,6,8),mat(0x6c8291),0,-3.3,0).rotation.z=Math.PI;
    }
    cylinder(11.8,.5,p.trim,0,-.65); cylinder(11.5,.6,p.edge,0,-.18); cylinder(10.8,.1,p.field,0,.17);
    ring(10.2,.09,0xe5ebcf,0,.235); ring(4.4,.07,0xe5ebcf,0,.245);
    // Central field emblem and opposing lanes stay clear for future attack effects.
    ring(2.05,.08,0xe8eed7,0,.26); ring(.62,.11,0xe8eed7,0,.27);
    box(2.85,.014,.09,0xe8eed7,-2.05,.26,0); box(2.85,.014,.09,0xe8eed7,2.05,.26,0);
    for (const z of [-3.4,3.4]) box(2.8,.014,.06,0xe8eed7,0,.26,z);
    // Short grandstands leave the front of the diorama open to the camera.
    for(let i=0;i<12;i++) {
      const a=(i/11)*Math.PI+Math.PI/2;
      for(let row=0;row<3;row++) {
        const r=12.15+row*.6;
        const stand=box(2.6,.35,.48,row%2?p.edge:p.seats,Math.sin(a)*r,.12+row*.42,Math.cos(a)*r);
        stand.rotation.y=a;
      }
    }
    for(const [x,z] of [[-11,-7],[11,-7]]) {
      box(.15,6.5,.15,p.trim,x,3,z);
      box(2.2,.5,.4,p.trim,x,6.1,z);
      for(let j=0;j<4;j++) box(.36,.26,.44,0xfff4c8,x-.8+j*.53,6.1,z+.02);
    }
    const layout = seatLayout(config.players,config.viewerId);
    layout.forEach(position => {
      const group=new THREE.Group(); group.position.set(position.x,.24,position.z); group.rotation.y=position.angle;
      scene.add(group);
      const color=colors[position.index%colors.length];
      cylinder(1.32,.16,p.trim,0,.06,0,group,8); cylinder(1.17,.12,p.edge,0,.2,0,group,8);
      const halo=ring(1.12,.075,color,0,.269,0,group);
      // A neutral capsule is a model slot, not a claimed Pokémon asset.
      const proxy=new THREE.Group(); proxy.position.set(0,.28,-.24); group.add(proxy);
      mesh(new THREE.SphereGeometry(.5,24,16,0,Math.PI*2,0,Math.PI/2),mat(color),0,.53,0,proxy);
      mesh(new THREE.SphereGeometry(.5,24,16,0,Math.PI*2,Math.PI/2,Math.PI/2),mat(0xeef0dc),0,.53,0,proxy);
      cylinder(.508,.075,p.trim,0,.53,0,proxy,32);
      // Trainer marker is outside the Pokémon's plinth, facing the centre.
      const trainer=new THREE.Group(); trainer.position.set(.2,0,1.75); group.add(trainer);
      mesh(new THREE.CapsuleGeometry(.19,.42,4,8),mat(color),0,.65,0,trainer);
      mesh(new THREE.SphereGeometry(.19,12,8),mat(0xf0c9a4),0,1.13,0,trainer);
      cylinder(.21,.11,color,0,1.28,0,trainer,12);
      box(.12,.34,.14,p.trim,-.12,.2,0,trainer); box(.12,.34,.14,p.trim,.12,.2,0,trainer);
      const turnMarker=mesh(new THREE.OctahedronGeometry(.16),new THREE.MeshBasicMaterial({color:0xffd459}),0,2.1,0,group);
      pods.push({id:position.id, position:new THREE.Vector3(position.x,1.8,position.z), halo, turnMarker, proxy});
    });
  }
  function resize() {
    if(!host || disposed || lost) return;
    const w=Math.max(host.clientWidth,1), h=Math.max(host.clientHeight,1);
    renderer.setSize(w,h,false); camera.aspect=w/h;
    const distance=Math.max(28, 27/Math.min(camera.aspect,1.6));
    camera.position.set(0, config.camera==='overhead'?distance*1.23:distance*.79,config.camera==='overhead'?.01:distance*.85);
    camera.lookAt(0,0,0); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    draw(0);
  }
  function draw(time) {
    if (!scene || !host?.isConnected || disposed || lost || document.hidden) return;
    for(const pod of pods) {
      const active=pod.id===config.turnId;
      pod.turnMarker.visible=active;
      pod.turnMarker.position.y=2.1+(config.reducedMotion?0:Math.sin(time*.002)*.08);
      pod.halo.material.color.setHex(active?0xffd459:0x809e94);
      const v=pod.position.clone().project(camera);
      const label=labelLayer?.querySelector(`[data-seat-id="${CSS.escape(pod.id)}"]`);
      if(label) {
        label.style.left=`${(v.x*.5+.5)*100}%`; label.style.top=`${(-v.y*.5+.5)*100}%`;
      }
    }
    renderer.render(scene,camera);
  }
  const onLost = event => {
    event.preventDefault(); lost=true;
    if(host) {host.dataset.mode='flat'; host.dataset.reason='webgl';}
  };
  const onRestored = () => { if(disposed)return; lost=false; host.dataset.mode='3d'; delete host.dataset.reason; resize(); };
  renderer.domElement.addEventListener('webglcontextlost',onLost);
  renderer.domElement.addEventListener('webglcontextrestored',onRestored);
  renderer.setAnimationLoop(time => {
    if(config?.reducedMotion || time-lastFrame<33) return;
    lastFrame=time; draw(time);
  });
  return {
    mount(nextHost, nextConfig) {
      host=nextHost; config=nextConfig; labelLayer=host.querySelector('.world-labels');
      host.prepend(renderer.domElement); host.dataset.mode=lost?'flat':'3d';
      const key=JSON.stringify([config.theme,config.viewerId,config.players.map(p=>p.id)]);
      if(key!==geometryKey) { geometryKey=key; build(); }
      observer?.disconnect(); observer=new ResizeObserver(resize); observer.observe(host); resize();
    },
    dispose() {
      disposed=true; observer?.disconnect(); renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('webglcontextlost',onLost);
      renderer.domElement.removeEventListener('webglcontextrestored',onRestored);
      clearScene(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}
