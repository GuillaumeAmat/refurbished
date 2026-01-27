<template>
  <div class="overcooked-viewer">
    <!-- Loading screen -->
    <div
      v-if="isLoading"
      class="loading-screen"
    >
      <p class="loading-text">Loading Kitchen Assets...</p>
    </div>

    <canvas ref="canvasRef" />

    <!-- Ambient Light Panel -->
    <div
      v-if="!isLoading"
      class="settings-panels"
    >
      <div class="settings-panel bg-yellow">
        <p class="panel-title">Ambient Light</p>
        <div class="panel-content">
          <label class="setting-row">
            <span>Color:</span>
            <input
              type="color"
              :value="ambientLightInfo.color"
              @input="updateAmbientLightColor(($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="setting-row">
            <span>Intensity: {{ ambientLightInfo.intensity.toFixed(2) }}</span>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              :value="ambientLightInfo.intensity"
              @input="updateAmbientLightIntensity(parseFloat(($event.target as HTMLInputElement).value))"
            />
          </label>
        </div>
      </div>

      <div class="settings-panel bg-cyan">
        <p class="panel-title">Workbench</p>
        <div class="panel-content">
          <label class="setting-row">
            <span>X: {{ workbenchSettings.position.x.toFixed(1) }}</span>
            <input
              type="range"
              min="-50"
              max="50"
              step="0.5"
              :value="workbenchSettings.position.x"
              @input="updateWorkbenchPosition('x', parseFloat(($event.target as HTMLInputElement).value))"
            />
          </label>
          <label class="setting-row">
            <span>Y: {{ workbenchSettings.position.y.toFixed(1) }}</span>
            <input
              type="range"
              min="-10"
              max="20"
              step="0.5"
              :value="workbenchSettings.position.y"
              @input="updateWorkbenchPosition('y', parseFloat(($event.target as HTMLInputElement).value))"
            />
          </label>
          <label class="setting-row">
            <span>Z: {{ workbenchSettings.position.z.toFixed(1) }}</span>
            <input
              type="range"
              min="-50"
              max="50"
              step="0.5"
              :value="workbenchSettings.position.z"
              @input="updateWorkbenchPosition('z', parseFloat(($event.target as HTMLInputElement).value))"
            />
          </label>
          <label class="setting-row">
            <span>Scale: {{ workbenchSettings.scale.toFixed(2) }}</span>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              :value="workbenchSettings.scale"
              @input="updateWorkbenchScale(parseFloat(($event.target as HTMLInputElement).value))"
            />
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { loadPrefabModel } from '~/three/utils/prefabLoader';
import { definePageMeta, useSimpleHead } from '#imports';

definePageMeta({
  layout: false,
});

useSimpleHead({
  title: 'Overcooked Kitchen - BackTrack',
  description: 'Overcooked kitchen assets viewer',
  suffixedTitle: false,
});

const canvasRef = ref<HTMLCanvasElement | null>(null);
const isLoading = ref(true);
const ambientLightInfo = ref({
  color: '#ffffff',
  intensity: 5,
});

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let ambientLight: THREE.AmbientLight;
let toonModel: THREE.Group;
let normalModel: THREE.Group;
let workbench: THREE.Group;

const workbenchSettings = ref({
  position: { x: 0, y: 0, z: 5 },
  scale: 1,
});

