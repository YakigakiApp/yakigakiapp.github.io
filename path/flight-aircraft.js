import * as THREE from './vendor/three.module.min.js';

// Contours and component positions reference Boeing ACAP Rev Q, page 2-6:
// 62.81 m overall length, 62.00 m fuselage, 60.12 m span, 5.77 × 5.94 m section.
// The nose is a loft of independently traced upper/lower/plan contours, not a lathe.
// Units are 1:10 metres. This is an interpretation of the published three-view.
// https://www.boeing.com/commercial/airports/3-view
// https://www.boeing.com/content/dam/boeing/v2/airports/acaps/787_ACAP_Rev_Q.pdf
// https://www.boeing.com/content/dam/boeing/v2/products/787/787-roadblock-2-imtow.jpg
export function buildDreamliner({ own, materials: m, detailed = true }) {
  const group = new THREE.Group();
  group.name = detailed ? 'PATH Dreamliner' : 'Apron aircraft';
  const unitBox = own(new THREE.BoxGeometry(1, 1, 1));
  const unitSphere = own(new THREE.SphereGeometry(1, detailed ? 20 : 12, detailed ? 14 : 8));
  const mesh = (geometry, material, parent = group, x = 0, y = 0, z = 0) => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  };
  const box = (parent, x, y, z, w, h, d, material) => {
    const object = mesh(unitBox, material, parent, x, y, z);
    object.scale.set(w, h, d);
    return object;
  };
  const cylinder = (parent, x, y, z, r1, r2, length, material, segments = 24) => mesh(
    own(new THREE.CylinderGeometry(r1, r2, length, segments)), material, parent, x, y, z,
  );
  // [longitudinal position, upper contour, lower contour, half breadth].
  // In the side view the radome tip is ~1.28 m below the cabin-section centre.
  // Full cabin breadth continues to ~8 m behind the nose; the old model began
  // tapering 16 m behind it, producing the incorrect long, symmetrical point.
  const bodySections = [
    [-3.0595, 0.151, 0.151, 0], [-2.96, 0.184, 0.127, 0.028],
    [-2.73, 0.221, 0.028, 0.084], [-2.40, 0.261, -0.073, 0.151],
    [-2.05, 0.284, -0.179, 0.216], [-1.58, 0.297, -0.279, 0.278],
    [-1.25, 0.297, -0.297, 0.2885], [1.55, 0.297, -0.297, 0.2885],
    [2.10, 0.297, -0.297, 0.2885], [2.262, 0.297, -0.297, 0.2885],
    [2.407, 0.287, -0.297, 0.285], [2.531, 0.271, -0.289, 0.276],
    [2.676, 0.238, -0.279, 0.254], [2.800, 0.192, -0.258, 0.221],
    [2.893, 0.143, -0.246, 0.183], [2.975, 0.068, -0.230, 0.137],
    [3.037, 0.012, -0.213, 0.098], [3.099, -0.043, -0.188, 0.054],
    [3.128, -0.084, -0.159, 0.027], [3.139, -0.111, -0.143, 0.01],
    [3.1405, -0.128, -0.128, 0],
  ];
  const sectionAt = (x) => {
    const i = bodySections.findIndex(([position]) => position >= x);
    if (i <= 0) return bodySections[i === 0 ? 0 : bodySections.length - 1].slice(1);
    const a = bodySections[i - 1], b = bodySections[i];
    const before = bodySections[Math.max(0, i - 2)];
    const after = bodySections[Math.min(bodySections.length - 1, i + 1)];
    const dx = b[0] - a[0], t = (x - a[0]) / dx;
    return [1, 2, 3].map((column) => {
      const previousSlope = (b[column] - before[column]) / (b[0] - before[0]);
      const nextSlope = (after[column] - a[column]) / (after[0] - a[0]);
      const value = (2 * t ** 3 - 3 * t ** 2 + 1) * a[column]
        + (t ** 3 - 2 * t ** 2 + t) * dx * previousSlope
        + (-2 * t ** 3 + 3 * t ** 2) * b[column]
        + (t ** 3 - t ** 2) * dx * nextSlope;
      return THREE.MathUtils.clamp(value, Math.min(a[column], b[column]), Math.max(a[column], b[column]));
    });
  };
  const surfaceAt = (x, y, side, offset = 0) => {
    const [top, bottom, breadth] = sectionAt(x);
    const centre = (top + bottom) / 2, radius = (top - bottom) / 2;
    const vertical = THREE.MathUtils.clamp((y - centre) / Math.max(radius, 0.00001), -0.999, 0.999);
    return new THREE.Vector3(x, y, side * (breadth * Math.sqrt(1 - vertical * vertical) + offset));
  };
  const bodyPositions = [], bodyIndices = [], sections = [];
  const radialSegments = detailed ? 64 : 28;
  const subdivisions = detailed ? 9 : 4;
  for (let i = 0; i < bodySections.length - 1; i++) {
    for (let step = 0; step < subdivisions; step++) sections.push(THREE.MathUtils.lerp(bodySections[i][0], bodySections[i + 1][0], step / subdivisions));
  }
  sections.push(bodySections[bodySections.length - 1][0]);
  for (const x of sections) {
    const [top, bottom, breadth] = sectionAt(x);
    for (let j = 0; j <= radialSegments; j++) {
      const theta = j / radialSegments * Math.PI * 2;
      bodyPositions.push(x, (top + bottom) / 2 + (top - bottom) / 2 * Math.cos(theta), breadth * Math.sin(theta));
    }
  }
  for (let i = 0; i < sections.length - 1; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * (radialSegments + 1) + j, b = a + radialSegments + 1;
      bodyIndices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const bodyGeometry = own(new THREE.BufferGeometry());
  bodyGeometry.setAttribute('position', new THREE.Float32BufferAttribute(bodyPositions, 3));
  bodyGeometry.setIndex(bodyIndices);
  bodyGeometry.computeVertexNormals();
  mesh(bodyGeometry, m.porcelain).name = 'Asymmetric fuselage loft';

  // A closed, cambered airfoil with continuous dihedral and a raked tip; no winglet.
  const stations = [
    [0.22, 1.025, -0.242, -0.090], [0.45, 0.869, -0.261, -0.080],
    [0.92, 0.528, -0.298, -0.049], [1.43, 0.186, -0.451, -0.006],
    [1.98, -0.207, -0.687, 0.066], [2.51, -0.575, -0.899, 0.139],
    [2.82, -0.788, -1.047, 0.195], [2.95, -0.984, -1.151, 0.234],
    [3.006, -1.182, -1.1955, 0.263],
  ];
  const chordSamples = detailed ? 12 : 5;
  const n = chordSamples + 1;
  const surfaceSize = stations.length * n;
  const vertices = [];
  for (const top of [true, false]) {
    for (const [z, leading, trailing, y] of stations) {
      const chord = leading - trailing;
      for (let j = 0; j <= chordSamples; j++) {
        const t = j / chordSamples;
        const camber = Math.sin(Math.PI * t);
        vertices.push(THREE.MathUtils.lerp(leading, trailing, t), y + camber * chord * (top ? 0.035 : -0.016), z);
      }
    }
  }
  const indices = [];
  for (let i = 0; i < stations.length - 1; i++) {
    for (let j = 0; j < chordSamples; j++) {
      const a = i * n + j, b = a + n, c = a + 1, d = b + 1;
      indices.push(a, c, b, b, c, d);
      indices.push(a + surfaceSize, b + surfaceSize, c + surfaceSize, b + surfaceSize, d + surfaceSize, c + surfaceSize);
    }
    for (const j of [0, chordSamples]) {
      const a = i * n + j, b = a + n;
      if (j === 0) indices.push(a, b, a + surfaceSize, b, b + surfaceSize, a + surfaceSize);
      else indices.push(a, a + surfaceSize, b, b, a + surfaceSize, b + surfaceSize);
    }
  }
  for (const i of [0, stations.length - 1]) {
    for (let j = 0; j < chordSamples; j++) {
      const a = i * n + j, b = a + 1;
      if (i === 0) indices.push(a, a + surfaceSize, b, b, a + surfaceSize, b + surfaceSize);
      else indices.push(a, b, a + surfaceSize, b, b + surfaceSize, a + surfaceSize);
    }
  }
  const wingGeometry = own(new THREE.BufferGeometry());
  wingGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  wingGeometry.setIndex(indices);
  wingGeometry.computeVertexNormals();
  mesh(wingGeometry, m.porcelain);
  mesh(wingGeometry, m.porcelain).scale.z = -1;
  const wingBase = new Float32Array(wingGeometry.attributes.position.array);

  function foil(points, thickness, material, horizontal) {
    const shape = new THREE.Shape();
    points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
    shape.closePath();
    const geometry = own(new THREE.ExtrudeGeometry(shape, {
      depth: thickness, bevelEnabled: true, bevelSize: 0.009, bevelThickness: 0.008, bevelSegments: 2, steps: 1,
    }));
    geometry.translate(0, 0, -thickness / 2);
    if (horizontal) geometry.rotateX(-Math.PI / 2);
    return mesh(geometry, material);
  }
  foil([[-1.83, 0.24], [-2.03, 0.32], [-2.75, 1.128], [-3.007, 1.155], [-2.632, 0.22]], 0.046, m.blue, false);
  const tail = foil([[-2.09, 0], [-2.945, -0.9815], [-3.125, -0.9815], [-2.819, 0], [-3.125, 0.9815], [-2.945, 0.9815]], 0.027, m.porcelain, true);
  tail.position.y = 0.116;
  for (const side of [-1, 1]) {
    const stripe = box(group, -2.66, 0.77, side * 0.032, 0.095, 0.26, 0.006, m.porcelain);
    stripe.rotation.z = -0.35;
  }

  // Separate front windscreens and five-corner side windows, conforming to the
  // nose loft. Subdivision prevents a flat glazing triangle disappearing inside it.
  for (const side of [-1, 1]) {
    const panes = [
      [[3.013, sectionAt(3.013)[0] - 0.0001], [2.911, sectionAt(2.911)[0] - 0.0001], [2.854, 0.113], [2.944, 0.032]],
      [[2.922, 0.030], [2.843, 0.116], [2.782, 0.103], [2.793, 0.035], [2.846, 0.020]],
    ];
    panes.forEach((corners, paneIndex) => {
      const polygon = corners.map(([x, y]) => new THREE.Vector2(x, y));
      const positions = [];
      const addTriangle = (a, b, c, depth) => {
        if (depth) {
          const ab = a.clone().add(b).multiplyScalar(0.5), bc = b.clone().add(c).multiplyScalar(0.5), ca = c.clone().add(a).multiplyScalar(0.5);
          addTriangle(a, ab, ca, depth - 1); addTriangle(ab, b, bc, depth - 1);
          addTriangle(ca, bc, c, depth - 1); addTriangle(ab, bc, ca, depth - 1);
          return;
        }
        const points = [a, b, c].map((p) => surfaceAt(p.x, p.y, side, 0.003));
        const normal = new THREE.Vector3().crossVectors(points[1].clone().sub(points[0]), points[2].clone().sub(points[0]));
        if (normal.z * side < 0) [points[1], points[2]] = [points[2], points[1]];
        points.forEach((p) => positions.push(p.x, p.y, p.z));
      };
      THREE.ShapeUtils.triangulateShape(polygon, []).forEach(([a, b, c]) => addTriangle(polygon[a], polygon[b], polygon[c], detailed ? 3 : 1));
      const geometry = own(new THREE.BufferGeometry());
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      mesh(geometry, m.blueDark).name = paneIndex ? 'Cockpit side window' : 'Cockpit windscreen';
    });
  }
  if (detailed) {
    const windowCount = 35;
    const windows = new THREE.InstancedMesh(unitSphere, m.blueDark, windowCount * 2);
    const dummy = new THREE.Object3D();
    let instance = 0;
    for (const side of [-1, 1]) {
      for (let i = 0; i < windowCount; i++) {
        const x = -1.83 + i * 0.112;
        dummy.position.copy(surfaceAt(x, 0.075, side, 0.003));
        dummy.scale.set(0.021, 0.032, 0.006);
        dummy.updateMatrix();
        windows.setMatrixAt(instance++, dummy.matrix);
      }
    }
    group.add(windows);
  }

  function chevrons() {
    const position = [], index = [], count = detailed ? 72 : 36;
    for (let i = 0; i <= count; i++) {
      const theta = i / count * Math.PI * 2;
      const tooth = (1 + Math.cos(theta * 12)) / 2;
      const rearX = -0.22 - tooth * 0.065;
      for (const [x, radius] of [[-0.15, 0.149], [rearX, 0.124], [rearX, 0.111], [-0.15, 0.135]]) {
        position.push(x, Math.cos(theta) * radius, Math.sin(theta) * radius);
      }
      if (i < count) for (let ring = 0; ring < 4; ring++) {
        const a = i * 4 + ring, b = i * 4 + (ring + 1) % 4, c = a + 4, d = b + 4;
        index.push(a, b, c, c, b, d);
      }
    }
    const geometry = own(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    return geometry;
  }
  const nacelleProfile = [[0.149, -0.15], [0.173, -0.06], [0.184, 0.11], [0.177, 0.23], [0.153, 0.31], [0.135, 0.302], [0.131, 0.12]];
  const nacelleGeometry = own(new THREE.LatheGeometry(nacelleProfile.map(([r, x]) => new THREE.Vector2(r, x)), detailed ? 48 : 24));
  nacelleGeometry.rotateZ(-Math.PI / 2);
  const chevronGeometry = chevrons();
  for (const side of [-1, 1]) {
    const engine = new THREE.Group();
    // Boeing's plan view puts the inlet 20.80 m aft of the nose and 9.91 m outboard.
    engine.position.set(0.7505, -0.304, side * 0.991);
    engine.name = 'Turbofan nacelle';
    group.add(engine);
    mesh(nacelleGeometry, m.porcelain, engine);
    mesh(chevronGeometry, m.porcelain, engine);
    const fan = cylinder(engine, 0.165, 0, 0, 0.132, 0.132, 0.012, m.blueDark, detailed ? 40 : 20);
    fan.rotation.z = -Math.PI / 2;
    const spinner = cylinder(engine, 0.199, 0, 0, 0.006, 0.037, 0.074, m.concrete, 20);
    spinner.rotation.z = -Math.PI / 2;
    if (detailed) {
      const blades = new THREE.InstancedMesh(unitBox, m.glass, 14);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < 14; i++) {
        const theta = i / 14 * Math.PI * 2;
        dummy.position.set(0.181, Math.cos(theta) * 0.081, Math.sin(theta) * 0.081);
        dummy.scale.set(0.007, 0.092, 0.01);
        dummy.rotation.x = theta + 0.20;
        dummy.updateMatrix();
        blades.setMatrixAt(i, dummy.matrix);
      }
      engine.add(blades);
    }
    const nozzle = cylinder(engine, -0.229, 0, 0, 0.096, 0.078, 0.13, m.blueDark, 24);
    nozzle.rotation.z = -Math.PI / 2;
    const plug = cylinder(engine, -0.307, 0, 0, 0.061, 0.004, 0.11, m.concrete, 24);
    plug.rotation.z = -Math.PI / 2;
    const pylon = foil([[0.973, -0.20], [0.466, -0.039], [0.169, -0.075], [0.536, -0.265]], 0.048, m.porcelain, false);
    pylon.position.z = side * 0.991;
  }

  const gear = new THREE.Group();
  gear.name = 'Retractable landing gear';
  group.add(gear);
  for (const side of [-1, 1]) {
    cylinder(gear, 0.0165, -0.376, side * 0.43, 0.026, 0.031, 0.21, m.concrete, 10);
    box(gear, 0.0165, -0.46, side * 0.43, 0.31, 0.032, 0.033, m.concrete);
    for (const x of detailed ? [0.1315, -0.0985] : [0.0165]) {
      for (const offset of detailed ? [-0.044, 0.044] : [0]) {
        const wheel = cylinder(gear, x, -0.478, side * 0.43 + offset, 0.06, 0.06, 0.035, m.rubber, 16);
        wheel.rotation.x = Math.PI / 2;
      }
    }
  }
  cylinder(gear, 2.5995, -0.367, 0, 0.018, 0.023, 0.248, m.concrete, 10);
  for (const side of [-1, 1]) {
    const wheel = cylinder(gear, 2.5995, -0.491, side * 0.032, 0.047, 0.047, 0.034, m.rubber, 16);
    wheel.rotation.x = Math.PI / 2;
  }
  group.updateMatrixWorld(true);
  const groundClearance = -new THREE.Box3().setFromObject(gear).min.y;
  let lastFlex = -1;
  return {
    group, gear, groundClearance,
    setWingFlex(value) {
      if (!detailed || Math.abs(value - lastFlex) < 0.0005) return;
      lastFlex = value;
      const position = wingGeometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        position.array[i * 3 + 1] = wingBase[i * 3 + 1] + value * 0.23 * Math.pow(wingBase[i * 3 + 2] / 3.006, 2);
      }
      position.needsUpdate = true;
      wingGeometry.computeVertexNormals();
      wingGeometry.computeBoundingSphere();
    },
  };
}
