<template>
  <div class="level-editor">
    <!-- Loading screen -->
    <div
      v-if="isLoading"
      class="loading-screen"
    >
      <p class="loading-text">Loading...</p>
    </div>

    <canvas ref="canvasRef" />

    <!-- Top Right Buttons -->
    <div
      v-if="!isLoading"
      class="top-right-buttons"
    >
      <!-- Toggle Settings Panels Button (Eye) -->
      <button
        v-if="!isTestMode"
        class="toggle-btn"
        @click="showSettingsPanels = !showSettingsPanels"
        :title="showSettingsPanels ? 'Hide Settings' : 'Show Settings'"
      >
        <svg
          v-if="showSettingsPanels"
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
        <svg
          v-else
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
          />
        </svg>
      </button>
      <!-- Test Mode Button -->
      <button
        class="test-mode-btn-inline"
        @click="toggleTestMode"
        :class="{ active: isTestMode }"
      >
        {{ isTestMode ? 'Exit Test Mode' : 'Test Mode' }}
      </button>
    </div>

    <!-- Toggle Prefab Panel Button -->
    <button
      v-if="!isLoading && !isTestMode"
      class="toggle-prefab-panel-btn"
      @click="showPrefabPanel = !showPrefabPanel"
    >
      {{ showPrefabPanel ? '✕' : '☰' }}
    </button>

    <!-- Prefab Selection Panel -->
    <div
      v-if="!isLoading && !isTestMode && showPrefabPanel"
      class="prefab-panel"
      @click.stop
    >
      <div class="prefab-sections">
        <div class="prefab-section">
          <h4>Prefabs</h4>
          <div class="prefab-grid">
            <button
              v-for="prefab in prefabItems"
              :key="prefab.type"
              class="prefab-thumb"
              @click="addPrefab(prefab.type)"
              :title="prefab.label"
            >
              <img
                v-if="prefabThumbnails[prefab.type]"
                :src="prefabThumbnails[prefab.type]"
                :alt="prefab.label"
              />
              <span
                v-else
                class="thumb-placeholder"
              >{{ prefab.label.charAt(0) }}</span>
            </button>
          </div>
        </div>
        <div class="prefab-section">
          <h4>Resources</h4>
          <div class="prefab-grid">
            <button
              v-for="resource in resourceItems"
              :key="resource.type"
              class="prefab-thumb"
              @click="addPrefab(resource.type)"
              :title="resource.label"
            >
              <img
                v-if="prefabThumbnails[resource.type]"
                :src="prefabThumbnails[resource.type]"
                :alt="resource.label"
              />
              <span
                v-else
                class="thumb-placeholder"
              >{{ resource.label.charAt(0) }}</span>
            </button>
          </div>
        </div>
      </div>
      <button
        class="save-btn"
        @click="saveLevel"
      >💾 Save</button>
    </div>

    <!-- Save Toast -->
    <div
      v-if="showSaveToast"
      class="save-toast"
    >
      Save in progress...
    </div>

    <!-- Copy Toast -->
    <div
      v-if="showCopyToast"
      class="copy-toast"
    >
      {{ copyToastMessage }}
    </div>

    <!-- Settings Panels (stacked on left) -->
    <div
      v-if="!isLoading && !isTestMode && showSettingsPanels"
      class="settings-panels"
    >
      <!-- Directional Light Panel -->
      <div class="settings-panel bg-cyan-600/90">
        <p class="panel-title">Directional Light</p>
        <div class="panel-content">
          <label class="setting-row">
            <span>Color:</span>
            <input
              type="color"
              :value="directionalLightInfo.color"
              @input="updateDirectionalLightColor(($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="setting-row">
            <span>Intensity: {{ directionalLightInfo.intensity.toFixed(2) }}</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              :value="directionalLightInfo.intensity"
              @input="updateDirectionalLightIntensity(parseFloat(($event.target as HTMLInputElement).value))"
            />
          </label>
          <p class="subsection-title">Position</p>
          <label class="setting-row">
            <span>X: {{ directionalLightInfo.position.x.toFixed(1) }}</span>
            <input
              type="range"
              min="-50"
              max="50"
              step="1"
              :value="directionalLightInfo.position.x"
              @input="updateDirectionalLightPosition('x', parseFloat(($event.target as HTMLInputElement).value))"
            />
          </label>
          <label class="setting-row">
            <span>Y: {{ directionalLightInfo.position.y.toFixed(1) }}</span>
            <input
              type="range"
              min="5"
              max="50"
              step="1"
              :value="directionalLightInfo.position.y"
              @input="updateDirectionalLightPosition('y', parseFloat(($event.target as HTMLInputElement).value))"
            />
          </label>
          <label class="setting-row">
            <span>Z: {{ directionalLightInfo.position.z.toFixed(1) }}</span>
            <input
              type="range"
              min="-50"
              max="50"
              step="1"
              :value="directionalLightInfo.position.z"
              @input="updateDirectionalLightPosition('z', parseFloat(($event.target as HTMLInputElement).value))"
            />
          </label>
          <label class="setting-row checkbox">
            <span>Show Grid</span>
            <input
              type="checkbox"
              :checked="showGrid"
              @change="toggleGrid"
            />
          </label>
        </div>
      </div>

      <!-- Ambient Light Panel -->
      <div class="settings-panel bg-yellow-600/90">
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
              max="3"
              step="0.1"
              :value="ambientLightInfo.intensity"
              @input="updateAmbientLightIntensity(parseFloat(($event.target as HTMLInputElement).value))"
            />
          </label>
        </div>
      </div>

      <!-- Neon Lights Panel -->
      <div class="settings-panel bg-purple-600/90">
        <p class="panel-title">Neon Lights</p>
        <div class="panel-content">
          <label class="setting-row">
            <span>Spotlight: {{ neonLightInfo.spotlightIntensity.toFixed(1) }}</span>
            <input
              type="range"
              min="0"
              max="30"
              step="0.5"
              :value="neonLightInfo.spotlightIntensity"
              @input="updateNeonSpotlightIntensity(parseFloat(($event.target as HTMLInputElement).value))"
            />
          </label>
          <label class="setting-row">
            <span>Emissive: {{ neonLightInfo.emissiveIntensity.toFixed(1) }}</span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              :value="neonLightInfo.emissiveIntensity"
              @input="updateNeonEmissiveIntensity(parseFloat(($event.target as HTMLInputElement).value))"
            />
          </label>
          <label class="setting-row">
            <span>Glass Emissive: {{ neonLightInfo.glassEmissiveIntensity.toFixed(1) }}</span>
            <input
              type="range"
              min="0"
              max="20"
              step="0.5"
              :value="neonLightInfo.glassEmissiveIntensity"
              @input="updateNeonGlassEmissiveIntensity(parseFloat(($event.target as HTMLInputElement).value))"
            />
          </label>
        </div>
      </div>
    </div>

    <!-- Transform Panel (shown when objects selected) -->
    <div
      v-if="selectedObjects.length > 0 && !isTestMode"
      class="transform-panel"
      @click.stop
    >
      <h3>Transform</h3>
      <p
        class="prefab-name"
        v-if="selectedObjects.length === 1"
      >{{ selectedObjects[0].userData.prefabType }}</p>
      <p
        class="prefab-name"
        v-else
      >{{ selectedObjects.length }} objects selected</p>

      <template v-if="selectedObjects.length === 1">
        <p class="section-label">Position</p>
        <div class="control-row">
          <div class="control-group compact">
            <label>X: {{ selectedObjects[0].position.x.toFixed(1) }}</label>
            <div class="buttons">
              <button
                @click.stop="adjustPosition('x', -1)"
                @mousedown.stop
              >-</button>
              <button
                @click.stop="adjustPosition('x', 1)"
                @mousedown.stop
              >+</button>
            </div>
          </div>
          <div class="control-group compact">
            <label>Y: {{ selectedObjects[0].position.y.toFixed(1) }}</label>
            <div class="buttons">
              <button
                @click.stop="adjustPosition('y', -1)"
                @mousedown.stop
              >-</button>
              <button
                @click.stop="adjustPosition('y', 1)"
                @mousedown.stop
              >+</button>
            </div>
          </div>
          <div class="control-group compact">
            <label>Z: {{ selectedObjects[0].position.z.toFixed(1) }}</label>
            <div class="buttons">
              <button
                @click.stop="adjustPosition('z', -1)"
                @mousedown.stop
              >-</button>
              <button
                @click.stop="adjustPosition('z', 1)"
                @mousedown.stop
              >+</button>
            </div>
          </div>
        </div>

        <p class="section-label">Rotation</p>
        <div class="control-row">
          <div class="control-group compact">
            <label>X: {{ (selectedObjects[0].rotation.x * 180 / Math.PI).toFixed(0) }}°</label>
            <div class="buttons">
              <button
                @click.stop="adjustRotationAxis('x', -15)"
                @mousedown.stop
              >-</button>
              <button
                @click.stop="adjustRotationAxis('x', 15)"
                @mousedown.stop
              >+</button>
            </div>
          </div>
          <div class="control-group compact">
            <label>Y: {{ (selectedObjects[0].rotation.y * 180 / Math.PI).toFixed(0) }}°</label>
            <div class="buttons">
              <button
                @click.stop="adjustRotationAxis('y', -15)"
                @mousedown.stop
              >-</button>
              <button
                @click.stop="adjustRotationAxis('y', 15)"
                @mousedown.stop
              >+</button>
            </div>
          </div>
          <div class="control-group compact">
            <label>Z: {{ (selectedObjects[0].rotation.z * 180 / Math.PI).toFixed(0) }}°</label>
            <div class="buttons">
              <button
                @click.stop="adjustRotationAxis('z', -15)"
                @mousedown.stop
              >-</button>
              <button
                @click.stop="adjustRotationAxis('z', 15)"
                @mousedown.stop
              >+</button>
            </div>
          </div>
        </div>
      </template>

      <button
        class="delete-btn"
        @click="deleteSelected"
      >Delete{{ selectedObjects.length > 1 ? ' All' : '' }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { createWorkbenchPrefab } from '~/three/prefabs/WorkbenchPrefab';
import { createNeonWallPrefab } from '~/three/prefabs/NeonWallPrefab';
import { createBlueWorkZonePrefab } from '~/three/prefabs/BlueWorkZonePrefab';
import { createWoodWallPrefab } from '~/three/prefabs/WoodWallPrefab';
import { PhysicsManager } from '~/three/utils/PhysicsManager';
import { CowController } from '~/three/controllers/CowController';
import { PrefabColliderManager } from '~/three/utils/PrefabColliderManager';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const textureLoader = new THREE.TextureLoader();

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let effect: OutlineEffect;
let controls: OrbitControls;
let raycaster: THREE.Raycaster;
let mouse: THREE.Vector2;
let floor: THREE.Mesh;
let dragPlane: THREE.Plane;
let isDragging = false;
let selectionHelpers: THREE.BoxHelper[] = [];
let dragOffsets = new Map<THREE.Group, THREE.Vector3>();
let directionalLight: THREE.DirectionalLight;
let ambientLight: THREE.AmbientLight;
let gridHelper: THREE.GridHelper;

const selectedObjects = ref<THREE.Group[]>([]);
const placedObjects = ref<THREE.Group[]>([]);
const showSaveToast = ref(false);
const showCopyToast = ref(false);
const copyToastMessage = ref('');
type PrefabType = 'workbench' | 'neonwall-yellow' | 'neonwall-blue' | 'blueworkzone' | 'woodwall' | 'battery-full' | 'battery-low' | 'chassis' | 'chassis-broken' | 'screen-repaired' | 'screen-broken';
const copiedData = ref<Array<{ type: PrefabType; position: { x: number; y: number; z: number }; rotation: { y: number } }>>([]);
const directionalLightInfo = ref({
  color: '#ffffff',
  intensity: 1.5,
  position: { x: 0, y: 20, z: 0 }
});
const ambientLightInfo = ref({
  color: '#ffffff',
  intensity: 0.5
});
const neonLightInfo = ref({
  spotlightIntensity: 9.0,
  emissiveIntensity: 35,
  glassEmissiveIntensity: 7
});
const isLoading = ref(true);
const showGrid = ref(true);
const showPrefabPanel = ref(false);
const showSettingsPanels = ref(true);
const isTestMode = ref(false);

// Prefab items for the panel
const prefabItems = [
  { type: 'workbench' as PrefabType, label: 'Workbench' },
  { type: 'neonwall-yellow' as PrefabType, label: 'Neon Yellow' },
  { type: 'neonwall-blue' as PrefabType, label: 'Neon Blue' },
  { type: 'blueworkzone' as PrefabType, label: 'Work Zone' },
  { type: 'woodwall' as PrefabType, label: 'Wood Wall' },
];

const resourceItems = [
  { type: 'battery-full' as PrefabType, label: 'Battery Full' },
  { type: 'battery-low' as PrefabType, label: 'Battery Low' },
  { type: 'chassis' as PrefabType, label: 'Chassis' },
  { type: 'chassis-broken' as PrefabType, label: 'Chassis Broken' },
  { type: 'screen-repaired' as PrefabType, label: 'Screen OK' },
  { type: 'screen-broken' as PrefabType, label: 'Screen Broken' },
];

const prefabThumbnails = ref<Record<string, string>>({});

// Test mode variables (outside reactive state)
let physicsManager: PhysicsManager | null = null;
let cowController: CowController | null = null;
let prefabColliderManager: PrefabColliderManager | null = null;
let storedCameraPosition: THREE.Vector3 | null = null;
let storedCameraTarget: THREE.Vector3 | null = null;
let preloadedCowModel: THREE.Group | null = null;


// GLB model cache for robot parts
const glbModelCache = new Map<string, THREE.Group>();
const glbLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
glbLoader.setDRACOLoader(dracoLoader);

// GLB paths for robot parts only
const GLB_PREFAB_PATHS: Record<string, string> = {
  'battery-full': '/models/battery_full.glb',
  'battery-low': '/models/battery_low.glb',
  'chassis': '/models/chassis.glb',
  'chassis-broken': '/models/chassis_broken.glb',
  'screen-repaired': '/models/screen_repaired.glb',
  'screen-broken': '/models/screen_broken.glb',
};

const loadGLBPrefab = async (type: string): Promise<THREE.Group> => {
  const glbPath = GLB_PREFAB_PATHS[type];
  if (!glbPath) throw new Error(`Unknown GLB prefab type: ${type}`);

  // Check cache first
  const cached = glbModelCache.get(type);
  if (cached) {
    return cached.clone();
  }

  // Load the model
  const gltf = await glbLoader.loadAsync(glbPath);
  const model = gltf.scene;

  // Configure shadows for all meshes
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  // Cache the model
  glbModelCache.set(type, model);
  return model.clone();
};

interface LevelData {
  prefabs: Array<{
    type: PrefabType | 'neonwall';  // 'neonwall' for legacy support
    position: { x: number; y: number; z: number };
    rotation: { y: number };
  }>;
  settings?: {
    directionalLight?: {
      color: string;
      intensity: number;
      position: { x: number; y: number; z: number };
    };
    // Legacy support
    ambientLight?: {
      color: string;
      intensity: number;
    };
    neonLights?: {
      spotlightIntensity: number;
      emissiveIntensity: number;
      glassEmissiveIntensity: number;
    };
    showGrid?: boolean;
  };
}

const loadConcreteTextures = () => {
  const colorMap = textureLoader.load('/textures/concrete/Concrete047A_1K-JPG_Color.jpg');
  const normalMap = textureLoader.load('/textures/concrete/Concrete047A_1K-JPG_NormalGL.jpg');
  const roughnessMap = textureLoader.load('/textures/concrete/Concrete047A_1K-JPG_Roughness.jpg');
  const aoMap = textureLoader.load('/textures/concrete/Concrete047A_1K-JPG_AmbientOcclusion.jpg');

  // Configure texture wrapping and repeat
  // Floor is 39x27, use low repeat to avoid visible tiling
  [colorMap, normalMap, roughnessMap, aoMap].forEach((texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 1.4);
  });

  return { colorMap, normalMap, roughnessMap, aoMap };
};

