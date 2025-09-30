import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/* ===================== TWEAKS / TOGGLES ===================== */
const AVATAR_HEIGHT_M = 1.8;
const AVATAR_ROT_Y = 0;
const JACKET_ROT_Y = 4.7;       // confirmed good for your GLB
const JACKET_Y_NUDGE = 0.05;    // collar line from neck (meters)
const TORSO_FRACTION = 0.56;    // jacket bottom ~ hips
const SHOULDER_EASE = 1.08;     // slightly wider than shoulders
const DEFAULT_EASE_CM = 4;      // extra ease for visual comfort (cm)

const DEBUG_MATERIAL  = false;  // true = neon wireframe to guarantee visibility
const ENABLE_WARP     = false;   // cheap chest/waist/hip hugging
const ENABLE_ARM_MATCH= true;   // rotate jacket arm bones to avatar arms

/* ===================== RENDERER / SCENE ===================== */
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.6, 3.2);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.4, 0);
controls.enableDamping = true;
controls.minDistance = 0.8;
controls.maxDistance = 7;

scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1.2));
const dl = new THREE.DirectionalLight(0xffffff, 0.8);
dl.position.set(3, 6, 4);
scene.add(dl);

/* ============================ HELPERS ====================== */
const loader = new GLTFLoader();
const boxOf = (o)=> new THREE.Box3().setFromObject(o);
const worldPos = (o)=> { const v=new THREE.Vector3(); o.getWorldPosition(v); return v; };
const worldQuat= (o)=> { const q=new THREE.Quaternion(); o.getWorldQuaternion(q); return q; };

function centerAtOrigin(o){
  const b = boxOf(o);
  const c = b.getCenter(new THREE.Vector3());
  o.position.sub(c);
}
function fitToHeight(o, targetH){
  const b = boxOf(o);
  const h = Math.max(1e-6, b.max.y - b.min.y);
  o.scale.multiplyScalar(targetH / h);
}
function findBone(root, names=["Neck","UpperChest","Chest","Spine2","Spine1"]){
  let found=null;
  root.traverse(o=>{
    if(o.isBone){
      const n=(o.name||"").toLowerCase();
      if(names.some(s=>n.includes(s.toLowerCase()))) found=o;
    }
  });
  return found;
}
function tryShoulderWidth(root){
  let L=null,R=null;
  root.traverse(o=>{
    if(!o.isBone) return;
    const n=(o.name||"").toLowerCase();
    if(!L && (n.includes('leftshoulder')||n==='l_shoulder'||n.includes('l_shoulder'))) L=o;
    if(!R && (n.includes('rightshoulder')||n==='r_shoulder'||n.includes('r_shoulder'))) R=o;
  });
  return (L&&R) ? worldPos(L).distanceTo(worldPos(R)) : null;
}
async function loadJSON(url){ const r=await fetch(url); if(!r.ok) throw new Error(`Failed to load ${url}`); return r.json(); }

/* ====================== REGION WARP (FAST) ================= */
function installRegionWarpOnMesh(mesh){
  if (!ENABLE_WARP || !mesh.isMesh || !mesh.material) return null;

  const mat = mesh.material;
  mat.side = THREE.DoubleSide;
  mat.depthTest = true;
  mat.metalness ??= 0.0;
  mat.roughness ??= 0.8;

  mesh.geometry?.computeBoundingBox?.();
  const bb = mesh.geometry?.boundingBox;
  const uniforms = {
    uChest:{value:1.0}, uWaist:{value:1.0}, uHip:{value:1.0},
    uYMin:{value:bb?bb.min.y:0}, uYMax:{value:bb?bb.max.y:1},
    uPush:{value:0.002}
  };

  mat.onBeforeCompile = (shader)=>{
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace(
      '#include <skinning_vertex>',
      `
      #include <skinning_vertex>
      float yMin=uYMin, yMax=uYMax;
      float t = clamp((transformed.y - yMin) / max(1e-5,(yMax - yMin)), 0.0, 1.0);
      float wHip   = smoothstep(0.00, 0.25, 1.0 - t);
      float wWaist = smoothstep(0.25, 0.55, 1.0 - abs(t-0.45)*2.0);
      float wChest = smoothstep(0.60, 0.98, t);
      float denom = max(1e-4, wHip+wWaist+wChest);
      float sXZ = (wHip*uHip + wWaist*uWaist + wChest*uChest) / denom;
      transformed.xz *= sXZ;
      transformed += normal * uPush;
      `
    );
    mat.userData._shaderUniforms = uniforms;
  };
  mat.needsUpdate = true;

  const clamp = (x)=> Math.max(0.85, Math.min(1.25, x));
  return {
    setBands:(ch,wa,hi)=>{ uniforms.uChest.value=clamp(ch); uniforms.uWaist.value=clamp(wa); uniforms.uHip.value=clamp(hi); },
    setRange:(mn,mx)=>{ uniforms.uYMin.value=mn; uniforms.uYMax.value=mx; }
  };
}

