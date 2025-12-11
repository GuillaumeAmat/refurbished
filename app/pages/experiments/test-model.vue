<script setup lang="ts">
import { onMounted, ref, onUnmounted } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { definePageMeta, useSimpleHead } from '#imports';

definePageMeta({
  layout: false,
});

useSimpleHead({
  title: 'Test Model - BackTrack',
  description: 'Model viewer test page',
  suffixedTitle: false,
});

const canvas = ref<HTMLCanvasElement>();
const selectedMeshName = ref<string>('');
const selectedMeshMaterial = ref<{
  type: string;
  color: string;
  roughness?: number;
  metalness?: number;
} | null>(null);
const selectedMeshObject = ref<THREE.Mesh | null>(null);
const cameraPosition = ref({ x: 0, y: 0, z: 0 });
const lightInfo = ref({
  position: { x: 0, y: 0, z: 0 },
  direction: { x: 0, y: 0, z: 0 },
  color: '',
  intensity: 0,
  angle: 0,
  penumbra: 0,
  distance: 0
});
const ambientLightInfo = ref({
  color: '',
  intensity: 0
});
const floorMaterialInfo = ref({
  color: '',
  roughness: 0,
  metalness: 0,
  noiseIntensity: 30
});
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let effect: OutlineEffect;
let controls: OrbitControls;
let animationId: number;
let raycaster: THREE.Raycaster;
let pointer: THREE.Vector2;
let sunLight: THREE.SpotLight;
let ambientLight: THREE.AmbientLight;
let floor: THREE.Mesh;

// Function to update material properties
const updateRoughness = (value: number) => {
  if (selectedMeshObject.value && selectedMeshObject.value.material instanceof THREE.MeshStandardMaterial) {
    selectedMeshObject.value.material.roughness = value;
    if (selectedMeshMaterial.value) {
      selectedMeshMaterial.value.roughness = value;
    }
  }
};

const updateMetalness = (value: number) => {
  if (selectedMeshObject.value && selectedMeshObject.value.material instanceof THREE.MeshStandardMaterial) {
    selectedMeshObject.value.material.metalness = value;
    if (selectedMeshMaterial.value) {
      selectedMeshMaterial.value.metalness = value;
    }
  }
};

const updateAmbientLightIntensity = (value: number) => {
  if (ambientLight) {
    ambientLight.intensity = value;
    ambientLightInfo.value.intensity = value;
  }
};

const updateDirectionalLightIntensity = (value: number) => {
  if (sunLight) {
    sunLight.intensity = value;
    lightInfo.value.intensity = value;
  }
};

const updateSpotLightAngle = (value: number) => {
  if (sunLight) {
    sunLight.angle = value;
    lightInfo.value.angle = value;
  }
};

const updateSpotLightPenumbra = (value: number) => {
  if (sunLight) {
    sunLight.penumbra = value;
    lightInfo.value.penumbra = value;
  }
};

const updateSpotLightDistance = (value: number) => {
  if (sunLight) {
    sunLight.distance = value;
    lightInfo.value.distance = value;
  }
};

const updateFloorRoughness = (value: number) => {
  if (floor && floor.material instanceof THREE.MeshStandardMaterial) {
    floor.material.roughness = value;
    floorMaterialInfo.value.roughness = value;
  }
};

const updateFloorMetalness = (value: number) => {
  if (floor && floor.material instanceof THREE.MeshStandardMaterial) {
    floor.material.metalness = value;
    floorMaterialInfo.value.metalness = value;
  }
};

const updateFloorNoiseIntensity = (value: number) => {
  if (floor && floor.material instanceof THREE.MeshStandardMaterial) {
    floorMaterialInfo.value.noiseIntensity = value;

    // Regenerate texture with new noise intensity
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 512;
    textureCanvas.height = 512;
    const ctx = textureCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#a0a0a0';
    ctx.fillRect(0, 0, 512, 512);

    const imageData = ctx.getImageData(0, 0, 512, 512);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * value;
      data[i] = Math.max(0, Math.min(255, (data[i] || 0) + noise));
      data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] || 0) + noise));
      data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] || 0) + noise));
    }
    ctx.putImageData(imageData, 0, 0);

    const concreteTexture = new THREE.CanvasTexture(textureCanvas);
    concreteTexture.wrapS = THREE.RepeatWrapping;
    concreteTexture.wrapT = THREE.RepeatWrapping;
    concreteTexture.repeat.set(4, 4);

    floor.material.map = concreteTexture;
    floor.material.needsUpdate = true;
  }
};

