import type { Group } from 'three';
import { Mesh, MeshStandardMaterial, PlaneGeometry, Vector3 } from 'three';

import type { LevelInfo } from '../../levels';
import { Physics } from '../../util/Physics';
import { LevelObject } from './LevelObject';

export class Floor extends LevelObject {
  #levelInfo: LevelInfo;

  constructor(levelInfo: LevelInfo) {
    super();
    this.#levelInfo = levelInfo;
  }

  create(group: Group): void {
    const { width, depth } = this.#levelInfo;

    const geometry = new PlaneGeometry(width, depth, 1, 1);
    const material = new MeshStandardMaterial({
      color: '#83898E',
      metalness: 0.1,
      roughness: 0.5,
    });

    const mesh = new Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.rotation.x = Math.PI * -0.5;
    mesh.position.set(width / 2, 0, depth / 2);

    this.mesh = mesh;
    group.add(mesh);

    this.createFloorPhysics();
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
