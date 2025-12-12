<script setup lang="ts">
import { onMounted, ref, onUnmounted, watch, nextTick } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createNeonWallPrefab } from '~/three/prefabs/NeonWallPrefab';
import { createWorkbenchPrefab } from '~/three/prefabs/WorkbenchPrefab';

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
const floorMaterialPanel = ref<HTMLDivElement>();
const selectedMeshPanel = ref<HTMLDivElement>();
const cameraPositionPanel = ref<HTMLDivElement>();
const objectTransformPanel = ref<HTMLDivElement>();
const ambientLightPanel = ref<HTMLDivElement>();
const spotLightPanel = ref<HTMLDivElement>();

const selectedMeshName = ref<string>('');
const selectedMeshObject = ref<THREE.Mesh | null>(null);
const selectedObjectName = ref<string>('');
const selectedObject = ref<THREE.Object3D | null>(null);
const selectedObjectPosition = ref({ x: 0, y: 0, z: 0 });
const selectedObjectRotation = ref({ x: 0, y: 0, z: 0 }); // Stored in degrees
const selectedObjectScale = ref<number>(1); // Uniform scale
const cameraPosition = ref({ x: 0, y: 0, z: 0 });
const cameraRotation = ref({ x: 0, y: 0, z: 0 }); // Stored in degrees
const lightInfo = ref({
  position: { x: 0, y: 0, z: 0 },
  direction: { x: 0, y: 0, z: 0 },
  color: '#fbff00',
  intensity: 0,
  angle: 0,
  penumbra: 0,
  distance: 0
});
const ambientLightInfo = ref({
  color: '#ffffff',
  intensity: 0
});
const floorMaterialInfo = ref({
  color: '#333333',
  roughness: 0,
  metalness: 0,
  noiseIntensity: 30
});
const copiedPanel = ref<string | null>(null);
const isLoading = ref<boolean>(true);
const loadedModelsCount = ref<number>(0);
const totalModelsCount = 2; // WORKBENCH + NEON_WALL prefabs
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let animationId: number;
let raycaster: THREE.Raycaster;
let pointer: THREE.Vector2;
let sunLight: THREE.SpotLight;
let ambientLight: THREE.AmbientLight;
let floor: THREE.Mesh;
let spotLightHelper: THREE.SpotLightHelper;

// Material update functions
const updateRoughness = (value: number) => {
  if (selectedMeshObject.value?.material instanceof THREE.MeshStandardMaterial) {
    selectedMeshObject.value.material.roughness = value;
  }
};

const updateMetalness = (value: number) => {
  if (selectedMeshObject.value?.material instanceof THREE.MeshStandardMaterial) {
    selectedMeshObject.value.material.metalness = value;
  }
};

const updateOpacity = (value: number) => {
  if (selectedMeshObject.value?.material instanceof THREE.MeshStandardMaterial) {
    selectedMeshObject.value.material.opacity = value;
    selectedMeshObject.value.material.needsUpdate = true;
  }
};

const updateTransparent = (value: boolean) => {
  if (selectedMeshObject.value?.material instanceof THREE.MeshStandardMaterial) {
    selectedMeshObject.value.material.transparent = value;
    selectedMeshObject.value.material.depthWrite = !value;
    selectedMeshObject.value.material.needsUpdate = true;
  }
};

const updateTransmission = (value: number) => {
  if (selectedMeshObject.value?.material instanceof THREE.MeshPhysicalMaterial) {
    selectedMeshObject.value.material.transmission = value;
    if (selectedMeshObject.value) {
      selectedMeshObject.value.castShadow = value === 0;
    }
    selectedMeshObject.value.material.needsUpdate = true;
  }
};

const updateThickness = (value: number) => {
  if (selectedMeshObject.value?.material instanceof THREE.MeshPhysicalMaterial) {
    selectedMeshObject.value.material.thickness = value;
    selectedMeshObject.value.material.needsUpdate = true;
  }
};

const updateMaterialColor = (hexColor: string) => {
  if (selectedMeshObject.value?.material instanceof THREE.MeshStandardMaterial) {
    selectedMeshObject.value.material.color.setHex(parseInt(hexColor.replace('#', ''), 16));
  }
};

const updateEmissiveColor = (hexColor: string) => {
  if (selectedMeshObject.value?.material instanceof THREE.MeshStandardMaterial) {
    selectedMeshObject.value.material.emissive.setHex(parseInt(hexColor.replace('#', ''), 16));
    selectedMeshObject.value.material.needsUpdate = true;
  }
};

const updateEmissiveIntensity = (value: number) => {
  if (selectedMeshObject.value?.material instanceof THREE.MeshStandardMaterial) {
    selectedMeshObject.value.material.emissiveIntensity = value;
    selectedMeshObject.value.material.needsUpdate = true;
  }
};

// Light update functions
const updateAmbientLightColor = (hexColor: string) => {
  if (!ambientLight) return;
  ambientLight.color.setHex(parseInt(hexColor.replace('#', ''), 16));
  ambientLightInfo.value.color = hexColor;
};

const updateAmbientLightIntensity = (value: number) => {
  if (!ambientLight) return;
  ambientLight.intensity = value;
  ambientLightInfo.value.intensity = value;
};

const updateSpotLightColor = (hexColor: string) => {
  if (!sunLight) return;
  sunLight.color.setHex(parseInt(hexColor.replace('#', ''), 16));
  lightInfo.value.color = hexColor;
  if (spotLightHelper) spotLightHelper.update();
};

const updateDirectionalLightIntensity = (value: number) => {
  if (!sunLight) return;
  sunLight.intensity = value;
  lightInfo.value.intensity = value;
  if (spotLightHelper) spotLightHelper.update();
};

const updateSpotLightAngle = (value: number) => {
  if (!sunLight) return;
  sunLight.angle = value;
  lightInfo.value.angle = value;
  if (spotLightHelper) spotLightHelper.update();
};