const setupScene = () => {
  if (!canvasRef.value) return;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 200);
  camera.position.set(-3.5, 40, 38.5);
  camera.lookAt(-3.5, 0, 3.5);

  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // OutlineEffect for cartoon-style outlines
  effect = new OutlineEffect(renderer, {
    defaultThickness: 0.003,
    defaultColor: [0, 0, 0],
  });

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(-3.5, 0, 3.5); // Center of floor

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // Simplified cartoon-style lighting
  ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  ambientLightInfo.value = {
    color: '#' + ambientLight.color.getHexString(),
    intensity: ambientLight.intensity
  };

  directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.left = -25;
  directionalLight.shadow.camera.right = 25;
  directionalLight.shadow.camera.top = 20;
  directionalLight.shadow.camera.bottom = -20;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;
  scene.add(directionalLight);

  directionalLightInfo.value = {
    color: '#' + directionalLight.color.getHexString(),
    intensity: directionalLight.intensity,
    position: {
      x: directionalLight.position.x,
      y: directionalLight.position.y,
      z: directionalLight.position.z
    }
  };

  const floorGeometry = new THREE.PlaneGeometry(39, 27);
  // Cartoon-style floor material with texture
  const { colorMap } = loadConcreteTextures();
  const floorMaterial = new THREE.MeshToonMaterial({
    color: 0xffffff, // White base - texture shows at natural brightness
    map: colorMap,
  });
  floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(-3.5, 0, 3.5); // Top-left corner at (-23, -10)
  floor.receiveShadow = true;
  scene.add(floor);

  gridHelper = new THREE.GridHelper(39, 39, 0x444444, 0x222222);
  gridHelper.position.set(-3.5, 0, 3.5); // Match floor position
  scene.add(gridHelper);

  window.addEventListener('resize', onWindowResize);
  renderer.domElement.addEventListener('mousedown', onMouseDown);
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('mouseup', onMouseUp);
  window.addEventListener('keydown', onKeyDown);

  // Preload cow model
  preloadCowModel();

  loadLevel();
  animate();
};

