import * as THREE from 'three';
import { loadPrefabModel } from '~/three/utils/prefabLoader';

// Shared materials cache - one material per unique color
const sharedMaterials = new Map<number, THREE.MeshStandardMaterial>();

function getOrCreateSharedMaterial(sourceColor: THREE.Color): THREE.MeshStandardMaterial {
  const colorKey = sourceColor.getHex();

  if (!sharedMaterials.has(colorKey)) {
    // Create material with original color from MTL file
    sharedMaterials.set(colorKey, new THREE.MeshStandardMaterial({
      color: sourceColor.clone(),
      roughness: 0.8,
      metalness: 0.2,
    }));
  }

  return sharedMaterials.get(colorKey)!;
}

/**
 * Creates a BLUE_WORK_ZONE prefab
 * Returns a THREE.Group containing the model
 */
export async function createBlueWorkZonePrefab(): Promise<THREE.Group> {
  const group = new THREE.Group();
  group.name = 'BLUE_WORK_ZONE_PREFAB';

  // Load the model using shared loader
  const model = await loadPrefabModel({
    objPath: '/experiments/blue-work-zone.obj',
    mtlPath: '/experiments/blue-work-zone.mtl',
    modelName: 'BLUE_WORK_ZONE',
    onMaterialSetup: (child) => {
      // Capture original color from MTL and create/reuse shared material
      const oldMaterial = Array.isArray(child.material) ? child.material[0] : child.material;
      child.material = getOrCreateSharedMaterial(oldMaterial.color);
    },
  });

  group.add(model);
  return group;
}
