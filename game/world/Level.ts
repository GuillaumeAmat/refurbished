import { Group, Mesh, MeshStandardMaterial, PlaneGeometry, type Scene, Vector3 } from 'three';

import { LEVEL_1_MATRIX, TILE_SIZE } from '../constants';
import { createGridTexture } from '../lib/createGridTexture';
import { Debug } from '../utils/Debug';
import { Physics } from '../utils/Physics';
import { Resources } from '../utils/Resources';

export class Level {
  #screenGroup: Group;
  #scene: Scene;
  #resources: Resources;
  #group: Group;
  #physics: Physics;

  #properties = {
    tileSize: TILE_SIZE,
  };

  #debug: Debug;
  #debugProperties = {
    DisplayHelper: true,
  };

  constructor(screenGroup: Group, scene: Scene) {
    this.#screenGroup = screenGroup;
    this.#scene = scene;
    this.#resources = Resources.getInstance();
    this.#debug = Debug.getInstance();
    this.#physics = Physics.getInstance();

    this.#group = new Group();
    this.#screenGroup.add(this.#group);

    this.createOuterFloor();
    this.createFloor();
    this.createBench();
    this.createWall();
    this.createPhysicsBodies();
    this.setupHelpers();
  }

  private createFloor() {
    const levelWidth = LEVEL_1_MATRIX[0]?.length || 0;
    const levelDepth = LEVEL_1_MATRIX.length;

    const geometry = new PlaneGeometry(levelWidth * TILE_SIZE, levelDepth * TILE_SIZE, 1, 1);

    const material = new MeshStandardMaterial({
      color: '#83898E',
      // color: MOODS['mindaro-94'].value,
      metalness: 0.1,
      roughness: 0.5,
    });

    const mesh = new Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.rotation.x = Math.PI * -0.5;

    // Position at origin - geometry already translated
    mesh.position.x = (levelWidth * TILE_SIZE) / 2;
    mesh.position.y = 0;
    mesh.position.z = (levelDepth * TILE_SIZE) / 2;

    this.#group.add(mesh);
  }

  private createOuterFloor() {
    const levelWidth = LEVEL_1_MATRIX[0]?.length || 0;

    const geometry = new PlaneGeometry(100, 100, 1, 1);

    // Generate grid texture
    const gridInterval = 5;
    const textureSize = 320;
    const gridSpacing = 64;
    const gridTexture = createGridTexture({
      backgroundColor: '#041428',
      // backgroundColor: '#072346',
      gridColor: '#FFFFFF',
      gridSpacing,
      lineWidth: 1,
      textureSize,
      minorLineOpacity: 0.1,
      majorLineOpacity: 0.8,
      majorLineInterval: gridInterval,
    });

    gridTexture.repeat.set(levelWidth, levelWidth);
    // gridTexture.repeat.set(16, 16);

    const material = new MeshStandardMaterial({
      map: gridTexture,
      color: '#FFFFFF',
      metalness: 0.1,
      roughness: 0.5,
    });

    const mesh = new Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.rotation.x = Math.PI * -0.5;

    // Position at origin - geometry already translated
    mesh.position.x = 0;
    mesh.position.y = -0.1;
    mesh.position.z = 0;

    this.#group.add(mesh);
  }

  private createBench() {
    if (!Array.isArray(LEVEL_1_MATRIX) || !LEVEL_1_MATRIX[0]) {
      return;
    }

    const benchModel = this.#resources.getGLTFAsset('benchModel');
    const blueWorkZoneModel = this.#resources.getGLTFAsset('blueWorkZoneModel');
    const crateModel = this.#resources.getGLTFAsset('crateModel');

    if (!benchModel || !blueWorkZoneModel || !crateModel) {
      return;
    }

    const levelWidth = LEVEL_1_MATRIX[0].length;
    const levelDepth = LEVEL_1_MATRIX.length;
    const meshes: Group[] = [];

    for (let xIndex = 0; xIndex < levelWidth; xIndex++) {
      for (let zIndex = 0; zIndex < levelDepth; zIndex++) {
        const cellValue = LEVEL_1_MATRIX[zIndex]?.[xIndex];

        if (cellValue === 0) {
          continue;
        }

        let modelToClone;
        if (cellValue === 1) modelToClone = benchModel;
        else if (cellValue === 2) modelToClone = blueWorkZoneModel;
        else if (cellValue === 3) modelToClone = crateModel;
        else continue;

        const mesh = modelToClone.scene.clone();

        mesh.position.x = xIndex * TILE_SIZE;
        mesh.position.y = 0;
        mesh.position.z = zIndex * TILE_SIZE;

        // Rotate outer edge models to face inward
        const isBottomEdge = zIndex === levelDepth - 1;
        const isLeftEdge = xIndex === 0;
        const isRightEdge = xIndex === levelWidth - 1;

        if (isBottomEdge) {
          mesh.rotation.y = Math.PI;
          mesh.position.x += TILE_SIZE;
          mesh.position.z += TILE_SIZE;
        } else if (isLeftEdge) {
          mesh.rotation.y = Math.PI / 2;
          mesh.position.z += TILE_SIZE;
        } else if (isRightEdge) {
          mesh.rotation.y = -Math.PI / 2;
          mesh.position.x += TILE_SIZE;
        }

        // Setup shadows
        mesh.traverse((child) => {
          if (child instanceof Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        meshes.push(mesh);
      }
    }

    this.#group.add(...meshes);
  }

  private createWall() {
    const { tileSize } = this.#properties;

    if (!Array.isArray(LEVEL_1_MATRIX) || !LEVEL_1_MATRIX[0]) {
      return;
    }

    const wallModel = this.#resources.getGLTFAsset('wallModel');

    if (!wallModel) {
      return;
    }

    const levelWidth = LEVEL_1_MATRIX[0].length;
    const levelDepth = LEVEL_1_MATRIX.length;
    const meshes: Group[] = [];

    // Top side (z = 0, facing inward)
    for (let xIndex = 0; xIndex < levelWidth; xIndex++) {
      const cellValue = LEVEL_1_MATRIX[0]?.[xIndex];
      if (cellValue === 0) continue;

      const mesh = wallModel.scene.clone();

      mesh.position.x = (xIndex + 1) * tileSize;
      mesh.position.y = 0;
      mesh.position.z = 0;
      mesh.rotation.y = 0;

      mesh.traverse((child) => {
        if (child instanceof Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      meshes.push(mesh);
    }

    // Bottom side (z = max, facing inward)
    for (let xIndex = 0; xIndex < levelWidth; xIndex++) {
      const cellValue = LEVEL_1_MATRIX[levelDepth - 1]?.[xIndex];
      if (cellValue === 0) continue;

      const mesh = wallModel.scene.clone();

      mesh.position.x = xIndex * tileSize;
      mesh.position.y = 0;
      mesh.position.z = levelDepth * tileSize;
      mesh.rotation.y = Math.PI;

      mesh.traverse((child) => {
        if (child instanceof Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      meshes.push(mesh);
    }

    // Left side (x = 0, facing inward)
    for (let zIndex = 0; zIndex < levelDepth; zIndex++) {
      const cellValue = LEVEL_1_MATRIX[zIndex]?.[0];
      if (cellValue === 0) continue;

      const mesh = wallModel.scene.clone();

      mesh.position.x = 0;
      mesh.position.y = 0;
      mesh.position.z = zIndex * tileSize;
      mesh.rotation.y = Math.PI / 2;

      mesh.traverse((child) => {
        if (child instanceof Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      meshes.push(mesh);
    }

    // Right side (x = max, facing inward)
    for (let zIndex = 0; zIndex < levelDepth; zIndex++) {
      const cellValue = LEVEL_1_MATRIX[zIndex]?.[levelWidth - 1];
      if (cellValue === 0) continue;

      const mesh = wallModel.scene.clone();

      mesh.position.x = levelWidth * tileSize;
      mesh.position.y = 0;
      mesh.position.z = (zIndex + 1) * tileSize;
      mesh.rotation.y = -Math.PI / 2;

      mesh.traverse((child) => {
        if (child instanceof Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      meshes.push(mesh);
    }

    this.#group.add(...meshes);
  }

  private createPhysicsBodies() {
    if (!Array.isArray(LEVEL_1_MATRIX) || !LEVEL_1_MATRIX[0]) {
      return;
    }

    const levelWidth = LEVEL_1_MATRIX[0].length;
    const levelDepth = LEVEL_1_MATRIX.length;

    // Create floor physics body - centered under level in positive space
    const floorPosition = new Vector3((levelWidth * TILE_SIZE) / 2, -0.1, (levelDepth * TILE_SIZE) / 2);
    const floorRigidBody = this.#physics.createStaticRigidBody(floorPosition);
    const floorHalfExtents = new Vector3((levelWidth * TILE_SIZE) / 2, 0.1, (levelDepth * TILE_SIZE) / 2);
    this.#physics.createBoxCollider(floorRigidBody, floorHalfExtents, 0.5);

    // Create workbench physics bodies - one per workbench (1:1 mapping)
    for (let xIndex = 0; xIndex < levelWidth; xIndex++) {
      for (let zIndex = 0; zIndex < levelDepth; zIndex++) {
        const cellValue = LEVEL_1_MATRIX[zIndex]?.[xIndex];

        if (cellValue === 1 || cellValue === 2 || cellValue === 3) {
          // Position at center of 2x2 workbench
          const position = new Vector3(xIndex * TILE_SIZE + 1, 0.5, zIndex * TILE_SIZE + 1);
          const rigidBody = this.#physics.createStaticRigidBody(position);
          const halfExtents = new Vector3(1, 0.5, 1);
          this.#physics.createBoxCollider(rigidBody, halfExtents, 0.0);
        }
      }
    }
  }

  private async setupHelpers() {
    if (this.#debug.active) {
      const folderName = 'Level';
      const guiFolder = this.#debug.gui.addFolder(folderName);

      this.#debugProperties = {
        ...this.#debugProperties,
        ...this.#debug.configFromLocaleStorage?.folders?.[folderName]?.controllers,
      };

      if (this.#group) {
        const { BoxHelper } = await import('three');
        const helper = new BoxHelper(this.#group, 0xffff00);
        helper.visible = this.#debugProperties.DisplayHelper;
        this.#scene.add(helper);

        guiFolder.add(this.#debugProperties, 'DisplayHelper').onChange((value: boolean) => {
          helper.visible = value;
          this.#debug.save();
        });
      }
    }
  }

  public update() {}
}
