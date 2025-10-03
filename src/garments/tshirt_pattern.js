// src/garments/tshirt_pattern.js
// Two-piece tee (front + back) built from 2D pattern curves, then WRAPPED to a tapered cylinder
// to form a real 3D garment shell. Neck/hem stay open; side + shoulder seams are stitched.
// Units: API in centimeters → meters internally.

import * as THREE from 'three';

export function createPatternTee({
  chest_cm = 102,          // garment chest circumference (around)
  waist_cm = 98,           // garment waist circumference
  length_cm = 68,          // center-front length
  sleeve_len_cm = 20,      // drop-shoulder horizontal extension
  neck_w_cm = 16,
  neck_d_front_cm = 9,
  neck_d_back_cm = 3.5,
  shoulder_drop_cm = 3,
  ease_taper = 0.5,        // 0..1 amount of waist taper
  thickness_cm = 0.6,      // visual fabric thickness
  texture = null,
  yOffset = 1.0,
} = {}) {
  // ---- convert to meters
  const toM = (cm) => cm / 100;
  const chestM = toM(chest_cm);
  const waistM = toM(waist_cm ?? (chest_cm - 4));
  const lengthM = toM(length_cm);
  const sleeveExtM = toM(sleeve_len_cm);
  const neckW = toM(neck_w_cm);
  const neckFrontD = toM(neck_d_front_cm);
  const neckBackD  = toM(neck_d_back_cm);
  const shoulderDrop = toM(shoulder_drop_cm);
  const thickness = toM(thickness_cm);

  // Half widths (piece cut on fold)
  const halfChest = chestM * 0.25; // front half width = chest/4
  const halfWaist = THREE.MathUtils.lerp(halfChest, waistM * 0.25, ease_taper);

  // Build 2D half patterns in XY (Z=0), origin at CF neck.
  const frontHalf = buildHalfPanelShape({
    halfChest,
    halfWaist,
    lengthM,
    sleeveExtM,
    neckWHalf: neckW * 0.5,
    neckDepth: neckFrontD,
    shoulderDrop,
    armholeEase: 0.012,
  });

  const backHalf = buildHalfPanelShape({
    halfChest,
    halfWaist,
    lengthM,
    sleeveExtM,
    neckWHalf: neckW * 0.5,
    neckDepth: neckBackD,
    shoulderDrop: Math.max(0, shoulderDrop - toM(1)),
    armholeEase: 0.010,
  });

  // Mirror across CF to create closed shapes
  const frontShape = mirrorJoin(frontHalf);
  const backShape  = mirrorJoin(backHalf);

  // Triangulate 2D surfaces
  const frontFlat = new THREE.ShapeGeometry(frontShape, 64);
  const backFlat  = new THREE.ShapeGeometry(backShape, 64);

  // ---- WRAP to torso (tapered cylinder)
  // Front covers [-π/2 .. +π/2], Back covers [+π/2 .. +3π/2]
  const frontWrapped = wrapFlatToTorso(frontFlat, {
    chestCirc: chestM,
    waistCirc: waistM,
    angleStart: -Math.PI / 2,
    angleEnd:   +Math.PI / 2,
    thickness,
  });

  const backWrapped = wrapFlatToTorso(backFlat, {
    chestCirc: chestM,
    waistCirc: waistM,
    angleStart: +Math.PI / 2,
    angleEnd:   +Math.PI * 3/2,
    thickness,
  });

  // Build seam (side + shoulder) between front/back along their perimeters
  const seam = stitchWrappedSeams(frontShape, backShape, {
    chestCirc: chestM,
    waistCirc: waistM,
    thickness,
  });

  // Material
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.75,
    metalness: 0.0,
    side: THREE.DoubleSide,
    map: texture ?? null,
  });

  const frontMesh = new THREE.Mesh(frontWrapped, mat);
  const backMesh  = new THREE.Mesh(backWrapped,  mat);
  frontMesh.castShadow = frontMesh.receiveShadow = true;
  backMesh.castShadow  = backMesh.receiveShadow  = true;

  const seamMesh = new THREE.Mesh(seam, mat);
  seamMesh.castShadow = seamMesh.receiveShadow = true;

  // Group
  const group = new THREE.Group();
  group.name = 'PatternTee';
  group.add(frontMesh, backMesh, seamMesh);
  group.position.y = yOffset;

  // updater
  group.userData.update = (p = {}) => {
    const next = { chest_cm, waist_cm, length_cm, sleeve_len_cm, neck_w_cm, neck_d_front_cm, neck_d_back_cm, shoulder_drop_cm, ease_taper, thickness_cm, texture, yOffset, ...p };
    const rebuilt = createPatternTee(next);
    group.clear();
    rebuilt.children.forEach(c => group.add(c));
    group.position.y = next.yOffset ?? group.position.y;
  };

  return group;
}

