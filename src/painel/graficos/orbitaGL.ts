import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { rngDe } from '@/lib/aleatorio';
import { ETAPA_NOME, ETAPAS_ABERTAS } from '@/lib/etapas';
import { fmt } from '@/lib/formato';
import type { Visao } from '@/lib/metricas/computar';
import type { Campanha, Dados } from '@/lib/tipos';
import { clamp, DAY, ease, lerp, TAU } from '@/lib/util';
import { el, type Ambiente } from '../ambiente';
import { rgba } from '../desenho';
import type { Orbita } from './orbita';
import { alvo as alvoComum, D0, IDX, preencherTip as preencherTipComum, RB, RCORE, RINGS, type DotBase } from './orbitaComum';

/* ================= órbita do pipeline em WebGL =================
   Física honesta (docs/VISUAL.md): o que se move, cresce ou brilha é dado.
   - Anel: uma etapa aberta. Gira na velocidade real da etapa (inverso da mediana de dias nela, últimos 30 dias).
   - Esfera: um negócio. Tamanho = valor, cor = fonte. É iluminada pelo núcleo.
   - Rastro: o negócio mudando de lugar (lead chegando pela borda, avanço de etapa, venda caindo no núcleo).
   - Anel vermelho pulsando: negócio parado há 7 dias ou mais.
   - Clarão e onda de choque no núcleo: venda fechada.
   - Brilho do núcleo e da luz que ele projeta: receita fechada no período, relativa ao investimento.
   - Varredura na grade: a data do replay passando.
   Cenário (não representa dado): grade, estrelas, poeira em deriva lenta e a gaiola do núcleo, como no protótipo. */

const GLSL_COMUM = /* glsl */`
#define TAU 6.28318530718
float linha(float d, float w) { float fw = fwidth(d); return 1.0 - smoothstep(w, w + fw * 1.5, abs(d)); }
float frente(vec3 w) { return .5 + .5 * dot(normalize(w.xz + 1e-5), normalize(cameraPosition.xz + 1e-5)); }
`;

/* Ruído simplex 3D (Ashima Arts, licença MIT). */
const GLSL_RUIDO = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

/* Converte a cor para a saída (sRGB na tela). Precisa ficar numa linha só dela. */
const SAIDA = '\n#include <colorspace_fragment>\n';

/* Plano no chão da órbita (XZ), com a posição local e a de mundo para os shaders. */
const VERT_PLANO = /* glsl */`
varying vec2 vP; varying vec3 vW;
void main() { vP = position.xz; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`;

/* Atributos por negócio, compartilhados pelas esferas, halos e rastros. */
const ATRIB = /* glsl */`
attribute vec3 aPos; attribute vec3 aVel; attribute vec3 aCol; attribute float aSize; attribute float aAlpha; attribute vec4 aInfo;
`;

