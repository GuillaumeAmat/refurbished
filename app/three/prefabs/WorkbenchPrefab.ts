import * as THREE from 'three';
import { loadPrefabModel } from '~/three/utils/prefabLoader';

// Shared materials cache - one material per unique color
const sharedMaterials = new Map<number, THREE.MeshStandardMaterial>();

// Special material for TOP mesh (white color with specific properties)
let topMaterial: THREE.MeshStandardMaterial | null = null;

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

function getOrCreateTopMaterial(): THREE.MeshStandardMaterial {
  if (!topMaterial) {
    // TOP mesh gets specific white color and material properties
    topMaterial = new THREE.MeshStandardMaterial({
      color: 0xfafafa,
      roughness: 1.0,
      metalness: 0.08,
    });
  }
  return topMaterial;
}

/**
 * Creates a WORKBENCH prefab
 * Returns a THREE.Group containing the model
 */
export async function createWorkbenchPrefab(): Promise<THREE.Group> {
  const group = new THREE.Group();
  group.name = 'WORKBENCH_PREFAB';

  // Load the model using shared loader
  const model = await loadPrefabModel({
    objPath: '/experiments/plan-de-travail.obj',
    mtlPath: '/experiments/plan-de-travail.mtl',
    modelName: 'WORKBENCH',
    onMaterialSetup: (child) => {
      // Capture original color from MTL and create/reuse shared materials
      const oldMaterial = Array.isArray(child.material) ? child.material[0] : child.material;
      if (child.name === 'TOP') {
        // TOP mesh gets special white material
        child.material = getOrCreateTopMaterial();
      } else {
        // All other meshes get material based on their original color
        child.material = getOrCreateSharedMaterial(oldMaterial.color);
      }
    },
  });

  group.add(model);
  return group;
}
