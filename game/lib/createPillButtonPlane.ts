import { DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';

import { createPillButtonTexture, type PillButtonTextureOptions } from './createPillButtonTexture';

export interface PillButtonPlaneOptions extends Omit<PillButtonTextureOptions, 'text'> {
  height: number;
}

export interface PillButtonPlaneResult {
  mesh: Mesh;
  width: number;
  dispose: () => void;
}

export function createPillButtonPlane(
  text: string,
  options: PillButtonPlaneOptions,
): PillButtonPlaneResult {
  const { height, ...textureOptions } = options;

  const result = createPillButtonTexture({ text, ...textureOptions });
  const planeWidth = height * result.aspectRatio;
  const geometry = new PlaneGeometry(planeWidth, height);

  const material = new MeshBasicMaterial({
    map: result.texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
  });

  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = 999;

  const dispose = () => {
    result.texture.dispose();
    geometry.dispose();
    material.dispose();
  };

  return {
    mesh,
    get width() {
      return planeWidth;
    },
    dispose,
  };
}