const preloadCowModel = async () => {
  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync('/models/cow.glb');
    preloadedCowModel = gltf.scene;
    console.log('Cow model preloaded successfully');
  } catch (error) {
    console.error('Failed to preload cow model:', error);
  }
};

const animate = () => {
  requestAnimationFrame(animate);

  if (isTestMode.value) {
    // Test mode: update physics and cow
    physicsManager?.update();
    cowController?.update();
  } else {
    // Edit mode: update orbit controls
    controls.update();
  }

  selectionHelpers.forEach((helper) => helper.update());
  effect.render(scene, camera);
};

const onWindowResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};

const updateMousePosition = (event: MouseEvent) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
};

const updateDirectionalLightColor = (hexColor: string) => {
  if (!directionalLight) return;
  directionalLight.color.setHex(parseInt(hexColor.replace('#', ''), 16));
  directionalLightInfo.value.color = hexColor;
};

const updateDirectionalLightIntensity = (value: number) => {
  if (!directionalLight) return;
  directionalLight.intensity = value;
  directionalLightInfo.value.intensity = value;
};

const updateDirectionalLightPosition = (axis: 'x' | 'y' | 'z', value: number) => {
  if (!directionalLight) return;
  directionalLight.position[axis] = value;
  directionalLightInfo.value.position[axis] = value;
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

// Update all neon spotlights in the scene
const updateNeonSpotlightIntensity = (value: number) => {
  neonLightInfo.value.spotlightIntensity = value;
  placedObjects.value.forEach((obj) => {
    if (obj.userData.prefabType?.startsWith('neonwall')) {
      obj.traverse((child) => {
        if (child instanceof THREE.SpotLight) {
          child.intensity = value;
        }
      });
    }
  });
};

// Update all neon emissive materials in the scene
const updateNeonEmissiveIntensity = (value: number) => {
  neonLightInfo.value.emissiveIntensity = value;
  placedObjects.value.forEach((obj) => {
    if (obj.userData.prefabType?.startsWith('neonwall')) {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh && child.name.match(/^NEON_[1-5]$/)) {
          const mat = child.material as THREE.MeshToonMaterial;
          if (mat.emissiveIntensity !== undefined) {
            mat.emissiveIntensity = value;
          }
        }
      });
    }
  });
};

