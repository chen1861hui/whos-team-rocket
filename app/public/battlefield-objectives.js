import * as THREE from '/vendor/three.module.js';

const teamGlow={'team-a':0x54c9f4,'team-b':0xf39171,'team-c':0xc3acfa};

export function createObjectiveTerrain(scene, theme) {
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

  if (theme==='lake') {
    scene.fog=new THREE.FogExp2(0x718f99,.025);
    const water=material(0x25637c,{roughness:.38,metalness:.18});
    const stone=material(0x475852),moss=material(0x41654a);
    const seabed=mesh(new THREE.PlaneGeometry(180,180),water,0,-.44,0);
    seabed.rotation.x=-Math.PI/2;
    seabed.castShadow=false;
    const rock=new THREE.DodecahedronGeometry(1,0);
    for (let i=0;i<24;i++) {
      const angle=i*Math.PI/12, radius=13.4+(i%3)*.78;
      const x=Math.cos(angle)*radius, z=Math.sin(angle)*radius;
      const boulder=mesh(rock,i%3===0?moss:stone,x,-.33,z);
      boulder.scale.set(1.25+(i%4)*.31,.43+(i%3)*.26,.9+(i%4)*.16);
      boulder.rotation.y=angle;
      if (z<5 && i%2===0) {
        const treeX=x*1.24,treeZ=z*1.24;
        round(.13,.19,2.8,5,stone,treeX,.49,treeZ);
        round(0,1.03,2.9,7,moss,treeX,1.87,treeZ);
        round(0,.83,2.6,7,moss,treeX,2.66,treeZ);
      }
    }
    for (const radius of [3.8,6.7,9.2,11.7]) {
      ring(radius,.07,material(0x79b1ba,{transparent:true,opacity:.26,depthWrite:false}),0,-.426,0);
    }
    const hull=material(0x262f37),paint=material(0x7e3341);
    round(1.28,1.42,.47,8,stone,0,-.075,0,centered);
    box(1.3,.42,.99,hull,0,.37,0,centered);
    box(.84,1.13,.65,paint,0,1.05,0,centered);
    box(.58,.33,.08,luminous,0,1.2,.361,centered);
    round(.045,.09,1.93,8,hull,0,1.94,0,centered).rotation.z=-.12;
    const dish=mesh(new THREE.SphereGeometry(.58,24,10,0,Math.PI*2,0,.65),
      material(0xa46065,{side:THREE.DoubleSide}),.13,2.84,0,centered);
    dish.rotation.z=-.7;
    ring(1.63,.15,luminous,0,-.376,0);
    return state=>{
      const color=state?.transmitter===false?0x59b6ac:state?.phase===2?0xff473c:0xff9a56;
      luminous.color.setHex(color);
      luminous.emissive.setHex(color);
    };
  }

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
