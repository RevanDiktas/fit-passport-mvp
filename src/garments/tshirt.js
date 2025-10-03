import * as THREE from 'three';

export function createTShirt({
  chestCm = 100,
  waistCm = 96,
  lengthCm = 68,
  sleeveLenCm = 20,
  sleeveCircCm = 32,
  tightness = 1.0,
  texture = null,
  yOffset = 1.0
} = {}) {
  const group = new THREE.Group();
  group.name = 'TShirt';

  const circToR = (cm) => (cm / 100) / (2 * Math.PI);
  const clearance = 0.01;

  const chestR  = circToR(chestCm)  * tightness;
  const waistR  = circToR(waistCm)  * tightness;
  const bodyLen = (lengthCm / 100) * 0.9;
  const slLen   = (sleeveLenCm / 100) * 0.9;
  const slR     = circToR(sleeveCircCm) * 0.9;

  const bodyGeom = makeBodyTube(chestR + clearance, waistR + clearance, bodyLen);
  const sleeveG  = makeSleeve(slR + clearance * 0.6, slLen);

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.7,
    metalness: 0.0,
    side: THREE.DoubleSide,
    map: texture ?? null,
  });

  const body = new THREE.Mesh(bodyGeom, mat);
  body.castShadow = body.receiveShadow = true;
  body.name = 'TShirtBody';

  const sl = new THREE.Mesh(sleeveG, mat);
  sl.castShadow = sl.receiveShadow = true;
  sl.position.set(0, 0.12, chestR + clearance);
  sl.rotation.set(0, Math.PI / 2, 0);
  sl.name = 'TShirtSleeveL';

  const sr = sl.clone();
  sr.position.z *= -1;
  sr.rotation.y *= -1;
  sr.name = 'TShirtSleeveR';

  group.add(body, sl, sr);
  group.position.set(0, yOffset, 0);

  group.userData.update = (p = {}) => {
    const next = { chestCm, waistCm, lengthCm, sleeveLenCm, sleeveCircCm, tightness, texture, yOffset, ...p };

    const _chestR  = circToR(next.chestCm) * next.tightness;
    const _waistR  = circToR(next.waistCm) * next.tightness;
    const _bodyLen = (next.lengthCm / 100) * 0.9;
    const _slLen   = (next.sleeveLenCm / 100) * 0.9;
    const _slR     = circToR(next.sleeveCircCm) * 0.9;

    body.geometry.dispose();
    body.geometry = makeBodyTube(_chestR + clearance, _waistR + clearance, _bodyLen);

    const newSleeve = makeSleeve(_slR + clearance * 0.6, _slLen);
    sl.geometry.dispose(); sr.geometry.dispose();
    sl.geometry = newSleeve; sr.geometry = newSleeve;

    group.position.y = next.yOffset ?? group.position.y;

    if (next.texture && next.texture !== mat.map) {
      mat.map = next.texture; mat.needsUpdate = true;
    }
  };

  return group;
}

function makeBodyTube(chestR, waistR, h) {
  const seg = 64, rings = 40;
  const pos = [], uvs = [], idx = [];
  for (let y = 0; y <= rings; y++) {
    const t = y / rings, r = THREE.MathUtils.lerp(chestR, waistR, t), yPos = (t - 0.5) * h;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      pos.push(Math.cos(a)*r, yPos, Math.sin(a)*r);
      uvs.push(i/seg, 1 - t);
    }
  }
  for (let y = 0; y < rings; y++) {
    for (let i = 0; i < seg; i++) {
      const a = y*(seg+1)+i, b = a + seg + 1;
      idx.push(a,b,a+1, b,b+1,a+1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs,2));
  g.computeVertexNormals();
  return g;
}

function makeSleeve(r, len) {
  const radial = 32, height = 8;
  const pos = [], uvs = [], idx = [];
  for (let y = 0; y <= height; y++) {
    const t = y / height; const radius = r * (1 - 0.05 * t); const xPos = (t - 0.1) * len;
    for (let i = 0; i <= radial; i++) {
      const a = (i / radial) * Math.PI * 2;
      pos.push(xPos, Math.cos(a)*radius, Math.sin(a)*radius);
      uvs.push(i / radial, 1 - t);
    }
  }
  for (let y = 0; y < height; y++) {
    for (let i = 0; i < radial; i++) {
      const a = y * (radial + 1) + i; const b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}