// Update all glass emissive materials in the scene
const updateNeonGlassEmissiveIntensity = (value: number) => {
  neonLightInfo.value.glassEmissiveIntensity = value;
  placedObjects.value.forEach((obj) => {
    if (obj.userData.prefabType?.startsWith('neonwall')) {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh && child.name === 'GLASS') {
          const mat = child.material as THREE.MeshToonMaterial;
          if (mat.emissiveIntensity !== undefined) {
            mat.emissiveIntensity = value;
          }
        }
      });
    }
  });
};

const toggleGrid = () => {
  showGrid.value = !showGrid.value;
  if (gridHelper) {
    gridHelper.visible = showGrid.value;
  }
};

const updateSelectionHelpers = () => {
  selectionHelpers.forEach((helper) => scene.remove(helper));
  selectionHelpers = [];

  selectedObjects.value.forEach((obj) => {
    const helper = new THREE.BoxHelper(obj, 0x00ff00);
    scene.add(helper);
    selectionHelpers.push(helper);
  });
};

const onMouseDown = (event: MouseEvent) => {
  if (isTestMode.value) return;
  updateMousePosition(event);
  const isShiftPressed = event.shiftKey;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(placedObjects.value, true);

  if (intersects.length > 0) {
    let object: THREE.Object3D = intersects[0].object;

    while (object && object !== scene) {
      if (object.userData.prefabType) {
        const clickedObject = object as THREE.Group;

        if (isShiftPressed) {
          const index = selectedObjects.value.indexOf(clickedObject);
          if (index > -1) {
            selectedObjects.value.splice(index, 1);
          } else {
            selectedObjects.value.push(clickedObject);
          }
        } else {
          if (!selectedObjects.value.includes(clickedObject)) {
            selectedObjects.value = [clickedObject];
          }

          const intersectionPoint = new THREE.Vector3();
          raycaster.ray.intersectPlane(dragPlane, intersectionPoint);
          dragOffsets.clear();
          selectedObjects.value.forEach((obj) => {
            const offset = new THREE.Vector3();
            offset.subVectors(obj.position, intersectionPoint);
            dragOffsets.set(obj, offset);
          });

          isDragging = true;
          controls.enabled = false;
          renderer.domElement.style.cursor = 'grabbing';
        }

        updateSelectionHelpers();
        return;
      }
      object = object.parent!;
    }

    if (!isShiftPressed) {
      selectedObjects.value = [];
      updateSelectionHelpers();
    }
  } else {
    if (!isShiftPressed) {
      selectedObjects.value = [];
      updateSelectionHelpers();
    }
  }
};

const onMouseMove = (event: MouseEvent) => {
  if (isTestMode.value) return;
  if (!isDragging || selectedObjects.value.length === 0) {
    updateHoverCursor(event);
    return;
  }

  updateMousePosition(event);
  raycaster.setFromCamera(mouse, camera);
  const intersectionPoint = new THREE.Vector3();

  if (raycaster.ray.intersectPlane(dragPlane, intersectionPoint)) {
    selectedObjects.value.forEach((obj) => {
      const offset = dragOffsets.get(obj);
      if (offset) {
        obj.position.x = Math.round(intersectionPoint.x + offset.x);
        obj.position.z = Math.round(intersectionPoint.z + offset.z);
      }
    });

    selectionHelpers.forEach((helper) => helper.update());
  }
};

const updateHoverCursor = (event: MouseEvent) => {
  updateMousePosition(event);
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(placedObjects.value, true);

  if (intersects.length > 0) {
    let object: THREE.Object3D = intersects[0].object;
    while (object && object !== scene) {
      if (object.userData.prefabType) {
        renderer.domElement.style.cursor = 'grab';
        return;
      }
      object = object.parent!;
    }
  }
  renderer.domElement.style.cursor = 'default';
};

const onMouseUp = () => {
  if (isTestMode.value) return;
  if (isDragging) {
    isDragging = false;
    controls.enabled = true;
    renderer.domElement.style.cursor = 'grab';
    autoSaveLevel();
  }
};

const onKeyDown = (event: KeyboardEvent) => {
  if (isTestMode.value) return;

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const isCtrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

  if (isCtrlOrCmd && event.key === 'c') {
    event.preventDefault();
    copySelected();
  }

  if (isCtrlOrCmd && event.key === 'v') {
    event.preventDefault();
    pasteSelected();
  }

  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    deleteSelected();
  }
};

const autoSaveLevel = () => {
  showSaveToast.value = true;
  saveLevel();
  setTimeout(() => {
    showSaveToast.value = false;
  }, 1500);
};

const addPrefab = async (type: PrefabType) => {
  let prefabGroup: THREE.Group;

  // Use OBJ prefab creators for furniture
  if (type === 'workbench') {
    prefabGroup = await createWorkbenchPrefab();
  } else if (type === 'neonwall-yellow') {
    prefabGroup = await createNeonWallPrefab('yellow');
  } else if (type === 'neonwall-blue') {
    prefabGroup = await createNeonWallPrefab('blue');
  } else if (type === 'blueworkzone') {
    prefabGroup = await createBlueWorkZonePrefab();
  } else if (type === 'woodwall') {
    prefabGroup = await createWoodWallPrefab();
  } else if (GLB_PREFAB_PATHS[type]) {
    // Use GLB loader for robot parts
    prefabGroup = await loadGLBPrefab(type);
  } else {
    console.error(`Unknown prefab type: ${type}`);
    return;
  }

  prefabGroup.position.set(-3.5, 5, 3.5); // Center of floor, elevated so it falls
  prefabGroup.userData.prefabType = type;

  scene.add(prefabGroup);
  placedObjects.value.push(prefabGroup);
  selectedObjects.value = [prefabGroup];
  updateSelectionHelpers();

  // Animate the drop
  animateDrop(prefabGroup);
};

