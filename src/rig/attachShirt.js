import * as THREE from 'three';
import { findSkeleton, findBoneLike } from './findSkeleton.js';

export function attachShirtToSkeleton(avatarRoot, shirtGroup) {
  const found = findSkeleton(avatarRoot);
  if (!found) { console.warn('No skeleton found'); return null; }
  const { skeleton, bonesByName } = found;

  const chestBone = findBoneLike(bonesByName, ['spine3','spine2','spineupper','spine','chest','upperchest']) || skeleton.bones[0];
  const lUpperArm = findBoneLike(bonesByName, ['leftarm','lupperarm','upperarm_l','arm_l','clavicle_l','shoulder_l','larm']);
  const rUpperArm = findBoneLike(bonesByName, ['rightarm','rupperarm','upperarm_r','arm_r','clavicle_r','shoulder_r','rarm']);

  const body = shirtGroup.getObjectByName('TShirtBody');
  const sl = shirtGroup.getObjectByName('TShirtSleeveL');
  const sr = shirtGroup.getObjectByName('TShirtSleeveR');
  if (!body || !sl || !sr) { console.warn('Missing shirt parts'); return null; }

  const bodyHolder = new THREE.Object3D();
  const lSleeveHolder = new THREE.Object3D();
  const rSleeveHolder = new THREE.Object3D();

  const tmpV = new THREE.Vector3(); const tmpQ = new THREE.Quaternion(); const tmpS = new THREE.Vector3();

  body.getWorldPosition(tmpV); body.getWorldQuaternion(tmpQ); body.getWorldScale(tmpS);
  bodyHolder.position.copy(tmpV); bodyHolder.quaternion.copy(tmpQ); bodyHolder.scale.copy(tmpS);
  sl.getWorldPosition(tmpV); sl.getWorldQuaternion(tmpQ); sl.getWorldScale(tmpS);
  lSleeveHolder.position.copy(tmpV); lSleeveHolder.quaternion.copy(tmpQ); lSleeveHolder.scale.copy(tmpS);
  sr.getWorldPosition(tmpV); sr.getWorldQuaternion(tmpQ); sr.getWorldScale(tmpS);
  rSleeveHolder.position.copy(tmpV); rSleeveHolder.quaternion.copy(tmpQ); rSleeveHolder.scale.copy(tmpS);

  avatarRoot.add(bodyHolder, lSleeveHolder, rSleeveHolder);
  bodyHolder.add(body); lSleeveHolder.add(sl); rSleeveHolder.add(sr);

  if (chestBone) chestBone.add(bodyHolder);
  if (lUpperArm) lUpperArm.add(lSleeveHolder);
  if (rUpperArm) rUpperArm.add(rSleeveHolder);

  bodyHolder.position.y += 0.02; // small lift

  return { chestBone, lUpperArm, rUpperArm, bodyHolder, lSleeveHolder, rSleeveHolder };
}
