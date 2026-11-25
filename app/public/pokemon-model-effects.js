import * as THREE from '/vendor/three.module.js';

function cloudNoise() {
  const size = 16;
  const data = new Uint8Array(size ** 3);
  let seed = 293117;
  for (let i=0; i<data.length; i++) {
    seed = (Math.imul(seed,1664525)+1013904223)>>>0;
    data[i] = seed>>>24;
  }
  const texture = new THREE.Data3DTexture(data,size,size,size);
  texture.format = THREE.RedFormat;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = texture.wrapR = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

const smokeVertex = `
  varying vec3 fogSurface;
  varying vec3 fogEye;
`;

const smokeFragment = `
  uniform highp sampler3D fogNoise;
  uniform float fogTime;
  varying vec3 fogSurface;
  varying vec3 fogEye;

  float puff(vec3 samplePoint,vec3 center,vec3 radius) {
    return 1.0-smoothstep(0.37,1.0,length((samplePoint-center)/radius));
  }

  vec4 billowingSmoke() {
    vec3 ray = normalize(fogSurface - fogEye);
    vec3 invRay = 1.0 / (ray + 0.000001);
    vec3 first = (-1.0 - fogEye) * invRay;
    vec3 second = (1.0 - fogEye) * invRay;
    vec3 enters = min(first,second);
    vec3 leaves = max(first,second);
    float start = max(0.0,max(enters.x,max(enters.y,enters.z)));
    float end = min(leaves.x,min(leaves.y,leaves.z));
    float stepSize = max(0.0,end-start) / 22.0;
    vec4 total = vec4(0.0);

    for (int i=0; i<22; ++i) {
      vec3 p = fogEye + ray * (start+(float(i)+0.5)*stepSize);
      float spiral = 0.52 * p.y - fogTime*0.46;
      float c = cos(spiral);
      float s = sin(spiral);
      vec3 twisted = vec3(c*p.x-s*p.z,p.y,s*p.x+c*p.z);
      twisted += 0.15 * sin(twisted.yzx*3.4 + vec3(0.8,2.6,4.2) + fogTime*vec3(-0.7,0.9,-0.6));

      vec3 flow = vec3(0.02,-0.055,0.025) * fogTime;
      float broad = texture(fogNoise,twisted*0.17+flow).r;
      float detail = texture(fogNoise,twisted*0.39+flow*1.32 + 0.37).r;
      vec3 drift = vec3(sin(fogTime*0.75),cos(fogTime*0.68),sin(fogTime*0.51));
      vec3 q = p + (broad-0.5)*vec3(0.15,0.20,0.11);
      float core = puff(q,vec3(0.0,-0.13,0.0),vec3(0.94,0.76,0.92));
      float west = puff(q,vec3(-0.43,0.14,-0.11)+drift*0.10,vec3(0.56,0.61,0.58));
      float east = puff(q,vec3(0.43,0.26,0.04)-drift.yzx*0.09,vec3(0.59,0.56,0.64));
      float crown = puff(q,vec3(0.02,0.53,-0.03)+drift.zxy*0.10,vec3(0.63,0.46,0.61));
      float envelope = max(core*0.62,max(max(west,east),crown));
      envelope *= 1.0-smoothstep(0.81,1.0,max(abs(p.x),max(abs(p.y),abs(p.z))));
      float detailDensity = smoothstep(0.32,0.67,broad*0.71+detail*0.29);
      float density = envelope*detailDensity;
      float illuminatedNoise = texture(fogNoise,twisted*0.17+flow+vec3(0.014,0.033,-0.021)).r;
      float lighting = clamp(0.45+0.37*p.y+(broad-illuminatedNoise)*1.36+(detail-0.5)*0.58,0.08,1.0);
      vec3 tint = mix(vec3(0.29,0.12,0.56),vec3(2.65,1.95,2.50),lighting);
      float alpha = (1.0-total.a)*(1.0-exp(-4.1*density*stepSize));
      total += vec4(tint*alpha,alpha);
      if (total.a > 0.92) break;
    }
    return vec4(total.rgb/max(total.a,0.001),total.a*0.92);
  }
`;

function gastlyMaterial(noise,clock) {
  const material = new THREE.MeshBasicMaterial({
    color:0xa270c9,side:THREE.BackSide,transparent:true,depthWrite:false,toneMapped:false,
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.fogNoise = {value:noise};
    shader.uniforms.fogTime = clock;
    shader.vertexShader = smokeVertex+shader.vertexShader.replace('#include <project_vertex>',`
      #include <project_vertex>
      fogSurface = position;
      // Parallel rays start at the pixel's position on the orthographic view plane.
      vec2 viewOrigin = isOrthographic ? mvPosition.xy : vec2(0.0);
      fogEye = (inverse(modelViewMatrix)*vec4(viewOrigin,0.0,1.0)).xyz;
    `);
    shader.fragmentShader = smokeFragment+shader.fragmentShader.replace('#include <map_fragment>',`
      #include <map_fragment>
      vec4 smoke = billowingSmoke();
      diffuseColor *= smoke;
    `);
  };
  return material;
}

function softenWingFlame(shader,clock) {
  shader.uniforms.wingFlameTime = clock;
  shader.vertexShader = 'varying vec3 wingFlamePosition;\n' + shader.vertexShader.replace(
    '#include <project_vertex>', '#include <project_vertex>\nwingFlamePosition = position;');
  shader.fragmentShader = 'uniform float wingFlameTime;\nvarying vec3 wingFlamePosition;\n' +
    shader.fragmentShader.replace('#include <alphamap_fragment>', `
      #include <alphamap_fragment>
      float span = abs(wingFlamePosition.x) / 266.0;
      float trail = (-wingFlamePosition.z + 4.0) / 77.0;
      float phase = wingFlameTime * 4.4 + sign(wingFlamePosition.x) * 0.4;
      float curl = 0.13 * sin(span * 44.0 - phase) + 0.08 * sin(span * 83.0 + phase * 0.71);
      float tip = 0.49 + 0.31 * smoothstep(0.55,0.98,span) + curl;
      float envelope = (1.0-smoothstep(tip-0.09,tip+0.06,trail)) * smoothstep(-0.09,0.12,trail);
      float hot = 1.0 - smoothstep(0.24,tip+0.02,trail);
      vec3 fire = mix(vec3(0.92,0.075,0.007),vec3(1.0,0.69,0.079),hot);
      diffuseColor.rgb = mix(fire,diffuseColor.rgb,0.32);
      diffuseColor.a *= envelope;
    `);
}

function bindFlameStencil(mesh,clock) {
  const {flameStencil,flameMask} = mesh.userData;
  const material = mesh.material;
  mesh.userData.pokemonEffect = true;
  material.stencilWrite = true;
  material.stencilRef = flameStencil;
  material.depthWrite = false;
  if (flameMask) {
    mesh.renderOrder = 40;
    material.opacity = 1;
    material.alphaTest = .035;
    material.transparent = false;
    material.colorWrite = false;
    material.stencilZPass = THREE.ReplaceStencilOp;
  } else {
    material.stencilFunc = THREE.EqualStencilFunc;
    material.stencilWriteMask = 0;
    if (mesh.name.startsWith('FireStenA')) material.onBeforeCompile = shader => softenWingFlame(shader,clock);
  }
}

export function createPokemonModelEffects() {
  const effectTime = {value:0};
  let noise, disposed = false;
  return {
    attach(model,dex) {
      if (disposed) return;
      if (dex===92) {
        const anchor = model.getObjectByName('GastlySmoke');
        if (!anchor) return;
        noise ??= cloudNoise();
        const smoke = new THREE.Mesh(new THREE.BoxGeometry(2,2,2),gastlyMaterial(noise,effectTime));
        smoke.name = 'Gastly smoke volume';
        smoke.userData.pokemonEffect = true;
        anchor.add(smoke);
      } else if (dex===146) {
        model.traverse(mesh=>{
          if (mesh.isSkinnedMesh && mesh.userData.flameStencil) bindFlameStencil(mesh,effectTime);
        });
      }
    },
    update(seconds,reducedMotion) { effectTime.value = reducedMotion ? 0 : seconds; },
    dispose() { disposed = true; noise?.dispose(); },
  };
}