// Simple drop animation
const animateDrop = (object: THREE.Group) => {
  const startY = object.position.y;
  const targetY = 0;
  const duration = 400; // ms
  const startTime = performance.now();

  const animate = () => {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing: ease-out bounce effect
    const easeOutBounce = (t: number) => {
      if (t < 1 / 2.75) {
        return 7.5625 * t * t;
      } else if (t < 2 / 2.75) {
        return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
      } else if (t < 2.5 / 2.75) {
        return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
      } else {
        return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
      }
    };

    object.position.y = startY + (targetY - startY) * easeOutBounce(progress);
    updateSelectionHelpers();

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  requestAnimationFrame(animate);
};

const adjustPosition = (axis: 'x' | 'y' | 'z', delta: number) => {
  if (selectedObjects.value.length !== 1) return;
  selectedObjects.value[0].position[axis] += delta;
  selectionHelpers.forEach((helper) => helper.update());
};

const adjustRotationAxis = (axis: 'x' | 'y' | 'z', degrees: number) => {
  if (selectedObjects.value.length !== 1) return;

  const obj = selectedObjects.value[0];
  const radians = (degrees * Math.PI) / 180;

  obj.rotation[axis] += radians;
  obj.updateMatrixWorld(true);

  selectionHelpers.forEach((helper) => helper.update());
};

const deleteSelected = () => {
  if (selectedObjects.value.length === 0) return;

  selectionHelpers.forEach((helper) => {
    scene.remove(helper);
    helper.dispose();
  });
  selectionHelpers = [];

  selectedObjects.value.forEach((obj) => {
    if (obj.parent) {
      obj.parent.remove(obj);
    }

    const index = placedObjects.value.indexOf(obj);
    if (index > -1) {
      placedObjects.value.splice(index, 1);
    }

    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  });

  selectedObjects.value = [];
  effect.render(scene, camera);
  autoSaveLevel();
};

const copySelected = () => {
  if (selectedObjects.value.length === 0) return;

  copiedData.value = selectedObjects.value.map((obj) => ({
    type: obj.userData.prefabType,
    position: {
      x: obj.position.x,
      y: obj.position.y,
      z: obj.position.z,
    },
    rotation: {
      y: obj.rotation.y,
    },
  }));

  copyToastMessage.value = `Copied ${copiedData.value.length} object(s)`;
  showCopyToast.value = true;
  setTimeout(() => {
    showCopyToast.value = false;
  }, 1500);
};

const pasteSelected = async () => {
  if (copiedData.value.length === 0) return;

  const newObjects: THREE.Group[] = [];

  for (const data of copiedData.value) {
    let prefabGroup: THREE.Group;

    // Use OBJ prefab creators for furniture
    if (data.type === 'workbench') {
      prefabGroup = await createWorkbenchPrefab();
    } else if (data.type === 'neonwall-yellow') {
      prefabGroup = await createNeonWallPrefab('yellow');
    } else if (data.type === 'neonwall-blue') {
      prefabGroup = await createNeonWallPrefab('blue');
    } else if (data.type === 'blueworkzone') {
      prefabGroup = await createBlueWorkZonePrefab();
    } else if (data.type === 'woodwall') {
      prefabGroup = await createWoodWallPrefab();
    } else if (GLB_PREFAB_PATHS[data.type]) {
      // Use GLB loader for robot parts
      prefabGroup = await loadGLBPrefab(data.type);
    } else {
      console.error(`Unknown prefab type: ${data.type}`);
      continue;
    }

    prefabGroup.position.set(
      data.position.x + 1,
      data.position.y,
      data.position.z + 1
    );
    prefabGroup.rotation.y = data.rotation.y;
    prefabGroup.userData.prefabType = data.type;

    scene.add(prefabGroup);
    placedObjects.value.push(prefabGroup);
    newObjects.push(prefabGroup);
  }

  selectedObjects.value = newObjects;
  updateSelectionHelpers();

  copyToastMessage.value = `Pasted ${newObjects.length} object(s)`;
  showCopyToast.value = true;
  setTimeout(() => {
    showCopyToast.value = false;
  }, 1500);
};

const saveLevel = () => {
  const levelData: LevelData = {
    prefabs: placedObjects.value.map((obj) => ({
      type: obj.userData.prefabType,
      position: {
        x: obj.position.x,
        y: obj.position.y,
        z: obj.position.z,
      },
      rotation: {
        y: obj.rotation.y,
      },
    })),
    settings: {
      directionalLight: {
        color: directionalLightInfo.value.color,
        intensity: directionalLightInfo.value.intensity,
        position: {
          x: directionalLightInfo.value.position.x,
          y: directionalLightInfo.value.position.y,
          z: directionalLightInfo.value.position.z
        }
      },
      neonLights: {
        spotlightIntensity: neonLightInfo.value.spotlightIntensity,
        emissiveIntensity: neonLightInfo.value.emissiveIntensity,
        glassEmissiveIntensity: neonLightInfo.value.glassEmissiveIntensity
      },
      showGrid: showGrid.value,
    },
  };

  localStorage.setItem('backtrack-level', JSON.stringify(levelData));
};

const loadLevel = async () => {
  let savedData = localStorage.getItem('backtrack-level');

  // Load default level if no saved data exists
  if (!savedData) {
    savedData = `{"prefabs":[{"type":"workbench","position":{"x":-14,"y":0,"z":-10},"rotation":{"y":0}},{"type":"workbench","position":{"x":-5,"y":0,"z":-10},"rotation":{"y":0}},{"type":"workbench","position":{"x":-20,"y":0,"z":-10},"rotation":{"y":0}},{"type":"neonwall","position":{"x":-14,"y":0,"z":-10},"rotation":{"y":-1.5707963267948966}},{"type":"neonwall","position":{"x":-11,"y":0,"z":-10},"rotation":{"y":10.995574287564276}},{"type":"workbench","position":{"x":-5,"y":0,"z":2},"rotation":{"y":0}},{"type":"workbench","position":{"x":1,"y":0,"z":-10},"rotation":{"y":0}},{"type":"workbench","position":{"x":-11,"y":0,"z":-10},"rotation":{"y":0}},{"type":"workbench","position":{"x":13,"y":0,"z":-10},"rotation":{"y":0}},{"type":"workbench","position":{"x":7,"y":0,"z":-10},"rotation":{"y":0}},{"type":"workbench","position":{"x":10,"y":0,"z":-10},"rotation":{"y":0}},{"type":"workbench","position":{"x":-2,"y":0,"z":-10},"rotation":{"y":0}},{"type":"workbench","position":{"x":16,"y":0,"z":-10},"rotation":{"y":0}},{"type":"workbench","position":{"x":-23,"y":0,"z":-4},"rotation":{"y":14.137166941154069}},{"type":"workbench","position":{"x":-23,"y":0,"z":-7},"rotation":{"y":14.137166941154069}},{"type":"workbench","position":{"x":-23.000000029802322,"y":0,"z":17.000000029802322},"rotation":{"y":15.707963267948966}},{"type":"workbench","position":{"x":-23,"y":0,"z":2},"rotation":{"y":14.137166941154069}},{"type":"workbench","position":{"x":-20,"y":0,"z":-1},"rotation":{"y":0}},{"type":"workbench","position":{"x":-23.000000029802322,"y":0,"z":4.999999970197677},"rotation":{"y":1.5707963267948966}},{"type":"workbench","position":{"x":16,"y":0,"z":14},"rotation":{"y":0}},{"type":"workbench","position":{"x":13,"y":0,"z":14},"rotation":{"y":0}},{"type":"workbench","position":{"x":7,"y":0,"z":14},"rotation":{"y":0}},{"type":"workbench","position":{"x":-17,"y":0,"z":14},"rotation":{"y":0}},{"type":"workbench","position":{"x":-14,"y":0,"z":14},"rotation":{"y":0}},{"type":"workbench","position":{"x":-5,"y":0,"z":14},"rotation":{"y":0}},{"type":"workbench","position":{"x":-11,"y":0,"z":14},"rotation":{"y":0}},{"type":"workbench","position":{"x":-11,"y":0,"z":2},"rotation":{"y":0}},{"type":"workbench","position":{"x":-2,"y":0,"z":14},"rotation":{"y":0}},{"type":"workbench","position":{"x":1,"y":0,"z":14},"rotation":{"y":0}},{"type":"workbench","position":{"x":4,"y":0,"z":14},"rotation":{"y":0}},{"type":"workbench","position":{"x":10,"y":0,"z":14},"rotation":{"y":0}},{"type":"workbench","position":{"x":13,"y":0,"z":11},"rotation":{"y":14.137166941154069}},{"type":"workbench","position":{"x":13,"y":0,"z":8},"rotation":{"y":14.137166941154069}},{"type":"workbench","position":{"x":12.999999970197678,"y":0,"z":4.999999970197677},"rotation":{"y":1.5707963267948966}},{"type":"workbench","position":{"x":13,"y":0,"z":2},"rotation":{"y":14.137166941154069}},{"type":"workbench","position":{"x":13,"y":0,"z":-4},"rotation":{"y":14.137166941154069}},{"type":"workbench","position":{"x":13,"y":0,"z":-7},"rotation":{"y":14.137166941154069}},{"type":"workbench","position":{"x":-17,"y":0,"z":2},"rotation":{"y":0}},{"type":"workbench","position":{"x":-14,"y":0,"z":2},"rotation":{"y":0}},{"type":"workbench","position":{"x":-8,"y":0,"z":14},"rotation":{"y":0}},{"type":"workbench","position":{"x":-8,"y":0,"z":-10},"rotation":{"y":0}},{"type":"workbench","position":{"x":-8,"y":0,"z":2},"rotation":{"y":0}},{"type":"workbench","position":{"x":-2,"y":0,"z":2},"rotation":{"y":0}},{"type":"workbench","position":{"x":1,"y":0,"z":2},"rotation":{"y":0}},{"type":"workbench","position":{"x":4,"y":0,"z":2},"rotation":{"y":0}},{"type":"workbench","position":{"x":7,"y":0,"z":2},"rotation":{"y":0}},{"type":"neonwall","position":{"x":10,"y":0,"z":-10},"rotation":{"y":4.71238898038469}},{"type":"neonwall","position":{"x":7,"y":0,"z":-10},"rotation":{"y":-1.5707963267948966}},{"type":"woodwall","position":{"x":-2,"y":0,"z":-11},"rotation":{"y":1.5707963267948966}},{"type":"neonwall-blue","position":{"x":-23.00000001490116,"y":0,"z":4.9999998807907104},"rotation":{"y":0}},{"type":"neonwall-blue","position":{"x":-23.00000001490116,"y":0,"z":1.9999998807907078},"rotation":{"y":0}},{"type":"woodwall","position":{"x":-23,"y":0,"z":-10},"rotation":{"y":0}},{"type":"woodwall","position":{"x":-23,"y":0,"z":14},"rotation":{"y":0}},{"type":"woodwall","position":{"x":17,"y":0,"z":14},"rotation":{"y":0}},{"type":"neonwall-blue","position":{"x":16,"y":0,"z":14},"rotation":{"y":3.141592653589793}},{"type":"neonwall-blue","position":{"x":16,"y":0,"z":11},"rotation":{"y":3.141592653589793}},{"type":"woodwall","position":{"x":17,"y":0,"z":5},"rotation":{"y":0}},{"type":"woodwall","position":{"x":17,"y":0,"z":2},"rotation":{"y":0}},{"type":"woodwall","position":{"x":17,"y":0,"z":-1},"rotation":{"y":0}},{"type":"neonwall-blue","position":{"x":16,"y":0,"z":-1},"rotation":{"y":3.141592653589793}},{"type":"neonwall-blue","position":{"x":16,"y":0,"z":-4},"rotation":{"y":3.141592653589793}},{"type":"woodwall","position":{"x":17,"y":0,"z":-10},"rotation":{"y":0}},{"type":"woodwall","position":{"x":-11,"y":0,"z":-11},"rotation":{"y":1.5707963267948966}},{"type":"woodwall","position":{"x":-23,"y":0,"z":-11},"rotation":{"y":1.5707963267948966}},{"type":"woodwall","position":{"x":-20,"y":0,"z":-11},"rotation":{"y":1.5707963267948966}},{"type":"woodwall","position":{"x":13,"y":0,"z":-11},"rotation":{"y":1.5707963267948966}},{"type":"woodwall","position":{"x":10,"y":0,"z":-11},"rotation":{"y":1.5707963267948966}},{"type":"neonwall-yellow","position":{"x":-2,"y":0,"z":-10},"rotation":{"y":-1.5707963267948966}},{"type":"woodwall","position":{"x":-8,"y":0,"z":-11},"rotation":{"y":1.5707963267948966}},{"type":"woodwall","position":{"x":1,"y":0,"z":-11},"rotation":{"y":1.5707963267948966}},{"type":"blueworkzone","position":{"x":13,"y":0,"z":2},"rotation":{"y":9.42477796076938}},{"type":"neonwall-blue","position":{"x":-23,"y":0,"z":-1},"rotation":{"y":6.283185307179586}},{"type":"woodwall","position":{"x":-23,"y":0,"z":-7},"rotation":{"y":0}},{"type":"woodwall","position":{"x":-23,"y":0,"z":-4},"rotation":{"y":0}},{"type":"woodwall","position":{"x":-23,"y":0,"z":17},"rotation":{"y":1.5707963267948966}},{"type":"woodwall","position":{"x":-20,"y":0,"z":17},"rotation":{"y":1.5707963267948966}},{"type":"woodwall","position":{"x":1,"y":0,"z":17},"rotation":{"y":1.5707963267948966}},{"type":"woodwall","position":{"x":-8,"y":0,"z":17},"rotation":{"y":1.5707963267948966}},{"type":"neonwall-yellow","position":{"x":-5,"y":0,"z":17},"rotation":{"y":1.5707963267948966}},{"type":"woodwall","position":{"x":-2,"y":0,"z":17},"rotation":{"y":1.5707963267948966}},{"type":"woodwall","position":{"x":1,"y":0,"z":17},"rotation":{"y":1.5707963267948966}},{"type":"woodwall","position":{"x":10,"y":0,"z":17},"rotation":{"y":1.5707963267948966}},{"type":"woodwall","position":{"x":13,"y":0,"z":17},"rotation":{"y":1.5707963267948966}},{"type":"neonwall-yellow","position":{"x":7,"y":0,"z":17},"rotation":{"y":7.853981633974483}},{"type":"neonwall-yellow","position":{"x":4,"y":0,"z":17},"rotation":{"y":1.5707963267948966}},{"type":"neonwall-yellow","position":{"x":-17,"y":0,"z":17},"rotation":{"y":1.5707963267948966}},{"type":"neonwall-yellow","position":{"x":-14,"y":0,"z":17},"rotation":{"y":1.5707963267948966}},{"type":"blueworkzone","position":{"x":4,"y":0,"z":-7},"rotation":{"y":4.71238898038469}},{"type":"blueworkzone","position":{"x":-17,"y":0,"z":-7},"rotation":{"y":4.71238898038469}},{"type":"woodwall","position":{"x":-11,"y":0,"z":17},"rotation":{"y":1.5707963267948966}}],"settings":{"ambientLight":{"color":"#ffffff","intensity":1},"showGrid":false}}`;
  }

  try {
    const levelData: LevelData = JSON.parse(savedData);

    for (const prefabData of levelData.prefabs) {
      // Handle legacy 'neonwall' type as yellow
      const type = prefabData.type === 'neonwall' ? 'neonwall-yellow' : prefabData.type;

      let prefabGroup: THREE.Group;

      // Use OBJ prefab creators for furniture
      if (type === 'workbench') {
        prefabGroup = await createWorkbenchPrefab();
      } else if (type === 'neonwall-yellow') {
        prefabGroup = await createNeonWallPrefab('yellow');
      } else if (type === 'neonwall-blue') {
        prefabGroup = await createNeonWallPrefab('blue');
      } else if (type === 'blueworkzone') {
        prefabGroup = await createBlueWorkZonePrefab();
      } else if (type === 'woodwall') {
        prefabGroup = await createWoodWallPrefab();
      } else if (GLB_PREFAB_PATHS[type]) {
        // Use GLB loader for robot parts
        prefabGroup = await loadGLBPrefab(type);
      } else {
        console.warn(`Unknown prefab type: ${prefabData.type}, skipping`);
        continue;
      }

      prefabGroup.position.set(
        prefabData.position.x,
        prefabData.position.y,
        prefabData.position.z
      );
      prefabGroup.rotation.y = prefabData.rotation.y;
      prefabGroup.userData.prefabType = type;

      scene.add(prefabGroup);
      placedObjects.value.push(prefabGroup);
    }

    if (levelData.settings) {
      if (levelData.settings.directionalLight) {
        directionalLightInfo.value.color = levelData.settings.directionalLight.color;
        directionalLightInfo.value.intensity = levelData.settings.directionalLight.intensity;
        directionalLightInfo.value.position = levelData.settings.directionalLight.position;
        directionalLight.color.setHex(parseInt(levelData.settings.directionalLight.color.replace('#', ''), 16));
        directionalLight.intensity = levelData.settings.directionalLight.intensity;
        directionalLight.position.set(
          levelData.settings.directionalLight.position.x,
          levelData.settings.directionalLight.position.y,
          levelData.settings.directionalLight.position.z
        );
      } else if (levelData.settings.ambientLight) {
        // Legacy support: convert ambient light to directional light
        directionalLightInfo.value.color = levelData.settings.ambientLight.color;
        directionalLightInfo.value.intensity = levelData.settings.ambientLight.intensity;
        directionalLight.color.setHex(parseInt(levelData.settings.ambientLight.color.replace('#', ''), 16));
        directionalLight.intensity = levelData.settings.ambientLight.intensity;
      }

      if (levelData.settings.showGrid !== undefined) {
        showGrid.value = levelData.settings.showGrid;
        gridHelper.visible = levelData.settings.showGrid;
      }

      // Restore neon lights settings
      if (levelData.settings.neonLights) {
        neonLightInfo.value.spotlightIntensity = levelData.settings.neonLights.spotlightIntensity;
        neonLightInfo.value.emissiveIntensity = levelData.settings.neonLights.emissiveIntensity;
        neonLightInfo.value.glassEmissiveIntensity = levelData.settings.neonLights.glassEmissiveIntensity;

        // Apply to all neon walls
        placedObjects.value.forEach((obj) => {
          if (obj.userData.prefabType?.startsWith('neonwall')) {
            obj.traverse((child) => {
              if (child instanceof THREE.SpotLight) {
                child.intensity = neonLightInfo.value.spotlightIntensity;
              }
              if (child instanceof THREE.Mesh) {
                const mat = child.material as THREE.MeshToonMaterial;
                if (child.name.match(/^NEON_[1-5]$/)) {
                  mat.emissiveIntensity = neonLightInfo.value.emissiveIntensity;
                } else if (child.name === 'GLASS') {
                  mat.emissiveIntensity = neonLightInfo.value.glassEmissiveIntensity;
                }
              }
            });
          }
        });
      }
    }
  } catch (error) {
    console.error('Failed to load level:', error);
  } finally {
    isLoading.value = false;
  }
};

// Test Mode Functions
const toggleTestMode = async () => {
  if (isTestMode.value) {
    exitTestMode();
  } else {
    await enterTestMode();
  }
};

const enterTestMode = async () => {
  isTestMode.value = true;

  // Clear selection
  selectedObjects.value = [];
  updateSelectionHelpers();

  // Store current camera state
  storedCameraPosition = camera.position.clone();
  storedCameraTarget = controls.target.clone();

  // Keep current camera position/target (don't change it)
  // Just disable orbit controls so camera stays fixed
  controls.enabled = false;

  // Initialize physics manager
  physicsManager = new PhysicsManager();
  await physicsManager.init();

  // Create prefab colliders
  prefabColliderManager = new PrefabColliderManager(physicsManager);
  prefabColliderManager.createCollidersForPrefabs(placedObjects.value);
  prefabColliderManager.createFloorCollider();

  // Create cow controller with preloaded model
  cowController = new CowController(scene, physicsManager, preloadedCowModel);
};

const exitTestMode = () => {
  // Dispose cow controller
  if (cowController) {
    cowController.dispose();
    cowController = null;
  }

  // Dispose prefab collider manager
  if (prefabColliderManager) {
    prefabColliderManager.dispose();
    prefabColliderManager = null;
  }

  // Dispose physics manager
  if (physicsManager) {
    physicsManager.dispose();
    physicsManager = null;
  }

  // Restore camera position
  if (storedCameraPosition && storedCameraTarget) {
    camera.position.copy(storedCameraPosition);
    controls.target.copy(storedCameraTarget);
    camera.updateProjectionMatrix();
  }

  // Re-enable orbit controls
  controls.enabled = true;

  isTestMode.value = false;
};

// Generate thumbnail for a prefab
const generateThumbnail = async (type: PrefabType): Promise<string> => {
  // Create a small scene for the thumbnail
  const thumbScene = new THREE.Scene();
  thumbScene.background = new THREE.Color(0xffffff);

  // Add lights
  const thumbAmbient = new THREE.AmbientLight(0xffffff, 0.8);
  thumbScene.add(thumbAmbient);
  const thumbDirectional = new THREE.DirectionalLight(0xffffff, 0.8);
  thumbDirectional.position.set(3, 5, 3);
  thumbScene.add(thumbDirectional);
  const thumbDirectional2 = new THREE.DirectionalLight(0xffffff, 0.4);
  thumbDirectional2.position.set(-2, 3, -2);
  thumbScene.add(thumbDirectional2);

  // Load the prefab
  let prefabGroup: THREE.Group;
  try {
    if (type === 'workbench') {
      prefabGroup = await createWorkbenchPrefab();
    } else if (type === 'neonwall-yellow') {
      prefabGroup = await createNeonWallPrefab('yellow');
    } else if (type === 'neonwall-blue') {
      prefabGroup = await createNeonWallPrefab('blue');
    } else if (type === 'blueworkzone') {
      prefabGroup = await createBlueWorkZonePrefab();
    } else if (type === 'woodwall') {
      prefabGroup = await createWoodWallPrefab();
    } else if (GLB_PREFAB_PATHS[type]) {
      prefabGroup = await loadGLBPrefab(type);
    } else {
      throw new Error(`Unknown type: ${type}`);
    }
  } catch {
    return '';
  }

  // Get bounding box and center
  const box = new THREE.Box3().setFromObject(prefabGroup);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  // Move model to origin (centered)
  prefabGroup.position.x = -center.x;
  prefabGroup.position.y = -center.y;
  prefabGroup.position.z = -center.z;

  thumbScene.add(prefabGroup);

  // Calculate camera distance to fit the object
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = 35;
  const cameraDistance = maxDim / (2 * Math.tan((fov * Math.PI) / 360)) * 1.4;

  // Create camera positioned to see the object
  const thumbCamera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  thumbCamera.position.set(cameraDistance * 0.7, cameraDistance * 0.5, cameraDistance * 0.7);
  thumbCamera.lookAt(0, 0, 0);

  // Create renderer
  const thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  thumbRenderer.setSize(160, 160);
  thumbRenderer.render(thumbScene, thumbCamera);

  const dataUrl = thumbRenderer.domElement.toDataURL();

  // Cleanup
  thumbRenderer.dispose();
  prefabGroup.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
    }
  });

  return dataUrl;
};