/* -------------------------------
   Build half pattern in 2D (XY)
-------------------------------- */
function buildHalfPanelShape({
  halfChest,
  halfWaist,
  lengthM,
  sleeveExtM,
  neckWHalf,
  neckDepth,
  shoulderDrop,
  armholeEase,
}) {
  const yNeck = 0;
  const yShoulder = -shoulderDrop;
  const yArmhole  = -Math.max(0.18, lengthM * 0.28); // armhole depth from neck
  const yHem      = -lengthM;

  const wChest = halfChest + armholeEase;
  const wWaist = halfWaist + armholeEase * 0.5;
  const xSleeve = wChest + sleeveExtM;

  const s = new THREE.Shape();
  s.moveTo(0, yNeck);

  const neckCtrlX = neckWHalf * 0.6;
  const neckCtrlY = -neckDepth * 0.8;
  const shoulderX = neckWHalf + 0.02;
  const shoulderY = yShoulder;

  s.bezierCurveTo(neckCtrlX, neckCtrlY, neckWHalf, -neckDepth, shoulderX, shoulderY);
  s.quadraticCurveTo((shoulderX + xSleeve) * 0.5, shoulderY + 0.01, xSleeve, shoulderY + 0.015);
  s.lineTo(xSleeve, yArmhole);
  s.quadraticCurveTo((xSleeve + wChest) * 0.5, yArmhole + 0.02, wChest, yArmhole);
  s.quadraticCurveTo(wWaist, (yArmhole + yHem) * 0.5, wWaist, yHem);
  s.lineTo(0, yHem);
  s.lineTo(0, yNeck);
  return s;
}

// Mirror a half shape across CF (x=0) and join
function mirrorJoin(halfShape) {
  const pts = halfShape.getPoints(128);
  const left = pts.map(p => new THREE.Vector2(-p.x, p.y)).reverse();
  const right = pts;
  const all = [...left, ...right];

  const shape = new THREE.Shape();
  shape.moveTo(all[0].x, all[0].y);
  for (let i = 1; i < all.length; i++) shape.lineTo(all[i].x, all[i].y);
  shape.closePath();
  return shape;
}

/* -------------------------------
   Helpers to get 2D bounds
-------------------------------- */
function shapeBounds(shape, samples = 256) {
  const pts = shape.getSpacedPoints(samples);
  const box = new THREE.Box2().setFromPoints(pts);
  return { box, pts };
}