const loadKitchenModels = async () => {
  const loader = new GLTFLoader();

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  loader.setDRACOLoader(dracoLoader);

  try {
    // Load GLB twice for completely separate instances
    const [gltfToon, gltfNormal] = await Promise.all([
      loader.loadAsync('/models/overcooked_kitchen_assets_fan_art.glb'),
      loader.loadAsync('/models/overcooked_kitchen_assets_fan_art.glb'),
    ]);

    // Model 1: Toon shading (left side) - with outline
    toonModel = gltfToon.scene;
    toonModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // Convert to toon material
        const oldMat = child.material as THREE.MeshStandardMaterial;
        const toonMat = new THREE.MeshToonMaterial({
          color: oldMat.color || 0xffffff,
          map: oldMat.map || null,
        });
        child.material = toonMat;
      }
    });
    toonModel.position.set(-25, 0, 0);
    scene.add(toonModel);

    // Model 2: Normal/Standard shading (right side)
    normalModel = gltfNormal.scene;
    normalModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    normalModel.position.set(25, 0, 0);
    scene.add(normalModel);

    // Load workbench
    workbench = await loadPrefabModel({
      objPath: '/experiments/plan-de-travail.obj',
      mtlPath: '/experiments/plan-de-travail.mtl',
      modelName: 'WORKBENCH',
    });
    workbench.position.set(
      workbenchSettings.value.position.x,
      workbenchSettings.value.position.y,
      workbenchSettings.value.position.z
    );
    workbench.scale.setScalar(workbenchSettings.value.scale);
    scene.add(workbench);

    console.log('Kitchen models loaded successfully (toon + normal)');
  } catch (error) {
    console.error('Failed to load kitchen models:', error);
  } finally {
    isLoading.value = false;
  }
};

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

const updateWorkbenchPosition = (axis: 'x' | 'y' | 'z', value: number) => {
  if (!workbench) return;
  workbench.position[axis] = value;
  workbenchSettings.value.position[axis] = value;
};

const updateWorkbenchScale = (value: number) => {
  if (!workbench) return;
  workbench.scale.setScalar(value);
  workbenchSettings.value.scale = value;
};

const setupScene = async () => {
  if (!canvasRef.value) return;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  // Camera
  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 200);
  camera.position.set(0, 50, 80);
  camera.lookAt(0, 0, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // OrbitControls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 0, 0);

  // Ambient Light
  ambientLight = new THREE.AmbientLight(0xffffff, 5);
  ambientLight.layers.enableAll();
  scene.add(ambientLight);
  ambientLightInfo.value = {
    color: '#' + ambientLight.color.getHexString(),
    intensity: ambientLight.intensity,
  };

  // Directional Light Left (for toon model)
  const directionalLightLeft = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLightLeft.position.set(-20, 15, 10);
  directionalLightLeft.castShadow = true;
  directionalLightLeft.shadow.mapSize.width = 2048;
  directionalLightLeft.shadow.mapSize.height = 2048;
  directionalLightLeft.shadow.camera.left = -15;
  directionalLightLeft.shadow.camera.right = 15;
  directionalLightLeft.shadow.camera.top = 15;
  directionalLightLeft.shadow.camera.bottom = -15;
  directionalLightLeft.layers.enableAll();
  scene.add(directionalLightLeft);

  // Directional Light Right (for normal model)
  const directionalLightRight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLightRight.position.set(30, 15, 10);
  directionalLightRight.castShadow = true;
  directionalLightRight.shadow.mapSize.width = 2048;
  directionalLightRight.shadow.mapSize.height = 2048;
  directionalLightRight.shadow.camera.left = -15;
  directionalLightRight.shadow.camera.right = 15;
  directionalLightRight.shadow.camera.top = 15;
  directionalLightRight.shadow.camera.bottom = -15;
  directionalLightRight.layers.enableAll();
  scene.add(directionalLightRight);

  // Load kitchen models (toon + normal)
  await loadKitchenModels();

  // Event listeners
  window.addEventListener('resize', onWindowResize);

  // Start animation loop
  animate();
};

const animate = () => {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
};

const onWindowResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};

onMounted(() => {
  setupScene();
});

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize);
  renderer?.dispose();
});
</script>

<style scoped>
.overcooked-viewer {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.loading-screen {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  z-index: 9999;
}

.loading-text {
  color: #333;
  font-size: 2rem;
  font-family: monospace;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: default;
}

.settings-panels {
  position: absolute;
  bottom: 20px;
  left: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 100;
}

.settings-panel {
  padding: 12px;
  border-radius: 8px;
  color: white;
  width: 200px;
  user-select: none;
}

.bg-yellow {
  background-color: rgba(202, 138, 4, 0.9);
}

.bg-cyan {
  background-color: rgba(8, 145, 178, 0.9);
}

.panel-title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 10px;
  text-align: center;
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  font-family: monospace;
}

.setting-row span {
  display: flex;
  justify-content: space-between;
}
</style>