const generateAllThumbnails = async () => {
  const allItems = [...prefabItems, ...resourceItems];
  for (const item of allItems) {
    const thumb = await generateThumbnail(item.type);
    if (thumb) {
      prefabThumbnails.value[item.type] = thumb;
    }
  }
};

onMounted(() => {
  setupScene();
  // Generate thumbnails after scene is ready
  setTimeout(() => {
    generateAllThumbnails();
  }, 500);
});

onUnmounted(() => {
  // Exit test mode if active
  if (isTestMode.value) {
    exitTestMode();
  }

  window.removeEventListener('resize', onWindowResize);
  renderer.domElement.removeEventListener('mousedown', onMouseDown);
  renderer.domElement.removeEventListener('mousemove', onMouseMove);
  renderer.domElement.removeEventListener('mouseup', onMouseUp);
  window.removeEventListener('keydown', onKeyDown);
  renderer.dispose();
});
</script>

<style scoped>
.level-editor {
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

/* Top right buttons */
.top-right-buttons {
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  gap: 10px;
  z-index: 100;
}

.toggle-btn {
  width: 44px;
  height: 44px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.toggle-btn:hover {
  background: rgba(0, 0, 0, 0.9);
}

/* Settings panels stacked on left */
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

.subsection-title {
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  opacity: 0.8;
  margin-top: 4px;
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

.setting-row input[type="range"] {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  cursor: pointer;
  -webkit-appearance: none;
  background: rgba(0, 0, 0, 0.3);
}

.setting-row input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: white;
  cursor: pointer;
}

.setting-row input[type="color"] {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  align-self: flex-end;
}

.setting-row.checkbox {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}

.setting-row.checkbox input {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.prefab-panel {
  position: absolute;
  top: 80px;
  left: 20px;
  background: rgba(0, 0, 0, 0.9);
  padding: 10px;
  border-radius: 8px;
  color: white;
  user-select: none;
}

.prefab-sections {
  display: flex;
  gap: 12px;
}

.prefab-section h4 {
  margin: 0 0 6px 0;
  font-size: 10px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  text-align: center;
}

.prefab-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.prefab-thumb {
  width: 80px;
  height: 80px;
  padding: 4px;
  background: #fff;
  border: 2px solid #555;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.prefab-thumb:hover {
  border-color: #4CAF50;
  transform: scale(1.08);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
}

.prefab-thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 6px;
}

.thumb-placeholder {
  font-size: 24px;
  font-weight: bold;
  color: #999;
}

.prefab-panel .save-btn {
  width: 100%;
  padding: 8px;
  margin-top: 10px;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
}

.prefab-panel .save-btn:hover {
  background: #0b7dda;
}

.test-mode-btn-inline {
  padding: 12px 24px;
  background: rgba(255, 152, 0, 0.9);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  transition: background 0.2s;
  user-select: none;
}

.test-mode-btn-inline:hover {
  background: rgba(255, 152, 0, 1);
}

.test-mode-btn-inline.active {
  background: rgba(244, 67, 54, 0.9);
}

.test-mode-btn-inline.active:hover {
  background: rgba(244, 67, 54, 1);
}

.toggle-prefab-panel-btn {
  position: absolute;
  top: 20px;
  left: 20px;
  width: 50px;
  height: 50px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  user-select: none;
}

.toggle-prefab-panel-btn:hover {
  background: rgba(0, 0, 0, 0.9);
}

.transform-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  padding: 20px;
  border-radius: 8px;
  color: white;
  min-width: 250px;
  user-select: none;
}

.transform-panel h3 {
  margin: 0 0 5px 0;
  font-size: 16px;
}

.prefab-name {
  margin: 0 0 15px 0;
  font-size: 14px;
  color: #4CAF50;
  font-weight: bold;
  text-transform: capitalize;
}

.section-label {
  margin: 10px 0 5px 0;
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
}

.control-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.control-group {
  margin-bottom: 15px;
}

.control-group.compact {
  margin-bottom: 0;
  flex: 1;
}

.control-group.compact label {
  font-size: 11px;
  margin-bottom: 3px;
}

.control-group.compact .buttons {
  gap: 4px;
}

.control-group.compact button {
  padding: 4px 8px;
  font-size: 12px;
}

.control-group label {
  display: block;
  margin-bottom: 5px;
  font-size: 14px;
}

.control-group .buttons {
  display: flex;
  gap: 10px;
}

.control-group button {
  flex: 1;
  padding: 8px;
  background: #555;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.control-group button:hover {
  background: #666;
}

.delete-btn {
  width: 100%;
  padding: 10px;
  margin-top: 10px;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.delete-btn:hover {
  background: #da190b;
}

.save-toast {
  position: fixed;
  bottom: 30px;
  right: 30px;
  background: rgba(76, 175, 80, 0.95);
  color: white;
  padding: 15px 25px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: bold;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  animation: slideIn 0.3s ease-out;
  z-index: 1000;
}

.copy-toast {
  position: fixed;
  bottom: 30px;
  left: 30px;
  background: rgba(33, 150, 243, 0.95);
  color: white;
  padding: 15px 25px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: bold;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  animation: slideInLeft 0.3s ease-out;
  z-index: 1000;
}

@keyframes slideIn {
  from {
    transform: translateY(100px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes slideInLeft {
  from {
    transform: translateX(-100px);
    opacity: 0;
  }

  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>
