import { DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';

import { createTextTexture, type TextTextureOptions } from './createTextTexture';

export interface TextPlaneOptions extends Omit<TextTextureOptions, 'text'> {
  height: number;
}

export interface TextPlaneResult {
  mesh: Mesh;
  width: number;
  updateText: (newText: string) => void;
  dispose: () => void;
}

export function createTextPlane(text: string, options: TextPlaneOptions): TextPlaneResult {
  const { height, ...textureOptions } = options;

  let currentTexture = createTextTexture({ text, ...textureOptions });
  let currentWidth = height * currentTexture.aspectRatio;
  let currentGeometry = new PlaneGeometry(currentWidth, height);

  const material = new MeshBasicMaterial({
    map: currentTexture.texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
  });

  const mesh = new Mesh(currentGeometry, material);
  mesh.renderOrder = 999;

  const updateText = (newText: string) => {
    currentTexture.texture.dispose();
    currentTexture = createTextTexture({ text: newText, ...textureOptions });

    const newWidth = height * currentTexture.aspectRatio;
    if (newWidth !== currentWidth) {
      currentWidth = newWidth;
      currentGeometry.dispose();
      currentGeometry = new PlaneGeometry(currentWidth, height);
      mesh.geometry = currentGeometry;
    }

    material.map = currentTexture.texture;
    material.needsUpdate = true;
  };

  const dispose = () => {
    currentTexture.texture.dispose();
    currentGeometry.dispose();
    material.dispose();
  };

  return {
    mesh,
    get width() {
      return currentWidth;
    },
    updateText,
    dispose,
  };
}
