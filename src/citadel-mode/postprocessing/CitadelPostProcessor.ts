import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

/**
 * Custom HDR Optics Shader combining:
 * 1. Radial Chromatic Aberration (0.0014 lens dispersion at screen edges)
 * 2. Anamorphic Vignette & Tone Mapping
 * 3. Animated Simplex Film Grain (0.032 opacity)
 */
const CitadelOpticsShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0.0 },
    uChromaticOffset: { value: 0.0014 },
    uFilmGrainOpacity: { value: 0.032 },
    uPulseIntensity: { value: 0.15 },
    uResolution: { value: new THREE.Vector2(1920, 1080) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uChromaticOffset;
    uniform float uFilmGrainOpacity;
    uniform float uPulseIntensity;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float simplexGrain(vec2 co, float timeSeed) {
      vec2 p = co * uResolution * 0.5 + vec2(timeSeed * 83.1, timeSeed * 127.9);
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123) * 2.0 - 1.0;
    }

    void main() {
      vec2 centerDelta = vUv - vec2(0.5);
      // Anamorphic aspect weighting
      vec2 anamorphicDelta = centerDelta * vec2(1.15, 0.92);
      float distFromCenter = length(anamorphicDelta);

      // Radial Chromatic Aberration (0.0014 baseline + dynamic telemetry pulse boost)
      float aberrationAmount = (uChromaticOffset + uPulseIntensity * 0.0016) * pow(distFromCenter * 1.45, 1.35);
      vec2 radialDir = normalize(centerDelta + vec2(0.00001)) * aberrationAmount;

      float rChannel = texture2D(tDiffuse, vUv + radialDir).r;
      vec4 baseSample = texture2D(tDiffuse, vUv);
      float gChannel = baseSample.g;
      float bChannel = texture2D(tDiffuse, vUv - radialDir).b;

      vec3 color = vec3(rChannel, gChannel, bChannel);

      // Animated Simplex Film Grain (0.032 opacity)
      float grain = simplexGrain(vUv, fract(uTime * 0.43));
      color += vec3(grain * uFilmGrainOpacity);

      // Silky Anamorphic Vignette
      float vignette = smoothstep(1.08, 0.22, distFromCenter);
      color *= mix(0.68, 1.06, vignette);

      gl_FragColor = vec4(max(color, vec3(0.0)), baseSample.a);
    }
  `,
};

export interface CitadelComposerBundle {
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
  opticsPass: ShaderPass;
  update: (elapsedTime: number, pulseIntensity: number) => void;
  setSize: (width: number, height: number) => void;
  dispose: () => void;
}

export function createCitadelPostProcessor(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number
): CitadelComposerBundle {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  // MSAA 4x HalfFloat HDR RenderTarget
  const renderTarget = new THREE.WebGLRenderTarget(width * pixelRatio, height * pixelRatio, {
    samples: 4,
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
  });

  const composer = new EffectComposer(renderer, renderTarget);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(width, height);

  // Pass 1: Scene Render
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // Pass 2: Mipmap UnrealBloomPass (strength: 1.35, radius: 0.65, threshold: 0.12)
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    1.35,
    0.65,
    0.12
  );
  composer.addPass(bloomPass);

  // Pass 3: Custom Radial Chromatic Aberration (0.0014) + Anamorphic Vignette + Simplex Film Grain (0.032)
  const opticsPass = new ShaderPass(CitadelOpticsShader);
  opticsPass.uniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio);
  composer.addPass(opticsPass);

  // Pass 4: Sub-pixel Morphological Anti-Aliasing (SMAA)
  const smaaPass = new SMAAPass(width * pixelRatio, height * pixelRatio);
  composer.addPass(smaaPass);

  return {
    composer,
    bloomPass,
    opticsPass,
    update: (elapsedTime: number, pulseIntensity: number) => {
      opticsPass.uniforms.uTime.value = elapsedTime;
      opticsPass.uniforms.uPulseIntensity.value = pulseIntensity;
      bloomPass.strength = 1.35 + pulseIntensity * 0.55;
      composer.render();
    },
    setSize: (w: number, h: number) => {
      const pr = Math.min(window.devicePixelRatio || 1, 2);
      composer.setSize(w, h);
      opticsPass.uniforms.uResolution.value.set(w * pr, h * pr);
    },
    dispose: () => {
      renderTarget.dispose();
      bloomPass.dispose();
      smaaPass.dispose();
      composer.dispose();
    },
  };
}

export function disposeThreeContextComplete(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  postProcessor?: CitadelComposerBundle
) {
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
    }
  });

  if (postProcessor) {
    postProcessor.dispose();
  }

  renderer.dispose();
  renderer.forceContextLoss();
}