/* ============================ STATE ======================= */
let avatar, avatarNeck;
let jacket, jacketOriginalScale = new THREE.Vector3(1,1,1);
let warpCtrls = [];
let garmentSpec = null;
let avatarMeasures = null;

/* ========================== LOADERS ======================= */
async function loadAvatar(){
  const gl = await loader.loadAsync('/avatar.glb');
  avatar = gl.scene;
  avatar.rotation.y = AVATAR_ROT_Y;
  centerAtOrigin(avatar);
  fitToHeight(avatar, AVATAR_HEIGHT_M);
  scene.add(avatar);
  avatarNeck = findBone(avatar) || avatar;
}

async function loadJacket(){
  const gl = await loader.loadAsync('/jacket.glb');
  jacket = gl.scene;

  centerAtOrigin(jacket);
  fitToHeight(jacket, AVATAR_HEIGHT_M);  // visible baseline
  jacket.rotation.y = JACKET_ROT_Y;
  jacket.position.set(0, 0, 0);

  if (DEBUG_MATERIAL) {
    const m = new THREE.MeshBasicMaterial({ color: 0x44ff88, wireframe: true, transparent: true, opacity: 0.95, depthTest: false });
    jacket.traverse(o=>{ if(o.isMesh){ o.material=m; o.frustumCulled=false; o.renderOrder=2; }});
  } else {
    jacket.traverse(o=>{
      if(o.isMesh){
        o.material.side = THREE.DoubleSide;
        o.material.transparent = false;
        o.material.alphaTest = 0.0;
        o.material.depthTest = true;
        o.frustumCulled = false;
        o.renderOrder = 2;
      }
    });
  }

  // install warp on all meshes (safe if ENABLE_WARP=false)
  warpCtrls = [];
  jacket.traverse(o=>{
    if (o.isMesh) {
      const ctrl = installRegionWarpOnMesh(o);
      if (ctrl) warpCtrls.push(ctrl);
    }
  });

  jacketOriginalScale.copy(jacket.scale);
  scene.add(jacket);
}

/* ================== ALIGNMENT + SCALING =================== */
function alignAndScaleJacket(){
  if (!avatar || !jacket) return;

  // reset (avoid cumulative transforms)
  jacket.scale.copy(jacketOriginalScale);
  jacket.rotation.y = AVATAR_ROT_Y + JACKET_ROT_Y;
  jacket.position.set(0, 0, 0);

  // 1) length to torso
  const avatarH = Math.max(1e-6, (boxOf(avatar).max.y - boxOf(avatar).min.y));
  const desiredLen = avatarH * TORSO_FRACTION;

  const jBox0 = boxOf(jacket);
  const jH0 = Math.max(1e-6, jBox0.max.y - jBox0.min.y);
  let sLen = THREE.MathUtils.clamp(desiredLen / jH0, 0.2, 3.0);
  jacket.scale.multiplyScalar(sLen);

  // 2) shoulder width
  const shoulder = tryShoulderWidth(avatar);
  const jBox1 = boxOf(jacket);
  const jW1 = Math.max(1e-6, jBox1.max.x - jBox1.min.x);
  if (shoulder) {
    let sW = THREE.MathUtils.clamp((shoulder * SHOULDER_EASE) / jW1, 0.2, 3.0);
    jacket.scale.multiplyScalar(sW);
  }

  // 3) snap collar to neck
  const neckY = worldPos(avatarNeck).y + JACKET_Y_NUDGE;
  const jBox2 = boxOf(jacket);
  jacket.position.y += (neckY - jBox2.max.y);

  // 4) update warp vertical range
  const jBox3 = boxOf(jacket);
  warpCtrls.forEach(c => c.setRange(jBox3.min.y, jBox3.max.y));

  // 5) sleeve posing
  if (ENABLE_ARM_MATCH) tryMatchArmsToAvatar();
}

