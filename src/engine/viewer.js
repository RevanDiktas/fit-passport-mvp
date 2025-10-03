// src/engine/viewer.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

import { createPatternTee } from '../garments/tshirt_pattern.js';
import { loadTextureFromURL } from '../utils/texture.js';
import { attachShirtToSkeleton } from '../rig/attachShirt.js';

export async function initViewer({ canvas }) {
  // Renderer / Scene / Camera
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setSize(canvas.clientWidth || 640, canvas.clientHeight || 360);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  const camera = new THREE.PerspectiveCamera(
    40,
    (canvas.clientWidth || 640) / (canvas.clientHeight || 360),
    0.01,
    500
  );
  camera.position.set(0, 1.6, 3);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.0, 0);
  controls.enableDamping = true;
  controls.minDistance = 0.3;
  controls.maxDistance = 50;

  // Lights / ground
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

  // GLB loader (Draco-capable)
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderConfig({ type: 'js' });
  draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
  loader.setDRACOLoader(draco);

  // State
  let avatarRoot = null;
  let shirt = null;
  let rafHandle = null;

  // Core helpers
  function resize() {
    const w = canvas.clientWidth || 640;
    const h = canvas.clientHeight || 360;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  function frameToObject(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3(); const center = new THREE.Vector3();
    if (!Number.isFinite(box.min.x)) return;
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

  function centerOnGround(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    if (!Number.isFinite(box.min.x)) return;
    const center = new THREE.Vector3();
    box.getCenter(center);
    obj.position.x -= center.x;
    obj.position.z -= center.z;
    obj.position.y -= box.min.y; // feet to ground
  }

  // Public API
  async function loadAvatar(url) {
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
    }

    avatarRoot = gltf.scene;
    avatarRoot.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true;
        if (o.material?.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
      }
    });

    centerOnGround(avatarRoot);
    scene.add(avatarRoot);
    frameToObject(avatarRoot);
  }

  async function showTop({
    chest_cm, waist_cm, length_cm, sleeve_len_cm = 20, sleeve_circ_cm = 32, texture_url
  }) {
    if (!avatarRoot) throw new Error('loadAvatar first');

    // Compute a decent vertical offset from torso (top of shoulder down a bit)
    const yOffset = estimateTorsoY(avatarRoot);

    if (shirt) { scene.remove(shirt); shirt = null; }

    let map = null;
    if (texture_url) {
      try { map = await loadTextureFromURL(texture_url, { mirrored: true }); } catch {}
    }

    shirt = createPatternTee({
  chest_cm,
  waist_cm,
  length_cm,
  sleeve_len_cm, // becomes drop-shoulder extension
  texture: map,
  yOffset
});
    scene.add(shirt);

    // Bind to bones so it follows animation (FK)
    attachShirtToSkeleton(avatarRoot, shirt);
  }

  function dispose() {
    cancelAnimationFrame(rafHandle);
    renderer.dispose();
  }

  // Loop
  function tick() {
    controls.update();
    renderer.render(scene, camera);
    rafHandle = requestAnimationFrame(tick);
  }
  tick();

  return { loadAvatar, showTop, dispose, scene, camera, renderer, controls };
}

// crude torso offset estimator (works across most rigs)
function estimateTorsoY(root) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3(); box.getSize(size);
  // place shirt center roughly 55% up the body, then drop ~12 cm
  const base = box.min.y + size.y * 0.55;
  return base - 0.12;
}