const updateSpotLightPenumbra = (value: number) => {
  if (!sunLight) return;
  sunLight.penumbra = value;
  lightInfo.value.penumbra = value;
  if (spotLightHelper) spotLightHelper.update();
};

const updateSpotLightDistance = (value: number) => {
  if (!sunLight) return;
  sunLight.distance = value;
  lightInfo.value.distance = value;
  if (spotLightHelper) spotLightHelper.update();
};

const updateSpotLightPositionX = (value: number) => {
  if (!sunLight) return;
  sunLight.position.x = value;
  lightInfo.value.position.x = value;
  if (spotLightHelper) spotLightHelper.update();
};

const updateSpotLightPositionY = (value: number) => {
  if (!sunLight) return;
  sunLight.position.y = value;
  lightInfo.value.position.y = value;
  if (spotLightHelper) spotLightHelper.update();
};

const updateSpotLightPositionZ = (value: number) => {
  if (!sunLight) return;
  sunLight.position.z = value;
  lightInfo.value.position.z = value;
  if (spotLightHelper) spotLightHelper.update();
};

const updateSpotLightDirectionX = (value: number) => {
  if (!sunLight) return;
  // Update the stored direction value first
  lightInfo.value.direction.x = value;

  // Calculate current distance from light to target
  const currentDir = new THREE.Vector3().subVectors(sunLight.target.position, sunLight.position);
  const distance = currentDir.length();

  // Create new direction with updated X component and normalize
  const newDir = new THREE.Vector3(value, lightInfo.value.direction.y, lightInfo.value.direction.z).normalize();

  // Set new target position
  sunLight.target.position.copy(sunLight.position).add(newDir.multiplyScalar(distance));
  if (spotLightHelper) spotLightHelper.update();
};

const updateSpotLightDirectionY = (value: number) => {
  if (!sunLight) return;
  // Update the stored direction value first
  lightInfo.value.direction.y = value;

  // Calculate current distance from light to target
  const currentDir = new THREE.Vector3().subVectors(sunLight.target.position, sunLight.position);
  const distance = currentDir.length();

  // Create new direction with updated Y component and normalize
  const newDir = new THREE.Vector3(lightInfo.value.direction.x, value, lightInfo.value.direction.z).normalize();

  // Set new target position
  sunLight.target.position.copy(sunLight.position).add(newDir.multiplyScalar(distance));
  if (spotLightHelper) spotLightHelper.update();
};

const updateSpotLightDirectionZ = (value: number) => {
  if (!sunLight) return;
  // Update the stored direction value first
  lightInfo.value.direction.z = value;

  // Calculate current distance from light to target
  const currentDir = new THREE.Vector3().subVectors(sunLight.target.position, sunLight.position);
  const distance = currentDir.length();

  // Create new direction with updated Z component and normalize
  const newDir = new THREE.Vector3(lightInfo.value.direction.x, lightInfo.value.direction.y, value).normalize();

  // Set new target position
  sunLight.target.position.copy(sunLight.position).add(newDir.multiplyScalar(distance));
  if (spotLightHelper) spotLightHelper.update();
};

// Floor material update functions
const updateFloorRoughness = (value: number) => {
  if (!(floor?.material instanceof THREE.MeshStandardMaterial)) return;
  floor.material.roughness = value;
  floorMaterialInfo.value.roughness = value;
};

const updateFloorMetalness = (value: number) => {
  if (!(floor?.material instanceof THREE.MeshStandardMaterial)) return;
  floor.material.metalness = value;
  floorMaterialInfo.value.metalness = value;
};

const createFloorTexture = (noiseIntensity: number): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#a0a0a0';
  ctx.fillRect(0, 0, 512, 512);

  const imageData = ctx.getImageData(0, 0, 512, 512);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * noiseIntensity;
    data[i] = Math.max(0, Math.min(255, (data[i] || 0) + noise));
    data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] || 0) + noise));
    data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] || 0) + noise));
  }
  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
};

const updateFloorNoiseIntensity = (value: number) => {
  if (!(floor?.material instanceof THREE.MeshStandardMaterial)) return;
  floorMaterialInfo.value.noiseIntensity = value;
  floor.material.map = createFloorTexture(value);
  floor.material.needsUpdate = true;
};

// Object transform update functions
const updateObjectPositionX = (value: number) => {
  if (!selectedObject.value) return;
  selectedObject.value.position.x = value;
  selectedObjectPosition.value.x = value;
  if (spotLightHelper) spotLightHelper.update();
};

const updateObjectPositionY = (value: number) => {
  if (!selectedObject.value) return;
  selectedObject.value.position.y = value;
  selectedObjectPosition.value.y = value;
  if (spotLightHelper) spotLightHelper.update();
};

const updateObjectPositionZ = (value: number) => {
  if (!selectedObject.value) return;
  selectedObject.value.position.z = value;
  selectedObjectPosition.value.z = value;
  if (spotLightHelper) spotLightHelper.update();
};

const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180;

const updateObjectRotationX = (degrees: number) => {
  if (!selectedObject.value) return;
  selectedObject.value.rotation.x = degreesToRadians(degrees);
  selectedObjectRotation.value.x = degrees;
  if (spotLightHelper) spotLightHelper.update();
};

const updateObjectRotationY = (degrees: number) => {
  if (!selectedObject.value) return;
  selectedObject.value.rotation.y = degreesToRadians(degrees);
  selectedObjectRotation.value.y = degrees;
  if (spotLightHelper) spotLightHelper.update();
};

const updateObjectRotationZ = (degrees: number) => {
  if (!selectedObject.value) return;
  selectedObject.value.rotation.z = degreesToRadians(degrees);
  selectedObjectRotation.value.z = degrees;
  if (spotLightHelper) spotLightHelper.update();
};

