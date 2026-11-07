import type * as THREE from "three";
import { SushiSceneFrameGate } from "./sushi-scene-lifecycle";

export type SushiKind = "salmon" | "tuna" | "egg" | "shrimp" | "maki";
type RoundedBoxGeometryConstructor = new (width: number, height: number, depth: number, segments?: number, radius?: number) => THREE.BufferGeometry;
type Menu = { current: SushiKind; upcoming: SushiKind[]; questionKey: string };

export type SushiScene = {
  setMenu(menu: Menu): void;
  resize(): void;
  setHidden(hidden: boolean): void;
  setOffscreen(offscreen: boolean): void;
  setReducedMotion(reduced: boolean): void;
  dispose(): void;
};

export type SushiWorld = {
  root: THREE.Group;
  setMenu(menu: Menu): void;
  update(time: number): void;
  dispose(): void;
};

function disposeObject(object: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

/** Builds the one owned canvas used for every 3D sushi, plate and belt item. */
export function createSushiWorld(three: typeof import("three"), RoundedBoxGeometry: RoundedBoxGeometryConstructor, initialMenu: Menu): SushiWorld {
  const root = new three.Group();
  root.rotation.y = -0.08;
  const wood = new three.MeshStandardMaterial({ color: 0x9d5d35, roughness: 0.66 });
  const woodLight = new three.MeshStandardMaterial({ color: 0xd69d62, roughness: 0.76 });
  const belt = new three.MeshStandardMaterial({ color: 0x254d4a, roughness: 0.74 });
  const shadowMaterial = new three.MeshBasicMaterial({ color: 0x4a2417, transparent: true, opacity: 0.16, depthWrite: false });
  const boardGeometry = new RoundedBoxGeometry(8.4, 0.42, 3.45, 4, 0.15);
  const railGeometry = new RoundedBoxGeometry(8.25, 0.28, 0.25, 3, 0.08);
  const plankGeometry = new RoundedBoxGeometry(0.72, 0.13, 2.55, 2, 0.06);
  const board = new three.Mesh(boardGeometry, wood);
  board.position.y = -0.28;
  root.add(board);
  for (const z of [-1.42, 1.42]) {
    const rail = new three.Mesh(railGeometry, woodLight);
    rail.position.set(0, 0.06, z);
    root.add(rail);
  }
  const beltSlats: THREE.Mesh[] = [];
  for (let index = 0; index < 10; index += 1) {
    const slat = new three.Mesh(plankGeometry, belt);
    slat.position.set(-3.9 + index * 0.84, -0.01, 0);
    root.add(slat);
    beltSlats.push(slat);
  }

  const plateGeometry = new three.CylinderGeometry(0.9, 0.82, 0.14, 32);
  const rimGeometry = new three.TorusGeometry(0.68, 0.075, 10, 32);
  const shadowGeometry = new three.CircleGeometry(0.8, 28);
  const plateColors = [0xe7b849, 0xb8d8d3, 0xe4a4a5];
  const makePlate = (index: number) => {
    const group = new three.Group();
    const shadow = new three.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.18;
    shadow.scale.set(1.1, 0.8, 1);
    group.add(shadow);
    const plate = new three.Mesh(plateGeometry, new three.MeshStandardMaterial({ color: plateColors[index], roughness: 0.32, metalness: 0.04 }));
    group.add(plate);
    const rim = new three.Mesh(rimGeometry, new three.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.24 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.1;
    group.add(rim);
    const food = new three.Group();
    food.position.y = 0.15;
    group.add(food);
    root.add(group);
    return { group, food };
  };
  const plates = [makePlate(0), makePlate(1), makePlate(2)];
  const basePositions = [new three.Vector3(0, 0.2, 0.28), new three.Vector3(-2.55, -0.02, -0.25), new three.Vector3(2.48, -0.04, -0.5)];
  plates.forEach(({ group }, index) => { group.position.copy(basePositions[index]); group.scale.setScalar(index === 0 ? 1.16 : 0.73); });

  const box = (width: number, height: number, depth: number, color: number, roughness = 0.55) => new three.Mesh(new RoundedBoxGeometry(width, height, depth, 4, Math.min(width, height, depth) * 0.24), new three.MeshStandardMaterial({ color, roughness }));
  const sushi = (kind: SushiKind) => {
    const group = new three.Group();
    const rice = box(1.24, 0.44, 0.82, 0xfff7e7, 0.88);
    rice.position.y = 0.32;
    group.add(rice);
    if (kind === "maki") {
      group.remove(rice);
      rice.geometry.dispose();
      (rice.material as THREE.Material).dispose();
      const nori = new three.Mesh(new three.CylinderGeometry(0.47, 0.47, 0.58, 20), new three.MeshStandardMaterial({ color: 0x163c36, roughness: 0.75 }));
      nori.position.y = 0.3;
      group.add(nori);
      const inner = new three.Mesh(new three.CylinderGeometry(0.35, 0.35, 0.6, 20), new three.MeshStandardMaterial({ color: 0xfff8e7, roughness: 0.86 }));
      inner.position.y = 0.31;
      group.add(inner);
      const filling = new three.Mesh(new three.CylinderGeometry(0.16, 0.16, 0.61, 16), new three.MeshStandardMaterial({ color: 0xeb8253, roughness: 0.55 }));
      filling.position.y = 0.32;
      group.add(filling);
      return group;
    }
    if (kind === "shrimp") {
      const shrimp = new three.Mesh(new three.CapsuleGeometry(0.25, 0.9, 4, 12), new three.MeshStandardMaterial({ color: 0xf18b68, roughness: 0.52 }));
      shrimp.rotation.z = Math.PI / 2;
      shrimp.position.set(0, 0.67, 0);
      group.add(shrimp);
      const tail = new three.Mesh(new three.ConeGeometry(0.2, 0.45, 4), new three.MeshStandardMaterial({ color: 0xe65f55, roughness: 0.58 }));
      tail.rotation.z = -Math.PI / 2;
      tail.position.set(-0.73, 0.67, 0);
      group.add(tail);
      return group;
    }
    const fishColor = kind === "tuna" ? 0xbc3d41 : kind === "egg" ? 0xf1bb3b : 0xf47c62;
    const fish = box(1.32, kind === "egg" ? 0.38 : 0.27, 0.74, fishColor, 0.42);
    fish.position.y = 0.68;
    group.add(fish);
    if (kind === "egg") {
      const noriBand = box(0.19, 0.48, 0.89, 0x1d4841, 0.7);
      noriBand.position.y = 0.51;
      group.add(noriBand);
    } else {
      for (const x of [-0.36, 0, 0.36]) {
        const stripe = box(0.075, 0.025, 0.77, 0xffd0b2, 0.42);
        stripe.position.set(x, 0.83, 0);
        group.add(stripe);
      }
    }
    return group;
  };

  let lastQuestion = "";
  let transitionStarted = -Infinity;
  const setFood = (index: number, kind: SushiKind) => {
    const holder = plates[index].food;
    while (holder.children.length) {
      const child = holder.children.pop()!;
      disposeObject(child);
    }
    holder.add(sushi(kind));
  };
  const setMenu = (menu: Menu) => {
    if (menu.questionKey === lastQuestion) return;
    lastQuestion = menu.questionKey;
    setFood(0, menu.current);
    setFood(1, menu.upcoming[0] ?? "maki");
    setFood(2, menu.upcoming[1] ?? "salmon");
    transitionStarted = performance.now();
  };
  const update = (time: number) => {
    const progress = Math.max(0, 1 - (time - transitionStarted) / 480);
    plates.forEach(({ group }, index) => {
      group.position.copy(basePositions[index]);
      if (index === 0) group.position.y += Math.sin((1 - progress) * Math.PI) * 0.23;
      group.position.x += progress * (index === 0 ? -0.46 : 0.2);
      group.rotation.z = index === 0 ? Math.sin((1 - progress) * Math.PI) * 0.04 : 0;
    });
    beltSlats.forEach((slat, index) => { slat.position.x = -4.25 + ((index * 0.84 + time * 0.00042) % 8.4); });
  };
  setMenu(initialMenu);
  return {
    root,
    setMenu,
    update,
    dispose() { disposeObject(root); },
  };
}

/** Legacy leaf wrapper retained for isolated use; the game viewport owns the production renderer. */
export function createSushiScene(host: HTMLDivElement, three: typeof import("three"), RoundedBoxGeometry: RoundedBoxGeometryConstructor, initialMenu: Menu): SushiScene {
  const renderer = new three.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  const canvas = renderer.domElement;
  canvas.className = "sushi-lane-3d-canvas";
  canvas.setAttribute("aria-hidden", "true");
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  host.append(canvas);
  const scene = new three.Scene();
  const camera = new three.PerspectiveCamera(33, 1, 0.1, 30);
  camera.position.set(5.5, 4.1, 6.4);
  camera.lookAt(0, 0.4, 0);
  scene.add(new three.HemisphereLight(0xfff7df, 0x74462d, 2.7));
  const key = new three.DirectionalLight(0xffdfad, 3.2);
  key.position.set(-3, 6, 4);
  scene.add(key);
  const world = createSushiWorld(three, RoundedBoxGeometry, initialMenu);
  scene.add(world.root);
  const gate = new SushiSceneFrameGate();
  let disposed = false;
  const render = (time: number) => { if (!disposed && gate.shouldRender(time)) { world.update(time); renderer.render(scene, camera); } };
  const sync = () => renderer.setAnimationLoop(gate.animated ? render : null);
  const resize = () => { const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); gate.markDirty(); render(performance.now()); };
  resize(); sync();
  return {
    setMenu(menu) { world.setMenu(menu); gate.markDirty(); render(performance.now()); }, resize,
    setHidden(hidden) { gate.setHidden(hidden); sync(); if (!hidden) render(performance.now()); },
    setOffscreen(offscreen) { gate.setOffscreen(offscreen); sync(); if (!offscreen) render(performance.now()); },
    setReducedMotion(reduced) { gate.setReducedMotion(reduced); sync(); render(performance.now()); },
    dispose() { if (disposed) return; disposed = true; gate.dispose(); renderer.setAnimationLoop(null); world.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); },
  };
}
