import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';

/**
 * Creates a WORKBENCH prefab
 * Returns a THREE.Group containing the model
 */
export async function createWorkbenchPrefab(): Promise<THREE.Group> {
  const group = new THREE.Group();
  group.name = 'WORKBENCH_PREFAB';

  // Load the model
  const model = await loadWorkbenchModel();
  group.add(model);

  return group;
}

/**
 * Loads the WORKBENCH OBJ model with materials
 */
async function loadWorkbenchModel(): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    const mtlLoader = new MTLLoader();

    mtlLoader.load(
      '/experiments/plan-de-travail.mtl',
      (materials) => {
        materials.preload();

        const objLoader = new OBJLoader();
        objLoader.setMaterials(materials);

        objLoader.load(
          '/experiments/plan-de-travail.obj',
          (model) => {
            // Set the model name
            model.name = 'WORKBENCH';

            // Apply scale (already scaled in OBJ file)
            model.scale.setScalar(1.0);

            // Apply rotations (convert degrees to radians) FIRST
            model.rotation.order = 'XYZ';
            model.rotation.x = (270 * Math.PI) / 180;
            model.rotation.y = (360 * Math.PI) / 180;
            model.rotation.z = (90 * Math.PI) / 180;

            // Calculate bounding box AFTER rotations
            model.updateMatrixWorld(true);
            const bbox = new THREE.Box3().setFromObject(model);

            // Calculate bottom-right corner (maxX, minY, minZ) after rotation
            const bottomRightCorner = new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.min.z);

            // Position model so bottom-right corner is at origin (0, 0, 0)
            model.position.set(-bottomRightCorner.x, -bottomRightCorner.y, -bottomRightCorner.z);

            // Configure materials for all meshes
            model.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;

                // Convert material to MeshPhysicalMaterial if it isn't already
                if (!(child.material instanceof THREE.MeshPhysicalMaterial)) {
                  const oldMaterial = Array.isArray(child.material) ? child.material[0] : child.material;
                  const newMaterial = new THREE.MeshPhysicalMaterial({
                    color: oldMaterial.color,
                    map: oldMaterial.map,
                    roughness: 0.8,
                    metalness: 0.2,
                    transmission: 0,
                    thickness: 0.5,
                  });
                  child.material = newMaterial;
                  if (oldMaterial.map) newMaterial.needsUpdate = true;
                }

                // Apply specific settings to TOP mesh
                if (child.name === 'TOP' && child.material instanceof THREE.MeshPhysicalMaterial) {
                  child.material.color.setHex(0xfafafa); // White color
                  child.material.roughness = 1.0;
                  child.material.metalness = 0.08;
                  child.material.transparent = false;
                  child.material.opacity = 1.0;
                  child.material.emissive.setHex(0x000000); // No emissive
                  child.material.emissiveIntensity = 0;
                  child.material.needsUpdate = true;
                }
              }
            });

            resolve(model);
          },
          undefined,
          (error) => {
            console.error('Error loading WORKBENCH OBJ:', error);
            reject(error);
          }
        );
      },
      undefined,
      (error) => {
        console.error('Error loading WORKBENCH MTL:', error);
        reject(error);
      }
    );
  });
}