/* -------------------------------
   WRAP 2D surface -> tapered cylinder
-------------------------------- */
function wrapFlatToTorso(geo2D, { chestCirc, waistCirc, angleStart, angleEnd, thickness }) {
  // geo2D has positions in XY plane. We map:
  //  - y stays y
  //  - x maps to angle [angleStart..angleEnd]
  //  - radius r(y) blends chest/waist: r = (circ(y) / (2π)) * 0.5 (panel is half the torso)
  // Then we push outward by a small "thickness" along the radial direction.

  const pos = geo2D.attributes.position;

  // Find XY bounds of the flat geometry to normalize x and y
  const box3 = new THREE.Box3().setFromBufferAttribute(pos);
  const halfW = Math.max(Math.abs(box3.min.x), Math.abs(box3.max.x));
  const yMin = box3.min.y, yMax = box3.max.y;

  const arr = pos.array;
  for (let i = 0; i < arr.length; i += 3) {
    const x = arr[i + 0];
    const y = arr[i + 1];

    const t = THREE.MathUtils.clamp((x / halfW + 1) / 2, 0, 1); // 0..1 across the panel
    const angle = THREE.MathUtils.lerp(angleStart, angleEnd, t);

    const yT = (y - yMin) / Math.max(1e-6, (yMax - yMin)); // 0 at hem .. 1 at neck
    const circY = THREE.MathUtils.lerp(waistCirc, chestCirc, yT);
    const r = (circY / (2 * Math.PI)) * 0.5; // half because panel covers half circumference

    const cos = Math.cos(angle), sin = Math.sin(angle);

    // Base point on cylinder + outward thickness
    arr[i + 0] = cos * (r + thickness * 0.5);
    arr[i + 1] = y;
    arr[i + 2] = sin * (r + thickness * 0.5);
  }

  geo2D.computeVertexNormals();
  return geo2D;
}

/* -------------------------------
   Stitch perimeters in wrapped space
-------------------------------- */
function stitchWrappedSeams(frontShape, backShape, { chestCirc, waistCirc, thickness }) {
  const { box: fBox, pts: FR } = shapeBounds(frontShape, 400);
  const { pts: BK }            = shapeBounds(backShape,  400);

  // Y thresholds to keep neck & hem open
  const yMax = fBox.max.y;
  const yMin = fBox.min.y;
  const neckBand = (y) => y > yMax - 0.02;
  const hemBand  = (y) => y < yMin + 0.02;

  const positions = [];
  const uvs = [];
  const indices = [];

  const halfW = Math.max(Math.abs(fBox.min.x), Math.abs(fBox.max.x));

  // helper to wrap a 2D (x,y) to cylinder at a given angular sector
  const wrapPoint = (x, y, sector /* 'front' | 'back' */) => {
    const t = THREE.MathUtils.clamp((x / halfW + 1) / 2, 0, 1);
    const angle = sector === 'front'
      ? THREE.MathUtils.lerp(-Math.PI/2, +Math.PI/2, t)
      : THREE.MathUtils.lerp(+Math.PI/2, +Math.PI*3/2, t);

    const yT = (y - yMin) / Math.max(1e-6, (yMax - yMin));
    const circY = THREE.MathUtils.lerp(waistCirc, chestCirc, yT);
    const r = (circY / (2 * Math.PI)) * 0.5;

    const cos = Math.cos(angle), sin = Math.sin(angle);
    // two sides of thickness if ever needed; for seam we just need the outer shell
    return new THREE.Vector3(cos * (r + thickness * 0.5), y, sin * (r + thickness * 0.5));
  };

  const N = Math.min(FR.length, BK.length);
  for (let i = 0; i < N; i++) {
    const pF = FR[i];
    const pB = BK[i];

    if (neckBand(pF.y) || hemBand(pF.y)) continue;

    const vF = wrapPoint(pF.x, pF.y, 'front');
    const vB = wrapPoint(pB.x, pB.y, 'back');

    const base = positions.length / 3;
    // order: front(i), back(i)
    positions.push(vF.x, vF.y, vF.z);
    positions.push(vB.x, vB.y, vB.z);

    uvs.push(i / (N - 1), 0);
    uvs.push(i / (N - 1), 1);

    if (i > 0) {
      indices.push(
        base - 2, base - 1, base,
        base - 1, base + 1, base
      );
    }
  }

  const g = new THREE.BufferGeometry();
  g.setIndex(indices);
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}
