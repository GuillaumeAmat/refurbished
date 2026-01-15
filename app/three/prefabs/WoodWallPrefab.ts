import * as THREE from 'three';

import { loadPrefabModel } from '~/three/utils/prefabLoader';

// Shared wood material (cartoon-style)
let sharedWoodMaterial: THREE.MeshToonMaterial | null = null;

function getOrCreateWoodMaterial(): THREE.MeshToonMaterial {
  if (!sharedWoodMaterial) {
    sharedWoodMaterial = new THREE.MeshToonMaterial({
      color: 0xdeb887, // Warm wood color (burlywood)
    });
  }

  return sharedWoodMaterial;
}

/**
 * Creates a WOOD_WALL prefab
 * Returns a THREE.Group containing the model
 */
export async function createWoodWallPrefab(): Promise<THREE.Group> {
  const group = new THREE.Group();
  group.name = 'WOOD_WALL_PREFAB';

  // Get simple wood material
  const woodMaterial = getOrCreateWoodMaterial();

  // Load the model using shared loader
  const model = await loadPrefabModel({
    objPath: '/experiments/wood-wall.obj',
    mtlPath: '/experiments/wood-wall.mtl',
    modelName: 'WOOD_WALL',
    onMaterialSetup: (child) => {
      // Apply shared wood material
      child.material = woodMaterial;
    },
  });

  // Double-check: traverse again and force material application
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.material = woodMaterial;
      child.material.needsUpdate = true;
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  group.add(model);
  return group;
}
