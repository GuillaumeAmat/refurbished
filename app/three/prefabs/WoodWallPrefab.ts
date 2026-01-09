import * as THREE from 'three';
import { loadPrefabModel } from '~/three/utils/prefabLoader';

// Shared materials cache - one material per unique color
const sharedMaterials = new Map<number, THREE.MeshStandardMaterial>();

function getOrCreateSharedMaterial(sourceColor: THREE.Color): THREE.MeshStandardMaterial {
  const colorKey = sourceColor.getHex();

  if (!sharedMaterials.has(colorKey)) {
    // Create material with lightened color from MTL file
    const lightenedColor = sourceColor.clone();
    lightenedColor.multiplyScalar(1.4); // Lighten by 40%

    sharedMaterials.set(colorKey, new THREE.MeshStandardMaterial({
      color: lightenedColor,
      roughness: 0.8,
      metalness: 0.2,
    }));
  }

  return sharedMaterials.get(colorKey)!;
}

/**
 * Creates a WOOD_WALL prefab
 * Returns a THREE.Group containing the model
 */
export async function createWoodWallPrefab(): Promise<THREE.Group> {
  const group = new THREE.Group();
  group.name = 'WOOD_WALL_PREFAB';

  // Load the model using shared loader
  const model = await loadPrefabModel({
    objPath: '/experiments/wood-wall.obj',
    mtlPath: '/experiments/wood-wall.mtl',
    modelName: 'WOOD_WALL',
    onMaterialSetup: (child) => {
      // Capture original color from MTL and create/reuse shared material
      const oldMaterial = Array.isArray(child.material) ? child.material[0] : child.material;
      child.material = getOrCreateSharedMaterial(oldMaterial.color);
    },
  });

  group.add(model);
  return group;
}
