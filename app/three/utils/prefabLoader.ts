import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';

export interface PrefabLoaderConfig {
  objPath: string;
  mtlPath: string;
  modelName: string;
  applyRotation?: boolean;
  onMaterialSetup?: (child: THREE.Mesh, color?: string) => void;
}

/**
 * Loads an OBJ model with MTL materials and applies standard transformations
 * All models are rotated and positioned so their bottom-right corner is at origin (0,0,0)
 */
export async function loadPrefabModel(config: PrefabLoaderConfig): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    const mtlLoader = new MTLLoader();

    mtlLoader.load(
      config.mtlPath,
      (materials) => {
        materials.preload();

        const objLoader = new OBJLoader();
        objLoader.setMaterials(materials);

        objLoader.load(
          config.objPath,
          (model) => {
            model.name = config.modelName;
            model.scale.setScalar(1.0);

            // Apply standard rotations if requested (default: true)
            if (config.applyRotation !== false) {
              model.rotation.order = 'XYZ';
              model.rotation.x = (270 * Math.PI) / 180;
              model.rotation.y = (360 * Math.PI) / 180;
              model.rotation.z = (90 * Math.PI) / 180;
            }

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

                // Call custom material setup callback if provided
                if (config.onMaterialSetup) {
                  config.onMaterialSetup(child);
                }
              }
            });

            resolve(model);
          },
          undefined,
          (error) => {
            console.error(`Error loading ${config.modelName} OBJ:`, error);
            reject(error);
          }
        );
      },
      undefined,
      (error) => {
        console.error(`Error loading ${config.modelName} MTL:`, error);
        reject(error);
      }
    );
  });
}
