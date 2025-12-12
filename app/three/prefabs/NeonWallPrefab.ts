import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';

/**
 * Creates a NEON_WALL prefab with attached spotlight
 * Returns a THREE.Group containing the model and light
 */
export async function createNeonWallPrefab(): Promise<THREE.Group> {
  const group = new THREE.Group();
  group.name = 'NEON_WALL_PREFAB';

  // Load the model (without transformations)
  const model = await loadNeonWallModel();

  // Apply rotations to the model
  model.rotation.order = 'XYZ';
  model.rotation.x = (-90 * Math.PI) / 180;
  model.rotation.y = 0;
  model.rotation.z = 0;

  // Calculate bounding box AFTER rotations to find the corner position
  model.updateMatrixWorld(true);
  const bboxRotated = new THREE.Box3().setFromObject(model);

  // Calculate bottom-right corner (maxX, minY, minZ) after rotation
  const bottomRightCorner = new THREE.Vector3(bboxRotated.max.x, bboxRotated.min.y, bboxRotated.min.z);

  // Position model so bottom-right corner is at origin (0, 0, 0)
  model.position.set(-bottomRightCorner.x, -bottomRightCorner.y, -bottomRightCorner.z);

  // Create and attach the spotlight to the model
  const spotlight = createNeonSpotlight();
  model.add(spotlight);
  model.add(spotlight.target); // Add target to the model so it moves with it

  group.add(model);

  return group;
}

/**
 * Loads the NEON_WALL OBJ model with materials
 */
async function loadNeonWallModel(): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    const mtlLoader = new MTLLoader();

    mtlLoader.load(
      '/experiments/neon-wall.mtl',
      (materials) => {
        materials.preload();

        const objLoader = new OBJLoader();
        objLoader.setMaterials(materials);

        objLoader.load(
          '/experiments/neon-wall.obj',
          (model) => {
            // Set the model name
            model.name = 'NEON_WALL';

            // Apply scale (already scaled in OBJ file)
            model.scale.setScalar(1.0);

            // Note: rotation and position are applied in createNeonWallPrefab()
            // after calculating the bounding box to align bottom-right corner at origin

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

                // Apply specific material settings for NEON_WALL meshes
                if (child.material instanceof THREE.MeshPhysicalMaterial) {
                  child.material.color.setHex(0xffdd1a);
                  child.material.roughness = 0.8;
                  child.material.metalness = 0.2;
                  child.material.transparent = false;
                  child.material.opacity = 1.0;
                  child.material.transmission = 0;
                  child.material.thickness = 0.5;
                  child.material.needsUpdate = true;
                  child.castShadow = true;

                  // Apply emissive to NEON_1 through NEON_5 meshes
                  if (child.name.match(/^NEON_[1-5]$/)) {
                    child.material.emissive.setHex(0xffdd1a); // Yellow neon color
                    child.material.emissiveIntensity = 25;
                  }

                  // Apply specific settings to GLASS mesh (only transparent mesh)
                  if (child.name === 'GLASS') {
                    child.material.color.setHex(0x8cff1a); // Green color
                    child.material.roughness = 0.34;
                    child.material.metalness = 0.64;
                    child.material.transparent = true;
                    child.material.opacity = 0.47;
                    child.material.transmission = 0.55;
                    child.material.thickness = 2.4;
                    child.material.emissive.setHex(0x3be846); // Green emissive
                    child.material.emissiveIntensity = 5.03;
                    child.castShadow = false; // Disable shadows for transparent mesh
                  }
                }
              }
            });

            resolve(model);
          },
          undefined,
          (error) => {
            console.error('Error loading NEON_WALL OBJ:', error);
            reject(error);
          }
        );
      },
      undefined,
      (error) => {
        console.error('Error loading NEON_WALL MTL:', error);
        reject(error);
      }
    );
  });
}

/**
 * Creates the spotlight for the neon wall
 * Position and direction are relative to the model origin
 */
function createNeonSpotlight(): THREE.SpotLight {
  const spotlight = new THREE.SpotLight('#fbff00', 3.0); // Yellow light

  // Position relative to model center (scaled uniformly by 3)
  spotlight.position.set(0.69, -0.72, 4.05);

  // Calculate target position from direction (scaled by 3)
  const lightDirection = new THREE.Vector3(0, -0.5, -0.7).normalize();
  const targetDistance = 10; // Distance for target
  spotlight.target.position.copy(spotlight.position).add(lightDirection.multiplyScalar(targetDistance));

  spotlight.angle = (53.3 * Math.PI) / 180; // Angle in radians (53.3 degrees)
  spotlight.penumbra = 0.26;
  spotlight.decay = 1; // Less aggressive light falloff
  spotlight.distance = 10.0; // Distance limit
  spotlight.castShadow = true;
  spotlight.shadow.camera.near = 1;
  spotlight.shadow.camera.far = 50;
  spotlight.shadow.camera.fov = 60;
  spotlight.shadow.mapSize.set(2048, 2048);
  spotlight.shadow.bias = -0.0001;

  return spotlight;
}