/* ========================= ARM MATCHING ==================== */
function findArmChain(root, side /* 'L' | 'R' */) {
  const s = side.toLowerCase();
  const shoulderNames = s === 'l'
    ? ['leftshoulder','l_shoulder','shoulder_l','shoulder.l','shoulder_left']
    : ['rightshoulder','r_shoulder','shoulder_r','shoulder.r','shoulder_right'];
  const upperNames = s === 'l'
    ? ['leftupperarm','upperarm_l','upperarm.l','leftarm','arm_l','arm.l','mixamorigleftarm']
    : ['rightupperarm','upperarm_r','upperarm.r','rightarm','arm_r','arm.r','mixamorigrightarm'];
  const foreNames = s === 'l'
    ? ['leftforearm','forearm_l','forearm.l','lowerarm_l','lowerarm.l','mixamorigleftforearm']
    : ['rightforearm','forearm_r','forearm.r','lowerarm_r','lowerarm.r','mixamorigrightforearm'];
  const handNames = s === 'l'
    ? ['lefthand','hand_l','hand.l','l_hand','mixamoriglefthand']
    : ['righthand','hand_r','hand.r','r_hand','mixamorigrighthand'];

  const findBy = (names)=>{
    let b=null; root.traverse(o=>{ if(o.isBone && !b){ const n=(o.name||'').toLowerCase(); if(names.some(k=>n.includes(k))) b=o; }});
    return b;
  };
  return { shoulder: findBy(shoulderNames), upper: findBy(upperNames), fore: findBy(foreNames), hand: findBy(handNames) };
}

function alignBoneDirectionWorld(jBone, fromWorld, toWorld) {
  if (!jBone) return;
  const start = new THREE.Vector3(); jBone.getWorldPosition(start);
  const curDir = new THREE.Vector3().copy(toWorld).sub(start).normalize();
  const tgtDir = new THREE.Vector3().copy(toWorld).sub(fromWorld).normalize();
  if (curDir.lengthSq() < 1e-6 || tgtDir.lengthSq() < 1e-6) return;

  const deltaWorld = new THREE.Quaternion().setFromUnitVectors(curDir, tgtDir);
  const parentWorld = jBone.parent ? worldQuat(jBone.parent) : new THREE.Quaternion();
  const newWorld = deltaWorld.multiply(worldQuat(jBone));
  const newLocal = parentWorld.clone().invert().multiply(newWorld);

  jBone.quaternion.copy(newLocal);
  jBone.updateMatrixWorld(true);
}

function tryMatchSingleArm(side) {
  const a = findArmChain(avatar, side);
  const j = findArmChain(jacket, side);
  if (!a.upper || !a.fore || !a.hand || !j.upper || !j.fore) return;

  const aShoulderP = worldPos(a.shoulder ?? a.upper.parent ?? a.upper);
  const aElbowP    = worldPos(a.fore);
  const aWristP    = worldPos(a.hand);

  alignBoneDirectionWorld(j.upper, aShoulderP, aElbowP);
  alignBoneDirectionWorld(j.fore,  aElbowP,    aWristP);
}

function tryMatchArmsToAvatar() {
  tryMatchSingleArm('L');
  tryMatchSingleArm('R');
}

/* ========================= SIZING / UI ===================== */
const ui = {
  sizeSelect: document.getElementById('sizeSelect'),
  recommendBtn: document.getElementById('recommendBtn'),
  info: document.getElementById('info')
};

