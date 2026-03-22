import { Mesh, type Object3D } from 'three';

/**
 * Traverse an Object3D tree, dispose every geometry and material found,
 * then detach the root from its parent.
 */
export function disposeObject3D(root: Object3D): void {
  root.traverse((child) => {
    if (child instanceof Mesh) {
      child.geometry?.dispose();
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) mat?.dispose();
    }
  });
  root.removeFromParent();
}
