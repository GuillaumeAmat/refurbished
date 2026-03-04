import type { MeshStandardMaterial } from 'three';
import { Box3, Group, Mesh, PointLight, PointLightHelper, Vector3 } from 'three';

import { TILE_SIZE } from '../../constants';
import type { NeonWallVariant } from '../../levels';
import { Debug } from '../../util/Debug';
import { Resources } from '../../util/Resources';
import { LevelObject } from './LevelObject';

export type NeonWallSide = 'top' | 'bottom' | 'left' | 'right';
export type { NeonWallVariant };

export interface NeonWallParams {
  index: number;
  side: NeonWallSide;
  levelWidth: number;
  levelDepth: number;
  variant?: NeonWallVariant;
}

export class NeonWall extends LevelObject {
  static #emissiveIntensity = 1.5;
  static #neonMaterials: MeshStandardMaterial[] = [];
  static #lights: PointLight[] = [];
  static get lights(): PointLight[] {
    return NeonWall.#lights;
  }

  static #helpers: PointLightHelper[] = [];
  static get helpers(): PointLightHelper[] {
    return NeonWall.#helpers;
  }

  static setEmissiveIntensity(value: number): void {
    NeonWall.#emissiveIntensity = value;
    for (const mat of NeonWall.#neonMaterials) {
      mat.emissiveIntensity = value;
    }
  }

  #params: NeonWallParams;

  constructor(params: NeonWallParams) {
    super();
    this.#params = params;
  }

  create(group: Group): void {
    const { index, side, levelWidth, levelDepth, variant = 'default' } = this.#params;

    const modelName = variant === 'blue' ? 'neonWallBlueModel' : 'neonWallModel';
    const model = Resources.getInstance().getGLTFAsset(modelName);
    if (!model) {
      console.error(`Neon wall model (${modelName}) not loaded`);
      return;
    }

    const wallBox = new Box3().setFromObject(model.scene);
    const wallSize = wallBox.getSize(new Vector3());

    const mesh = model.scene.clone();

    switch (side) {
      case 'top':
        mesh.position.x = index * TILE_SIZE;
        mesh.position.y = 0;
        mesh.position.z = -wallSize.z;
        mesh.rotation.y = 0;
        break;
      case 'bottom':
        mesh.position.x = (index + 1) * TILE_SIZE;
        mesh.position.y = 0;
        mesh.position.z = levelDepth * TILE_SIZE + wallSize.z + 0.5;
        mesh.rotation.y = Math.PI;
        break;
      case 'left':
        mesh.position.x = -wallSize.z;
        mesh.position.y = 0;
        mesh.position.z = (index + 1) * TILE_SIZE;
        mesh.rotation.y = Math.PI / 2;
        break;
      case 'right':
        mesh.position.x = levelWidth * TILE_SIZE + wallSize.z;
        mesh.position.y = 0;
        mesh.position.z = index * TILE_SIZE;
        mesh.rotation.y = -Math.PI / 2;
        break;
    }

    this.setupShadows(mesh);
    this.setupNeonMaterials(mesh);
    this.cloneMaterials(mesh);

    mesh.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      if (!child.name.toLowerCase().includes('neon')) return;
      const mat = child.material as MeshStandardMaterial;
      mat.emissiveIntensity = NeonWall.#emissiveIntensity;
      NeonWall.#neonMaterials.push(mat);
    });

    const lightColor = variant === 'blue' ? 0x4488ff : 0xffdd00;
    const light = new PointLight(lightColor, 1, 3, 1.8);
    const lightOffset = new Vector3(TILE_SIZE / 2, wallSize.y - 0.6, wallSize.z + 0.6);
    lightOffset.applyEuler(mesh.rotation);
    light.position.copy(mesh.position).add(lightOffset);
    NeonWall.#lights.push(light);

    const container = new Group();
    container.add(mesh);
    container.add(light);

    if (Debug.getInstance().active) {
      const helper = new PointLightHelper(light, 0.3);
      helper.visible = false;
      container.add(helper);
      NeonWall.#helpers.push(helper);
    }

    // Second row: wallTop for bottom, stacked classic wall + wallTop for others
    const wallTopModel = Resources.getInstance().getGLTFAsset('wallTopRegularModel');

    if (side === 'bottom') {
      if (wallTopModel) {
        const wallTop = wallTopModel.scene.clone();

        const offset = new Vector3(TILE_SIZE / 2, 0, wallSize.z / 2);
        offset.applyEuler(mesh.rotation);

        wallTop.position.copy(mesh.position);
        wallTop.position.x += offset.x;
        wallTop.position.y = wallSize.y;
        wallTop.position.z += offset.z;
        wallTop.rotation.copy(mesh.rotation);

        wallTop.name = 'wallTop';
        this.setupShadows(wallTop);
        container.add(wallTop);
      }
    } else {
      const classicModel = Resources.getInstance().getGLTFAsset('wallModel');
      if (classicModel) {
        const classicBox = new Box3().setFromObject(classicModel.scene);
        const classicSize = classicBox.getSize(new Vector3());

        const stackedWall = classicModel.scene.clone();

        const stackOffset = new Vector3(classicSize.x, 0, classicSize.z);
        stackOffset.applyEuler(mesh.rotation);

        stackedWall.position.copy(mesh.position);
        stackedWall.position.x += stackOffset.x;
        stackedWall.position.y = wallSize.y;
        stackedWall.position.z += stackOffset.z;
        stackedWall.rotation.y = mesh.rotation.y + Math.PI;

        this.setupShadows(stackedWall);
        container.add(stackedWall);

        if (wallTopModel) {
          const wallTop = wallTopModel.scene.clone();

          const topOffset = new Vector3(classicSize.x / 2, 0, classicSize.z / 2);
          topOffset.applyEuler(mesh.rotation);

          wallTop.position.copy(mesh.position);
          wallTop.position.x += topOffset.x;
          wallTop.position.y = wallSize.y * 2;
          wallTop.position.z += topOffset.z;
          wallTop.rotation.copy(mesh.rotation);

          wallTop.name = 'wallTop';
          this.setupShadows(wallTop);
          container.add(wallTop);
        }
      }
    }

    this.mesh = container;
    group.add(container);
  }
}
