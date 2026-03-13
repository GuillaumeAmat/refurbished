import { DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';

import { createRichTextTexture, type RichTextSegment, type RichTextTextureOptions } from './createRichTextTexture';

export interface RichTextPlaneOptions extends Omit<RichTextTextureOptions, 'segments'> {
  height: number;
}

export interface RichTextPlaneResult {
  mesh: Mesh;
  width: number;
  dispose: () => void;
}

export function createRichTextPlane(
  segments: RichTextSegment[],
  options: RichTextPlaneOptions,
): RichTextPlaneResult {
  const { height, ...textureOptions } = options;

  const result = createRichTextTexture({ segments, ...textureOptions });
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