const setupScene = () => {
  if (!canvas.value) return;

  // Scene - Same as game
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#333333'); // BACKGROUND_COLOR from constants

  // Camera - Adjusted to see the scaled model
  camera = new THREE.PerspectiveCamera(
    35, // FOV from game
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  // Fixed camera position
  camera.position.set(-23.58, 10.88, 37.08);
  camera.lookAt(0, 0, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas: canvas.value,
    antialias: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Outline Effect for cel-shading outlines
  effect = new OutlineEffect(renderer, {
    defaultThickness: 0.005,
    defaultColor: [0, 0, 0],
    defaultAlpha: 1,
    defaultKeepAlive: true,
  });

  // Controls
  controls = new OrbitControls(camera, canvas.value);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 0, 0);

  // Raycaster setup
  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();

  // Lights - Same as game (Environment.ts)
  ambientLight = new THREE.AmbientLight('#ffffff', 2); // intensity 2 for brighter ambient lighting
  scene.add(ambientLight);

  // Initialize ambient light info
  ambientLightInfo.value = {
    color: '#' + ambientLight.color.getHexString(),
    intensity: ambientLight.intensity,
  };

  sunLight = new THREE.SpotLight('#ffff00', 50); // Yellow light with higher intensity
  // Position the light above and slightly in front
  const lightAngle = Math.PI / 4; // 45 degrees
  const lightY = 15 * Math.cos(lightAngle); // Increased from 10 to 15 (50% higher)
  const lightZ = -15 * Math.sin(lightAngle); // Increased from -10 to -15 (50% higher)
  sunLight.position.set(0, lightY, lightZ);
  sunLight.target.position.set(0, 0, 0); // Point at the center
  sunLight.angle = Math.PI / 6; // 30 degrees cone angle
  sunLight.penumbra = 0.2; // Soft edge
  sunLight.decay = 1; // Less aggressive light falloff (1 = linear, 2 = physically realistic)
  sunLight.distance = 0; // No distance limit (0 = infinite)
  sunLight.castShadow = true;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 50;
  sunLight.shadow.camera.fov = 60;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.bias = -0.0001;
  scene.add(sunLight);
  scene.add(sunLight.target); // Don't forget to add the target to the scene

  // Initialize light info
  // Calculate direction (normalized vector pointing from light to target)
  const direction = new THREE.Vector3().subVectors(sunLight.target.position, sunLight.position).normalize();

  lightInfo.value = {
    position: {
      x: Math.round(sunLight.position.x * 100) / 100,
      y: Math.round(sunLight.position.y * 100) / 100,
      z: Math.round(sunLight.position.z * 100) / 100,
    },
    direction: {
      x: Math.round(direction.x * 100) / 100,
      y: Math.round(direction.y * 100) / 100,
      z: Math.round(direction.z * 100) / 100,
    },
    color: '#' + sunLight.color.getHexString(),
    intensity: sunLight.intensity,
    angle: sunLight.angle,
    penumbra: sunLight.penumbra,
    distance: sunLight.distance,
  };

  // Add SpotLight helper to visualize the light
  const spotLightHelper = new THREE.SpotLightHelper(sunLight, 0xffff00);
  scene.add(spotLightHelper);

  // Add a concrete floor with grain texture
  const floorGeometry = new THREE.PlaneGeometry(50, 50);

  // Create a simple noise texture for concrete grain
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 512;
  textureCanvas.height = 512;
  const ctx = textureCanvas.getContext('2d')!;

  // Fill with base gray
  ctx.fillStyle = '#a0a0a0';
  ctx.fillRect(0, 0, 512, 512);

  // Add noise/grain
  const imageData = ctx.getImageData(0, 0, 512, 512);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 30; // Random variation
    data[i] += noise;     // R
    data[i + 1] += noise; // G
    data[i + 2] += noise; // B
  }
  ctx.putImageData(imageData, 0, 0);

  // Create texture from canvas
  const concreteTexture = new THREE.CanvasTexture(textureCanvas);
  concreteTexture.wrapS = THREE.RepeatWrapping;
  concreteTexture.wrapT = THREE.RepeatWrapping;
  concreteTexture.repeat.set(4, 4); // Repeat the texture 4x4 times

  const floorMaterial = new THREE.MeshStandardMaterial({
    map: concreteTexture, // Use the grain texture
    roughness: 0.95, // Very rough surface for concrete
    metalness: 0.0, // No metallic reflection
  });
  floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2; // Rotate to be horizontal
  floor.position.y = 0;
  floor.receiveShadow = true;
  scene.add(floor);

  // Initialize floor material info
  floorMaterialInfo.value = {
    color: '#' + floorMaterial.color.getHexString(),
    roughness: floorMaterial.roughness,
    metalness: floorMaterial.metalness,
    noiseIntensity: 30,
  };

  // Axes helper (for reference)
  const axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);

  // Helper function to load and setup a model
  const loadModel = (objPath: string, mtlPath: string, offsetX: number, logPrefix: string) => {
    const mtlLoader = new MTLLoader();
    mtlLoader.load(
      mtlPath,
      (materials) => {
        materials.preload();

        const objLoader = new OBJLoader();
        objLoader.setMaterials(materials);
        objLoader.load(
          objPath,
          (model) => {
            const meshes: THREE.Mesh[] = [];
            const meshInfo: Array<{ name: string, geometry: string, material: string, vertices: number }> = [];

            // Mesh names are now defined directly in the OBJ file (no mapping needed)

            // Color mapping: all meshes are #C2AC97 by default
            // Specify which mesh name should have a different color (to be customized)
            const colorMapping: Record<string, THREE.Color> = {
              'TOP': new THREE.Color(0xffffff), // White
            };

            // Default color for all meshes (white)
            const defaultColor = new THREE.Color(0xffffff); // White

            // Group meshes by name prefix to merge similar parts
            const meshGroups = new Map<string, THREE.Mesh[]>();

            model.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                meshes.push(child);

                // Mesh names come directly from the OBJ file
                const meshName = child.name || 'Unnamed';

                const info = {
                  name: meshName,
                  geometry: child.geometry.type,
                  material: child.material instanceof THREE.Material ? child.material.type : 'Unknown',
                  vertices: child.geometry.attributes.position?.count || 0,
                };
                meshInfo.push(info);

                // Group meshes by name for merging
                if (!meshGroups.has(meshName)) {
                  meshGroups.set(meshName, []);
                }
                meshGroups.get(meshName)!.push(child);
              }
            });

            // Now merge geometries within each group and apply single color
            let groupIndex = 0;
            meshGroups.forEach((groupMeshes, groupName) => {
              // Check if this mesh name has a specific color mapping
              let materialColor: THREE.Color;
              if (colorMapping[groupName]) {
                // Use the specific color from the mapping
                materialColor = colorMapping[groupName].clone();
              } else {
                // Use default white color for all other meshes
                materialColor = defaultColor.clone();
              }

              // Merge all meshes in this group into one
              const geometries: THREE.BufferGeometry[] = [];

              groupMeshes.forEach((mesh) => {
                // Clone and apply world transform
                const geo = mesh.geometry.clone();
                mesh.updateMatrixWorld();
                geo.applyMatrix4(mesh.matrixWorld);

                // Remove vertex colors
                if (geo.attributes.color) {
                  geo.deleteAttribute('color');
                }

                geometries.push(geo);

                // Hide original mesh
                mesh.visible = false;
              });

              // Merge geometries using BufferGeometryUtils
              if (geometries.length > 0) {
                const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries, false);

                if (mergedGeometry) {
                  // Compute smooth normals
                  mergedGeometry.computeVertexNormals();

                  // Create material based on mesh name
                  let material: THREE.Material;
                  if (groupName === 'TOP') {
                    // Use MeshStandardMaterial for TOP with plastic properties
                    material = new THREE.MeshStandardMaterial({
                      color: materialColor,
                      roughness: 0.3, // Slightly rough for plastic sheen (0.0 to 1.0)
                      metalness: 0.0, // No metalness = dielectric/plastic (0.0 to 1.0)
                      flatShading: false,
                      vertexColors: false,
                    });
                  } else {
                    // Use MeshStandardMaterial for other meshes with varnished metal properties
                    material = new THREE.MeshStandardMaterial({
                      color: materialColor,
                      roughness: 0.25, // Low roughness for varnished/polished metal
                      metalness: 0.9, // High metalness for metal appearance
                      flatShading: false,
                      vertexColors: false,
                    });
                  }

                  // Create the merged mesh
                  const mergedMesh = new THREE.Mesh(mergedGeometry, material);
                  mergedMesh.castShadow = true;
                  mergedMesh.receiveShadow = true;
                  mergedMesh.name = `Merged_${groupName}`;

                  model.add(mergedMesh);
                }
              }

              groupIndex++;
            });

            // Scale the model down by 10x
            model.scale.set(0.1, 0.1, 0.1);

            // Apply rotations using rotation order to ensure correct transformation
            model.rotation.order = 'XYZ';
            model.rotation.x = Math.PI / 2 + Math.PI;  // 270 degrees around X
            model.rotation.y = 2 * Math.PI;             // 90 degrees around Y
            model.rotation.z = Math.PI / 2;            // -90 degrees around Z

            // Center the model
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center);

            // Position the model on the ground plane (y=0) - bottom touching the grid
            model.position.y = -box.min.y;

            // Position the model with offset
            model.position.x += offsetX;

            scene.add(model);
          },
          undefined,
          (error) => {
            console.error(`${logPrefix} Error loading OBJ:`, error);
          }
        );
      },
      undefined,
      (error) => {
        console.error(`${logPrefix} Error loading MTL:`, error);
      }
    );
  };

  // Load the OBJ models with multiple meshes
  loadModel('/experiments/plan-de-travail.obj', '/experiments/plan-de-travail.mtl', 0, 'MODEL_1');

  // Animation loop
  const animate = () => {
    animationId = requestAnimationFrame(animate);
    controls.update();

    // Update camera position display
    cameraPosition.value = {
      x: Math.round(camera.position.x * 100) / 100,
      y: Math.round(camera.position.y * 100) / 100,
      z: Math.round(camera.position.z * 100) / 100,
    };

    effect.render(scene, camera); // Use effect instead of renderer for outlines
  };
  animate();

  // Handle window resize
  const handleResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    effect.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', handleResize);

  // Handle click events for mesh selection
  const handleClick = (event: MouseEvent) => {
    // Calculate pointer position in normalized device coordinates (-1 to +1)
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the raycaster with the camera and pointer position
    raycaster.setFromCamera(pointer, camera);

    // Calculate objects intersecting the ray
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
      // Find the first mesh that is not a helper
      const clickedMesh = intersects.find(intersect =>
        intersect.object instanceof THREE.Mesh &&
        intersect.object.name.startsWith('Merged_')
      );

      if (clickedMesh) {
        // Extract the original mesh name (remove 'Merged_' prefix)
        const meshName = clickedMesh.object.name.replace('Merged_', '');
        selectedMeshName.value = meshName;

        // Store reference to the mesh object
        selectedMeshObject.value = clickedMesh.object as THREE.Mesh;

        // Extract material information
        const mesh = clickedMesh.object as THREE.Mesh;
        const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;

        if (material instanceof THREE.MeshStandardMaterial) {
          selectedMeshMaterial.value = {
            type: 'MeshStandardMaterial',
            color: '#' + material.color.getHexString(),
            roughness: material.roughness,
            metalness: material.metalness,
          };
        } else if (material instanceof THREE.MeshToonMaterial) {
          selectedMeshMaterial.value = {
            type: 'MeshToonMaterial',
            color: '#' + material.color.getHexString(),
          };
        } else {
          selectedMeshMaterial.value = {
            type: material?.type || 'Unknown',
            color: 'N/A',
          };
        }

        console.log('Clicked on mesh:', meshName, 'Material:', selectedMeshMaterial.value);
      }
    }
  };
  window.addEventListener('click', handleClick);
};