export function suportaWebGL() {
  try {
    const c = document.createElement('canvas'), gl = c.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}

interface Dot extends DotBase {
  th: number; ph: number; vf: number; tilt: number; pend: boolean; k: number;
  sx: number; sy: number; vis: boolean; x: number; y: number; z: number; rPrev: number; vr: number; novo: boolean;
}

export function criarOrbitaGL(amb: Ambiente, DATA: Dados, CAMP: Record<string, Campanha>): Orbita {
  const { $, $$, COL, REDUCED, FINE, signal } = amb;
  const stageEl = $('#stage3d'), cv2d = $<HTMLCanvasElement>('#orbit'), tip = $('#otip'), camada = $('#olabels');
  const lite = !FINE || Math.min(screen.width, screen.height) < 700;

  const cv = document.createElement('canvas');
  cv.className = 'orbit-gl'; cv.setAttribute('role', 'img');
  // se o WebGL falhar aqui, iniciar.ts cai para a versão em Canvas 2D (nada foi inserido na tela ainda)
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: lite, alpha: false, powerPreference: 'high-performance' });
  cv2d.hidden = true; cv2d.after(cv);
  renderer.setClearColor(0x05090b, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, .5, 400);
  const mundo = new THREE.Group(); scene.add(mundo);

  let composer: EffectComposer | null = null, bloom: UnrealBloomPass | null = null;
  if (!lite) {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .6, .45, .5);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  const C = (hex: string) => new THREE.Color(hex);
  const TEAL = C('#5eead4'), TINT = C('#a0f0e6');
  const add = { blending: THREE.AdditiveBlending, transparent: true, depthWrite: false } as const;

  /* ---------- fundo do cartão (mesmo degradê do CSS do protótipo) e luz do núcleo ---------- */
  const uBg = { uRes: { value: new THREE.Vector2(1, 1) }, uCore: { value: new THREE.Vector2(0, 0) }, uI: { value: .5 } };
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: uBg, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
    fragmentShader: /* glsl */`
      uniform vec2 uRes; uniform vec2 uCore; uniform float uI; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uRes;
        vec3 c = mix(vec3(10.6, 18.6, 21.4), vec3(5.0, 9.8, 11.8), 1.0 - vUv.y) / 255.0;
        vec2 q = (px - vec2(.5, .52) * uRes) / (vec2(1.1, .85) * uRes);
        c = mix(c, vec3(22.0, 70.0, 66.0) / 255.0, .34 * clamp(1.0 - length(q) / .64, 0.0, 1.0));
        float dc = length(px - uCore) / uRes.y;
        c += vec3(45.0, 212.0, 191.0) / 255.0 * .06 * uI * exp(-dc * dc * 7.0);
        c += (hash(px) - .5) / 255.0;
        gl_FragColor = vec4(pow(max(c, 0.0), vec3(2.2)), 1.0);
        ${SAIDA}
      }`
  }));
  bg.frustumCulled = false; bg.renderOrder = -10; scene.add(bg);

  /* ---------- estrelas ao fundo (profundidade quando a órbita gira) ---------- */
  const uStars = { uVis: { value: 1 }, uDpr: { value: 1 }, uColor: { value: TINT } };
  const stars = (() => {
    const r = rngDe('estrelas'), n = lite ? 260 : 700, pos = new Float32Array(n * 3), s = new Float32Array(n), a = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const th = r() * TAU, ph = Math.acos(lerp(-.15, 1, r())), R = 70 + r() * 60;
      pos[i * 3] = Math.cos(th) * Math.sin(ph) * R; pos[i * 3 + 1] = Math.cos(ph) * R * .8 - 6; pos[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * R;
      s[i] = .6 + r() * 1.3; a[i] = .12 + r() * .35;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1)); g.setAttribute('aA', new THREE.BufferAttribute(a, 1));
    const p = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: uStars, ...add,
      vertexShader: 'attribute float aS; attribute float aA; uniform float uVis; uniform float uDpr; varying float vA; void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aS * uDpr * 1.6; vA = aA * uVis; }',
      fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(uColor * smoothstep(.5, .0, d) * vA, 1.0); ${SAIDA} }`
    }));
    p.frustumCulled = false; return p;
  })();
  mundo.add(stars);

  /* ---------- grade holográfica, escala externa e varredura do replay ---------- */
  const uPlate = { uTint: { value: TINT }, uGlow: { value: C('#2dd4bf') }, uVis: { value: 1 }, uReveal: { value: 30 }, uSweep: { value: 0 }, uSweepOn: { value: 0 }, uRB: { value: RB } };
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(34, 34).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: uPlate, ...add, side: THREE.DoubleSide,
    vertexShader: VERT_PLANO,
    fragmentShader: /* glsl */`
      ${GLSL_COMUM}
      uniform vec3 uTint; uniform vec3 uGlow; uniform float uVis; uniform float uReveal; uniform float uSweep; uniform float uSweepOn; uniform float uRB;
      varying vec2 vP; varying vec3 vW;
      void main(){
        float r = length(vP), a = atan(vP.y, vP.x), fr = frente(vW);
        float fade = smoothstep(15.5, 11.5, r) * smoothstep(1.4, 2.6, r);
        float seg = TAU / 24.0;
        float grade = (linha(fract(r + .5) - .5, .003) * .045 + linha((fract(a / seg + .5) - .5) * seg * r, .004) * .03) * fade * (.35 + .65 * fr);
        float tseg = TAU / 120.0, ti = floor(a / tseg + .5), maior = 1.0 - step(.5, mod(ti + 120.0, 10.0));
        float tick = linha((a / tseg - ti) * tseg * uRB, .01) * step(uRB, r) * step(r, uRB + mix(.22, .5, maior)) * mix(.24, .45, maior);
        float escala = (linha(r - uRB, .006) * .5 + linha(r - uRB - .6, .005) * .2 + tick) * (.3 + .7 * fr);
        float da = mod(uSweep - a, TAU);
        float varre = uSweepOn * step(1.5, r) * step(r, uRB) * (exp(-da * 4.0) * .08 + linha(da * r, .012) * .5 * step(da, 1.0));
        float rev = smoothstep(uReveal + .2, uReveal - 1.2, r);
        float borda = exp(-pow((r - uReveal) * 2.2, 2.0)) * step(uReveal, 16.0) * .45 * smoothstep(15.5, 11.0, r);
        vec3 col = (uTint * (grade + escala + varre) + uGlow * exp(-pow(r / 6.5, 2.0)) * .09) * rev + uTint * borda;
        gl_FragColor = vec4(col * uVis, 1.0);
        ${SAIDA}
      }`
  }));
  plate.renderOrder = 1; mundo.add(plate);

  /* ---------- anéis das etapas ---------- */
  const aneis = RINGS.map((rg, k) => {
    const u = { uColor: { value: C(COL.st[k]) }, uAccent: { value: TEAL }, uR: { value: rg.r }, uProg: { value: 1 }, uHl: { value: 0 }, uVis: { value: 1 }, uA0: { value: 0 } };
    const m = new THREE.Mesh(new THREE.RingGeometry(rg.r - .5, rg.r + .5, 320, 1).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: u, ...add, side: THREE.DoubleSide,
      vertexShader: VERT_PLANO,
      fragmentShader: /* glsl */`
        ${GLSL_COMUM}
        uniform vec3 uColor; uniform vec3 uAccent; uniform float uR; uniform float uProg; uniform float uHl; uniform float uVis; uniform float uA0;
        varying vec2 vP; varying vec3 vW;
        void main(){
          float r = length(vP), a = atan(vP.y, vP.x), t = fract((a - uA0) / TAU);
          if (t > uProg) discard;
          float d = r - uR, fr = frente(vW);
          float nucleo = linha(d, .012), halo = exp(-pow(d / .15, 2.0)) * .15;
          float trilho = step(.55, fract(a / TAU * 40.0)) * linha(d - .21, .007) * .55;
          float cabeca = exp(-pow((uProg - t) * 26.0, 2.0)) * (1.0 - step(.999, uProg));
          vec3 cor = mix(uColor, uAccent, uHl);
          vec3 col = cor * (nucleo * (.85 + .7 * uHl) + halo * (1.0 + 1.2 * uHl) + trilho * (.8 + .5 * uHl)) * (.28 + .72 * fr);
          col += vec3(.85, 1.0, .96) * cabeca * (nucleo * 3.0 + halo * 4.0);
          gl_FragColor = vec4(col * uVis, 1.0);
          ${SAIDA}
        }`
    }));
    m.renderOrder = 2; mundo.add(m);
    return { m, u, hl: 0 };
  });

  /* ---------- poeira em deriva (cenário, como no protótipo) ---------- */
  const uDust = { uTime: { value: 0 }, uVis: { value: 1 }, uPx: { value: 300 }, uColor: { value: C('#aaf5eb') } };
  const DUST_MAX = 420;
  const dust = (() => {
    const r = rngDe('poeira'), g = new THREE.BufferGeometry(), n = DUST_MAX;
    const f = (k: number) => new Float32Array(n * k);
    const aR = f(1), aTh = f(1), aY = f(1), aW = f(1), aS = f(1), aA = f(1);
    for (let i = 0; i < n; i++) { const rr = Math.sqrt(r()) * 12.8; aR[i] = rr; aTh[i] = r() * TAU; aY[i] = (r() - .5) * 1.8 * (1 - rr / 15); aW[i] = .015 + r() * .03; aS[i] = .6 + r() * .9; aA[i] = .25 + r() * .5; }
    g.setAttribute('position', new THREE.BufferAttribute(f(3), 3));
    Object.entries({ aR, aTh, aY, aW, aS, aA }).forEach(([k, v]) => g.setAttribute(k, new THREE.BufferAttribute(v, 1)));
    const p = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: uDust, ...add,
      vertexShader: /* glsl */`
        attribute float aR; attribute float aTh; attribute float aY; attribute float aW; attribute float aS; attribute float aA;
        uniform float uTime; uniform float uVis; uniform float uPx; varying float vA;
        void main(){
          float th = aTh + aW * uTime; vec3 p = vec3(cos(th) * aR, aY, sin(th) * aR);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = max(1.0, aS * .09 * uPx / -mv.z);
          vec3 w = (modelMatrix * vec4(p, 1.0)).xyz;
          float fr = clamp((dot(normalize(w.xz + 1e-5), normalize(cameraPosition.xz + 1e-5)) * length(w.xz) / 12.0 + 1.0) / 2.0, 0.0, 1.0);
          vA = aA * (.2 + .6 * fr) * uVis;
        }`,
      fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(uColor * smoothstep(.5, .1, d) * vA * .8, 1.0); ${SAIDA} }`
    }));
    p.frustumCulled = false; p.renderOrder = 3; return p;
  })();
  mundo.add(dust);

  /* ---------- núcleo: esfera de energia, halo, gaiola, ondas de choque e feixe ---------- */
  const nucleo = new THREE.Group(); mundo.add(nucleo);
  const uCore = { uTime: { value: 0 }, uI: { value: .5 }, uFlash: { value: 0 }, c0: { value: C('#073b35') }, c1: { value: C('#138a7b') }, c2: { value: C('#8ff5e4') }, c3: { value: C('#f3fffd') }, uRim: { value: TEAL } };
  const esfera = new THREE.Mesh(new THREE.SphereGeometry(RCORE, lite ? 40 : 72, lite ? 28 : 48), new THREE.ShaderMaterial({
    uniforms: uCore,
    vertexShader: 'varying vec3 vNv; varying vec3 vPo; varying vec3 vVv; void main(){ vPo = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vNv = normalize(normalMatrix * normal); vVv = -mv.xyz; gl_Position = projectionMatrix * mv; }',
    fragmentShader: /* glsl */`
      ${GLSL_RUIDO}
      uniform float uTime; uniform float uI; uniform float uFlash; uniform vec3 c0; uniform vec3 c1; uniform vec3 c2; uniform vec3 c3; uniform vec3 uRim;
      varying vec3 vNv; varying vec3 vPo; varying vec3 vVv;
      void main(){
        vec3 N = normalize(vNv), V = normalize(vVv);
        float s = dot(N, normalize(vec3(-.35, .42, 1.0))) * .5 + .5;
        vec3 c = mix(c0, c1, smoothstep(.05, .5, s)); c = mix(c, c2, smoothstep(.55, .9, s)); c = mix(c, c3, smoothstep(.93, 1.0, s));
        float n = snoise(vPo * 2.3 + vec3(0.0, uTime * .12, uTime * .05)) * .5 + .5;
        float n2 = snoise(vPo * 6.5 - vec3(uTime * .18)) * .5 + .5;
        c *= .62 + .55 * n + .2 * n2;
        float fres = pow(1.0 - max(dot(N, V), 0.0), 2.4);
        c = c * (.3 + .38 * uI) + uRim * fres * (.5 + 1.6 * uFlash) * (.45 + .45 * uI) + c3 * uFlash * .4;
        gl_FragColor = vec4(c, 1.0);
        ${SAIDA}
      }`
  }));
  nucleo.add(esfera);
  const VERT_BILL = 'uniform float uR; varying vec2 vQ; void main(){ vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += position.xy * uR; vQ = position.xy; gl_Position = projectionMatrix * mv; }';
  const uHaloCore = { uR: { value: RCORE * 4.4 }, uA: { value: .3 }, uColor: { value: TEAL } };
  const haloCore = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: uHaloCore, ...add, vertexShader: VERT_BILL,
    fragmentShader: `uniform float uA; uniform vec3 uColor; varying vec2 vQ; void main(){ float d = length(vQ); float g = (1.0 - smoothstep(.0, 1.0, d)) * exp(-d * 2.2); gl_FragColor = vec4(uColor * g * uA, 1.0); ${SAIDA} }`
  }));
  haloCore.frustumCulled = false; haloCore.renderOrder = 5; nucleo.add(haloCore);
  const gaiola = new THREE.Group(); nucleo.add(gaiola);
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const uCage = { uVis: { value: 1 }, uColor: { value: C('#96f5e6') } };
  const VERT_GAIOLA = 'varying float vF; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); vF = step(c.z, mv.z); gl_Position = projectionMatrix * mv; ';
  gaiola.add(new THREE.LineSegments(new THREE.EdgesGeometry(ico), new THREE.ShaderMaterial({
    uniforms: uCage, ...add, vertexShader: VERT_GAIOLA + '}',
    fragmentShader: `uniform vec3 uColor; uniform float uVis; varying float vF; void main(){ gl_FragColor = vec4(uColor * mix(.13, .42, vF) * uVis, 1.0); ${SAIDA} }`
  })));
  const uCageP = { uVis: { value: 1 }, uColor: { value: TEAL }, uDpr: { value: 1 } };
  const PHI = (1 + Math.sqrt(5)) / 2;
  const IV = [[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]]
    .flatMap(v => { const n = Math.hypot(v[0], v[1], v[2]); return v.map(c => c / n); });
  gaiola.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(IV), 3)), new THREE.ShaderMaterial({
    uniforms: uCageP, ...add, vertexShader: 'uniform float uDpr; ' + VERT_GAIOLA + 'gl_PointSize = 7.0 * uDpr; }',
    fragmentShader: `uniform vec3 uColor; uniform float uVis; uniform float uDpr; varying float vF; void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(uColor * smoothstep(.5, .05, d) * mix(.3, .85, vF) * uVis, 1.0); ${SAIDA} }`
  })));
  const choques = Array.from({ length: 5 }, () => {
    const u = { uA: { value: 0 }, uW: { value: .02 }, uColor: { value: C('#a0faeb') } };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: u, ...add, side: THREE.DoubleSide, vertexShader: VERT_PLANO,
      fragmentShader: `${GLSL_COMUM} uniform float uA; uniform float uW; uniform vec3 uColor; varying vec2 vP; varying vec3 vW; void main(){ float d = length(vP) - 1.0; float l = linha(d, uW) + exp(-pow(d / (uW * 7.0), 2.0)) * .3; gl_FragColor = vec4(uColor * l * uA, 1.0); ${SAIDA} }`
    }));
    m.visible = false; m.renderOrder = 7; mundo.add(m); return { m, u };
  });
  const uBeam = { uA: { value: 0 }, uColor: { value: C('#c8fff6') } };
  const feixe = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 1, 12, 1, true).translate(0, .5, 0), new THREE.ShaderMaterial({
    uniforms: uBeam, ...add,
    vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uA; uniform vec3 uColor; varying float vY; void main(){ gl_FragColor = vec4(uColor * pow(1.0 - vY, 1.5) * uA, 1.0); ${SAIDA} }`
  }));
  feixe.visible = false; feixe.renderOrder = 7; mundo.add(feixe);

  /* ---------- negócios: esferas iluminadas pelo núcleo, halos e rastros (instanciados) ---------- */
  let cap = 0;
  const buf = { pos: new Float32Array(0), vel: new Float32Array(0), col: new Float32Array(0), size: new Float32Array(0), alpha: new Float32Array(0), info: new Float32Array(0) };
  const attrs: Record<string, THREE.InstancedBufferAttribute> = {};
  const base = {
    esfera: new THREE.SphereGeometry(1, lite ? 12 : 20, lite ? 8 : 14),
    quad: new THREE.PlaneGeometry(2, 2),
    rastro: new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0]), 3)).setIndex([0, 1, 2, 2, 1, 3])
  };
  const geos = { esfera: new THREE.InstancedBufferGeometry(), halo: new THREE.InstancedBufferGeometry(), rastro: new THREE.InstancedBufferGeometry() };
  geos.esfera.index = base.esfera.index; geos.esfera.setAttribute('position', base.esfera.getAttribute('position')); geos.esfera.setAttribute('normal', base.esfera.getAttribute('normal'));
  geos.halo.index = base.quad.index; geos.halo.setAttribute('position', base.quad.getAttribute('position'));
  geos.rastro.index = base.rastro.index; geos.rastro.setAttribute('position', base.rastro.getAttribute('position'));
  function garantirCap(n: number) {
    if (n <= cap) return;
    cap = Math.max(256, Math.pow(2, Math.ceil(Math.log2(n))));
    buf.pos = new Float32Array(cap * 3); buf.vel = new Float32Array(cap * 3); buf.col = new Float32Array(cap * 3);
    buf.size = new Float32Array(cap); buf.alpha = new Float32Array(cap); buf.info = new Float32Array(cap * 4);
    const defs: [string, Float32Array, number][] = [['aPos', buf.pos, 3], ['aVel', buf.vel, 3], ['aCol', buf.col, 3], ['aSize', buf.size, 1], ['aAlpha', buf.alpha, 1], ['aInfo', buf.info, 4]];
    for (const [nome, arr, k] of defs) {
      attrs[nome] = new THREE.InstancedBufferAttribute(arr, k).setUsage(THREE.DynamicDrawUsage);
      for (const g of Object.values(geos)) g.setAttribute(nome, attrs[nome]);
    }
  }
  garantirCap(256);
  const uDots = { uCoreI: { value: .5 } };
  const esferas = new THREE.Mesh(geos.esfera, new THREE.ShaderMaterial({
    uniforms: uDots, transparent: true,
    vertexShader: /* glsl */`
      ${ATRIB}
      varying vec3 vN; varying vec3 vW; varying vec3 vCol; varying float vA; varying float vDim;
      void main(){
        float s = aSize * (aInfo.y > .5 ? 1.5 : 1.0) * (aInfo.z > 1.0 ? 1.3 : 1.0);
        vec4 w = modelMatrix * vec4(aPos + position * s, 1.0);
        vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vCol = aCol; vA = aAlpha; vDim = aInfo.z;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform float uCoreI; varying vec3 vN; varying vec3 vW; varying vec3 vCol; varying float vA; varying float vDim;
      void main(){
        vec3 N = normalize(vN), L = normalize(-vW), V = normalize(cameraPosition - vW);
        float dif = max(dot(N, L), 0.0), fres = pow(1.0 - max(dot(N, V), 0.0), 2.2), spec = pow(max(dot(N, normalize(L + V)), 0.0), 36.0);
        vec3 c = vCol * (.24 + .8 * dif * uCoreI) + vCol * fres * .6 + vec3(spec * .35 * uCoreI);
        float k = min(vDim, 1.0) * (vDim > 1.0 ? 1.35 : 1.0);
        gl_FragColor = vec4(c * k, vA * min(vDim, 1.0));
        ${SAIDA}
      }`
  }));
  esferas.frustumCulled = false; esferas.renderOrder = 4; mundo.add(esferas);
  const uHalo = { uK: { value: 5 }, uGlow: { value: lite ? 1 : .6 }, uTime: { value: 0 }, uBad: { value: C(COL.bad) } };
  const halos = new THREE.Mesh(geos.halo, new THREE.ShaderMaterial({
    uniforms: uHalo, ...add,
    vertexShader: /* glsl */`
      ${ATRIB}
      uniform float uK; varying vec2 vQ; varying vec3 vCol; varying float vA; varying vec4 vInfo;
      void main(){
        vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
        mv.xy += position.xy * aSize * uK * (aInfo.y > .5 ? 1.5 : 1.0);
        vQ = position.xy; vCol = aCol; vA = aAlpha; vInfo = aInfo;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      ${GLSL_COMUM}
      uniform float uGlow; uniform float uTime; uniform vec3 uBad; varying vec2 vQ; varying vec3 vCol; varying float vA; varying vec4 vInfo;
      void main(){
        float d = length(vQ);
        if (d > 1.0) discard;
        float dim = min(vInfo.z, 1.0) * (vInfo.z > 1.0 ? 1.4 : 1.0);
        vec3 col = vCol * (exp(-d * d * 16.0) * .9 + exp(-d * d * 4.5) * .22) * uGlow * vA * dim;
        if (vInfo.x > .5) {
          float pul = uTime < 0.0 ? .6 : .45 + .35 * sin(uTime * 2.0 + vInfo.w);
          col += uBad * linha(d - .52, .02) * pul * vA * (vInfo.z < .5 ? .25 : 1.0);
        }
        if (vInfo.y > .5) col += vec3(.94, 1.0, .99) * linha(d - .74, .015) * .95;
        gl_FragColor = vec4(col, 1.0);
        ${SAIDA}
      }`
  }));
  halos.frustumCulled = false; halos.renderOrder = 5; mundo.add(halos);
  const uRastro = { uRes: { value: new THREE.Vector2(1, 1) }, uLen: { value: .14 } };
  const rastros = new THREE.Mesh(geos.rastro, new THREE.ShaderMaterial({
    uniforms: uRastro, ...add,
    vertexShader: /* glsl */`
      ${ATRIB}
      uniform vec2 uRes; uniform float uLen; varying float vT; varying float vU; varying float vA; varying vec3 vCol;
      void main(){
        vec4 h = projectionMatrix * modelViewMatrix * vec4(aPos, 1.0);
        vec4 t = projectionMatrix * modelViewMatrix * vec4(aPos - aVel * uLen, 1.0);
        vec2 hs = h.xy / h.w * uRes * .5, ts = t.xy / t.w * uRes * .5, dv = hs - ts;
        float len = length(dv);
        vec2 dir = len > .001 ? dv / len : vec2(1.0, 0.0), nrm = vec2(-dir.y, dir.x);
        float wpx = aSize * projectionMatrix[1][1] * uRes.y * .5 / h.w * 1.1;
        vec4 clip = mix(t, h, position.x);
        clip.xy = (mix(ts, hs, position.x) + nrm * position.y * wpx * position.x) / (uRes * .5) * clip.w;
        gl_Position = clip;
        vT = position.x; vU = position.y; vCol = aCol;
        vA = aAlpha * smoothstep(1.0, 3.5, length(aVel)) * min(aInfo.z, 1.0) * smoothstep(3.0, 14.0, len);
      }`,
    fragmentShader: `varying float vT; varying float vU; varying float vA; varying vec3 vCol; void main(){ float a = vA * pow(vT, 1.6) * (1.0 - abs(vU)); gl_FragColor = vec4(vCol * a * 1.6, 1.0); ${SAIDA} }`
  }));
  rastros.frustumCulled = false; rastros.renderOrder = 6; mundo.add(rastros);

  /* ---------- rótulos em HTML por cima do canvas (texto nítido e acessível) ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg'); svg.classList.add('olines'); svg.setAttribute('aria-hidden', 'true');
  const rot = RINGS.map((rg, k) => {
    const cor = COL.st[k];
    const ln = document.createElementNS(NS, 'line'); ln.setAttribute('stroke', rgba(cor, .7));
    const pt = document.createElementNS(NS, 'circle'); pt.setAttribute('r', '2.4'); pt.setAttribute('fill', cor);
    svg.append(ln, pt);
    const b = el('button', 'olabel'); b.type = 'button'; b.style.setProperty('--c', cor); b.style.setProperty('--cb', rgba(cor, .6));
    const nome = el('span', 'on', ETAPA_NOME[rg.k]), n = el('b', '', '0'), med = el('small', '', '');
    b.append(nome, n, med);
    b.addEventListener('pointerenter', () => setHl(k, 'orbit'), { signal });
    b.addEventListener('pointerleave', () => { if (st.hlFrom === 'orbit') setHl(null, null); }, { signal });
    b.addEventListener('focus', () => setHl(k, 'orbit'), { signal });
    b.addEventListener('blur', () => { if (st.hlFrom === 'orbit') setHl(null, null); }, { signal });
    b.addEventListener('click', () => setHl(st.hl === k ? null : k, 'orbit'), { signal });
    return { b, n, med, ln, pt, w: 0, cnt: -1, on: false };
  });
  const coreLbl = el('div', 'ocore'), coreT1 = el('b'), coreT2 = el('span'); coreLbl.append(coreT1, coreT2);
  camada.append(svg, ...rot.map(r => r.b), coreLbl);

  amb.aoEncerrar(() => {
    scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(x => x.dispose()); else if (mat) mat.dispose();
    });
    Object.values(base).forEach(g => g.dispose());
    composer?.dispose();
    renderer.dispose(); renderer.forceContextLoss();
    cv.remove(); cv2d.hidden = false; camada.textContent = '';
  });

  /* ---------- estado (mesmo modelo de câmera do protótipo) ---------- */
  const st = {
    W: 0, H: 0, perdido: false,
    yaw: -.65, yawV: 0, elev: .5, elevT: .5, elevSet: false, D: D0, f: 600, cx: 0, cy: 0, top: 96, bottom: 24,
    pX: 0, pY: 0, pXT: 0, pYT: 0,
    dots: new Map<number, Dot>(), t0: 0, t1: 0, tSim: 0,
    replay: null as { start: number; dur: number; p: number } | null, intro: null as number | null, introQ: 1,
    hover: null as Dot | null, pin: null as Dot | null, hl: null as number | null, hlFrom: null as string | null,
    drag: null as { id: number; x: number; y: number; yaw: number; elev: number; moved: boolean; lx: number; lt: number } | null,
    flash: 0, shocks: [] as number[], counts: [0, 0, 0, 0, 0], wonSim: 0, recSim: 0,
    omega: [0, 0, 0, 0, 0], ang: [0, 0, 0, 0, 0], coreT: .5, coreI: .5, time: 0, core: '', coreW: 0, coreH: 38
  };
  const PRE = RB + 5; // leads chegam de fora da grade, como cometas
  const alvo = (dot: Dot, t: number) => alvoComum(dot, t, PRE);
  const cores = { meta: C(amb.SRC.meta.cor), google: C(amb.SRC.google.cor), won: C('#cfeee8'), lost: C(COL.bad).multiplyScalar(.45) };
  const vt = new THREE.Vector3();

  function resize() {
    const r = stageEl.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    st.W = Math.round(r.width); st.H = Math.round(r.height);
    const dpr = Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 2);
    renderer.setPixelRatio(dpr); renderer.setSize(st.W, st.H, false);
    if (composer) { composer.setPixelRatio(dpr); composer.setSize(st.W, st.H); }
    const db = renderer.getDrawingBufferSize(new THREE.Vector2());
    uDust.uPx.value = db.y / 2; uStars.uDpr.value = dpr; uCageP.uDpr.value = dpr;
    uRastro.uRes.value.set(db.x, db.y); uBg.uRes.value.set(st.W, st.H);
    svg.setAttribute('width', String(st.W)); svg.setAttribute('height', String(st.H));
    const mobile = st.W < 560;
    const ask = $('#ask');
    const overlay = ask && !ask.hidden && getComputedStyle(ask).position === 'absolute';
    const ov = stageEl.querySelector('.ov-top')!.getBoundingClientRect();
    const rp = $('#replay'), rr = rp.hidden ? null : rp.getBoundingClientRect();
    let top = ov.bottom - r.top + 10, bottom = mobile ? 18 : 22;
    if (rr && rr.height) {
      if (rr.top - r.top < r.height / 2) top = Math.max(top, rr.bottom - r.top + 10);
      else bottom = Math.max(bottom, r.bottom - rr.top + 10);
    }
    if (overlay) bottom = Math.max(bottom, ask.offsetHeight + 30);
    st.top = top; st.bottom = bottom;
    if (!st.elevSet) {
      const avail = Math.max(120, st.H - top - bottom);
      st.elevT = Math.asin(clamp(.78 * avail / (.91 * st.W), Math.sin(.42), Math.sin(.7)));
      if (!st.intro) st.elev = st.elevT;
    }
    dust.geometry.setDrawRange(0, mobile ? 150 : lite ? 260 : DUST_MAX);
    rot.forEach(l => { l.w = 0; }); st.coreW = 0;
  }
  function fit() {
    const se = Math.sin(st.elev), ce = Math.cos(st.elev), R = RB + .35;
    const kT = R * se / (D0 + R * ce), kB = R * se / (D0 - R * ce);
    const avail = Math.max(120, st.H - st.top - st.bottom);
    const fW = st.W * .455 * D0 / R, fH = (avail - 36) / (kT + kB);
    st.f = Math.max(60, Math.min(fW, fH));
    st.cx = st.W / 2;
    st.cy = st.top + 36 + kT * st.f + Math.max(0, (avail - 36 - (kT + kB) * st.f) / 2);
  }
  function posicionarCamera() {
    const e = st.elev + st.pY * .035, D = st.D;
    camera.position.set(0, D * Math.sin(e), D * Math.cos(e));
    camera.lookAt(0, 0, 0);
    camera.fov = 2 * Math.atan(st.H / 2 / st.f) * 180 / Math.PI;
    camera.aspect = st.W / st.H;
    camera.setViewOffset(st.W, st.H, st.W / 2 - st.cx, st.H / 2 - st.cy, st.W, st.H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    mundo.rotation.y = -(st.yaw + st.pX * .07);
    mundo.updateMatrixWorld();
  }
  function tela(x: number, y: number, z: number, local: boolean) {
    vt.set(x, y, z); if (local) vt.applyMatrix4(mundo.matrixWorld);
    vt.project(camera);
    return { x: (vt.x + 1) / 2 * st.W, y: (1 - vt.y) / 2 * st.H, ok: vt.z < 1 };
  }

  function setData(V: Visao, opts?: { snap?: boolean }) {
    const o = opts || {};
    st.t0 = DATA.datas[V.win.a].getTime(); st.t1 = DATA.agora;
    const ids = new Set<number>();
    for (const d of V.coorte) {
      ids.add(d.id);
      let dot = st.dots.get(d.id);
      if (!dot) {
        const r = rngDe('orb|' + d.id);
        dot = { d, th: r() * TAU, jit: (r() - .5) * .5, ph: r() * 6.28, vf: 0, r: PRE, a: 0, kind: 'pre', gone: false, tilt: .4 + r() * .9, rr: 1.75 + r() * .75, pend: false, k: 0, sx: -99, sy: -99, vis: false, e: 'novo', em: d.criadoEm, x: 0, y: 0, z: 0, rPrev: PRE, vr: 0, novo: true };
        st.dots.set(d.id, dot);
      }
      dot.d = d; dot.gone = false; dot.vf = clamp((d.valor - 2200) / 5000, 0, 1);
    }
    for (const [id, dot] of st.dots) if (!ids.has(id)) dot.gone = true;
    if (o.snap || REDUCED) {
      for (const [id, dot] of st.dots) {
        if (dot.gone) { st.dots.delete(id); continue; }
        const t = alvo(dot, st.t1); dot.kind = t.kind; dot.r = t.r; dot.a = t.a; dot.e = t.e; dot.em = t.em; dot.k = t.k ?? dot.k; dot.pend = false; dot.novo = true;
      }
    }
    // velocidade de giro de cada anel: inverso da mediana de dias na etapa (etapa travada gira devagar; sem dado, parado)
    ETAPAS_ABERTAS.forEach((k, i) => {
      const v = V.velocidade[k], med = v.mediana;
      st.omega[i] = med == null ? 0 : clamp(.32 / Math.max(med, .05), .02, .45);
      rot[i].med.textContent = med == null ? 'sem dado' : `${fmt.d1(med)} d`;
      rot[i].w = 0;
      rot[i].b.title = med == null
        ? `${ETAPA_NOME[k]}: ${fmt.int(V.pipe[k].n)} negócios agora. Sem saídas desta etapa nos últimos 30 dias, então o anel fica parado.`
        : `${ETAPA_NOME[k]}: ${fmt.int(V.pipe[k].n)} negócios agora. Ficam ${fmt.d1(med)} dias nesta etapa (mediana das ${fmt.int(v.n)} saídas dos últimos 30 dias). O anel gira nessa velocidade: etapa travada gira devagar.`;
    });
    // brilho do núcleo: receita fechada no período, relativa ao investimento selecionado
    st.coreT = V.roi.roas == null ? .45 : .45 + .55 * clamp(V.roi.roas / 3, 0, 1);
    const nomes = ETAPAS_ABERTAS.map(k => `${ETAPA_NOME[k]} ${V.pipe[k].n}`).join(', ');
    cv.setAttribute('aria-label', `Órbita do pipeline, leads dos últimos ${V.periodo} dias: ${nomes}. ${V.funil.vendas.total} vendas no núcleo, ${fmt.money(V.roi.receita)}.`);
    $('#orbitSub').textContent = `Leads dos últimos ${V.periodo} dias em cada etapa · ${FINE ? 'arraste para girar' : 'toque e arraste para girar'}`;
    if (REDUCED) { st.coreI = st.coreT; amb.raf(() => draw(performance.now(), 0)); }
  }
  function replayUI(p: number | null) {
    const btn = $('#btnReplay'), bar = $('#rbar'), lbl = $('#rdate');
    if (p == null) { bar.style.width = '0%'; lbl.textContent = ''; btn.querySelector('span')!.textContent = 'Replay do período'; return; }
    bar.style.width = (p * 100).toFixed(1) + '%'; lbl.textContent = fmt.dm(new Date(st.tSim)); btn.querySelector('span')!.textContent = 'Pular replay';
  }
  function iniciarReplay(delay?: number) {
    if (REDUCED) return;
    st.replay = { start: performance.now() + (delay || 0), dur: 6500, p: 0 };
    for (const dot of st.dots.values()) { if (dot.gone) continue; dot.kind = 'pre'; dot.r = PRE; dot.a = 0; dot.pend = false; dot.novo = true; }
  }
  function iniciarIntro() { if (REDUCED) return; st.intro = performance.now(); st.introQ = 0; }
  function ringFrac(k: number) { return st.intro ? clamp((st.introQ - .1 - k * .06) / .5, 0, 1) : 1; }

  function atualizarDots(now: number, dt: number, tSim: number) {
    const counts = [0, 0, 0, 0, 0]; let won = 0, rec = 0;
    for (const [id, dot] of st.dots) {
      const t = alvo(dot, tSim);
      if (t.kind !== dot.kind) { if (t.kind === 'won' && !REDUCED) dot.pend = true; dot.kind = t.kind; }
      dot.e = t.e; dot.em = t.em; if (t.k != null) dot.k = t.k;
      const kr = 1 - Math.exp(-dt * (t.kind === 'lost' ? 1.05 : t.kind === 'won' ? 2.1 : 3.3));
      const ka = 1 - Math.exp(-dt * (t.kind === 'lost' ? 2.2 : dot.gone ? 1.25 : 4.5));
      dot.r += (t.r - dot.r) * kr; dot.a += (t.a - dot.a) * ka;
      if (dot.gone && dot.a < .01) { st.dots.delete(id); continue; }
      if (!REDUCED) dot.th += (dot.kind === 'won' ? 1.2 : dot.kind === 'open' ? st.omega[dot.k] : 0) * dt;
      if (dot.pend && dot.r < dot.rr + .55) { dot.pend = false; st.flash = 1; st.shocks.push(now); }
      if (dot.gone) continue;
      if (dot.kind === 'open') counts[dot.k]++;
      else if (dot.kind === 'won') { won++; rec += dot.d.valor; }
    }
    st.counts = counts; st.wonSim = won; st.recSim = rec;
  }

  function preencherInstancias(dt: number) {
    garantirCap(st.dots.size);
    let n = 0;
    for (const dot of st.dots.values()) {
      if (dot.a < .02) { dot.vis = false; dot.novo = true; continue; }
      const blend = dot.kind === 'won' ? clamp((3.4 - dot.r) / (3.4 - dot.rr), 0, 1) : 0;
      const tl = dot.tilt * blend, c = Math.cos(dot.th), s = Math.sin(dot.th), pz = s * dot.r;
      dot.x = c * dot.r; dot.y = pz * Math.sin(tl); dot.z = pz * Math.cos(tl);
      if (dot.novo || dt <= 0) { dot.vr = dt <= 0 ? 0 : dot.vr; dot.rPrev = dot.r; dot.novo = false; }
      else { dot.vr += ((dot.r - dot.rPrev) / dt - dot.vr) * (1 - Math.exp(-dt * 25)); dot.rPrev = dot.r; }
      const q = tela(dot.x, dot.y, dot.z, true);
      dot.sx = q.x; dot.sy = q.y; dot.vis = q.ok;
      const mine = st.hl != null && dot.kind === 'open' && dot.k === st.hl;
      const col = dot.kind === 'won' ? cores.won : dot.kind === 'lost' ? cores.lost : cores[dot.d.fonte];
      const stale = dot.kind === 'open' && dot.a >= .5 && !st.replay && (st.tSim - (dot.em as number)) / DAY >= 7;
      buf.pos[n * 3] = dot.x; buf.pos[n * 3 + 1] = dot.y; buf.pos[n * 3 + 2] = dot.z;
      buf.vel[n * 3] = c * dot.vr; buf.vel[n * 3 + 1] = 0; buf.vel[n * 3 + 2] = s * dot.vr;
      buf.col[n * 3] = col.r; buf.col[n * 3 + 1] = col.g; buf.col[n * 3 + 2] = col.b;
      buf.size[n] = (.12 + .1 * dot.vf) * (dot.kind === 'won' ? 1.25 : 1);
      buf.alpha[n] = clamp(dot.kind === 'lost' ? dot.a * dot.a : dot.a, 0, 1);
      buf.info[n * 4] = stale ? 1 : 0; buf.info[n * 4 + 1] = dot === st.hover || dot === st.pin ? 1 : 0;
      buf.info[n * 4 + 2] = st.hl == null ? 1 : mine ? 1.35 : .16; buf.info[n * 4 + 3] = dot.ph;
      n++;
    }
    for (const a of Object.values(attrs)) { a.clearUpdateRanges(); a.addUpdateRange(0, n * a.itemSize); a.needsUpdate = true; }
    geos.esfera.instanceCount = geos.halo.instanceCount = geos.rastro.instanceCount = n;
  }

  function atualizarRotulos(core: { x: number; y: number }) {
    const psi = st.W < 560 ? 2.0 : 2.4, H = 21;
    const L: { k: number; px: number; py: number; w: number; y: number }[] = [];
    RINGS.forEach((rg, k) => {
      const R = rot[k], on = ringFrac(k) >= .98;
      if (on !== R.on) { R.on = on; R.b.classList.toggle('on', on); R.ln.style.opacity = R.pt.style.opacity = on ? '1' : '0'; }
      if (st.counts[k] !== R.cnt) { R.cnt = st.counts[k]; R.n.textContent = fmt.int(R.cnt); R.w = 0; }
      if (!R.w) R.w = R.b.offsetWidth;
      if (!on) return;
      const p = tela(Math.cos(psi) * rg.r, 0, Math.sin(psi) * rg.r, false);
      L.push({ k, px: p.x, py: p.y, w: R.w, y: p.y - H / 2 });
    });
    if (L.length) {
      // separa os rótulos na vertical e recentra o grupo nas âncoras (mesma regra do protótipo)
      L.sort((a, b) => a.y - b.y);
      const alvoMedio = L.reduce((s, l) => s + l.y, 0) / L.length;
      for (let i = 1; i < L.length; i++) if (L[i].y < L[i - 1].y + H + 4) L[i].y = L[i - 1].y + H + 4;
      const sh = alvoMedio - L.reduce((s, l) => s + l.y, 0) / L.length;
      L.forEach(l => { l.y = clamp(l.y + sh, 4, st.H - H - 4); });
      const xr = Math.min(...L.map(l => l.px)) - 16;
      for (const l of L) {
        const R = rot[l.k], x = Math.max(4, xr - l.w), cy = l.y + H / 2;
        R.b.style.transform = `translate(${Math.round(x)}px,${Math.round(l.y)}px)`;
        R.ln.setAttribute('x1', (x + l.w).toFixed(1)); R.ln.setAttribute('y1', (cy + .5).toFixed(1));
        R.ln.setAttribute('x2', (l.px - 3).toFixed(1)); R.ln.setAttribute('y2', l.py.toFixed(1));
        R.pt.setAttribute('cx', l.px.toFixed(1)); R.pt.setAttribute('cy', l.py.toFixed(1));
        R.pt.setAttribute('fill', st.hl === l.k ? COL.accent : COL.st[l.k]);
      }
    }
    const txt = `${fmt.int(st.wonSim)} ${st.wonSim === 1 ? 'venda' : 'vendas'}|${fmt.money(st.recSim)}`;
    if (txt !== st.core) { st.core = txt; const [a, b] = txt.split('|'); coreT1.textContent = a; coreT2.textContent = b; st.coreW = 0; }
    if (!st.coreW) { st.coreW = coreLbl.offsetWidth; st.coreH = coreLbl.offsetHeight || 38; }
    coreLbl.classList.toggle('on', !(st.intro && st.introQ < .6));
    const rc = RCORE * st.f / D0;
    coreLbl.style.transform = `translate(${Math.round(core.x - st.coreW / 2)}px,${Math.round(core.y - rc * 2.25 - st.coreH)}px)`;
  }

  function draw(now: number, dt?: number) {
    if (!st.W || st.perdido) return;
    dt = dt || 0;
    if (st.intro) {
      const q = clamp((now - st.intro) / 2000, 0, 1), e = ease.out(q);
      st.introQ = q; st.D = lerp(64, D0, e); st.elev = lerp(1.18, st.elevT, e); st.yaw += dt * (1 - e) * 1.5;
      if (q >= 1) { st.intro = null; st.introQ = 1; }
    } else { st.D = D0; st.elev += (st.elevT - st.elev) * (1 - Math.exp(-dt * 6)); }
    if (!st.drag) { st.yaw += st.yawV * dt; st.yawV *= Math.exp(-dt * 2.4); }
    const kp = 1 - Math.exp(-dt * 3);
    st.pX += (st.pXT - st.pX) * kp; st.pY += (st.pYT - st.pY) * kp;
    fit(); posicionarCamera();
    st.tSim = st.t1;
    if (st.replay) {
      const p = clamp((now - st.replay.start) / st.replay.dur, 0, 1);
      st.replay.p = p; st.tSim = lerp(st.t0, st.t1, ease.inOut(p));
      replayUI(p);
      if (p >= 1) { st.replay = null; replayUI(null); }
    }
    atualizarDots(now, dt, st.tSim);
    if (!REDUCED) { st.time += dt; for (let k = 0; k < 5; k++) st.ang[k] += st.omega[k] * dt; }
    const vis = st.introQ;

    // cenário e anéis
    uStars.uVis.value = vis; uDust.uVis.value = vis; uDust.uTime.value = st.time; uCage.uVis.value = uCageP.uVis.value = vis;
    uPlate.uVis.value = vis; uPlate.uReveal.value = st.intro ? ease.out(st.introQ) * 17 : 30;
    const sw = st.replay ? clamp(st.replay.p * 12, 0, 1) * clamp((1 - st.replay.p) * 12, 0, 1) : 0;
    uPlate.uSweepOn.value = sw; if (st.replay) uPlate.uSweep.value = 2.4 + st.replay.p * TAU;
    aneis.forEach((a, k) => {
      a.m.rotation.y = -st.ang[k];
      a.hl += ((st.hl === k ? 1 : 0) - a.hl) * (dt ? 1 - Math.exp(-dt * 10) : 1);
      a.u.uHl.value = a.hl; a.u.uProg.value = ringFrac(k); a.u.uA0.value = 2.4 - st.ang[k];
      a.u.uVis.value = st.hl != null && st.hl !== k ? .45 : 1;
    });

    // núcleo: brilho pela receita, clarão e onda de choque pelas vendas
    st.coreI += (st.coreT - st.coreI) * (dt ? 1 - Math.exp(-dt * 2) : 1);
    st.flash = Math.max(0, st.flash - dt * 1.5);
    const sc = st.intro ? ease.back(clamp((st.introQ - .15) / .6, 0, 1)) : 1;
    nucleo.scale.setScalar(Math.max(sc, .001)); nucleo.visible = sc > .01;
    gaiola.scale.setScalar(1.55 * RCORE); gaiola.rotation.set(st.time * .31, st.time * .5, 0);
    uCore.uTime.value = st.time; uCore.uI.value = st.coreI; uCore.uFlash.value = st.flash;
    uDots.uCoreI.value = st.coreI; uBg.uI.value = st.coreI * vis;
    uHaloCore.uR.value = RCORE * (4.4 + 1.8 * st.flash); uHaloCore.uA.value = (.26 + .4 * st.flash) * (composer ? .55 : 1) * (.6 + .6 * st.coreI);
    st.shocks = st.shocks.filter(s0 => now - s0 < 1300);
    choques.forEach((c, i) => {
      const s0 = st.shocks[st.shocks.length - 1 - i];
      c.m.visible = s0 != null;
      if (s0 == null) return;
      const a = (now - s0) / 1300, r = RCORE + a * 7.5;
      c.m.scale.setScalar(r); c.u.uA.value = (1 - a) * .7; c.u.uW.value = .025 / r;
    });
    feixe.visible = st.flash > .02;
    if (feixe.visible) { feixe.position.y = RCORE * sc; feixe.scale.set(1, RCORE * 8 * st.flash, 1); uBeam.uA.value = .65 * st.flash; }

    // negócios
    uHalo.uTime.value = REDUCED ? -1 : st.time;
    preencherInstancias(dt);

    const core = tela(0, 0, 0, false);
    uBg.uCore.value.set(core.x, core.y);
    if (composer) composer.render(dt); else renderer.render(scene, camera);
    atualizarRotulos(core);
    if (st.pin && (!st.pin.vis || st.pin.a < .2)) { st.pin = null; tip.hidden = true; }
    if (st.hover || st.pin) posicionarTip(st.pin || st.hover);
  }

  /* ---------- interação (mesma do protótipo, rótulos agora são botões) ---------- */
  function pontoMaisProximo(mx: number, my: number) {
    let best: Dot | null = null, bd = 16 * 16;
    for (const dot of st.dots.values()) {
      if (!dot.vis || dot.a < .35) continue;
      const dx = dot.sx - mx, dy = dot.sy - my, d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = dot; }
    }
    return best;
  }
  const preencherTip = (dot: Dot) => preencherTipComum(amb, tip, dot, CAMP, st.tSim);
  function posicionarTip(dot: Dot | null) {
    if (!dot || !dot.vis) { tip.hidden = true; return; }
    if (tip.hidden) return;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = dot.sx + 16; if (left + tw > st.W - 8) left = dot.sx - tw - 16;
    left = clamp(left, 8, Math.max(8, st.W - tw - 8));
    const top = clamp(dot.sy - th / 2, 8, Math.max(8, st.H - th - 8));
    tip.style.transform = `translate(${Math.round(left)}px,${Math.round(top)}px)`;
  }
  function mostrarTip(dot: Dot) { preencherTip(dot); tip.hidden = false; posicionarTip(dot); }
  function esconderTip() { if (!st.pin) tip.hidden = true; }
  function setHl(k: number | null, from: string | null) {
    if (st.hl === k) return;
    st.hl = k; st.hlFrom = from;
    $$('#stl li').forEach(li => li.classList.toggle('hl', k != null && li.dataset.k === RINGS[k].k));
    rot.forEach((r, i) => r.b.classList.toggle('hl', i === k));
    if (REDUCED) draw(performance.now(), 0);
  }
  function hoverAt(mx: number, my: number) {
    const dot = pontoMaisProximo(mx, my);
    if (dot !== st.hover) { st.hover = dot; if (dot) mostrarTip(dot); else esconderTip(); }
    if (REDUCED) draw(performance.now(), 0);
  }
  function tapAt(mx: number, my: number) {
    const dot = pontoMaisProximo(mx, my);
    st.pin = dot; st.hover = null;
    if (dot) mostrarTip(dot); else tip.hidden = true;
    if (REDUCED) draw(performance.now(), 0);
  }
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); st.perdido = true; }, { signal });
  cv.addEventListener('webglcontextrestored', () => { st.perdido = false; resize(); }, { signal });
  cv.addEventListener('pointerdown', e => {
    st.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: st.yaw, elev: st.elevT, moved: false, lx: e.clientX, lt: performance.now() };
  }, { signal });
  cv.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    if (st.drag && st.drag.id === e.pointerId) {
      const dx = e.clientX - st.drag.x, dy = e.clientY - st.drag.y;
      if (!st.drag.moved && Math.abs(dx) + Math.abs(dy) > 5) { st.drag.moved = true; try { cv.setPointerCapture(e.pointerId); } catch { /* ok */ } cv.classList.add('drag'); }
      if (st.drag.moved) {
        const t = performance.now(), ddt = Math.max(8, t - st.drag.lt);
        st.yaw = st.drag.yaw + dx * .0065;
        if (e.pointerType === 'mouse') { st.elevT = clamp(st.drag.elev + dy * .004, .2, 1.05); st.elevSet = true; }
        st.yawV = clamp((e.clientX - st.drag.lx) * .0065 / (ddt / 1000), -5, 5);
        st.drag.lx = e.clientX; st.drag.lt = t;
        st.hover = null; esconderTip();
        if (REDUCED) draw(t, 0);
      }
      return;
    }
    if (e.pointerType === 'mouse') {
      if (!REDUCED) { st.pXT = clamp(mx / st.W - .5, -.5, .5) * 2; st.pYT = clamp(my / st.H - .5, -.5, .5) * 2; }
      hoverAt(mx, my);
    }
  }, { signal });
  function soltar(e: PointerEvent) {
    if (!st.drag || st.drag.id !== e.pointerId) return;
    const moved = st.drag.moved; st.drag = null; cv.classList.remove('drag');
    if (!moved) { const r = cv.getBoundingClientRect(); tapAt(e.clientX - r.left, e.clientY - r.top); }
  }
  cv.addEventListener('pointerup', soltar, { signal });
  cv.addEventListener('pointercancel', () => { st.drag = null; cv.classList.remove('drag'); }, { signal });
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !st.drag) { st.hover = null; st.pXT = st.pYT = 0; esconderTip(); } }, { signal });
  $('#btnReplay').addEventListener('click', () => {
    if (st.replay) st.replay.start = performance.now() - st.replay.dur;
    else { st.pin = null; tip.hidden = true; iniciarReplay(0); }
  }, { signal });
  if (REDUCED) $('#replay').hidden = true;

  return {
    resize, setData, draw, highlight: k => setHl(k == null ? null : IDX[k], k == null ? null : 'list'),
    replay: iniciarReplay, intro: iniciarIntro, el: stageEl, visible: true
  };
}
