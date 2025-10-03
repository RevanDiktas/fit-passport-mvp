import * as THREE from 'three';

export function findSkeleton(root) {
  let skinned = null;
  root.traverse((o) => { if (o.isSkinnedMesh && !skinned) skinned = o; });
  if (!skinned) return null;
  const skeleton = skinned.skeleton;
  const bonesByName = {};
  skeleton.bones.forEach(b => { bonesByName[normalize(b.name)] = b; });
  return { skinnedMesh: skinned, skeleton, bonesByName };
}
export function normalize(name) {
  return String(name || '').toLowerCase().replace(/[\s_\-]/g, '').replace(/[^\w]/g, '');
}
export function findBoneLike(bonesByName, candidates) {
  const keys = Object.keys(bonesByName);
  for (const q of candidates) {
    const n = normalize(q);
    const key = keys.find(k => k.includes(n));
    if (key) return bonesByName[key];
  }
  return null;
}
