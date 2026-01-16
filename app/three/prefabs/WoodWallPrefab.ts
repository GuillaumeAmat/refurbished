import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Creates a WOOD_WALL prefab
 * Returns a THREE.Group containing the model
 */
export async function createWoodWallPrefab(): Promise<THREE.Group> {
  const group = new THREE.Group();
  group.name = 'WOOD_WALL_PREFAB';

  // Load the GLB model
  const loader = new GLTFLoader();

  return new Promise((resolve, reject) => {
    loader.load(
      '/experiments/wood-wall.glb',
      (gltf) => {
        const model = gltf.scene;
        model.name = 'WOOD_WALL';

        // Calculate bounding box
        model.updateMatrixWorld(true);
        const bbox = new THREE.Box3().setFromObject(model);

        // Position model so bottom-right corner is at origin (0, 0, 0)
        const bottomRightCorner = new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.min.z);
        model.position.set(-bottomRightCorner.x, -bottomRightCorner.y, -bottomRightCorner.z);

        // Configure shadows for all meshes
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        group.add(model);
        resolve(group);
      },
      undefined,
      (error) => {
        console.error('Error loading WOOD_WALL GLB:', error);
        reject(error);
      }
    );
  });
}
