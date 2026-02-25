import type { Group, Vector3 } from 'three';
import { Color, InstancedMesh, Matrix4, Mesh } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

type PendingInstance = {
  position: Vector3;
  rotationY: number;
};

export class WorkbenchBatch {
  #pending: PendingInstance[] = [];
  #meshes: InstancedMesh[] = [];
  #count = 0;

  register(position: Vector3, rotationY: number): number {
    const index = this.#count++;
    this.#pending.push({ position: position.clone(), rotationY });
    return index;
  }

  build(group: Group, model: GLTF): void {
    const instanceCount = this.#pending.length;
    if (instanceCount === 0) return;

    model.scene.updateWorldMatrix(false, true);

    const subMeshes: Mesh[] = [];
    model.scene.traverse((child) => {
      if (child instanceof Mesh) subMeshes.push(child);
    });

    const mat = new Matrix4();

    for (const subMesh of subMeshes) {
      const geo = subMesh.geometry.clone();
      geo.applyMatrix4(subMesh.matrixWorld);

      const instancedMesh = new InstancedMesh(geo, subMesh.material, instanceCount);
      instancedMesh.castShadow = true;
      instancedMesh.receiveShadow = true;

      for (let i = 0; i < instanceCount; i++) {
        const { position, rotationY } = this.#pending[i]!;
        mat.makeRotationY(rotationY);
        mat.setPosition(position.x, position.y, position.z);
        instancedMesh.setMatrixAt(i, mat);
      }
      instancedMesh.instanceMatrix.needsUpdate = true;

      this.#meshes.push(instancedMesh);
      group.add(instancedMesh);
    }
  }

  setHighlight(instanceIndex: number, enabled: boolean): void {
    const color = enabled ? new Color(1.27, 1.27, 1.27) : new Color(1, 1, 1);
    for (const mesh of this.#meshes) {
      mesh.setColorAt(instanceIndex, color);
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const mesh of this.#meshes) {
      mesh.geometry.dispose();
      mesh.removeFromParent();
    }
    this.#meshes = [];
  }
}
