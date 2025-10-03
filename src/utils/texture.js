import * as THREE from 'three';

export function loadTextureFromURL(url, { mirrored = true } = {}) {
  return new Promise((resolve, reject) => {
    if (!url) return resolve(null);
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        if (mirrored) t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
        resolve(t);
      },
      undefined,
      reject
    );
  });
}
