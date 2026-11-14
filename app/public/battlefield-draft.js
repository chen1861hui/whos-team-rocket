import * as THREE from '/vendor/three.module.js';
import {clone} from '/vendor/addons/utils/SkeletonUtils.js';

function poseDraftModel(model, dex) {
  const aerodactyl = dex===142;
  model.rotation.set(aerodactyl ? .29 : .11, aerodactyl ? -.55 : -.28,0);
  // The draft camera faces the opposite side of Gastly's battle-facing axis.
  if (dex===92) model.rotation.y += Math.PI;
  if (dex!==66) return;
  model.updateMatrixWorld(true);
  for (const side of ['L','R']) {
    const arm = model.getObjectByName(`${side}Arm`);
    const forearm = model.getObjectByName(`${side}ForeArm`);
    if (!arm?.parent || !forearm) continue;
    const straight = forearm.position.clone().applyQuaternion(arm.quaternion).normalize();
    const down = new THREE.Vector3(0,-1,0)
      .applyQuaternion(arm.parent.getWorldQuaternion(new THREE.Quaternion()).invert());
    const relaxed = straight.clone().lerp(down,.65).normalize();
    arm.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(straight,relaxed));
  }
}

function createBallTemplate() {
  const ball = new THREE.Group();
  const lid = new THREE.Group();
  lid.name = 'lid';
  lid.position.z = -1;
  ball.add(lid);
  const red = new THREE.MeshStandardMaterial({color:0xcc202e,roughness:.27});
  const white = new THREE.MeshStandardMaterial({color:0xf8f1e4,roughness:.31});
  const seam = new THREE.MeshStandardMaterial({color:0x25222c,roughness:.53});
  const inner = new THREE.MeshStandardMaterial({color:0x918496,roughness:.43});
  const cap = new THREE.CylinderGeometry(1,1,.067,40);
  const top = new THREE.Mesh(new THREE.SphereGeometry(1,40,20,0,Math.PI*2,0,Math.PI/2),red);
  top.position.set(0,.067,1);
  lid.add(top);
  const lidRim = new THREE.Mesh(cap,seam);
  lidRim.position.set(0,.0335,1);
  lid.add(lidRim);
  const base = new THREE.Mesh(new THREE.SphereGeometry(1,40,20,0,Math.PI*2,Math.PI/2,Math.PI/2),white);
  base.position.y = -.067;
  ball.add(base);
  const baseRim = new THREE.Mesh(cap,seam);
  baseRim.position.y = -.0335;
  ball.add(baseRim);
  const liner = new THREE.CylinderGeometry(.84,.84,.019,32);
  const baseLining = new THREE.Mesh(liner,inner);
  baseLining.position.y = .006;
  ball.add(baseLining);
  const lidLining = new THREE.Mesh(liner,white);
  lidLining.position.set(0,-.013,1);
  lid.add(lidLining);
  for (const [radius,depth,z,material] of [[.29,.11,1,seam],[.19,.072,1.06,white]]) {
    const button = new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,depth,32),material);
    button.rotation.x = Math.PI/2;
    button.position.set(0,0,z+1);
    lid.add(button);
  }
  return ball;
}

