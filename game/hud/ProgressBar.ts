import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';

export class ProgressBar {
  #group: Group;
  #backgroundMesh: Mesh;
  #fillMesh: Mesh;
  #width: number;
  #height: number;

  constructor(width = 1, height = 0.1) {
    this.#width = width;
    this.#height = height;
    this.#group = new Group();

    const bgGeometry = new PlaneGeometry(width, height);
    const bgMaterial = new MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.8 });
    this.#backgroundMesh = new Mesh(bgGeometry, bgMaterial);
    this.#backgroundMesh.rotation.x = -Math.PI / 2;
    this.#group.add(this.#backgroundMesh);

    const fillGeometry = new PlaneGeometry(width, height);
    const fillMaterial = new MeshBasicMaterial({ color: 0x00ff00 });
    this.#fillMesh = new Mesh(fillGeometry, fillMaterial);
    this.#fillMesh.rotation.x = -Math.PI / 2;
    this.#fillMesh.position.y = 0.001;
    this.#group.add(this.#fillMesh);

    this.setProgress(0);
    this.hide();
  }

  public getGroup(): Group {
    return this.#group;
  }

  public setPosition(position: Vector3): void {
    this.#group.position.copy(position);
  }

  public setProgress(progress: number): void {
    const clampedProgress = Math.max(0, Math.min(1, progress));
    this.#fillMesh.scale.x = clampedProgress || 0.001;
    this.#fillMesh.position.x = -(this.#width / 2) * (1 - clampedProgress);
  }

  public show(): void {
    this.#group.visible = true;
  }

  public hide(): void {
    this.#group.visible = false;
  }

  public dispose(): void {
    this.#backgroundMesh.geometry.dispose();
    (this.#backgroundMesh.material as MeshBasicMaterial).dispose();
    this.#fillMesh.geometry.dispose();
    (this.#fillMesh.material as MeshBasicMaterial).dispose();
    this.#group.removeFromParent();
  }
}
