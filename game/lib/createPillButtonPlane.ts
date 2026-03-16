import { DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';

import {
  createPillButtonTexture,
  type ButtonSegment,
  type PillButtonTextureOptions,
} from './createPillButtonTexture';

export interface PillButtonPlaneOptions extends Omit<PillButtonTextureOptions, 'text' | 'segments'> {
  height: number;
}

export interface PillButtonPlaneResult {
  mesh: Mesh;
  width: number;
  updateState: (active: boolean) => void;
  dispose: () => void;
}

export function createPillButtonPlane(
  label: string | ButtonSegment[],
  options: PillButtonPlaneOptions,
): PillButtonPlaneResult {
  const { height, ...textureOptions } = options;
  const text = typeof label === 'string' ? label : '';
  const segments = Array.isArray(label) ? label : undefined;

  let currentResult = createPillButtonTexture({ text, segments, ...textureOptions });
  let currentWidth = height * currentResult.aspectRatio;
  let geometry = new PlaneGeometry(currentWidth, height);

  const material = new MeshBasicMaterial({
    map: currentResult.texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
  });

  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = 999;

  const updateState = (active: boolean) => {
    currentResult.texture.dispose();
    geometry.dispose();

    currentResult = createPillButtonTexture({
      text,
      segments,
      ...textureOptions,
      transparent: !active,
    });
    currentWidth = height * currentResult.aspectRatio;
    geometry = new PlaneGeometry(currentWidth, height);

    material.map = currentResult.texture;
    material.needsUpdate = true;
    mesh.geometry = geometry;
  };

  const dispose = () => {
    currentResult.texture.dispose();
    geometry.dispose();
    material.dispose();
  };

  return {
    mesh,
    get width() {
      return currentWidth;
    },
    updateState,
    dispose,
  };
}
