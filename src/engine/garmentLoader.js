// src/engine/garmentLoader.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export function makeGLTFLoader() {
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderConfig({ type: 'js' });
  draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
  loader.setDRACOLoader(draco);
  return loader;
}

/**
 * Try to fetch a precomputed draped mesh GLB.
 * url can be absolute, or like `/draped/tshirt_M.glb` (served from /public).
 * Returns a THREE.Group (the GLB's scene) or null if 404.
 */
export async function loadDrapedGarment(url) {
  const head = await fetch(url, { method: 'HEAD', cache: 'no-store' }).catch(() => null);
  if (!head || !head.ok) return null;

  const loader = makeGLTFLoader();
  const gltf = await loader.loadAsync(url);
  const root = gltf.scene || gltf.scenes?.[0];

  // basic setup
  root.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true;
      if (o.material?.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
    }
  });

  return root;
}