const updateObjectScale = (value: number) => {
  if (!selectedObject.value) return;
  selectedObject.value.scale.setScalar(value);
  selectedObjectScale.value = value;
  if (spotLightHelper) spotLightHelper.update();
};

// Copy panel content to clipboard
const copyPanelContent = (panelRef: HTMLElement | undefined, panelName: string) => {
  if (!panelRef) return;

  // Clone the panel to manipulate it
  const clone = panelRef.cloneNode(true) as HTMLElement;

  // Replace all input elements with span elements containing their values
  const inputs = clone.querySelectorAll('input');
  inputs.forEach(input => {
    const span = document.createElement('span');
    span.textContent = input.value;
    input.parentNode?.replaceChild(span, input);
  });

  // Get all text content from the cloned panel with preserved line breaks
  let textContent = clone.innerText;

  // Remove empty lines (lines with only whitespace)
  textContent = textContent.split('\n')
    .filter(line => line.trim() !== '')
    .join('\n');

  // Trim leading and trailing whitespace
  textContent = textContent.trim();

  navigator.clipboard.writeText(textContent).then(() => {
    console.log('Panel content copied to clipboard');

    // Show notification
    copiedPanel.value = panelName;

    // Hide notification after 2 seconds
    setTimeout(() => {
      copiedPanel.value = null;
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy: ', err);
  });
};

// Draggable panel functionality with localStorage persistence
const makeDraggable = (element: HTMLElement, panelId: string) => {
  let isDragging = false;
  let currentX = 0;
  let currentY = 0;
  let initialX = 0;
  let initialY = 0;
  let dragHandle: HTMLElement | null = null;

  // Restore position from localStorage
  const savedPosition = localStorage.getItem(`panel-position-${panelId}`);
  if (savedPosition) {
    const { x, y } = JSON.parse(savedPosition);
    currentX = x;
    currentY = y;
    element.style.transform = `translate(${currentX}px, ${currentY}px)`;
  }

  const dragStart = (e: MouseEvent) => {
    // Only allow dragging from the title/header area
    const target = e.target as HTMLElement;
    if (!target.classList.contains('drag-handle')) return;

    dragHandle = target;
    initialX = e.clientX - currentX;
    initialY = e.clientY - currentY;
    isDragging = true;
    dragHandle.style.cursor = 'grabbing';
    element.style.border = '3px solid white';
  };

  const drag = (e: MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();

    currentX = e.clientX - initialX;
    currentY = e.clientY - initialY;

    element.style.transform = `translate(${currentX}px, ${currentY}px)`;
  };

  const dragEnd = () => {
    isDragging = false;
    if (dragHandle) {
      dragHandle.style.cursor = 'grab';
      dragHandle = null;
    }
    element.style.border = '';

    // Save position to localStorage
    localStorage.setItem(`panel-position-${panelId}`, JSON.stringify({ x: currentX, y: currentY }));
  };

  element.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);

  // Cleanup function
  return () => {
    element.removeEventListener('mousedown', dragStart);
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', dragEnd);
  };
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

  // Note: SpotLight is now part of the NEON_WALL prefab
  // The light will be found and controlled after the model loads

  // Create floor (39 x 27 units)
  const floorGeometry = new THREE.PlaneGeometry(39, 27);
  const floorMaterial = new THREE.MeshStandardMaterial({
    map: createFloorTexture(30),
    roughness: 0.95,
    metalness: 0.0,
  });

  floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  floorMaterialInfo.value = {
    color: '#' + floorMaterial.color.getHexString(),
    roughness: 0.95,
    metalness: 0.0,
    noiseIntensity: 30,
  };

  // Axes helper (for reference, scaled down by 9)
  const axesHelper = new THREE.AxesHelper(5 / 9);
  scene.add(axesHelper);

  // Load prefabs
  // WORKBENCH prefab
  createWorkbenchPrefab().then((workbenchGroup) => {
    workbenchGroup.position.set(0, 0, 0);
    scene.add(workbenchGroup);
    console.log('WORKBENCH prefab loaded');

    loadedModelsCount.value++;
    if (loadedModelsCount.value >= totalModelsCount) {
      isLoading.value = false;
    }
  }).catch((error) => {
    console.error('Error loading WORKBENCH prefab:', error);
    loadedModelsCount.value++;
    if (loadedModelsCount.value >= totalModelsCount) {
      isLoading.value = false;
    }
  });

  // NEON_WALL prefab (includes spotlight)
  createNeonWallPrefab().then((neonWallGroup) => {
    // Position the NEON_WALL prefab in the scene
    neonWallGroup.position.set(0, 0, -1);
    scene.add(neonWallGroup);
    console.log('NEON_WALL prefab loaded');

    // Find the SpotLight in the prefab
    neonWallGroup.traverse((child) => {
      if (child instanceof THREE.SpotLight) {
        sunLight = child;

        // Create helper for the spotlight
        spotLightHelper = new THREE.SpotLightHelper(sunLight, 0xffff00);
        scene.add(spotLightHelper);

        // Initialize light info
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
      }
    });

    loadedModelsCount.value++;
    if (loadedModelsCount.value >= totalModelsCount) {
      isLoading.value = false;
    }
  }).catch((error) => {
    console.error('Error loading NEON_WALL prefab:', error);
    loadedModelsCount.value++;
    if (loadedModelsCount.value >= totalModelsCount) {
      isLoading.value = false;
    }
  });

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

    // Update camera rotation display (in degrees)
    cameraRotation.value = {
      x: Math.round((camera.rotation.x * 180 / Math.PI) * 100) / 100,
      y: Math.round((camera.rotation.y * 180 / Math.PI) * 100) / 100,
      z: Math.round((camera.rotation.z * 180 / Math.PI) * 100) / 100,
    };

    renderer.render(scene, camera);
  };
  animate();

  // Handle window resize
  const handleResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', handleResize);

  // Handle click events for object selection
  const handleClick = (event: MouseEvent) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    const clicked = intersects.find(i => i.object instanceof THREE.Mesh);
    if (!clicked) return;

    const mesh = clicked.object as THREE.Mesh;

    // Ignorer le clic si c'est le sol (floor) - garder la sélection précédente
    if (mesh === floor) return;

    // Ne mettre à jour que si c'est un mesh avec un nom valide
    if (!mesh.name) return;

    selectedMeshName.value = mesh.name;
    selectedMeshObject.value = mesh;

    // Find parent model
    let parent = mesh.parent;
    while (parent && parent.parent !== scene) {
      parent = parent.parent;
    }

    if (parent && parent !== scene) {
      selectedObject.value = parent;
      selectedObjectName.value = parent.name || 'Unknown';
      selectedObjectPosition.value = {
        x: Math.round(parent.position.x * 100) / 100,
        y: Math.round(parent.position.y * 100) / 100,
        z: Math.round(parent.position.z * 100) / 100,
      };
      selectedObjectRotation.value = {
        x: Math.round((parent.rotation.x * 180 / Math.PI) * 100) / 100,
        y: Math.round((parent.rotation.y * 180 / Math.PI) * 100) / 100,
        z: Math.round((parent.rotation.z * 180 / Math.PI) * 100) / 100,
      };
      selectedObjectScale.value = Math.round(parent.scale.x * 1000) / 1000;
    }
  };

  window.addEventListener('click', handleClick);
};

