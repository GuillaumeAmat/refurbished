<template>
  <div class="level-editor">
    <!-- Loading screen -->
    <div v-if="isLoading" class="loading-screen">
      <p class="loading-text">Loading...</p>
    </div>

    <canvas ref="canvasRef" />

    <!-- Prefab Selection Panel -->
    <div v-if="!isLoading" class="prefab-panel" @click.stop>
      <h3>Prefabs</h3>
      <button @click="addPrefab('workbench')">Workbench</button>
      <button @click="addPrefab('neonwall')">Neon Wall</button>
      <button @click="saveLevel">Save Level</button>
    </div>

    <!-- Save Toast -->
    <div v-if="showSaveToast" class="save-toast">
      Save in progress...
    </div>

    <!-- Copy Toast -->
    <div v-if="showCopyToast" class="copy-toast">
      {{ copyToastMessage }}
    </div>

    <!-- Ambient Light Panel -->
    <div v-if="!isLoading" class="ambient-light-panel" @click.stop>
      <h3>Ambient Light</h3>
      <div class="control-group">
        <label>Color: {{ ambientLightInfo.color }}</label>
        <input
          type="color"
          :value="ambientLightInfo.color"
          @input="updateAmbientLightColor(($event.target as HTMLInputElement).value)"
          class="color-picker"
        />
      </div>
      <div class="control-group">
        <label>Intensity: {{ ambientLightInfo.intensity.toFixed(2) }}</label>
        <input
          type="range"
          min="0"
          max="5"
          step="0.1"
          :value="ambientLightInfo.intensity"
          @input="updateAmbientLightIntensity(parseFloat(($event.target as HTMLInputElement).value))"
          class="slider"
        />
      </div>
      <div class="control-group">
        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="showGrid"
            @change="toggleGrid"
            class="checkbox"
          />
          Show Grid
        </label>
      </div>
    </div>

    <!-- Transform Panel (shown when objects selected) -->
    <div v-if="selectedObjects.length > 0" class="transform-panel" @click.stop>
      <h3>Transform</h3>
      <p class="prefab-name" v-if="selectedObjects.length === 1">{{ selectedObjects[0].userData.prefabType }}</p>
      <p class="prefab-name" v-else>{{ selectedObjects.length }} objects selected</p>

      <template v-if="selectedObjects.length === 1">
        <div class="control-group">
          <label>Position X: {{ selectedObjects[0].position.x.toFixed(2) }}</label>
          <div class="buttons">
            <button @click.stop="adjustPosition('x', -1)" @mousedown.stop>-</button>
            <button @click.stop="adjustPosition('x', 1)" @mousedown.stop>+</button>
          </div>
        </div>

        <div class="control-group">
          <label>Position Z: {{ selectedObjects[0].position.z.toFixed(2) }}</label>
          <div class="buttons">
            <button @click.stop="adjustPosition('z', -1)" @mousedown.stop>-</button>
            <button @click.stop="adjustPosition('z', 1)" @mousedown.stop>+</button>
          </div>
        </div>

        <div class="control-group">
          <label>Rotation: {{ (selectedObjects[0].rotation.y * 180 / Math.PI).toFixed(0) }}°</label>
          <div class="buttons">
            <button @click.stop="adjustRotation(-90)" @mousedown.stop>-90°</button>
            <button @click.stop="adjustRotation(90)" @mousedown.stop>+90°</button>
          </div>
        </div>
      </template>

      <button class="delete-btn" @click="deleteSelected">Delete{{ selectedObjects.length > 1 ? ' All' : '' }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { createWorkbenchPrefab } from '~/three/prefabs/WorkbenchPrefab';
import { createNeonWallPrefab } from '~/three/prefabs/NeonWallPrefab';

const canvasRef = ref<HTMLCanvasElement | null>(null);

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let raycaster: THREE.Raycaster;
let mouse: THREE.Vector2;
let floor: THREE.Mesh;
let dragPlane: THREE.Plane;
let isDragging = false;
let selectionHelpers: THREE.BoxHelper[] = [];
let dragOffsets = new Map<THREE.Group, THREE.Vector3>();
let ambientLight: THREE.AmbientLight;
let gridHelper: THREE.GridHelper;

const selectedObjects = ref<THREE.Group[]>([]);
const placedObjects = ref<THREE.Group[]>([]);
const showSaveToast = ref(false);
const showCopyToast = ref(false);
const copyToastMessage = ref('');
const copiedData = ref<Array<{ type: 'workbench' | 'neonwall'; position: { x: number; y: number; z: number }; rotation: { y: number } }>>([]);
const ambientLightInfo = ref({
  color: '#ffffff',
  intensity: 2
});
const isLoading = ref(true);
const showGrid = ref(true);

interface LevelData {
  prefabs: Array<{
    type: 'workbench' | 'neonwall';
    position: { x: number; y: number; z: number };
    rotation: { y: number };
  }>;
  settings?: {
    ambientLight?: {
      color: string;
      intensity: number;
    };
    showGrid?: boolean;
  };
}

const createFloorTexture = (noiseIntensity: number): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.fillStyle = '#333333';
  ctx.fillRect(0, 0, 512, 512);

  const imageData = ctx.getImageData(0, 0, 512, 512);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * noiseIntensity;
    data[i] += noise;
    data[i + 1] += noise;
    data[i + 2] += noise;
  }
  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 10);
  return texture;
};