function sizeRowToFlat(row){
  const chestFlat = row.chestFlat_cm ?? (row.chest_cm ? row.chest_cm/2 : undefined);
  const waistFlat = row.waist_cm ? row.waist_cm/2 : undefined;
  const hipFlat   = row.hip_cm   ? row.hip_cm/2   : undefined;
  return { chestFlat, waistFlat, hipFlat };
}
function pickSizeByChest(avatarChest_cm, spec){
  const sizes = Object.keys(spec.sizes||{});
  if(!sizes.length) return null;
  const target = avatarChest_cm/2;
  let best=sizes[0], diff=Infinity;
  for(const s of sizes){
    const { chestFlat } = sizeRowToFlat(spec.sizes[s]);
    if (chestFlat===undefined) continue;
    const d = Math.abs(chestFlat - target);
    if (d<diff){ diff=d; best=s; }
  }
  return best;
}
function applyWarpBands(sizeLabel){
  if (!ENABLE_WARP) return;
  const row = garmentSpec?.sizes?.[sizeLabel]; if(!row) return;

  const { chestFlat, waistFlat, hipFlat } = sizeRowToFlat(row);
  const aC = (avatarMeasures?.chest_cm ?? 0)/2;
  const aW = (avatarMeasures?.waist_cm ?? aC*0.85)/2;
  const aH = (avatarMeasures?.hip_cm   ?? aC*0.95)/2;

  const chestScale = ((chestFlat ?? aC) + DEFAULT_EASE_CM) / Math.max(1e-4, aC);
  const waistScale = ((waistFlat ?? aW) + DEFAULT_EASE_CM) / Math.max(1e-4, aW);
  const hipScale   = ((hipFlat   ?? aH) + DEFAULT_EASE_CM) / Math.max(1e-4, aH);

  warpCtrls.forEach(c=>c.setBands(chestScale, waistScale, hipScale));
}

function buildSizeDropdown(){
  ui.sizeSelect.innerHTML='';
  Object.keys(garmentSpec?.sizes ?? {}).forEach(s=>{
    const opt=document.createElement('option'); opt.value=s; opt.textContent=s;
    ui.sizeSelect.appendChild(opt);
  });
}

function wireUI(){
  ui.recommendBtn?.addEventListener('click', ()=>{
    const rec=pickSizeByChest(avatarMeasures?.chest_cm ?? 0, garmentSpec);
    if(rec){ ui.sizeSelect.value=rec; ui.info.textContent=`Recommended: ${rec}`; applyWarpBands(rec); alignAndScaleJacket(); }
  });
  ui.sizeSelect?.addEventListener('change', ()=>{
    const s=ui.sizeSelect.value;
    applyWarpBands(s);
    alignAndScaleJacket();
    ui.info.textContent = `Size: ${s}`;
  });
}

/* ============================ BOOT ========================= */
function onResize(){ camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }
window.addEventListener('resize', onResize);

async function init(){
  // Load JSON first (ok if missing—UI will just be empty)
  [garmentSpec, avatarMeasures] = await Promise.all([
    loadJSON('/jacket-measures.json').catch(()=>({sizes:{}})),
    loadJSON('/avatar-measures.json').catch(()=>({}))
  ]);
  buildSizeDropdown();

  await loadAvatar();
  await loadJacket();

  // Initial alignment
  alignAndScaleJacket();

  // Initial recommendation + warp
  const rec = pickSizeByChest(avatarMeasures?.chest_cm ?? 0, garmentSpec) || ui.sizeSelect.options[0]?.value;
  if (rec) {
    ui.sizeSelect.value = rec;
    ui.info.textContent = `Recommended: ${rec}`;
    applyWarpBands(rec);
    alignAndScaleJacket();
  }

  wireUI();

  renderer.setAnimationLoop(()=>{ controls.update(); renderer.render(scene, camera); });
}

init().catch(e=>{
  console.error(e);
  ui.info && (ui.info.textContent = 'Error: ' + (e?.message || e));
});

