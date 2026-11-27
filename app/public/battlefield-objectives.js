import * as THREE from '/vendor/three.module.js';

const teamGlow={'team-a':0x54c9f4,'team-b':0xf39171,'team-c':0xc3acfa};

export function createObjectiveTerrain(scene) {
  const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.76,...extra});
  const mesh=(geometry,surface,x,y,z,parent=scene)=>{
    const object=new THREE.Mesh(geometry,surface);
    object.position.set(x,y,z);
    object.receiveShadow=true;
    object.castShadow=true;
    parent.add(object);
    return object;
  };
  const round=(top,bottom,height,sides,surface,x,y,z,parent)=>mesh(
    new THREE.CylinderGeometry(top,bottom,height,sides),surface,x,y,z,parent);
  const box=(w,h,d,surface,x,y,z,parent)=>mesh(new THREE.BoxGeometry(w,h,d),surface,x,y,z,parent);
  const luminous=material(0x677487,{emissive:0x374c6b,emissiveIntensity:.6,metalness:.2});
  const ring=(radius,width,surface,x,y,z)=>{
    const object=mesh(new THREE.RingGeometry(radius-width,radius,72),surface,x,y,z);
    object.rotation.x=-Math.PI/2;
    object.castShadow=false;
    return object;
  };
  const centered=new THREE.Group();
  scene.add(centered);

  scene.fog=new THREE.Fog(0x203148,28,57);
  const deck=material(0x506779,{metalness:.27}),dark=material(0x182840,{metalness:.35});
  const edge=material(0x9cb4c4,{metalness:.38});
  const violet=material(0x87306f,{roughness:.26,metalness:.14});
  const white=material(0xd9d9df,{roughness:.29});
  const glass=material(0x334f76,{metalness:.19,roughness:.34});
  round(11.65,11.85,.9,12,dark,0,-.48,0);
  round(11.48,11.65,.25,12,edge,0,-.012,0);
  round(11.25,11.34,.14,12,deck,0,.135,0);
  ring(9.5,.04,edge,0,.211,0);
  ring(6.25,.08,glass,0,.214,0);
  for (let i=0;i<12;i++) {
    const angle=i*Math.PI/6;
    const stripe=box(.11,.012,3.14,edge,Math.sin(angle)*8.2,.213,Math.cos(angle)*8.2);
    stripe.rotation.y=angle;
  }
  for (let i=0;i<9;i++) {
    const x=(i-4)*2.92;
    box(2.73,3.65,.47,dark,x,1.05,-11.8);
    box(2.46,2.48,.16,glass,x,1.33,-11.5);
    box(2.38,.065,.12,luminous,x,2.19,-11.38);
    box(.14,3.75,.37,edge,x+1.38,1.05,-11.68);
  }
  round(1.46,1.65,.46,8,dark,0,.42,0,centered);
  round(1.25,1.44,.16,8,edge,0,.725,0,centered);
  round(.52,.75,.38,12,glass,0,.94,0,centered);
  mesh(new THREE.SphereGeometry(.7,32,16,0,Math.PI*2,0,Math.PI/2),violet,0,1.74,0,centered);
  mesh(new THREE.SphereGeometry(.7,32,16,0,Math.PI*2,Math.PI/2,Math.PI/2),white,0,1.74,0,centered);
  round(.706,.706,.09,32,dark,0,1.74,0,centered);
  const button=round(.17,.17,.1,24,white,0,1.74,.698,centered);
  button.rotation.x=Math.PI/2;
  ring(1.91,.18,luminous,0,.226,0);
  return state=>{
    const color=teamGlow[state?.control?.team] ?? 0x9dc8ef;
    luminous.color.setHex(color);
    luminous.emissive.setHex(color);
  };
}
