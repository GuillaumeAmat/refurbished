import type { PerspectiveCamera, Texture } from 'three';
import { LinearMipmapNearestFilter, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Vector3 } from 'three';

const _worldPos = new Vector3();
const _cameraUp = new Vector3();
const _iconPos = new Vector3();
const _toIcon = new Vector3();
const _cameraDir = new Vector3();
const REFERENCE_DIST = 10;
const SCREEN_UP_OFFSET = 1.8;

export interface IconPlaneResult {
  mesh: Mesh;
  dispose: () => void;
}

export function createIconPlane(texture: Texture, size: number, anchor?: Vector3): IconPlaneResult {
  texture.colorSpace = SRGBColorSpace;
  // Avoid trilinear mipmap blending, which blurs at mid-range distances
  texture.minFilter = LinearMipmapNearestFilter;

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
    if (anchor) {
      _cameraUp.setFromMatrixColumn((camera as PerspectiveCamera).matrixWorld, 1);
      _iconPos.copy(anchor).addScaledVector(_cameraUp, SCREEN_UP_OFFSET);
      if (mesh.parent) mesh.parent.worldToLocal(_iconPos);
      mesh.position.copy(_iconPos);
    }
    mesh.quaternion.copy(camera.quaternion);
    mesh.getWorldPosition(_worldPos);
    (camera as PerspectiveCamera).getWorldDirection(_cameraDir);
    _toIcon.subVectors(_worldPos, (camera as PerspectiveCamera).position);
    const depth = _toIcon.dot(_cameraDir);
    mesh.scale.setScalar(depth / REFERENCE_DIST);
  };

  const dispose = () => {
    geometry.dispose();
    material.dispose();
  };

  return { mesh, dispose };
}
