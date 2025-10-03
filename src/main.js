// src/main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { createTShirt } from './garments/tshirt.js';
import { loadTextureFromURL } from './utils/texture.js';

/* =========================
   Renderer / Scene / Camera
   ========================= */
const canvas   = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.01, 500);
camera.position.set(0, 1.6, 3);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.0, 0);
controls.enableDamping = true;
controls.minDistance = 0.3;
controls.maxDistance = 50;
camera.lookAt(controls.target);

/* =========================
   Lighting & Ground
   ========================= */
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 0.7);
hemi.position.set(0, 1, 0);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(2.5, 6, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
scene.add(new THREE.GridHelper(20, 40, 0x444444, 0x222222));

/* =========================
   UI Elements
   ========================= */
const infoEl  = document.getElementById('info');
const measureReadout = document.getElementById('measureReadout');
const errEl   = document.getElementById('error');
const reload  = document.getElementById('reload');
const picker  = document.getElementById('fileInput');

const UI = {
  shirtChest:  document.getElementById('shirtChest'),
  shirtWaist:  document.getElementById('shirtWaist'),
  shirtLen:    document.getElementById('shirtLen'),
  sleeveLen:   document.getElementById('sleeveLen'),
  sleeveCirc:  document.getElementById('sleeveCirc'),
  tightness:   document.getElementById('tightness'),
  textureFile: document.getElementById('textureFile'),
};

function showError(msg) { errEl.style.display = 'block'; errEl.textContent = msg; }
function clearError()   { errEl.style.display = 'none'; errEl.textContent = ''; }

/* =========================
   GLB Loader (with Draco)
   ========================= */
const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderConfig({ type: 'js' });
draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
loader.setDRACOLoader(draco);

let avatarRoot = null;
let shirt = null;
let lastObjectURL = null;

/* =========================
   Load GLB, estimate measures, add shirt
   ========================= */
async function loadGLB(url, onDone) {
  clearError();
  infoEl.textContent = `Loading ${url} ...`;

  try {
    const gltf = await loader.loadAsync(url);

    if (avatarRoot) {
      scene.remove(avatarRoot);
      avatarRoot.traverse(o => {
        if (o.isMesh) {
          o.geometry?.dispose?.();
          if (o.material?.map) o.material.map.dispose?.();
          o.material?.dispose?.();
        }
      });
      avatarRoot = null;
    }

    avatarRoot = gltf.scene;
    avatarRoot.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material?.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
      }
    });

    // Place on ground & frame
    centerOnGround(avatarRoot);
    frameToObject(avatarRoot);
    scene.add(avatarRoot);

    // Estimate basic measures from bounding boxes around torso
    const est = estimateAvatarMeasures(avatarRoot);
    measureReadout.textContent =
      `Estimated avatar → Chest ${est.chestCm}cm • Waist ${est.waistCm}cm • Shoulders ${est.shouldersCm}cm • TorsoY ${est.torsoY.toFixed(2)}m`;

    // Prefill shirt sliders from avatar
    UI.shirtChest.value = String(Math.round(est.chestCm * 1.03)); // tiny ease
    UI.shirtWaist.value = String(Math.round(est.waistCm * 1.03));
    // place shirt around mid torso
    const yOffset = est.torsoY;

    // Remove old shirt if any
    if (shirt) { scene.remove(shirt); shirt = null; }

    // Create shirt with current UI values
    shirt = createTShirt({
      chestCm: +UI.shirtChest.value,
      waistCm: +UI.shirtWaist.value,
      lengthCm: +UI.shirtLen.value,
      sleeveLenCm: +UI.sleeveLen.value,
      sleeveCircCm: +UI.sleeveCirc.value,
      tightness: +UI.tightness.value,
      yOffset,
    });
    scene.add(shirt);

    infoEl.textContent = `Loaded ${url}`;
  } catch (err) {
    console.error('Failed to load GLB:', err);
    showError(`Failed to load ${url}. ${err?.message ?? ''}`);
  } finally {
    onDone && onDone();
  }
}

/* =========================
   Helpers: center & frame
   ========================= */
function centerOnGround(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  if (!isFiniteBox(box)) return;
  const center = new THREE.Vector3();
  box.getCenter(center);
  obj.position.x -= center.x;
  obj.position.z -= center.z;
  obj.position.y -= box.min.y; // feet on ground
}
function frameToObject(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  if (!isFiniteBox(box)) return;
  const size = new THREE.Vector3(), center = new THREE.Vector3();
  box.getSize(size); box.getCenter(center);
  const height = Math.max(size.y, 0.001);
  const distByH = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)));
  const distByW = (size.x / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * camera.aspect;
  const dist = 1.2 * Math.max(distByH, distByW);
  controls.target.set(0, size.y * 0.5, 0);
  camera.position.set(0, size.y * 0.5, dist);
  camera.near = Math.max(0.01, dist * 0.01);
  camera.far  = dist * 20.0;
  camera.updateProjectionMatrix();
  camera.lookAt(controls.target);
}
function isFiniteBox(box) {
  return Number.isFinite(box.min.x) && Number.isFinite(box.max.x);
}

/* =========================
   Rough measurement estimator
   ========================= */
function estimateAvatarMeasures(root) {
  // Use torso bounds (y: 35%..78% of model height) to avoid legs/head
  const full = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3(); full.getSize(size);
  const minY = full.min.y + size.y * 0.35;
  const maxY = full.min.y + size.y * 0.78;

  // Sample points by cloning, applying clipping-by-Y, and measuring XZ extents.
  // Cheap approach: just use full box XZ as chest/waist proxy, scaled.
  const chestCirc = (full.getSize(new THREE.Vector3()).x * Math.PI) * 0.90 * 100; // cm-ish
  const waistCirc = chestCirc * 0.92; // crude proportion fallback

  const shoulders = full.getSize(new THREE.Vector3()).x * 0.9 * 100; // cm-ish
  const torsoY = (minY + (maxY - minY) * 0.25); // where shirt top sits visually

  return {
    chestCm: Math.max(70, Math.round(chestCirc)),
    waistCm: Math.max(60, Math.round(waistCirc)),
    shouldersCm: Math.max(35, Math.round(shoulders)),
    torsoY,
  };
}

/* =========================
   UI events
   ========================= */
reload.addEventListener('click', () => loadGLB('/avatar.glb'));
picker.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  loadGLB(url, () => URL.revokeObjectURL(url));
});

function readShirtParams() {
  return {
    chestCm:      +UI.shirtChest.value,
    waistCm:      +UI.shirtWaist.value,
    lengthCm:     +UI.shirtLen.value,
    sleeveLenCm:  +UI.sleeveLen.value,
    sleeveCircCm: +UI.sleeveCirc.value,
    tightness:    +UI.tightness.value,
  };
}

['shirtChest','shirtWaist','shirtLen','sleeveLen','sleeveCirc','tightness'].forEach(id => {
  UI[id].addEventListener('input', () => {
    if (!shirt) return;
    shirt.userData.update(readShirtParams());
  });
});

UI.textureFile.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file || !shirt) return;
  if (lastObjectURL) URL.revokeObjectURL(lastObjectURL);
  const url = URL.createObjectURL(file);
  lastObjectURL = url;
  try {
    const tex = await loadTextureFromURL(url, { mirrored: true });
    shirt.userData.update({ texture: tex });
  } catch (err) {
    console.error('Texture load failed:', err);
  }
});

/* =========================
   Start
   ========================= */
loadGLB('/avatar.glb');

/* =========================
   Loop / Resize
   ========================= */
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