onMounted(() => {
  setupScene();
});

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  if (renderer) {
    renderer.dispose();
  }
  if (controls) {
    controls.dispose();
  }
});
</script>

<template>
  <div class="fixed inset-0 bg-gray-900">
    <canvas
      ref="canvas"
      class="w-full h-full outline-0"
    ></canvas>

    <!-- Instructions overlay -->
    <div class="absolute top-4 left-4 bg-black/70 text-white p-4 rounded-lg max-w-md">
      <h1 class="text-xl font-bold mb-2">Model Viewer Test</h1>
      <p class="text-sm mb-2">File: <code class="bg-gray-700 px-1 rounded text-xs">plan-de-travail.obj</code></p>
      <p class="text-xs text-gray-400 mb-3">Game lighting & camera settings applied</p>
      <div class="text-xs space-y-1">
        <p><strong>Controls:</strong></p>
        <ul class="list-disc list-inside">
          <li>Left click + drag: Rotate</li>
          <li>Right click + drag: Pan</li>
          <li>Scroll: Zoom</li>
        </ul>
        <p class="text-yellow-300 mt-2">Click on a mesh to see its name</p>
      </div>
    </div>

    <!-- Floor material controls -->
    <div class="absolute top-64 left-4 bg-gray-700/90 text-white px-4 py-3 rounded-lg shadow-lg max-w-md">
      <p class="text-xs font-semibold mb-2">Floor Material:</p>
      <div class="text-sm font-mono space-y-2">
        <p class="text-xs opacity-80">Color: {{ floorMaterialInfo.color }}</p>

        <div class="space-y-1">
          <label class="text-xs flex items-center justify-between">
            <span>Roughness:</span>
            <span>{{ floorMaterialInfo.roughness.toFixed(2) }}</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            :value="floorMaterialInfo.roughness"
            @input="updateFloorRoughness(parseFloat(($event.target as HTMLInputElement).value))"
            class="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div class="space-y-1">
          <label class="text-xs flex items-center justify-between">
            <span>Metalness:</span>
            <span>{{ floorMaterialInfo.metalness.toFixed(2) }}</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            :value="floorMaterialInfo.metalness"
            @input="updateFloorMetalness(parseFloat(($event.target as HTMLInputElement).value))"
            class="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div class="space-y-1">
          <label class="text-xs flex items-center justify-between">
            <span>Noise:</span>
            <span>{{ floorMaterialInfo.noiseIntensity.toFixed(0) }}</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            :value="floorMaterialInfo.noiseIntensity"
            @input="updateFloorNoiseIntensity(parseFloat(($event.target as HTMLInputElement).value))"
            class="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
    </div>

    <!-- Selected mesh display -->
    <div
      v-if="selectedMeshName"
      class="absolute top-4 right-4 bg-green-600/90 text-white px-4 py-3 rounded-lg shadow-lg"
    >
      <p class="text-xs font-semibold mb-1">Selected Mesh:</p>
      <p class="text-lg font-mono mb-3">{{ selectedMeshName }}</p>

      <div
        v-if="selectedMeshMaterial"
        class="text-sm font-mono space-y-2"
      >
        <p class="text-xs font-semibold opacity-80">Material:</p>
        <p class="text-xs">Type: {{ selectedMeshMaterial.type }}</p>
        <p class="text-xs">Color: {{ selectedMeshMaterial.color }}</p>

        <div
          v-if="selectedMeshMaterial.roughness !== undefined"
          class="space-y-1"
        >
          <label class="text-xs flex items-center justify-between">
            <span>Roughness:</span>
            <span>{{ selectedMeshMaterial.roughness.toFixed(2) }}</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            :value="selectedMeshMaterial.roughness"
            @input="updateRoughness(parseFloat(($event.target as HTMLInputElement).value))"
            class="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div
          v-if="selectedMeshMaterial.metalness !== undefined"
          class="space-y-1"
        >
          <label class="text-xs flex items-center justify-between">
            <span>Metalness:</span>
            <span>{{ selectedMeshMaterial.metalness.toFixed(2) }}</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            :value="selectedMeshMaterial.metalness"
            @input="updateMetalness(parseFloat(($event.target as HTMLInputElement).value))"
            class="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
    </div>

    <!-- Camera position display -->
    <div class="absolute bottom-4 left-4 bg-blue-600/90 text-white px-4 py-3 rounded-lg shadow-lg">
      <p class="text-xs font-semibold mb-1">Camera Position:</p>
      <div class="text-sm font-mono space-y-1">
        <p>X: {{ cameraPosition.x.toFixed(2) }}</p>
        <p>Y: {{ cameraPosition.y.toFixed(2) }}</p>
        <p>Z: {{ cameraPosition.z.toFixed(2) }}</p>
      </div>
    </div>

    <!-- Ambient light info display -->
    <div class="absolute bottom-[32rem] right-4 bg-cyan-600/90 text-white px-4 py-3 rounded-lg shadow-lg">
      <p class="text-xs font-semibold mb-2">Ambient Light:</p>
      <div class="text-sm font-mono space-y-2">
        <p class="text-xs opacity-80">Color: {{ ambientLightInfo.color }}</p>

        <div class="space-y-1">
          <label class="text-xs flex items-center justify-between">
            <span>Intensity:</span>
            <span>{{ ambientLightInfo.intensity.toFixed(2) }}</span>
          </label>
          <input
            type="range"
            min="0"
            max="5"
            step="0.1"
            :value="ambientLightInfo.intensity"
            @input="updateAmbientLightIntensity(parseFloat(($event.target as HTMLInputElement).value))"
            class="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
    </div>

    <!-- Spot light info display -->
    <div class="absolute bottom-4 right-4 bg-yellow-600/90 text-white px-4 py-3 rounded-lg shadow-lg">
      <p class="text-xs font-semibold mb-2">Spot Light:</p>
      <div class="text-sm font-mono space-y-2">
        <p class="text-xs opacity-80">Position:</p>
        <p>X: {{ lightInfo.position.x.toFixed(2) }}</p>
        <p>Y: {{ lightInfo.position.y.toFixed(2) }}</p>
        <p>Z: {{ lightInfo.position.z.toFixed(2) }}</p>
        <p class="text-xs opacity-80 mt-2">Direction:</p>
        <p>X: {{ lightInfo.direction.x.toFixed(2) }}</p>
        <p>Y: {{ lightInfo.direction.y.toFixed(2) }}</p>
        <p>Z: {{ lightInfo.direction.z.toFixed(2) }}</p>
        <p class="text-xs opacity-80 mt-2">Color: {{ lightInfo.color }}</p>

        <div class="space-y-1">
          <label class="text-xs flex items-center justify-between">
            <span>Intensity:</span>
            <span>{{ lightInfo.intensity.toFixed(2) }}</span>
          </label>
          <input
            type="range"
            min="1"
            max="100"
            step="1"
            :value="lightInfo.intensity"
            @input="updateDirectionalLightIntensity(parseFloat(($event.target as HTMLInputElement).value))"
            class="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div class="space-y-1">
          <label class="text-xs flex items-center justify-between">
            <span>Angle (deg):</span>
            <span>{{ (lightInfo.angle * 180 / Math.PI).toFixed(1) }}</span>
          </label>
          <input
            type="range"
            min="0"
            max="1.57"
            step="0.01"
            :value="lightInfo.angle"
            @input="updateSpotLightAngle(parseFloat(($event.target as HTMLInputElement).value))"
            class="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div class="space-y-1">
          <label class="text-xs flex items-center justify-between">
            <span>Penumbra:</span>
            <span>{{ lightInfo.penumbra.toFixed(2) }}</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            :value="lightInfo.penumbra"
            @input="updateSpotLightPenumbra(parseFloat(($event.target as HTMLInputElement).value))"
            class="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div class="space-y-1">
          <label class="text-xs flex items-center justify-between">
            <span>Distance:</span>
            <span>{{ lightInfo.distance.toFixed(1) }}</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            :value="lightInfo.distance"
            @input="updateSpotLightDistance(parseFloat(($event.target as HTMLInputElement).value))"
            class="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
    </div>
  </div>
</template>