const setupScene = () => {
  if (!canvasRef.value) return;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);

  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 100);
  camera.position.set(0, 14, 11);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  ambientLight = new THREE.AmbientLight(0xffffff, 2);
  scene.add(ambientLight);
  ambientLightInfo.value = {
    color: '#' + ambientLight.color.getHexString(),
    intensity: ambientLight.intensity,
  };

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.position.set(0, 20, 0);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.left = -50;
  directionalLight.shadow.camera.right = 50;
  directionalLight.shadow.camera.top = 25;
  directionalLight.shadow.camera.bottom = -25;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;
  scene.add(directionalLight);

  const floorGeometry = new THREE.PlaneGeometry(100, 50);
  const floorMaterial = new THREE.MeshStandardMaterial({
    map: createFloorTexture(30),
    roughness: 0.95,
    metalness: 0.0,
  });
  floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  gridHelper = new THREE.GridHelper(100, 100, 0x444444, 0x222222);
  scene.add(gridHelper);

  window.addEventListener('resize', onWindowResize);
  renderer.domElement.addEventListener('mousedown', onMouseDown);
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('mouseup', onMouseUp);
  window.addEventListener('keydown', onKeyDown);

  loadLevel();
  animate();
};

const animate = () => {
  requestAnimationFrame(animate);
  controls.update();
  selectionHelpers.forEach((helper) => helper.update());
  renderer.render(scene, camera);
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
  if (isDragging) {
    isDragging = false;
    controls.enabled = true;
    renderer.domElement.style.cursor = 'grab';
    autoSaveLevel();
  }
};

const onKeyDown = (event: KeyboardEvent) => {
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

const addPrefab = async (type: 'workbench' | 'neonwall') => {
  const prefabGroup = type === 'workbench'
    ? await createWorkbenchPrefab()
    : await createNeonWallPrefab();

  prefabGroup.position.set(0, 0, 0);
  prefabGroup.userData.prefabType = type;

  scene.add(prefabGroup);
  placedObjects.value.push(prefabGroup);
  selectedObjects.value = [prefabGroup];
  updateSelectionHelpers();
};

const adjustPosition = (axis: 'x' | 'z', delta: number) => {
  if (selectedObjects.value.length !== 1) return;
  selectedObjects.value[0].position[axis] += delta;
  selectionHelpers.forEach((helper) => helper.update());
};

const adjustRotation = (degrees: number) => {
  if (selectedObjects.value.length !== 1) return;

  const obj = selectedObjects.value[0];
  const radians = (degrees * Math.PI) / 180;

  const boxBefore = new THREE.Box3().setFromObject(obj);
  const centerBefore = boxBefore.getCenter(new THREE.Vector3());

  obj.rotation.y += radians;
  obj.updateMatrixWorld(true);

  const boxAfter = new THREE.Box3().setFromObject(obj);
  const centerAfter = boxAfter.getCenter(new THREE.Vector3());

  const offset = new THREE.Vector3().subVectors(centerBefore, centerAfter);
  obj.position.add(offset);

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
  renderer.render(scene, camera);
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
    const prefabGroup = data.type === 'workbench'
      ? await createWorkbenchPrefab()
      : await createNeonWallPrefab();

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
      ambientLight: {
        color: ambientLightInfo.value.color,
        intensity: ambientLightInfo.value.intensity,
      },
      showGrid: showGrid.value,
    },
  };

  localStorage.setItem('backtrack-level', JSON.stringify(levelData));
};

