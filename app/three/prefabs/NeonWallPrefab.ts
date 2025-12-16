import * as THREE from 'three';
import { loadPrefabModel } from '~/three/utils/prefabLoader';

// Shared materials cache - materials are created once and reused across all instances
const sharedMaterials = {
  yellow: {
    default: null as THREE.MeshStandardMaterial | null,
    neon: null as THREE.MeshStandardMaterial | null,
    glass: null as THREE.MeshStandardMaterial | null,
  },
  blue: {
    default: null as THREE.MeshStandardMaterial | null,
    neon: null as THREE.MeshStandardMaterial | null,
    glass: null as THREE.MeshStandardMaterial | null,
  },
};

function getSharedMaterial(
  color: 'yellow' | 'blue',
  type: 'default' | 'neon' | 'glass'
): THREE.MeshStandardMaterial {
  if (!sharedMaterials[color][type]) {
    if (type === 'glass') {
      // Glass uses simple transparent MeshStandardMaterial to avoid GPU texture unit overflow
      // MeshPhysicalMaterial with transmission consumes too many texture units
      sharedMaterials[color].glass = new THREE.MeshStandardMaterial({
        color: color === 'yellow' ? 0x8cff1a : 0x007bff,
        roughness: 0.34,
        metalness: 0.64,
        transparent: true,
        opacity: 0.47,
        emissive: color === 'yellow' ? 0xffff00 : 0x00ffff,
        emissiveIntensity: 7,
      });
    } else if (type === 'neon') {
      // Neon meshes have emissive glow
      sharedMaterials[color].neon = new THREE.MeshStandardMaterial({
        color: color === 'yellow' ? 0xffdd1a : 0x1ae4ff,
        roughness: 0.8,
        metalness: 0.2,
        emissive: color === 'yellow' ? 0xffff00 : 0x00ffff,
        emissiveIntensity: 35,
      });
    } else {
      // Default material
      sharedMaterials[color].default = new THREE.MeshStandardMaterial({
        color: color === 'yellow' ? 0xffdd1a : 0x6b90ff,
        roughness: 0.8,
        metalness: 0.2,
      });
    }
  }
  return sharedMaterials[color][type]!;
}

/**
 * Creates a NEON_WALL prefab with attached spotlight
 * Returns a THREE.Group containing the model and light
 */
export async function createNeonWallPrefab(color: 'yellow' | 'blue' = 'yellow'): Promise<THREE.Group> {
  const group = new THREE.Group();
  group.name = 'NEON_WALL_PREFAB';

  // Load the model with standard transformations
  const model = await loadPrefabModel({
    objPath: '/experiments/neon-wall.obj',
    mtlPath: '/experiments/neon-wall.mtl',
    modelName: 'NEON_WALL',
    onMaterialSetup: (child) => {
      // Use shared materials instead of creating new ones
      if (child.name === 'GLASS') {
        child.material = getSharedMaterial(color, 'glass');
        child.castShadow = false;
      } else if (child.name.match(/^NEON_[1-5]$/)) {
        child.material = getSharedMaterial(color, 'neon');
      } else {
        child.material = getSharedMaterial(color, 'default');
      }
    },
  });

  // Create and attach the spotlight to the model
  const spotlight = createNeonSpotlight(color);
  model.add(spotlight);
  model.add(spotlight.target); // Add target to the model so it moves with it

  group.add(model);

  return group;
}

/**
 * Creates the spotlight for the neon wall
 * Position and direction are relative to the model origin
 */
function createNeonSpotlight(color: 'yellow' | 'blue'): THREE.SpotLight {
  const lightColor = color === 'yellow' ? '#ffff00' : '#00ffff';
  const intensity = 9.0;
  const spotlight = new THREE.SpotLight(lightColor, intensity);

  // Position relative to model center (scaled uniformly by 3)
  spotlight.position.set(0.69, -0.72, 4.05);

  // Calculate target position from direction (scaled by 3)
  const lightDirection = new THREE.Vector3(0, -0.5, -0.7).normalize();
  const targetDistance = 10; // Distance for target
  spotlight.target.position.copy(spotlight.position).add(lightDirection.multiplyScalar(targetDistance));

  spotlight.angle = (53.3 * Math.PI) / 180; // Angle in radians (53.3 degrees)
  spotlight.penumbra = 0.26;
  spotlight.decay = 1; // Less aggressive light falloff
  spotlight.distance = 20.0; // Distance limit (increased for more reach)

  // Disable shadows to avoid GPU texture unit overflow
  spotlight.castShadow = false;

  return spotlight;
}