// Cleanup functions for draggable panels
const dragCleanupFunctions: (() => void)[] = [];

// Function to setup draggable panels
const setupDraggablePanels = () => {
  nextTick(() => {
    if (floorMaterialPanel.value) dragCleanupFunctions.push(makeDraggable(floorMaterialPanel.value, 'floorMaterial'));
    if (selectedMeshPanel.value) dragCleanupFunctions.push(makeDraggable(selectedMeshPanel.value, 'selectedMesh'));
    if (cameraPositionPanel.value) dragCleanupFunctions.push(makeDraggable(cameraPositionPanel.value, 'cameraPosition'));
    if (objectTransformPanel.value) dragCleanupFunctions.push(makeDraggable(objectTransformPanel.value, 'objectTransform'));
    if (ambientLightPanel.value) dragCleanupFunctions.push(makeDraggable(ambientLightPanel.value, 'ambientLight'));
    if (spotLightPanel.value) dragCleanupFunctions.push(makeDraggable(spotLightPanel.value, 'spotLight'));
  });
};

onMounted(() => {
  setupScene();
});

// Watch for when loading is complete, then setup draggable panels
watch(isLoading, (newValue) => {
  if (!newValue) {
    setupDraggablePanels();
  }
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
  // Cleanup all draggable event listeners
  dragCleanupFunctions.forEach(cleanup => cleanup());
});
</script>

