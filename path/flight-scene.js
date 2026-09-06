import * as THREE from './vendor/three.module.min.js';
import { buildDreamliner } from './flight-aircraft.js?v=20260906-landing-solid-tail1';

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const smooth = (a, b, value) => {
  const t = clamp((value - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** A self-contained miniature airport. All animation is derived from scroll progress. */
export function createFlightScene(canvas, { reducedMotion = false, onReady, onStateChange } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-12, 12, 7.5, -7.5, 0.1, 160);
  camera.position.set(17, 15, 22);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const towardCamera = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2);
  const resources = new Set();
  const own = (resource) => { resources.add(resource); return resource; };
  const material = (color, extra = {}) => own(new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0, ...extra }));
  const colors = {
    porcelain: material(0xf8f6ef),
    concrete: material(0xe1e3db),
    platform: material(0xe6e5db),
    road: material(0x354553),
    tarmac: material(0xc1c9c6),
    blue: material(0x234dbb),
    blueDark: material(0x17366c),
    glass: material(0x507b93, { roughness: 0.62 }),
    white: material(0xffffff),
    line: material(0xf3f3e9),
    green: material(0x849e80),
    greenLight: material(0xabc2a0),
    bark: material(0xb7a98e),
    yellow: material(0xe5c477),
    rubber: material(0x283642),
  };
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb7c3c4, 2.25));
  const sun = new THREE.DirectionalLight(0xfff4df, 2.75);
  sun.position.set(-8, 18, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 0.5, far: 65 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias = 0.012;
  sun.shadow.bias = -0.00015;
  sun.shadow.radius = 4;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdce9ff, 0.85);
  fill.position.set(12, 6, -10);
  scene.add(fill);

  const boxGeometry = own(new THREE.BoxGeometry(1, 1, 1));
  const sphereGeometry = own(new THREE.SphereGeometry(1, 24, 16));
  function mesh(geometry, mat, parent, x = 0, y = 0, z = 0) {
    const object = new THREE.Mesh(geometry, mat);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function box(parent, x, y, z, width, height, depth, mat) {
    const object = mesh(boxGeometry, mat, parent, x, y, z);
    object.scale.set(width, height, depth);
    return object;
  }
  function sphere(parent, x, y, z, sx, sy, sz, mat) {
    const object = mesh(sphereGeometry, mat, parent, x, y, z);
    object.scale.set(sx, sy, sz);
    return object;
  }
  function cylinder(parent, x, y, z, top, bottom, height, mat, segments = 24) {
    return mesh(own(new THREE.CylinderGeometry(top, bottom, height, segments)), mat, parent, x, y, z);
  }
  function roundedSlab(parent, width, depth, height, radius, mat, y) {
    const x = -width / 2;
    const z = -depth / 2;
    const shape = new THREE.Shape();
    shape.moveTo(x + radius, z);
    shape.lineTo(x + width - radius, z);
    shape.quadraticCurveTo(x + width, z, x + width, z + radius);
    shape.lineTo(x + width, z + depth - radius);
    shape.quadraticCurveTo(x + width, z + depth, x + width - radius, z + depth);
    shape.lineTo(x + radius, z + depth);
    shape.quadraticCurveTo(x, z + depth, x, z + depth - radius);
    shape.lineTo(x, z + radius);
    shape.quadraticCurveTo(x, z, x + radius, z);
    const geo = own(new THREE.ExtrudeGeometry(shape, {
      depth: height, bevelEnabled: true, bevelSegments: 3, steps: 1,
      bevelSize: Math.min(height * 0.18, 0.07), bevelThickness: Math.min(height * 0.18, 0.07), curveSegments: 8,
    }));
    geo.translate(0, 0, -height / 2);
    geo.rotateX(-Math.PI / 2);
    return mesh(geo, mat, parent, 0, y, 0);
  }
  function marking(parent, text, x, y, z, width, height, rotation = 0, color = '#f3f3e9') {
    const label = document.createElement('canvas');
    label.width = 512;
    label.height = 128;
    const ctx = label.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 82px Arial, sans-serif';
    ctx.fillText(text, 256, 69);
    const texture = own(new THREE.CanvasTexture(label));
    texture.colorSpace = THREE.SRGBColorSpace;
    const mat = own(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    const object = mesh(own(new THREE.PlaneGeometry(width, height)), mat, parent, x, y, z);
    object.rotation.set(-Math.PI / 2, 0, rotation);
    object.castShadow = false;
    return object;
  }

  const airport = new THREE.Group();
  airport.name = 'PATH International Airport';
  scene.add(airport);
  // An interpretation of New Chitose's curved terminal and two parallel runways.
  // Hokkaido Airports specifies 3,000 × 60 m for both runways:
  // https://www.hokkaido-airports.com/en/new-chitose/business/airport/about/
  // The aircraft is built in 1:10 units; .28 keeps its ground scale consistent
  // with an airfield scale of .028 scene units per metre (84 × 1.68 runways).
  const airportWidth = 96;
  const airportDepth = 52;
  const runwayZ = 7.5;
  const runwayTop = 0.0925;
  const groundAircraftScale = 0.28;
  const takeoffStartX = -37.0;
  const takeoffEndX = 36.5;
  const infield = material(0xc9d2c0);
  const serviceRoad = material(0xa9b6b7);
  const gatePositions = [];
  roundedSlab(airport, airportWidth, airportDepth, 0.68, 1.65, colors.platform, -0.4);
  roundedSlab(airport, 95.6, 51.6, 0.06, 1.48, colors.concrete, -0.015);
  box(airport, 0, 0.027, 11.6, 92.0, 0.025, 23.8, infield);

  function paintedLine(x, z, length, width, color = colors.line, parent = airport) {
    const object = box(parent, x, 0.108, z, length, 0.009, width, color);
    object.castShadow = false;
    return object;
  }
  function runway(z, leftLabel, rightLabel) {
    box(airport, 0, 0.06, z, 84, 0.065, 1.68, colors.road);
    for (let i = 0; i < 42; i++) paintedLine(-40 + i * 1.95, z, 0.87, 0.045);
    for (const side of [-1, 1]) {
      paintedLine(0, z + side * 0.76, 83.3, 0.045);
      for (let i = 0; i < 23; i++) {
        const light = box(airport, -41 + i * 3.72, 0.113, z + side * 0.99, 0.06, 0.036, 0.06, colors.white);
        light.castShadow = false;
      }
      for (const x of [-40.0, 40.0]) {
        for (let i = 0; i < 5; i++) paintedLine(x, z + side * (0.13 + i * 0.125), 1.07, 0.073);
      }
      for (const x of [-33.6, 33.6]) paintedLine(x, z + side * 0.43, 1.26, 0.20);
    }
    marking(airport, leftLabel, -38.25, 0.118, z, 1.12, 0.70, -Math.PI / 2);
    marking(airport, rightLabel, 38.25, 0.118, z, 1.12, 0.70, Math.PI / 2);
  }
  runway(runwayZ, '09L', '27R');
  runway(17.0, '09R', '27L');
  // Parallel taxiways, connecting exits, and apron access make the scale legible
  // as the camera pulls back from the departure runway.
  for (const z of [3.0, 12.15, 21.1]) {
    box(airport, 0, 0.052, z, 82.8, 0.04, 0.66, colors.tarmac);
    paintedLine(0, z, 82.1, 0.032, colors.yellow);
  }
  for (const x of [-39.7, -27.0, -13.0, 3.8, 22.5, 39.7]) {
    box(airport, x, 0.054, 12.04, 0.68, 0.04, 18.1, colors.tarmac);
    paintedLine(x, 12.04, 0.033, 18.05, colors.yellow);
    for (const z of [6.30, 8.70, 15.8, 18.2]) paintedLine(x, z, 0.61, 0.06, colors.yellow);
  }
  // The runway surfaces sit slightly higher than all taxiway intersections.
  box(airport, -7.5, 0.045, -7.2, 41.0, 0.035, 19.5, colors.tarmac);
  for (const x of [-26.5, 13.1]) {
    box(airport, x, 0.053, -0.85, 0.76, 0.04, 7.75, colors.tarmac);
    paintedLine(x, -0.85, 0.033, 7.65, colors.yellow);
  }
  function arcSlab(parent, centerX, centerZ, innerRadius, outerRadius, angleStart, angleEnd, height, y, mat) {
    const shape = new THREE.Shape();
    const count = 56;
    for (let i = 0; i <= count; i++) {
      const angle = lerp(angleStart, angleEnd, i / count);
      const x = Math.cos(angle) * outerRadius;
      const z = -Math.sin(angle) * outerRadius;
      if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
    }
    for (let i = count; i >= 0; i--) {
      const angle = lerp(angleStart, angleEnd, i / count);
      shape.lineTo(Math.cos(angle) * innerRadius, -Math.sin(angle) * innerRadius);
    }
    shape.closePath();
    const geometry = own(new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1 }));
    geometry.translate(0, 0, -height / 2);
    geometry.rotateX(-Math.PI / 2);
    return mesh(geometry, mat, parent, centerX, y, centerZ);
  }
  const terminal = new THREE.Group();
  terminal.name = 'Semicircular passenger terminal';
  terminal.position.set(-7, 0.04, -15);
  airport.add(terminal);
  const arcStart = 0.07;
  const arcEnd = Math.PI - 0.07;
  arcSlab(terminal, 0, 0, 8.45, 11.75, arcStart, arcEnd, 0.84, 0.43, colors.porcelain);
  arcSlab(terminal, 0, 0, 8.2, 12.05, arcStart, arcEnd, 0.14, 0.94, colors.porcelain);
  arcSlab(terminal, 0, 0, 11.76, 11.79, arcStart, arcEnd, 0.43, 0.46, colors.glass);
  arcSlab(terminal, 0, 0, 8.39, 8.43, arcStart, arcEnd, 0.42, 0.47, colors.glass);
  // Roof ribs and restrained skylights trace the terminal's distinctive arc.
  for (let i = 0; i < 18; i++) {
    const angle = lerp(arcStart + 0.045, arcEnd - 0.045, i / 17);
    const rib = box(terminal, Math.cos(angle) * 10.1, 1.045, Math.sin(angle) * 10.1, 3.77, 0.075, 0.08, colors.concrete);
    rib.rotation.y = -angle;
    if (i % 2 === 0) {
      arcSlab(terminal, 0, 0, 9.1, 10.95, angle + 0.025, angle + 0.095, 0.025, 1.032, colors.glass);
    }
  }
  // A quiet central entrance and courtyard keep the model architectural, not toy-like.
  box(terminal, 0, 0.51, 0.2, 9.0, 0.95, 3.1, colors.porcelain);
  box(terminal, 0, 1.05, 0.2, 9.3, 0.13, 3.35, colors.porcelain);
  box(terminal, 0, 0.51, -1.37, 8.5, 0.48, 0.032, colors.glass);
  box(terminal, 0, 0.18, 3.5, 1.3, 0.29, 4.0, colors.porcelain);
  marking(terminal, 'P A T H', 0, 1.133, 0.12, 4.8, 0.74, 0, '#234dbb');
  for (let i = 0; i < 12; i++) {
    const angle = lerp(0.17, Math.PI - 0.17, i / 11);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const bridge = box(terminal, cos * 12.65, 0.40, sin * 12.65, 1.62, 0.27, 0.29, colors.porcelain);
    bridge.rotation.y = -angle;
    const cabin = box(terminal, cos * 13.48, 0.40, sin * 13.48, 0.35, 0.31, 0.46, colors.glass);
    cabin.rotation.y = -angle;
    cylinder(terminal, cos * 12.75, 0.21, sin * 12.75, 0.055, 0.07, 0.35, colors.concrete, 8);
    const guide = paintedLine(cos * 15.2, sin * 15.2, 2.7, 0.033, colors.yellow, terminal);
    guide.rotation.y = -angle;
    marking(terminal, String(i + 1).padStart(2, '0'), cos * 13.97, 0.081, sin * 13.97, 0.56, 0.25, angle, '#52645e');
    gatePositions.push({ x: -7 + cos * 14.72, z: -15 + sin * 14.72, heading: Math.PI - angle });
  }
  const international = new THREE.Group();
  international.name = 'International concourse';
  international.position.set(12.8, 0.04, -13.6);
  airport.add(international);
  box(international, -5.6, 0.4, -1.65, 6.4, 0.7, 0.78, colors.porcelain);
  box(international, 0, 0.60, 0, 7.6, 1.1, 4.8, colors.porcelain);
  box(international, 0, 1.21, 0, 7.95, 0.16, 5.14, colors.porcelain);
  box(international, 0, 0.58, 2.42, 7.3, 0.55, 0.026, colors.glass);
  for (const x of [-2.5, 0, 2.5]) {
    box(international, x, 0.4, 3.15, 0.28, 0.28, 1.45, colors.porcelain);
    box(international, x, 0.4, 3.88, 0.62, 0.30, 0.3, colors.glass);
  }
  const tower = new THREE.Group();
  tower.name = 'Air traffic control';
  tower.position.set(23.0, 0.04, -10.5);
  airport.add(tower);
  roundedSlab(tower, 1.9, 1.85, 0.2, 0.22, colors.porcelain, 0.1);
  box(tower, 0, 1.05, 0, 0.46, 2.0, 0.50, colors.porcelain);
  box(tower, 0, 1.40, 0.267, 0.18, 0.53, 0.027, colors.blue);
  cylinder(tower, 0, 2.15, 0, 0.78, 0.53, 0.32, colors.porcelain, 8);
  cylinder(tower, 0, 2.46, 0, 0.64, 0.72, 0.30, colors.glass, 8);
  cylinder(tower, 0, 2.65, 0, 0.76, 0.76, 0.1, colors.porcelain, 8);
  cylinder(tower, 0.1, 2.91, 0, 0.023, 0.026, 0.44, colors.blueDark, 8);
  sphere(tower, 0.1, 3.14, 0, 0.05, 0.05, 0.05, colors.yellow);
  for (const x of [29.0, 38.0]) {
    box(airport, x, 0.64, -10.3, 7.2, 1.16, 5.1, colors.porcelain);
    box(airport, x, 1.3, -10.3, 7.45, 0.14, 5.35, colors.concrete);
    box(airport, x, 0.54, -7.72, 5.7, 0.81, 0.027, colors.glass);
  }
  box(airport, -2, 0.045, -20.8, 88, 0.03, 1.18, serviceRoad);
  for (let i = 0; i < 39; i++) paintedLine(-43 + i * 2.22, -20.8, 0.65, 0.04);
  for (const side of [-1, 1]) {
    const parkingX = -7 + side * 8.8;
    box(airport, parkingX, 0.044, -18.25, 7.5, 0.03, 3.3, serviceRoad);
    for (let i = 0; i < 11; i++) {
      const x = parkingX - 3.2 + i * 0.62;
      paintedLine(x, -18.1, 0.025, 1.3);
      if (i % 3 !== 1) box(airport, x + 0.25, 0.13, -18.07, 0.23, 0.13, 0.51, i % 3 ? colors.porcelain : colors.blue);
    }
  }
  for (const x of [-36, -29, -21, -14, -6, 2, 10, 18, 27, 36, 42]) {
    cylinder(airport, x, 0.25, -23.3, 0.039, 0.05, 0.44, colors.bark, 8);
    sphere(airport, x, 0.64, -23.3, 0.35, 0.43, 0.35, x % 2 ? colors.green : colors.greenLight);
  }
  for (const index of [2, 5, 8]) {
    const gate = gatePositions[index];
    box(airport, gate.x + 0.75, 0.17, gate.z - 0.75, 0.49, 0.22, 0.23, colors.porcelain);
    box(airport, gate.x + 0.75, 0.22, gate.z - 0.62, 0.31, 0.08, 0.013, colors.blueDark);
  }
  const aircraft = buildDreamliner({ own, materials: colors });
  const { group: plane, gear } = aircraft;
  scene.add(plane);
  const groundPlaneY = runwayTop + aircraft.groundClearance * groundAircraftScale;
  // Locate the aft wheel contact from the model itself. During the first part
  // of rotation the aircraft pivots here instead of floating above the runway
  // or sinking into it when the gear arrangement changes.
  const groundContactX = (() => {
    const vertex = new THREE.Vector3();
    let lowest = Infinity;
    let aftContact = 0;
    gear.updateMatrixWorld(true);
    gear.traverse((object) => {
      const positions = object.geometry?.attributes.position;
      if (!positions) return;
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
        if (vertex.y < lowest - 0.000001) {
          lowest = vertex.y;
          aftContact = vertex.x;
        } else if (Math.abs(vertex.y - lowest) < 0.000001) {
          aftContact = Math.min(aftContact, vertex.x);
        }
      }
    });
    return aftContact;
  })();
  const parkedAircraft = buildDreamliner({ own, materials: colors, detailed: false });
  for (const [index, gateIndex] of [0, 2, 4, 7, 9, 11].entries()) {
    const gate = gatePositions[gateIndex];
    const parked = index === 0 ? parkedAircraft.group : parkedAircraft.group.clone(true);
    parked.name = `Parked aircraft ${index + 1}`;
    parked.rotation.y = gate.heading;
    parked.scale.setScalar(groundAircraftScale);
    parked.position.set(gate.x, 0.062 + parkedAircraft.groundClearance * groundAircraftScale, gate.z);
    airport.add(parked);
  }
  // Clouds are small matte sculptural groups, never a backdrop that hides the model.
  const cloudMaterials = [];
  const clouds = [];
  for (let i = 0; i < 3; i++) {
    const cloudMaterial = material(0xffffff, { transparent: true, opacity: 0, depthWrite: false });
    cloudMaterials.push(cloudMaterial);
    const cloud = new THREE.Group();
    [[-0.57, 0, 0.42], [-0.18, 0.18, 0.56], [0.39, 0.06, 0.46], [0.7, -0.03, 0.27]].forEach(([x, y, size]) => {
      const puff = sphere(cloud, x, y, 0, size, size * 0.58, size * 0.65, cloudMaterial);
      puff.castShadow = false;
      puff.receiveShadow = false;
    });
    scene.add(cloud);
    clouds.push(cloud);
  }

  let width = 1;
  let height = 1;
  let mobile = false;
  let viewWidth = 1;
  let viewHeight = 15;
  let airportScale = 1;
  let airportInitialScale = 1;
  let lastMask = "";
  let targetProgress = 0;
  let progress = 0;
  let targetCloudScroll = 0;
  let cloudScroll = 0;
  let lastTime = 0;
  let frame = 0;
  let disposed = false;
  let ready = false;
  let departure = null;
  let flightMotion = null;
  let lastScrollInput = null;
  let reverseDistance = 0;
  let forwardDistance = 0;
  let scrollViewport = window.innerHeight;
  let lastStatus = '';
  const flightStatus = () => ({ mode: departure ? 'departing' : flightMotion?.mode ?? 'outbound', phase: flightMotion?.phase ?? (progress < 0.29 ? 'takeoff-roll' : 'climbing'), returnT: flightMotion?.t ?? 0 });
  const worldUp = new THREE.Vector3(0, 1, 0);
  const wheelBounds = new THREE.Box3();
  // THREE.slerp chooses the shortest hemisphere on every call. A moving
  // destination near 180 degrees can cross that boundary between frames.
  // Keep one quaternion hemisphere for the complete manoeuvre instead.
  function manoeuvreRotation(from, to, amount, motion) {
    if (!motion.rotationReference) {
      motion.rotationReference = to.clone();
      if (from.dot(to) < 0) motion.rotationReference.set(-to.x, -to.y, -to.z, -to.w);
    }
    const target = to.clone();
    if (target.dot(motion.rotationReference) < 0) target.set(-target.x, -target.y, -target.z, -target.w);
    const dot = clamp(from.dot(target), -1, 1);
    if (dot > 0.9995) return new THREE.Quaternion(
      lerp(from.x, target.x, amount), lerp(from.y, target.y, amount), lerp(from.z, target.z, amount), lerp(from.w, target.w, amount)).normalize();
    const angle = Math.acos(dot);
    const denominator = Math.max(0.00001, Math.sin(angle));
    const a = Math.sin((1 - amount) * angle) / denominator;
    const b = Math.sin(amount * angle) / denominator;
    return new THREE.Quaternion(from.x * a + target.x * b, from.y * a + target.y * b, from.z * a + target.z * b, from.w * a + target.w * b).normalize();
  }
  const snapshotPose = () => ({
    position: plane.position.clone(), quaternion: plane.quaternion.clone(), scale: plane.scale.x,
    airportPosition: airport.position.clone(), airportQuaternion: airport.quaternion.clone(), airportScale: airport.scale.x,
    airportVisible: airport.visible, gear: gear.visible ? gear.scale.y : 0,
    localPosition: plane.position.clone().sub(airport.position).applyQuaternion(airport.quaternion.clone().invert()).divideScalar(airport.scale.x)
  });

  function beginMotion(mode, scroll) {
    const anchor = snapshotPose();
    const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(anchor.quaternion);
    const yaw = Math.atan2(-forward.z, forward.x);
    const yawDelta = Math.atan2(Math.sin(Math.PI - yaw), Math.cos(Math.PI - yaw));
    const fromGround = !departure && anchor.gear > 0.98 && (flightMotion?.phase === 'landed' || flightMotion?.phase === 'rollout');
    flightMotion = { mode, anchor, startScroll: cloudScroll,
      range: mode === 'return' ? Math.max(0.0001, cloudScroll) : fromGround ? 1.4 : 0.65,
      fromGround, yaw, yawDelta, phase: mode === 'return' ? 'turning' : 'climbing', t: 0 };
    reverseDistance = forwardDistance = 0;
  }

  function observeScroll(value) {
    if (lastScrollInput !== null && !reducedMotion && !departure) {
      const delta = value - lastScrollInput;
      reverseDistance = delta < 0 ? reverseDistance - delta : delta > 0 ? 0 : reverseDistance;
      forwardDistance = delta > 0 ? forwardDistance + delta : delta < 0 ? 0 : forwardDistance;
      if (reverseDistance >= 0.09 && flightMotion?.mode !== 'return' && (progress > 0.38 || flightMotion?.mode === 'resume')) beginMotion('return', value);
      else if (forwardDistance >= 0.07 && flightMotion?.mode === 'return') beginMotion('resume', value);
    }
    lastScrollInput = value;
  }
  const point = new THREE.Vector3();
  const cruisePoint = new THREE.Vector3();
  const baseRotation = new THREE.Euler();
  const baseQuaternion = new THREE.Quaternion();
  const bankQuaternion = new THREE.Quaternion();
  const departureAxis = new THREE.Vector3(1, 0, 0);
  const screenPoint = (x, y, out = new THREE.Vector3()) => out.copy(right).multiplyScalar((x - 0.5) * viewWidth).addScaledVector(up, (0.5 - y) * viewHeight);
  const airportProjectedWidth = airportWidth * Math.abs(right.x) + airportDepth * Math.abs(right.z);
  // Measure actual vertices, rather than the rectangular bounds, for both
  // the runway close-up and the airborne silhouette. Zoom enlarges airport and
  // aircraft together until liftoff; the ground-scale relationship never changes.
  function projectedAircraftWidth(rotation, flex) {
    const vertex = new THREE.Vector3();
    let min = Infinity;
    let max = -Infinity;
    aircraft.setWingFlex(flex);
    plane.updateMatrixWorld(true);
    plane.traverse((object) => {
      const positions = object.geometry?.attributes.position;
      if (!positions || object.isInstancedMesh) return;
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).applyQuaternion(rotation);
        const x = vertex.dot(right);
        min = Math.min(min, x);
        max = Math.max(max, x);
      }
    });
    return max - min;
  }
  const planeGroundProjectedWidth = projectedAircraftWidth(new THREE.Quaternion(), 0);
  const planeProjectedWidth = projectedAircraftWidth(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.11, -0.16, 0.12, 'YXZ')), 1);
  aircraft.setWingFlex(0);
  const runwayFocus = new THREE.Vector3();

  function outboundLayout() {
    const tracking = smooth(0.34, 0.80, progress);
    const lift = smooth(0.29, 0.68, progress);
    const cruise = smooth(0.43, 0.80, progress);
    const closeup = smooth(0.36, 0.78, progress);
    const groundRetreat = smooth(0.31, 0.79, progress);
    const pullback = smooth(0.025, 0.46, progress);
    const releaseRunwayFocus = smooth(0.22, 0.47, progress);
    const desktopHeightMix = smooth(700, 900, height);
    const desktopCruiseY = lerp(0.86, 0.70, desktopHeightMix);
    const desktopCruiseWidth = lerp(0.22, 0.255, desktopHeightMix);
    const shrink = lerp(1, mobile ? 0.24 : 0.33, tracking);
    const worldScale = lerp(airportInitialScale, airportScale, pullback) * shrink;
    const stageX = lerp(mobile ? 0.52 : 0.755, mobile ? 0.11 : 0.135, tracking);
    const stageY = lerp(mobile ? 0.755 : 0.68, mobile ? 0.77 : 0.87, tracking);
    const taxi = smooth(0.025, 0.46, progress);
    const runwayX = lerp(takeoffStartX, takeoffEndX, taxi);
    airport.scale.setScalar(worldScale);
    airport.quaternion.identity();
    screenPoint(stageX, stageY, airport.position);
    runwayFocus.set(runwayX, groundPlaneY, runwayZ).multiplyScalar(worldScale * (1 - releaseRunwayFocus));
    airport.position.sub(runwayFocus);
    // The initial airfield crop stays behind the illustration area. The soft
    // edge opens as the heading scrolls away and the airport comes into view.
    const maskOpening = smooth(0.055, 0.34, progress);
    let mask = 'none';
    if (maskOpening < 0.999) {
      const edge = lerp(mobile ? 58 : 46, -18, maskOpening);
      const solid = edge + (mobile ? 8 : 9);
      mask = 'linear-gradient(to ' + (mobile ? 'bottom' : 'right') + ', transparent ' + edge.toFixed(2) + '%, #000 ' + solid.toFixed(2) + '%)';
    }
    if (mask !== lastMask) {
      canvas.style.maskImage = mask;
      canvas.style.webkitMaskImage = mask;
      lastMask = mask;
    }
    const pitch = smooth(0.27, 0.39, progress) * 0.23 - smooth(0.52, 0.8, progress) * 0.11;
    const gearPivot = (-groundContactX * Math.sin(pitch) + aircraft.groundClearance * (Math.cos(pitch) - 1)) * groundAircraftScale * (1 - lift);
    // Continue travelling along the runway heading after rotation. The camera
    // catches up gradually, instead of lifting the plane straight off one point.
    point.set(runwayX + lift * 32, groundPlaneY + gearPivot + lift * 14.0, runwayZ);
    point.multiplyScalar(worldScale).add(airport.position);
    screenPoint(mobile ? 0.5 : 0.255, mobile ? 0.255 : desktopCruiseY, cruisePoint);
    plane.position.copy(point).lerp(cruisePoint, cruise);
    const cruiseScale = (viewWidth * (mobile ? 0.64 : desktopCruiseWidth)) / planeProjectedWidth;
    plane.scale.setScalar(lerp(worldScale * groundAircraftScale, cruiseScale, closeup));
    baseRotation.set(-cruise * 0.11, -cruise * 0.16, pitch, 'YXZ');
    plane.quaternion.setFromEuler(baseRotation);
    // Once airborne, track the aircraft rather than keeping the airfield below
    // it. Apply this only after deriving its takeoff position, so the receding
    // ground cannot drag the aircraft down with it. The entire airfield passes
    // outside the frame before it is hidden; no shared material opacity changes.
    airport.position
      .addScaledVector(right, -viewWidth * 0.40 * groundRetreat)
      .addScaledVector(up, -viewHeight * 0.48 * groundRetreat)
      .addScaledVector(towardCamera, -8 * groundRetreat);
    airport.scale.setScalar(worldScale * lerp(1, 0.18, groundRetreat));
    airport.visible = progress < 0.82;
    gear.scale.y = 1 - smooth(0.35, 0.51, progress);
    gear.visible = progress < 0.51;
    aircraft.setWingFlex(lift);
    clouds.forEach((cloud, i) => {
      // Travel only within each cloud's existing safe pocket of air. Different
      // scroll speeds and phases give depth without drifting into the text.
      const phase = ((cloudScroll * [0.85, 1.08, 0.68][i] + [0.16, 0.49, 0.81][i]) % 1 + 1) % 1;
      const drift = reducedMotion ? 0 : 0.5 - phase;
      const edgeFade = reducedMotion ? 1 : smooth(0, 0.16, phase) * (1 - smooth(0.84, 1, phase));
      cloudMaterials[i].opacity = smooth(0.6, 0.78, progress) * edgeFade * 0.87;
      const x = mobile ? [0.16, 0.81, 0.69][i] : [0.07, 0.38, 0.32][i];
      const y = mobile ? [0.21, 0.32, 0.12][i] : desktopCruiseY + [-0.07, 0.09, -0.10][i];
      screenPoint(x + drift * (mobile ? 0.12 : 0.07), y + drift * 0.028 + (1 - cruise) * 0.14, cloud.position);
      cloud.position.addScaledVector(towardCamera, -4 - i);
      cloud.scale.setScalar(viewWidth * (mobile ? 0.105 : 0.055) * [0.8, 1, 0.64][i]);
      cloud.visible = progress > 0.58;
    });
  }

  function layout() {
    outboundLayout();
    if (!flightMotion || reducedMotion) return;
    const motion = flightMotion;
    const a = motion.anchor;
    const t = clamp((motion.mode === 'return' ? motion.startScroll - cloudScroll : cloudScroll - motion.startScroll) / motion.range, 0, 1);
    motion.t = t;
    // Keep the complete turn visible. The normal hero crop is restored only
    // after a new outbound flight has finished merging with its original path.
    canvas.style.maskImage = canvas.style.webkitMaskImage = 'none';
    lastMask = 'none';
    if (motion.mode === 'resume' && motion.fromGround) {
      const destination = snapshotPose();
      const join = smooth(0.72, 1, t);
      const localHeading = new THREE.Vector3(1, 0, 0).applyQuaternion(a.quaternion).applyQuaternion(a.airportQuaternion.clone().invert());
      localHeading.y = 0; localHeading.normalize();
      // Accelerate along the runway before rotation: about 20 local units of
      // ground roll, then continue beyond its end while the camera follows.
      const distance = 160 * t * t;
      const pitch = 0.20 * smooth(0.30, 0.44, t);
      const pivot = (-groundContactX * Math.sin(pitch) + aircraft.groundClearance * (Math.cos(pitch) - 1)) * groundAircraftScale;
      const altitude = 40 * smooth(0.36, 1, t);
      const localPlane = a.localPosition.clone().addScaledVector(localHeading, distance);
      localPlane.y = groundPlaneY + pivot + altitude;
      const scale = a.airportScale * lerp(1, 0.12, smooth(0.40, 0.86, t));
      const forward = localHeading.clone().applyQuaternion(a.airportQuaternion);
      const trackedPlane = a.position.clone().addScaledVector(forward, viewWidth * 0.10 * smooth(0, 0.60, t))
        .addScaledVector(up, viewHeight * 0.12 * smooth(0.36, 0.82, t));
      airport.position.copy(trackedPlane).sub(localPlane.clone().multiplyScalar(scale).applyQuaternion(a.airportQuaternion)).lerp(destination.airportPosition, join);
      airport.quaternion.copy(a.airportQuaternion).slerp(destination.airportQuaternion, join);
      airport.scale.setScalar(lerp(scale, destination.airportScale, join));
      airport.visible = a.airportVisible || destination.airportVisible;
      plane.position.copy(trackedPlane).lerp(destination.position, join);
      const takeoffRotation = a.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), pitch));
      // Positive world-Y yaw projects counterclockwise in this camera. Keep
      // that left-turn branch explicit; interpolate pitch/roll independently.
      const targetForward = new THREE.Vector3(1, 0, 0).applyQuaternion(destination.quaternion);
      const targetYaw = Math.atan2(-targetForward.z, targetForward.x);
      const leftYaw = ((targetYaw - motion.yaw) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const fromTilt = new THREE.Quaternion().setFromAxisAngle(worldUp, -motion.yaw).multiply(takeoffRotation);
      const toTilt = new THREE.Quaternion().setFromAxisAngle(worldUp, -targetYaw).multiply(destination.quaternion);
      plane.quaternion.setFromAxisAngle(worldUp, motion.yaw + leftYaw * join).multiply(fromTilt.slerp(toTilt, join));
      plane.scale.setScalar(lerp(a.scale, destination.scale, join));
      gear.scale.y = a.gear * (1 - smooth(0.43, 0.70, t));
      gear.visible = gear.scale.y > 0.01;
      aircraft.setWingFlex(smooth(0.33, 0.65, t));
      motion.phase = t < 0.30 ? 'takeoff-roll' : t < 0.40 ? 'rotation' : 'climbing';
      if (t < 0.65) {
        const edge = lerp(mobile ? 58 : 46, -18, smooth(0.30, 0.65, t));
        const mask = 'linear-gradient(to ' + (mobile ? 'bottom' : 'right') + ', transparent ' + edge.toFixed(2) + '%, #000 ' + (edge + (mobile ? 8 : 9)).toFixed(2) + '%)';
        canvas.style.maskImage = canvas.style.webkitMaskImage = mask;
        lastMask = mask;
      }
      if (t >= 1) flightMotion = null;
      return;
    }
    if (motion.mode === 'resume') {
      const blend = smooth(0, 1, t);
      const destination = plane.position.clone();
      const destinationRotation = plane.quaternion.clone();
      plane.position.copy(a.position).lerp(destination, blend)
        .addScaledVector(up, Math.sin(Math.PI * t) * viewHeight * 0.07);
      plane.quaternion.copy(manoeuvreRotation(a.quaternion, destinationRotation, blend, motion));
      plane.scale.setScalar(lerp(a.scale, plane.scale.x, blend));
      airport.position.lerp(a.airportPosition, 1 - blend);
      airport.quaternion.slerp(a.airportQuaternion, 1 - blend);
      airport.scale.setScalar(lerp(a.airportScale, airport.scale.x, blend));
      airport.visible = a.airportVisible || airport.visible;
      gear.scale.y = lerp(a.gear, gear.scale.y, smooth(0.15, 0.80, t));
      gear.visible = gear.scale.y > 0.01;
      motion.phase = 'climbing';
      if (t >= 1) flightMotion = null;
      return;
    }

    const turn = smooth(0, 0.34, t);
    const theta = turn * motion.yawDelta;
    const heading = new THREE.Vector3(1, 0, 0).applyQuaternion(a.quaternion);
    heading.y = 0; heading.normalize();
    const side = new THREE.Vector3().crossVectors(worldUp, heading).normalize();
    const radius = viewWidth * 0.045 * (Math.sign(motion.yawDelta) || 1);
    const turnPosition = a.position.clone().addScaledVector(heading, radius * Math.sin(theta))
      .addScaledVector(side, radius * (1 - Math.cos(theta)))
      .addScaledVector(up, viewHeight * 0.035 * Math.sin(turn * Math.PI));
    const approach = clamp((t - 0.34) / 0.50, 0, 1);
    const rollout = clamp((t - 0.84) / 0.16, 0, 1);
    const runwayX = 115 - 85 * approach - 12 * (1 - (1 - rollout) ** 2);
    const approachScale = Math.min(airportInitialScale, viewWidth * 0.55 / 100);
    const groundScale = t < 0.34 ? lerp(a.airportScale, approachScale, smooth(0, 0.34, t)) : lerp(approachScale, airportInitialScale, smooth(0.34, 0.88, t));
    const landingFrame = screenPoint(mobile ? 0.52 : 0.755, mobile ? 0.755 : 0.68);
    const pitch = 0.11 * (1 - smooth(0.70, 0.84, t));
    const pivot = (-groundContactX * Math.sin(pitch) + aircraft.groundClearance * (Math.cos(pitch) - 1)) * groundAircraftScale;
    const altitude = 32 * (1 - smooth(0.34, 0.82, t));
    const approachLocal = new THREE.Vector3(runwayX, groundPlaneY + pivot + altitude, runwayZ);
    const localPlane = a.localPosition.clone().lerp(approachLocal, smooth(0, 0.34, t));
    plane.position.copy(turnPosition).lerp(landingFrame, smooth(0.34, 0.82, t));
    airport.quaternion.copy(a.airportQuaternion).slerp(new THREE.Quaternion(), smooth(0, 0.34, t));
    airport.scale.setScalar(groundScale);
    // A single camera-tracking transform ties altitude and forward travel to
    // the runway. The threshold approaches from ahead instead of rising below.
    airport.position.copy(plane.position).sub(localPlane.multiplyScalar(groundScale).applyQuaternion(airport.quaternion));
    airport.visible = a.airportVisible || t > 0.02;
    const reverseHeading = new THREE.Quaternion().setFromAxisAngle(worldUp, motion.yaw + motion.yawDelta);
    reverseHeading.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), pitch));
    plane.quaternion.copy(manoeuvreRotation(a.quaternion, reverseHeading, turn, motion));
    plane.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(departureAxis, Math.sin(turn * Math.PI) * 0.48 * clamp(motion.yawDelta / Math.PI, -1, 1)));
    plane.scale.setScalar(lerp(a.scale, groundScale * groundAircraftScale, smooth(0.34, 0.82, t)));
    gear.scale.y = lerp(a.gear, 1, smooth(0.42, 0.75, t));
    gear.visible = gear.scale.y > 0.01;
    aircraft.setWingFlex(1 - smooth(0.70, 0.87, t));
    motion.phase = t < 0.34 ? 'turning' : t < 0.70 ? 'approach' : t < 0.84 ? 'landing' : t < 0.999 ? 'rollout' : 'landed';
    const maskReturn = smooth(0.88, 1, t);
    if (maskReturn > 0) {
      const edge = lerp(-18, mobile ? 58 : 46, maskReturn);
      const mask = 'linear-gradient(to ' + (mobile ? 'bottom' : 'right') + ', transparent ' + edge.toFixed(2) + '%, #000 ' + (edge + (mobile ? 8 : 9)).toFixed(2) + '%)';
      canvas.style.maskImage = canvas.style.webkitMaskImage = mask;
      lastMask = mask;
    }
  }

  function render(time) {
    frame = 0;
    if (disposed || document.hidden) return;
    const dt = Math.min(lastTime ? (time - lastTime) / 1000 : 1 / 60, 0.06);
    lastTime = time;
    if (!departure) {
      progress = reducedMotion ? targetProgress : lerp(progress, targetProgress, 1 - Math.exp(-dt * 8));
      if (Math.abs(targetProgress - progress) < 0.00008) progress = targetProgress;
      cloudScroll = reducedMotion ? targetCloudScroll : lerp(cloudScroll, targetCloudScroll, 1 - Math.exp(-dt * 8));
      if (Math.abs(targetCloudScroll - cloudScroll) < 0.00008) cloudScroll = targetCloudScroll;
      layout();
    } else {
      departure.elapsed += dt * 1000;
      const t = clamp(departure.elapsed / departure.duration, 0, 1);
      const travel = t * t * (0.65 + 0.35 * t);
      plane.position.copy(departure.position)
        .addScaledVector(departure.forward, viewWidth * (0.12 * t + travel * 1.15))
        .addScaledVector(up, viewHeight * (0.10 * t + travel * 0.80))
        .addScaledVector(towardCamera, travel * 5);
      plane.scale.setScalar(departure.scale * (1 + travel * 1.45));
      plane.quaternion.copy(departure.quaternion)
        .multiply(new THREE.Quaternion().setFromAxisAngle(worldUp, -departure.direction * smooth(0, 1, t) * 0.38))
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), smooth(0, 1, t) * 0.45));
      bankQuaternion.setFromAxisAngle(departureAxis, departure.direction * Math.sin(t * Math.PI) * 0.36);
      plane.quaternion.multiply(bankQuaternion);
      gear.scale.y = departure.gear * (1 - smooth(0.12, 0.65, t));
      gear.visible = gear.scale.y > 0.01;
      // Track the departing aircraft: the runway and terminal slip backwards,
      // descend, and recede together instead of remaining a static backdrop.
      airport.scale.setScalar(departure.airportScale * lerp(1, 0.14, smooth(0, 1, t)));
      airport.visible = departure.airportVisible;
      airport.quaternion.copy(departure.airportQuaternion);
      bankQuaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, -departure.direction * travel * 0.10);
      airport.quaternion.multiply(bankQuaternion);
      const localTravel = viewWidth / Math.max(0.001, departure.airportScale) * (0.12 * t + 0.90 * travel);
      const departingLocal = departure.localPosition.clone().addScaledVector(departure.localForward, localTravel)
        .addScaledVector(worldUp, viewHeight / Math.max(0.001, departure.airportScale) * travel * 0.35);
      if (departure.gear > 0.98 && gear.visible) {
        // The close-up scale and departure bank can lower a wheel relative to
        // the fuselage. Keep the tracked runway below that actual wheel bound.
        plane.updateMatrixWorld(true);
        wheelBounds.setFromObject(gear);
        const wheelOffset = plane.position.y - wheelBounds.min.y;
        departingLocal.y = Math.max(departingLocal.y, runwayTop + (wheelOffset + viewHeight * travel * 0.05) / airport.scale.x);
      }
      airport.position.copy(plane.position).sub(departingLocal.multiplyScalar(airport.scale.x).applyQuaternion(airport.quaternion));
      clouds.forEach((cloud, index) => {
        cloud.position.copy(departure.cloudPositions[index])
          .addScaledVector(right, -viewWidth * departure.direction * travel * 0.25)
          .addScaledVector(up, -viewHeight * travel * (0.18 + index * 0.035));
      });
      cloudMaterials.forEach((material, i) => { material.opacity = departure.cloudOpacities[i] * (1 - t); });
      if (t === 1) {
        const done = departure.resolve;
        departure.resolve = null;
        renderer.render(scene, camera);
        done?.();
        return;
      }
    }
    const status = flightStatus();
    const statusKey = status.mode + ':' + status.phase;
    if (statusKey !== lastStatus) { lastStatus = statusKey; onStateChange?.(status); }
    renderer.render(scene, camera);
    if (!ready) { ready = true; onReady?.(); }
    if (departure || Math.abs(targetProgress - progress) > 0.00008 || Math.abs(targetCloudScroll - cloudScroll) > 0.00008) requestFrame();
  }
  function requestFrame() {
    if (!frame && !disposed && !document.hidden) frame = requestAnimationFrame(render);
  }
  function resize() {
    if (disposed) return;
    const nextViewport = Math.max(1, window.innerHeight);
    if (nextViewport !== scrollViewport) {
      const ratio = scrollViewport / nextViewport;
      cloudScroll *= ratio;
      targetCloudScroll *= ratio;
      if (flightMotion) { flightMotion.startScroll *= ratio; flightMotion.range *= ratio; }
      scrollViewport = nextViewport;
    }
    lastScrollInput = null;
    reverseDistance = forwardDistance = 0;
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width || window.innerWidth);
    height = Math.max(1, rect.height || window.innerHeight);
    mobile = width < 760;
    viewHeight = mobile ? 16 : 15;
    viewWidth = viewHeight * width / height;
    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height, false);
    airportScale = viewWidth * (mobile ? 0.96 : 0.59) / airportProjectedWidth;
    // In CSS pixels, keep the grounded plane readable at both viewport classes.
    // This changes the entire airport's framing, not just the airplane's size.
    const initialPlanePixels = mobile ? Math.max(110, width * 0.29) : Math.max(128, width * 0.10);
    airportInitialScale = (initialPlanePixels / width) * viewWidth / (planeGroundProjectedWidth * groundAircraftScale);
    if (!departure) layout();
    requestFrame();
  }
  function visibilityChange() {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else {
      lastTime = 0;
      requestFrame();
    }
  }
  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(canvas);
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', visibilityChange);
  resize();

  return {
    setCloudScroll(value) {
      if (disposed || departure?.resolve) return;
      observeScroll(Number.isFinite(value) ? value : 0);
      targetCloudScroll = Number.isFinite(value) ? value : 0;
      requestFrame();
    },
    setProgress(value) {
      if (disposed || departure?.resolve) return;
      // A completed departure may return through the browser's back/forward cache.
      if (departure) departure = null;
      targetProgress = clamp(Number(value) || 0, 0, 1);
      requestFrame();
    },
    setReducedMotion(value) {
      reducedMotion = Boolean(value);
      if (reducedMotion) flightMotion = null;
      requestFrame();
    },
    cancelDeparture({ restore = false } = {}) {
      if (disposed || !departure) return;
      const done = departure.resolve;
      const previousMotion = departure.savedMotion;
      if (!restore) beginMotion('resume', cloudScroll);
      departure = null;
      if (restore) flightMotion = previousMotion;
      lastTime = 0;
      layout();
      requestFrame();
      done?.();
    },
    depart({ direction = 1, duration = 1400 } = {}) {
      if (disposed) return Promise.resolve();
      if (departure) return departure.promise;
      let resolve;
      const promise = new Promise((done) => { resolve = done; });
      departure = {
        position: plane.position.clone(), quaternion: plane.quaternion.clone(), scale: plane.scale.x,
        airportPosition: airport.position.clone(), airportQuaternion: airport.quaternion.clone(), airportScale: airport.scale.x,
        airportVisible: airport.visible,
        cloudPositions: clouds.map((cloud) => cloud.position.clone()),
        cloudOpacities: cloudMaterials.map((material) => material.opacity),
        forward: new THREE.Vector3(1, 0, 0).applyQuaternion(plane.quaternion).normalize(),
        localPosition: plane.position.clone().sub(airport.position).applyQuaternion(airport.quaternion.clone().invert()).divideScalar(airport.scale.x),
        localForward: new THREE.Vector3(1, 0, 0).applyQuaternion(plane.quaternion).applyQuaternion(airport.quaternion.clone().invert()).normalize(),
        gear: gear.visible ? gear.scale.y : 0, savedMotion: flightMotion,
        direction: clamp(Number(direction) || 0, -1, 1), duration: reducedMotion ? 120 : Math.max(240, duration),
        elapsed: 0, resolve, promise,
      };
      lastTime = 0;
      requestFrame();
      return promise;
    },
    resize,
    getFlightStatus: flightStatus,
    getFlightState() {
      scene.updateMatrixWorld(true);
      wheelBounds.setFromObject(gear);
      const runwayWorldY = airport.position.y + runwayTop * airport.scale.x;
      const clearance = wheelBounds.min.y - runwayWorldY;
      const localPosition = airport.worldToLocal(plane.position.clone());
      const localHeading = new THREE.Vector3(1, 0, 0).applyQuaternion(plane.quaternion).applyQuaternion(airport.quaternion.clone().invert()).normalize();
      const projected = (point) => { const p = point.project(camera); return [p.x, p.y]; };
      return {
        mode: departure ? 'departing' : flightMotion?.mode ?? 'outbound', phase: flightMotion?.phase ?? (progress < 0.29 ? 'takeoff-roll' : 'climbing'),
        progress, targetProgress, cloudScroll, targetCloudScroll, returnT: flightMotion?.t ?? 0,
        plane: { position: plane.position.toArray(), quaternion: plane.quaternion.toArray(), scale: plane.scale.x, airportLocalPosition: localPosition.toArray(), airportLocalHeading: localHeading.toArray() },
        airport: { position: airport.position.toArray(), quaternion: airport.quaternion.toArray(), scale: airport.scale.x, visible: airport.visible },
        gear: { visible: gear.visible, scaleY: gear.scale.y },
        ground: { contact: gear.visible && Math.abs(clearance) < 0.015, clearance, runwayWorldY, gearBottomWorldY: wheelBounds.min.y },
        screen: { plane: projected(plane.position.clone()), nose: projected(plane.localToWorld(new THREE.Vector3(3.14, 0, 0))), runwayThreshold: projected(airport.localToWorld(new THREE.Vector3(42, runwayTop, runwayZ))) },
        departure: departure ? { elapsed: departure.elapsed, duration: departure.duration } : null
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibilityChange);
      departure?.resolve?.();
      resources.forEach((resource) => resource.dispose());
      renderer.dispose();
      canvas.style.maskImage = '';
      canvas.style.webkitMaskImage = '';
    },
  };
}
