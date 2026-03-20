import type { PerspectiveCamera } from 'three';
import {
  CanvasTexture,
  Group,
  LinearMipmapNearestFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three';

import { OVERLAY_LAYER } from '../constants';
import type { OnboardingIconType } from '../types';
import { Resources } from '../util/Resources';

const ICON_Y = 0.4;
const ARROW_BASE_Y = 0.2;
const AMP = 0.15;
const REFERENCE_DIST = 10;
const CANVAS_SIZE = 256;

// Module-level scratch vectors — safe because onBeforeRender runs sequentially
const _groupPos = new Vector3();
const _toGroup = new Vector3();
const _cameraUp = new Vector3();
const _cameraDir = new Vector3();
const _screenPos = new Vector3();

const BUTTON_BG_COLORS: Record<'button-a' | 'button-x', string> = {
  'button-a': '#107C10',
  'button-x': '#0078D4',
};

const PNG_KEY_MAP: Partial<Record<OnboardingIconType, string>> = {
  batteryBroken: 'batteryEmptyIcon',
  batteryRepaired: 'batteryFilledIcon',
  frameBroken: 'frameBrokenIcon',
  frameRepaired: 'frameRepairedIcon',
  screenBroken: 'screenBrokenIcon',
  screenRepaired: 'screenRepairedIcon',
  phone: 'phoneIcon',
  packageOpen: 'packageOpenIcon',
  packageClosed: 'packageClosedIcon',
};

// Both meshes anchor to the group's world position and offset along the camera's
// up axis by `yScreenOffset` (world units at REFERENCE_DIST). This guarantees they
// always share the same projected screen X regardless of camera angle or depth.
function makeBillboard(
  canvasTexture: CanvasTexture,
  size: number,
  group: Group,
  yScreenOffset: number,
): { mesh: Mesh; geometry: PlaneGeometry; material: MeshBasicMaterial } {
  canvasTexture.colorSpace = SRGBColorSpace;
  canvasTexture.minFilter = LinearMipmapNearestFilter;

  const geometry = new PlaneGeometry(size, size);
  const material = new MeshBasicMaterial({
    map: canvasTexture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = 999;
  mesh.layers.enable(OVERLAY_LAYER);

  mesh.onBeforeRender = (_, __, camera) => {
    const cam = camera as PerspectiveCamera;
    cam.getWorldDirection(_cameraDir);

    group.getWorldPosition(_groupPos);
    _toGroup.subVectors(_groupPos, cam.position);
    const depth = _toGroup.dot(_cameraDir);
    const scale = depth / REFERENCE_DIST;

    _cameraUp.setFromMatrixColumn(cam.matrixWorld, 1);
    _screenPos.copy(_groupPos).addScaledVector(_cameraUp, yScreenOffset * scale);
    if (mesh.parent) mesh.parent.worldToLocal(_screenPos);
    mesh.position.copy(_screenPos);

    mesh.quaternion.copy(cam.quaternion);
    mesh.scale.setScalar(scale);
  };

  return { mesh, geometry, material };
}

function buildIconCanvas(iconType: OnboardingIconType): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext('2d')!;
  const half = CANVAS_SIZE / 2;

  if (iconType === 'button-a' || iconType === 'button-x') {
    ctx.beginPath();
    ctx.arc(half, half, half - 4, 0, Math.PI * 2);
    ctx.fillStyle = BUTTON_BG_COLORS[iconType];
    ctx.fill();
    const letter = iconType === 'button-a' ? 'A' : 'X';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(CANVAS_SIZE * 0.55)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, half, half + CANVAS_SIZE * 0.04);
  } else {
    const key = PNG_KEY_MAP[iconType];
    if (key) {
      const texture = Resources.getInstance().getTextureAsset(key);
      if (texture?.source?.data) {
        ctx.drawImage(texture.source.data as CanvasImageSource, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      }
    }
  }

  return canvas;
}

function buildArrowCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext('2d')!;
  const half = CANVAS_SIZE / 2;

  ctx.beginPath();
  ctx.moveTo(half * 0.45, half * 0.05);
  ctx.lineTo(half * 1.55, half * 0.05);
  ctx.lineTo(half, half * 1.95);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  return canvas;
}

export class OnboardingMarker {
  #group: Group;
  #baseY: number;
  #iconGeometry: PlaneGeometry;
  #iconMaterial: MeshBasicMaterial;
  #iconTexture: CanvasTexture;
  #arrowGeometry: PlaneGeometry;
  #arrowMaterial: MeshBasicMaterial;
  #arrowTexture: CanvasTexture;
  #elapsed = 0;

  constructor(parent: Group, x: number, y: number, z: number, iconType: OnboardingIconType) {
    this.#baseY = y;
    this.#group = new Group();
    this.#group.position.set(x, y, z);
    parent.add(this.#group);

    this.#iconTexture = new CanvasTexture(buildIconCanvas(iconType));
    const icon = makeBillboard(this.#iconTexture, 0.21, this.#group, ICON_Y);
    this.#iconGeometry = icon.geometry;
    this.#iconMaterial = icon.material;
    this.#group.add(icon.mesh);

    this.#arrowTexture = new CanvasTexture(buildArrowCanvas());
    const arrow = makeBillboard(this.#arrowTexture, 0.14, this.#group, ARROW_BASE_Y);
    this.#arrowGeometry = arrow.geometry;
    this.#arrowMaterial = arrow.material;
    this.#group.add(arrow.mesh);
  }

  update(deltaMs: number): void {
    this.#elapsed += deltaMs;
    const t = (this.#elapsed % 1000) / 1000;
    const tri = t < 0.5 ? t * 2 : 2 - t * 2;
    const eased = tri * tri * (3 - 2 * tri); // smoothstep
    this.#group.position.y = this.#baseY - eased * AMP;
  }

  dispose(): void {
    this.#group.removeFromParent();
    this.#iconGeometry.dispose();
    this.#iconMaterial.dispose();
    this.#iconTexture.dispose();
    this.#arrowGeometry.dispose();
    this.#arrowMaterial.dispose();
    this.#arrowTexture.dispose();
  }
}
