import type { Group } from 'three';
import { Box3, Mesh, MeshStandardMaterial, PlaneGeometry, Vector3 } from 'three';

import { TILE_SIZE } from '../../constants';
import type { LevelInfo } from '../../levels';
import { Physics } from '../../util/Physics';
import { Resources } from '../../util/Resources';
import { LevelObject } from './LevelObject';

export class Floor extends LevelObject {
  #levelInfo: LevelInfo;

  constructor(levelInfo: LevelInfo) {
    super();
    this.#levelInfo = levelInfo;
  }

  create(group: Group): void {
    const { width, depth } = this.#levelInfo;

    const model = Resources.getInstance().getGLTFAsset('groundModel');
    if (!model) {
      console.error('Ground model not loaded');
      return;
    }

    const wallModel = Resources.getInstance().getGLTFAsset('wallModel');
    if (!wallModel) {
      console.error('Wall model not loaded');
      return;
    }

    const wallBox = new Box3().setFromObject(wallModel.scene);
    const wallSize = wallBox.getSize(new Vector3());

    const floorBox = new Box3().setFromObject(model.scene);
    const floorSize = floorBox.getSize(new Vector3());

    const mesh = model.scene.clone();
    mesh.scale.setScalar(1.1);
    mesh.position.set(floorSize.x + 2, 0, -wallSize.z + floorSize.z + 2);

    this.setupShadows(mesh);
    this.adjustMaterial(mesh, 0.8, 1.3, 2.4);

    this.mesh = mesh;
    group.add(mesh);

    this.createFloorPhysics();
    this.createExteriorPlane(group, width, depth);
  }

  private createExteriorPlane(group: Group, levelWidth: number, levelDepth: number): void {
    const planeSize = 200;
    const geometry = new PlaneGeometry(planeSize, planeSize);
    const material = new MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 1,
      metalness: 0,
    });

    const plane = new Mesh(geometry, material);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(
      (levelWidth * TILE_SIZE) / 2,
      -0.05,
      (levelDepth * TILE_SIZE) / 2,
    );
    plane.receiveShadow = true;

    group.add(plane);
  }

  private adjustMaterial(object: Group, brightness: number, contrast: number, gamma: number): void {
    object.traverse((child) => {
      if (!(child instanceof Mesh)) return;

      const material = child.material;
      if (material instanceof MeshStandardMaterial && material.color) {
        let r = (material.color.r - 0.5) * contrast + 0.5;
        let g = (material.color.g - 0.5) * contrast + 0.5;
        let b = (material.color.b - 0.5) * contrast + 0.5;

        r = Math.pow(Math.max(0, r), gamma) * brightness;
        g = Math.pow(Math.max(0, g), gamma) * brightness;
        b = Math.pow(Math.max(0, b), gamma) * brightness;

        material.color.setRGB(
          Math.max(0, Math.min(1, r)),
          Math.max(0, Math.min(1, g)),
          Math.max(0, Math.min(1, b)),
        );
      }
    });
  }

  private createFloorPhysics(): void {
    const { width, depth } = this.#levelInfo;
    const physics = Physics.getInstance();

    const position = new Vector3(width / 2, -0.1, depth / 2);
    this.rigidBody = physics.createStaticRigidBody(position);

    const halfExtents = new Vector3(width / 2, 0.1, depth / 2);
    physics.createBoxCollider(this.rigidBody, halfExtents, 0.5);
  }
}