const loadLevel = async () => {
  const savedData = localStorage.getItem('backtrack-level');

  if (!savedData) {
    isLoading.value = false;
    return;
  }

  try {
    const levelData: LevelData = JSON.parse(savedData);

    for (const prefabData of levelData.prefabs) {
      const prefabGroup = prefabData.type === 'workbench'
        ? await createWorkbenchPrefab()
        : await createNeonWallPrefab();

      prefabGroup.position.set(
        prefabData.position.x,
        prefabData.position.y,
        prefabData.position.z
      );
      prefabGroup.rotation.y = prefabData.rotation.y;
      prefabGroup.userData.prefabType = prefabData.type;

      scene.add(prefabGroup);
      placedObjects.value.push(prefabGroup);
    }

    if (levelData.settings) {
      if (levelData.settings.ambientLight) {
        ambientLightInfo.value.color = levelData.settings.ambientLight.color;
        ambientLightInfo.value.intensity = levelData.settings.ambientLight.intensity;
        ambientLight.color.setHex(parseInt(levelData.settings.ambientLight.color.replace('#', ''), 16));
        ambientLight.intensity = levelData.settings.ambientLight.intensity;
      }

      if (levelData.settings.showGrid !== undefined) {
        showGrid.value = levelData.settings.showGrid;
        gridHelper.visible = levelData.settings.showGrid;
      }
    }
  } catch (error) {
    console.error('Failed to load level:', error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  setupScene();
});

onUnmounted(() => {
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
  background: #1a1a1a;
  z-index: 9999;
}

.loading-text {
  color: white;
  font-size: 2rem;
  font-family: monospace;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: default;
}

.prefab-panel {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.8);
  padding: 20px;
  border-radius: 8px;
  color: white;
  min-width: 150px;
  user-select: none;
}

.prefab-panel h3 {
  margin: 0 0 15px 0;
  font-size: 16px;
}

.prefab-panel button {
  width: 100%;
  padding: 10px;
  margin-bottom: 10px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.prefab-panel button:hover {
  background: #45a049;
}

.prefab-panel button:last-child {
  background: #2196F3;
  margin-top: 10px;
}

.prefab-panel button:last-child:hover {
  background: #0b7dda;
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

.control-group {
  margin-bottom: 15px;
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

.ambient-light-panel {
  position: absolute;
  bottom: 20px;
  left: 20px;
  background: rgba(6, 182, 212, 0.9);
  padding: 20px;
  border-radius: 8px;
  color: white;
  min-width: 200px;
  user-select: none;
}

.ambient-light-panel h3 {
  margin: 0 0 15px 0;
  font-size: 16px;
}

.ambient-light-panel .control-group {
  margin-bottom: 15px;
}

.ambient-light-panel .control-group label {
  display: block;
  margin-bottom: 5px;
  font-size: 14px;
}

.ambient-light-panel .color-picker {
  width: 100%;
  height: 30px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.ambient-light-panel .slider {
  width: 100%;
  height: 4px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  outline: none;
  cursor: pointer;
}

.ambient-light-panel .slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  cursor: pointer;
}

.ambient-light-panel .slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}
</style>