<template>
  <div class="fixed inset-0 bg-gray-900">
    <!-- Loading screen -->
    <div v-if="isLoading" class="fixed inset-0 flex items-center justify-center bg-gray-900 z-50">
      <p class="text-white text-2xl font-mono">Loading...</p>
    </div>

    <canvas
      ref="canvas"
      class="w-full h-full outline-0"
    ></canvas>

    <!-- Floor material controls -->
    <div v-if="!isLoading">
    <div ref="floorMaterialPanel" class="absolute top-64 left-4 bg-gray-700/90 text-white px-2 py-2 rounded-lg shadow-lg w-[200px]">
      <div class="flex items-center gap-2 mb-2">
        <svg class="drag-handle w-3 h-3 opacity-30 hover:opacity-70 cursor-grab" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="5" r="2"/>
          <circle cx="15" cy="5" r="2"/>
          <circle cx="9" cy="12" r="2"/>
          <circle cx="15" cy="12" r="2"/>
          <circle cx="9" cy="19" r="2"/>
          <circle cx="15" cy="19" r="2"/>
        </svg>
        <p class="text-xs font-sans font-semibold flex-1 text-center">Floor</p>
        <div class="relative">
          <svg @click="copyPanelContent(floorMaterialPanel, 'floor')" class="w-4 h-4 flex-shrink-0 cursor-pointer hover:opacity-70" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
          <div v-if="copiedPanel === 'floor'" class="absolute top-6 right-0 bg-green-500 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap animate-fade-in">
            Copié!
          </div>
        </div>
      </div>
      <div class="text-sm font-mono space-y-2">
        <p class="text-xs font-mono opacity-80">Color: {{ floorMaterialInfo.color }}</p>

        <div class="space-y-1">
          <label class="text-xs font-mono flex items-center justify-between">
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
            class="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div class="space-y-1">
          <label class="text-xs font-mono flex items-center justify-between">
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
            class="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div class="space-y-1">
          <label class="text-xs font-mono flex items-center justify-between">
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
            class="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
      <div class="absolute bottom-1 right-1">
        <svg class="drag-handle w-3 h-3 opacity-30 hover:opacity-70 cursor-grab" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="5" r="2"/>
          <circle cx="15" cy="5" r="2"/>
          <circle cx="9" cy="12" r="2"/>
          <circle cx="15" cy="12" r="2"/>
          <circle cx="9" cy="19" r="2"/>
          <circle cx="15" cy="19" r="2"/>
        </svg>
      </div>
    </div>

    <!-- Selected mesh display -->
    <div
      ref="selectedMeshPanel"
      class="absolute top-4 right-4 bg-green-600/90 text-white px-2 py-2 rounded-lg shadow-lg w-[200px]"
    >
      <div class="flex items-center gap-2 mb-1">
        <svg class="drag-handle w-3 h-3 opacity-30 hover:opacity-70 cursor-grab" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="5" r="2"/>
          <circle cx="15" cy="5" r="2"/>
          <circle cx="9" cy="12" r="2"/>
          <circle cx="15" cy="12" r="2"/>
          <circle cx="9" cy="19" r="2"/>
          <circle cx="15" cy="19" r="2"/>
        </svg>
        <p class="text-xs font-sans font-semibold flex-1 text-center">Mesh</p>
        <div class="relative">
          <svg @click="copyPanelContent(selectedMeshPanel, 'mesh')" class="w-4 h-4 flex-shrink-0 cursor-pointer hover:opacity-70" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
          <div v-if="copiedPanel === 'mesh'" class="absolute top-6 right-0 bg-green-500 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap animate-fade-in">
            Copié!
          </div>
        </div>
      </div>

      <div v-if="!selectedMeshName" class="text-sm italic opacity-70">
        Aucun mesh sélectionné
      </div>

      <div v-else>
        <p class="text-base font-mono mb-3 text-center overflow-hidden text-ellipsis whitespace-nowrap">{{ selectedMeshName }}</p>

        <div v-if="selectedMeshObject && (selectedMeshObject.material instanceof THREE.MeshPhysicalMaterial || selectedMeshObject.material instanceof THREE.MeshStandardMaterial)" class="text-sm font-mono space-y-2">
          <p class="text-xs font-mono opacity-80">Material: {{ selectedMeshObject.material.type }}</p>

          <div>
            <label class="text-xs font-mono flex items-center justify-between">
              <span>Color:</span>
              <span>#{{ selectedMeshObject.material.color.getHexString() }}</span>
              <input
                type="color"
                :value="'#' + selectedMeshObject.material.color.getHexString()"
                @input="updateMaterialColor(($event.target as HTMLInputElement).value)"
                class="w-6 h-6 rounded cursor-pointer border-0"
              />
            </label>
          </div>

          <div class="space-y-1">
            <label class="text-xs font-mono flex items-center justify-between">
              <span>Roughness:</span>
              <span>{{ selectedMeshObject.material.roughness.toFixed(2) }}</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="selectedMeshObject.material.roughness"
              @input="updateRoughness(parseFloat(($event.target as HTMLInputElement).value))"
              class="w-full h-1 bg-green-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-mono flex items-center justify-between">
              <span>Metalness:</span>
              <span>{{ selectedMeshObject.material.metalness.toFixed(2) }}</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="selectedMeshObject.material.metalness"
              @input="updateMetalness(parseFloat(($event.target as HTMLInputElement).value))"
              class="w-full h-1 bg-green-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <label class="text-xs font-mono flex items-center justify-between">
              <span>Emissive:</span>
              <span>#{{ selectedMeshObject.material.emissive.getHexString() }}</span>
              <input
                type="color"
                :value="'#' + selectedMeshObject.material.emissive.getHexString()"
                @input="updateEmissiveColor(($event.target as HTMLInputElement).value)"
                class="w-6 h-6 rounded cursor-pointer border-0"
              />
            </label>
          </div>

          <div class="space-y-1">
            <label class="text-xs font-mono flex items-center justify-between">
              <span>Emissive Int:</span>
              <span>{{ selectedMeshObject.material.emissiveIntensity.toFixed(2) }}</span>
            </label>
            <input
              type="range"
              min="0"
              max="25"
              step="0.01"
              :value="selectedMeshObject.material.emissiveIntensity"
              @input="updateEmissiveIntensity(parseFloat(($event.target as HTMLInputElement).value))"
              class="w-full h-1 bg-green-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-mono flex items-center justify-between cursor-pointer">
              <span>Transparent:</span>
              <input
                type="checkbox"
                :checked="selectedMeshObject.material.transparent"
                @change="updateTransparent(($event.target as HTMLInputElement).checked)"
                class="w-4 h-4 cursor-pointer"
              />
            </label>
          </div>

          <div v-if="selectedMeshObject.material.transparent" class="space-y-1">
            <label class="text-xs font-mono flex items-center justify-between">
              <span>Opacity:</span>
              <span>{{ selectedMeshObject.material.opacity.toFixed(2) }}</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="selectedMeshObject.material.opacity"
              @input="updateOpacity(parseFloat(($event.target as HTMLInputElement).value))"
              class="w-full h-1 bg-green-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <template v-if="selectedMeshObject.material instanceof THREE.MeshPhysicalMaterial">
            <div v-if="selectedMeshObject.material.transparent" class="space-y-1">
              <label class="text-xs font-mono flex items-center justify-between">
                <span>Transmission:</span>
                <span>{{ selectedMeshObject.material.transmission.toFixed(2) }}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                :value="selectedMeshObject.material.transmission"
                @input="updateTransmission(parseFloat(($event.target as HTMLInputElement).value))"
                class="w-full h-1 bg-green-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div v-if="selectedMeshObject.material.transparent" class="space-y-1">
              <label class="text-xs font-mono flex items-center justify-between">
                <span>Thickness:</span>
                <span>{{ selectedMeshObject.material.thickness.toFixed(2) }}</span>
              </label>
              <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                :value="selectedMeshObject.material.thickness"
                @input="updateThickness(parseFloat(($event.target as HTMLInputElement).value))"
                class="w-full h-1 bg-green-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </template>
        </div>
      </div>
      <div class="absolute bottom-1 right-1">
        <svg class="drag-handle w-3 h-3 opacity-30 hover:opacity-70 cursor-grab" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="5" r="2"/>
          <circle cx="15" cy="5" r="2"/>
          <circle cx="9" cy="12" r="2"/>
          <circle cx="15" cy="12" r="2"/>
          <circle cx="9" cy="19" r="2"/>
          <circle cx="15" cy="19" r="2"/>
        </svg>
      </div>
    </div>

    <!-- Camera position display -->
    <div ref="cameraPositionPanel" class="absolute bottom-4 left-4 bg-blue-600/90 text-white px-2 py-2 rounded-lg shadow-lg w-[200px]">
      <div class="flex items-center gap-2 mb-1">
        <svg class="drag-handle w-3 h-3 opacity-30 hover:opacity-70 cursor-grab" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="5" r="2"/>
          <circle cx="15" cy="5" r="2"/>
          <circle cx="9" cy="12" r="2"/>
          <circle cx="15" cy="12" r="2"/>
          <circle cx="9" cy="19" r="2"/>
          <circle cx="15" cy="19" r="2"/>
        </svg>
        <p class="text-xs font-sans font-semibold flex-1 text-center">Camera</p>
        <div class="relative">
          <svg @click="copyPanelContent(cameraPositionPanel, 'camera')" class="w-4 h-4 flex-shrink-0 cursor-pointer hover:opacity-70" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
          <div v-if="copiedPanel === 'camera'" class="absolute top-6 right-0 bg-green-500 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap animate-fade-in">
            Copié!
          </div>
        </div>
      </div>
      <div class="text-sm font-mono space-y-1">
        <p class="text-xs font-sans font-semibold mb-1 text-center opacity-80">Position</p>
        <p>X: {{ cameraPosition.x.toFixed(2) }}</p>
        <p>Y: {{ cameraPosition.y.toFixed(2) }}</p>
        <p>Z: {{ cameraPosition.z.toFixed(2) }}</p>

        <p class="text-xs font-sans font-semibold mt-2 mb-1 text-center opacity-80">Rotation (deg)</p>
        <p>X: {{ cameraRotation.x.toFixed(2) }}</p>
        <p>Y: {{ cameraRotation.y.toFixed(2) }}</p>
        <p>Z: {{ cameraRotation.z.toFixed(2) }}</p>
      </div>
      <div class="absolute bottom-1 right-1">
        <svg class="drag-handle w-3 h-3 opacity-30 hover:opacity-70 cursor-grab" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="5" r="2"/>
          <circle cx="15" cy="5" r="2"/>
          <circle cx="9" cy="12" r="2"/>
          <circle cx="15" cy="12" r="2"/>
          <circle cx="9" cy="19" r="2"/>
          <circle cx="15" cy="19" r="2"/>
        </svg>
      </div>
    </div>

    <!-- Object position controls -->
    <div
      ref="objectTransformPanel"
      class="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-red-600/90 text-white px-2 py-2 rounded-lg shadow-lg w-[200px]"
    >
      <div class="flex items-center gap-2 mb-1">
        <svg class="drag-handle w-3 h-3 opacity-30 hover:opacity-70 cursor-grab" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="5" r="2"/>
          <circle cx="15" cy="5" r="2"/>
          <circle cx="9" cy="12" r="2"/>
          <circle cx="15" cy="12" r="2"/>
          <circle cx="9" cy="19" r="2"/>
          <circle cx="15" cy="19" r="2"/>
        </svg>
        <p class="text-xs font-sans font-semibold flex-1 text-center">Object</p>
        <div class="relative">
          <svg @click="copyPanelContent(objectTransformPanel, 'transform')" class="w-4 h-4 flex-shrink-0 cursor-pointer hover:opacity-70" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
          <div v-if="copiedPanel === 'transform'" class="absolute top-6 right-0 bg-green-500 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap animate-fade-in">
            Copié!
          </div>
        </div>
      </div>

      <div v-if="!selectedObject" class="text-sm italic opacity-70 text-center">
        Aucun objet sélectionné
      </div>

      <div v-else>
        <p class="text-base font-mono mb-3 text-center overflow-hidden text-ellipsis whitespace-nowrap">{{ selectedObjectName }}</p>

        <!-- Position controls -->
        <p class="text-xs font-sans font-semibold mb-1 text-center opacity-80">Position</p>
        <div class="grid grid-cols-3 gap-1 mb-2">
          <!-- X Position -->
          <div class="space-y-1">
            <label class="text-xs font-sans font-semibold block text-center">X</label>
            <input
              type="number"
              step="0.1"
              :value="selectedObjectPosition.x"
              @input="updateObjectPositionX(parseFloat(($event.target as HTMLInputElement).value))"
              class="w-full px-1 py-1 text-[0.625rem] font-mono text-white bg-black/30 rounded border-2 border-white focus:outline-none focus:border-yellow-300"
            />
          </div>

          <!-- Y Position -->
          <div class="space-y-1">
            <label class="text-xs font-sans font-semibold block text-center">Y</label>
            <input
              type="number"
              step="0.1"
              :value="selectedObjectPosition.y"
              @input="updateObjectPositionY(parseFloat(($event.target as HTMLInputElement).value))"
              class="w-full px-1 py-1 text-[0.625rem] font-mono text-white bg-black/30 rounded border-2 border-white focus:outline-none focus:border-yellow-300"
            />
          </div>

          <!-- Z Position -->
          <div class="space-y-1">
            <label class="text-xs font-sans font-semibold block text-center">Z</label>
            <input
              type="number"
              step="0.1"
              :value="selectedObjectPosition.z"
              @input="updateObjectPositionZ(parseFloat(($event.target as HTMLInputElement).value))"
              class="w-full px-1 py-1 text-[0.625rem] font-mono text-white bg-black/30 rounded border-2 border-white focus:outline-none focus:border-yellow-300"
            />
          </div>
        </div>

        <!-- Rotation controls -->
        <p class="text-xs font-sans font-semibold mb-1 text-center opacity-80">Rotation (degrees)</p>
        <div class="grid grid-cols-3 gap-1 mb-2">
          <!-- X Rotation -->
          <div class="space-y-1">
            <label class="text-xs font-sans font-semibold block text-center">X</label>
            <input
              type="number"
              step="1"
              :value="selectedObjectRotation.x"
              @input="updateObjectRotationX(parseFloat(($event.target as HTMLInputElement).value))"
              class="w-full px-1 py-1 text-[0.625rem] font-mono text-white bg-black/30 rounded border-2 border-white focus:outline-none focus:border-yellow-300"
            />
          </div>

          <!-- Y Rotation -->
          <div class="space-y-1">
            <label class="text-xs font-sans font-semibold block text-center">Y</label>
            <input
              type="number"
              step="1"
              :value="selectedObjectRotation.y"
              @input="updateObjectRotationY(parseFloat(($event.target as HTMLInputElement).value))"
              class="w-full px-1 py-1 text-[0.625rem] font-mono text-white bg-black/30 rounded border-2 border-white focus:outline-none focus:border-yellow-300"
            />
          </div>

          <!-- Z Rotation -->
          <div class="space-y-1">
            <label class="text-xs font-sans font-semibold block text-center">Z</label>
            <input
              type="number"
              step="1"
              :value="selectedObjectRotation.z"
              @input="updateObjectRotationZ(parseFloat(($event.target as HTMLInputElement).value))"
              class="w-full px-1 py-1 text-[0.625rem] font-mono text-white bg-black/30 rounded border-2 border-white focus:outline-none focus:border-yellow-300"
            />
          </div>
        </div>

        <!-- Scale control -->
        <p class="text-xs font-sans font-semibold mb-1 text-center opacity-80">Scale</p>
        <div class="flex justify-center">
          <div class="space-y-1 w-16">
            <input
              type="number"
              step="0.01"
              :value="selectedObjectScale"
              @input="updateObjectScale(parseFloat(($event.target as HTMLInputElement).value))"
              class="w-full px-1 py-1 text-[0.625rem] font-mono text-white bg-black/30 rounded border-2 border-white focus:outline-none focus:border-yellow-300 text-center"
            />
          </div>
        </div>
      </div>
      <div class="absolute bottom-1 right-1">
        <svg class="drag-handle w-3 h-3 opacity-30 hover:opacity-70 cursor-grab" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="5" r="2"/>
          <circle cx="15" cy="5" r="2"/>
          <circle cx="9" cy="12" r="2"/>
          <circle cx="15" cy="12" r="2"/>
          <circle cx="9" cy="19" r="2"/>
          <circle cx="15" cy="19" r="2"/>
        </svg>
      </div>
    </div>

    <!-- Ambient light info display -->
    <div ref="ambientLightPanel" class="absolute bottom-[32rem] right-4 bg-cyan-600/90 text-white px-2 py-2 rounded-lg shadow-lg w-[200px]">
      <div class="flex items-center gap-2 mb-2">
        <svg class="drag-handle w-3 h-3 opacity-30 hover:opacity-70 cursor-grab" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="5" r="2"/>
          <circle cx="15" cy="5" r="2"/>
          <circle cx="9" cy="12" r="2"/>
          <circle cx="15" cy="12" r="2"/>
          <circle cx="9" cy="19" r="2"/>
          <circle cx="15" cy="19" r="2"/>
        </svg>
        <p class="text-xs font-sans font-semibold flex-1 text-center">Ambiant light</p>
        <div class="relative">
          <svg @click="copyPanelContent(ambientLightPanel, 'ambient')" class="w-4 h-4 flex-shrink-0 cursor-pointer hover:opacity-70" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
          <div v-if="copiedPanel === 'ambient'" class="absolute top-6 right-0 bg-green-500 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap animate-fade-in">
            Copié!
          </div>
        </div>
      </div>
      <div class="text-sm font-mono space-y-2">
        <div>
          <label class="text-xs font-mono flex items-center justify-between">
            <span>Color:</span>
            <span>{{ ambientLightInfo.color }}</span>
            <input
              type="color"
              :value="ambientLightInfo.color"
              @input="updateAmbientLightColor(($event.target as HTMLInputElement).value)"
              class="w-6 h-6 rounded cursor-pointer border-0"
            />
          </label>
        </div>

        <div class="space-y-1">
          <label class="text-xs font-mono flex items-center justify-between">
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
            class="w-full h-1 bg-cyan-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
      <div class="absolute bottom-1 right-1">
        <svg class="drag-handle w-3 h-3 opacity-30 hover:opacity-70 cursor-grab" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="5" r="2"/>
          <circle cx="15" cy="5" r="2"/>
          <circle cx="9" cy="12" r="2"/>
          <circle cx="15" cy="12" r="2"/>
          <circle cx="9" cy="19" r="2"/>
          <circle cx="15" cy="19" r="2"/>
        </svg>
      </div>
    </div>

    <!-- Spot light info display -->
    <div ref="spotLightPanel" class="absolute bottom-4 right-4 bg-yellow-600/90 text-white px-2 py-2 rounded-lg shadow-lg w-[200px]">
      <div class="flex items-center gap-2 mb-2">
        <svg class="drag-handle w-3 h-3 opacity-30 hover:opacity-70 cursor-grab" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="5" r="2"/>
          <circle cx="15" cy="5" r="2"/>
          <circle cx="9" cy="12" r="2"/>
          <circle cx="15" cy="12" r="2"/>
          <circle cx="9" cy="19" r="2"/>
          <circle cx="15" cy="19" r="2"/>
        </svg>
        <p class="text-xs font-sans font-semibold flex-1 text-center">Directionnal light</p>
        <div class="relative">
          <svg @click="copyPanelContent(spotLightPanel, 'spot')" class="w-4 h-4 flex-shrink-0 cursor-pointer hover:opacity-70" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
          <div v-if="copiedPanel === 'spot'" class="absolute top-6 right-0 bg-green-500 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap animate-fade-in">
            Copié!
          </div>
        </div>
      </div>
      <div class="text-xs font-mono space-y-1">
        <p class="text-xs font-sans font-semibold mb-1 text-center opacity-80">Position</p>
        <div class="grid grid-cols-3 gap-1 mb-2">
          <div class="space-y-1">
            <label class="text-xs font-sans font-semibold block text-center">X</label>
            <input
              type="number"
              step="0.1"
              :value="lightInfo.position.x"
              @input="updateSpotLightPositionX(parseFloat(($event.target as HTMLInputElement).value))"
              class="w-full px-1 py-1 text-[0.625rem] font-mono text-white bg-black/30 rounded border-2 border-white focus:outline-none focus:border-yellow-300"
            />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-sans font-semibold block text-center">Y</label>
            <input
              type="number"
              step="0.1"
              :value="lightInfo.position.y"
              @input="updateSpotLightPositionY(parseFloat(($event.target as HTMLInputElement).value))"
              class="w-full px-1 py-1 text-[0.625rem] font-mono text-white bg-black/30 rounded border-2 border-white focus:outline-none focus:border-yellow-300"
            />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-sans font-semibold block text-center">Z</label>
            <input
              type="number"
              step="0.1"
              :value="lightInfo.position.z"
              @input="updateSpotLightPositionZ(parseFloat(($event.target as HTMLInputElement).value))"
              class="w-full px-1 py-1 text-[0.625rem] font-mono text-white bg-black/30 rounded border-2 border-white focus:outline-none focus:border-yellow-300"
            />
          </div>
        </div>

        <p class="text-xs font-sans font-semibold mb-1 text-center opacity-80">Direction</p>
        <div class="grid grid-cols-3 gap-1 mb-2">
          <div class="space-y-1">
            <label class="text-xs font-sans font-semibold block text-center">X</label>
            <input
              type="number"
              step="0.01"
              :value="lightInfo.direction.x"
              @input="updateSpotLightDirectionX(parseFloat(($event.target as HTMLInputElement).value))"
              class="w-full px-1 py-1 text-[0.625rem] font-mono text-white bg-black/30 rounded border-2 border-white focus:outline-none focus:border-yellow-300"
            />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-sans font-semibold block text-center">Y</label>
            <input
              type="number"
              step="0.01"
              :value="lightInfo.direction.y"
              @input="updateSpotLightDirectionY(parseFloat(($event.target as HTMLInputElement).value))"
              class="w-full px-1 py-1 text-[0.625rem] font-mono text-white bg-black/30 rounded border-2 border-white focus:outline-none focus:border-yellow-300"
            />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-sans font-semibold block text-center">Z</label>
            <input
              type="number"
              step="0.01"
              :value="lightInfo.direction.z"
              @input="updateSpotLightDirectionZ(parseFloat(($event.target as HTMLInputElement).value))"
              class="w-full px-1 py-1 text-[0.625rem] font-mono text-white bg-black/30 rounded border-2 border-white focus:outline-none focus:border-yellow-300"
            />
          </div>
        </div>

        <div class="mt-2">
          <label class="text-xs font-mono flex items-center justify-between">
            <span>Color:</span>
            <span>{{ lightInfo.color }}</span>
            <input
              type="color"
              :value="lightInfo.color"
              @input="updateSpotLightColor(($event.target as HTMLInputElement).value)"
              class="w-6 h-6 rounded cursor-pointer border-0"
            />
          </label>
        </div>

        <div class="space-y-1">
          <label class="text-xs font-mono flex items-center justify-between">
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
            class="w-full h-1 bg-yellow-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div class="space-y-1">
          <label class="text-xs font-mono flex items-center justify-between">
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
            class="w-full h-1 bg-yellow-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div class="space-y-1">
          <label class="text-xs font-mono flex items-center justify-between">
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
            class="w-full h-1 bg-yellow-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div class="space-y-1">
          <label class="text-xs font-mono flex items-center justify-between">
            <span>Distance:</span>
            <span>{{ lightInfo.distance.toFixed(1) }}</span>
          </label>
          <input
            type="range"
            min="0"
            max="11.11"
            step="0.1"
            :value="lightInfo.distance"
            @input="updateSpotLightDistance(parseFloat(($event.target as HTMLInputElement).value))"
            class="w-full h-1 bg-yellow-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
      <div class="absolute bottom-1 right-1">
        <svg class="drag-handle w-3 h-3 opacity-30 hover:opacity-70 cursor-grab" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="5" r="2"/>
          <circle cx="15" cy="5" r="2"/>
          <circle cx="9" cy="12" r="2"/>
          <circle cx="15" cy="12" r="2"/>
          <circle cx="9" cy="19" r="2"/>
          <circle cx="15" cy="19" r="2"/>
        </svg>
      </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fade-in {
  0% {
    opacity: 0;
    transform: translateY(-5px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}

/* Floor panel sliders - lighter gray thumb */
input[type="range"].bg-gray-800::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #d1d5db;
  cursor: pointer;
}

input[type="range"].bg-gray-800::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #d1d5db;
  cursor: pointer;
  border: none;
}

/* Mesh panel sliders - lighter green thumb */
input[type="range"].bg-green-700::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #86efac;
  cursor: pointer;
}

input[type="range"].bg-green-700::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #86efac;
  cursor: pointer;
  border: none;
}

/* Ambient light panel sliders - lighter cyan thumb */
input[type="range"].bg-cyan-700::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #67e8f9;
  cursor: pointer;
}

input[type="range"].bg-cyan-700::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #67e8f9;
  cursor: pointer;
  border: none;
}

/* Directional light panel sliders - lighter yellow thumb */
input[type="range"].bg-yellow-700::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fde047;
  cursor: pointer;
}

input[type="range"].bg-yellow-700::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fde047;
  cursor: pointer;
  border: none;
}
</style>