export function createDraftModels(loadModel, refresh) {
  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:true, powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const canvas = renderer.domElement;
  canvas.className = 'draft-model-canvas';
  canvas.setAttribute('aria-hidden','true');
  const camera = new THREE.OrthographicCamera(0,1,1,0,.1,1200);
  camera.position.z = 600;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff0db,0x8b91af,2.3));
  const key = new THREE.DirectionalLight(0xffefd8,2.4);
  key.position.set(-80,150,90);
  scene.add(key);

  const candidates = new Map();
  const ballTemplate = createBallTemplate();
  const ballGroup = new THREE.Group();
  scene.add(ballGroup);
  let center, balls = [], width, height, lost = false;
  const observer = new ResizeObserver(refresh);
  const showIllustrations = () => {
    for (const candidate of candidates.values()) delete candidate.art.dataset.modelReady;
    for (const {anchor} of balls) delete anchor.dataset.ballReady;
  };
  const onLost = event => {
    event.preventDefault();
    lost = true;
    canvas.hidden = true;
    showIllustrations();
  };
  const onRestored = () => {
    lost = false;
    canvas.hidden = false;
    refresh();
  };
  canvas.addEventListener('webglcontextlost',onLost);
  canvas.addEventListener('webglcontextrestored',onRestored);

  return {
    mount(nextCenter) {
      if (center===nextCenter) return;
      observer.disconnect();
      showIllustrations();
      center = nextCenter;
      center.append(canvas);
      observer.observe(center);
      const visible = new Set();
      for (const tile of center.querySelectorAll('.draft-revealed')) {
        const id = tile.dataset.candidate;
        const art = tile.querySelector('.draft-slot-art');
        visible.add(id);
        const existing = candidates.get(id);
        if (existing) {
          Object.assign(existing,{tile,art});
          continue;
        }
        const candidate = {tile,art,openedAt:tile.classList.contains('draft-arriving')?performance.now():null};
        candidates.set(id,candidate);
        loadModel({catalogueId:id,level:1}).then(asset=>{
          if (!asset || candidates.get(id)!==candidate) return;
          candidate.model = clone(asset.mount);
          poseDraftModel(candidate.model,asset.dex);
          if (asset.idle) {
            candidate.mixer = new THREE.AnimationMixer(candidate.model.children[0]);
            candidate.mixer.clipAction(asset.idle).play();
            candidate.mixer.setTime(.1);
          }
          scene.add(candidate.model);
          refresh();
        }).catch(()=>{ /* The portrait remains visible if a model cannot load. */ });
      }
      for (const [id,candidate] of candidates) {
        if (visible.has(id)) continue;
        candidate.model?.removeFromParent();
        candidates.delete(id);
      }
      const charging = center.dataset.ceremony==='charging';
      ballGroup.clear();
      balls = Array.from(center.querySelectorAll('.draft-ball'),(anchor,index)=>{
        const model = ballTemplate.clone(true);
        ballGroup.add(model);
        const tile = anchor.closest('.draft-slot');
        return {anchor,index,model,lid:model.getObjectByName('lid'),
          candidate:candidates.get(tile?.dataset.candidate),flight:charging ? tile : null};
      });
    },
    draw(time,dt,reducedMotion) {
      if (lost || !center?.isConnected || !center.clientWidth || !center.clientHeight) return;
      if (width!==center.clientWidth || height!==center.clientHeight) {
        width = center.clientWidth;
        height = center.clientHeight;
        renderer.setSize(width,height,false);
        camera.right = width;
        camera.top = height;
        camera.updateProjectionMatrix();
      }
      const origin = center.getBoundingClientRect();
      for (const {anchor,index,model,lid,candidate,flight} of balls) {
        const rect = anchor.getBoundingClientRect();
        const radius = Math.min(rect.width,rect.height)*.47;
        model.visible = radius>0 && (!flight || Number(getComputedStyle(flight).opacity)>.06);
        if (!model.visible) continue;
        const opening = candidate
          ? reducedMotion || candidate.openedAt==null ? 1 : THREE.MathUtils.smoothstep(time-candidate.openedAt,35,415)
          : 0;
        const phase = reducedMotion ? 0 : Math.sin(time*.0026+index*.8)*(1-opening);
        model.position.set(rect.left-origin.left+rect.width/2,
          height-(rect.top-origin.top+rect.height/2)+phase*3,0);
        model.rotation.set(.23,-.16+phase*.23,phase*.055);
        model.scale.setScalar(radius*(1-opening*.33));
        lid.rotation.x = -2.17*opening;
      }
      const displayed = [];
      for (const {art,model,mixer,openedAt} of candidates.values()) {
        if (!model) continue;
        const entry = reducedMotion || openedAt==null ? 1 : THREE.MathUtils.smoothstep(time-openedAt,290,610);
        model.visible = entry>0;
        if (!model.visible) continue;
        const rect = art.getBoundingClientRect();
        const scale = Math.min(rect.width,rect.height)*.94/2.25;
        model.position.set(rect.left-origin.left+rect.width/2,
          height-(rect.top-origin.top+rect.height*.84)+(1-entry)*rect.height*.18,55);
        model.scale.setScalar(scale*(.55+entry*.45));
        if (!reducedMotion) {
          if (mixer) mixer.update(dt);
          else model.position.y += Math.sin(time*.003+rect.left*.01)*1.1;
        }
        displayed.push(art);
      }
      renderer.render(scene,camera);
      for (const {anchor} of balls) anchor.dataset.ballReady = 'true';
      for (const art of displayed) art.dataset.modelReady = 'true';
    },
    dispose() {
      observer.disconnect();
      showIllustrations();
      candidates.clear();
      scene.clear();
      ballGroup.clear();
      const resources = new Set();
      ballTemplate.traverse(part=>{
        if (part.isMesh) resources.add(part.geometry).add(part.material);
      });
      for (const resource of resources) resource.dispose();
      canvas.removeEventListener('webglcontextlost',onLost);
      canvas.removeEventListener('webglcontextrestored',onRestored);
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
