import type { PerspectiveCamera, Texture } from 'three';
import { Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Vector3 } from 'three';

const _worldPos = new Vector3();
const REFERENCE_DIST = 10;

export interface IconPlaneResult {
  mesh: Mesh;
  dispose: () => void;
}

export function createIconPlane(texture: Texture, size: number): IconPlaneResult {
  texture.colorSpace = SRGBColorSpace;

  const geometry = new PlaneGeometry(size, size);
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = 999;

  mesh.onBeforeRender = (_, __, camera) => {
    mesh.quaternion.copy(camera.quaternion);
    mesh.getWorldPosition(_worldPos);
    const dist = _worldPos.distanceTo((camera as PerspectiveCamera).position);
    mesh.scale.setScalar(dist / REFERENCE_DIST);
  };

  const dispose = () => {
    geometry.dispose();
    material.dispose();
  };

  return { mesh, dispose };
}
