import { Group, IcosahedronGeometry, Mesh, MeshStandardMaterial, type Object3D, Vector3 } from 'three';

import { SMOKE_COLOR, SMOKE_PARTICLE_LIFETIME, SMOKE_POOL_SIZE, SMOKE_SPAWN_INTERVAL } from '../constants';
import { Time } from '../util/Time';

interface SmokeParticle {
  mesh: Mesh;
  velocity: Vector3;
  age: number;
  maxAge: number;
  active: boolean;
}

export class SmokeParticleSystem {
  #group: Group;
  #particles: SmokeParticle[] = [];
  #time: Time;
  #timeSinceLastSpawn = 0;
  #geometry: IcosahedronGeometry;
  #material: MeshStandardMaterial;

  // Cached vectors to avoid allocations in spawn()
  #tempBaseOffset = new Vector3();
  #tempPerpendicular = new Vector3();
  #tempSpawnPos = new Vector3();
  #freeList: number[] = [];

  constructor(parent: Object3D) {
    this.#group = new Group();
    parent.add(this.#group);

    this.#time = Time.getInstance();
    this.#geometry = new IcosahedronGeometry(0.4, 0);
    this.#material = new MeshStandardMaterial({
      color: SMOKE_COLOR,
    });

    this.#initPool();
  }

  #initPool(): void {
    for (let i = 0; i < SMOKE_POOL_SIZE; i++) {
      const mesh = new Mesh(this.#geometry, this.#material.clone());
      mesh.visible = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 1;
      this.#group.add(mesh);

      this.#particles.push({
        mesh,
        velocity: new Vector3(),
        age: 0,
        maxAge: SMOKE_PARTICLE_LIFETIME,
        active: false,
      });
      this.#freeList.push(i);
    }
  }

  #getInactiveParticle(): SmokeParticle | null {
    if (this.#freeList.length === 0) return null;
    return this.#particles[this.#freeList.pop()!]!;
  }

  spawn(position: Vector3, movementDirection: Vector3): void {
    const particle = this.#getInactiveParticle();
    if (!particle) return;

    // Spawn behind player with randomized offset
    this.#tempBaseOffset
      .copy(movementDirection)
      .normalize()
      .multiplyScalar(-0.2 - Math.random() * 0.2);
    this.#tempPerpendicular
      .set(-movementDirection.z, 0, movementDirection.x)
      .normalize()
      .multiplyScalar((Math.random() - 0.5) * 0.4);
    this.#tempSpawnPos.copy(position).add(this.#tempBaseOffset).add(this.#tempPerpendicular);
    this.#tempSpawnPos.y = 0.3 + Math.random() * 0.4;

    particle.mesh.position.copy(this.#tempSpawnPos);
    particle.mesh.scale.setScalar(0.3 + Math.random() * 0.4);
    particle.mesh.visible = true;

    // Slight upward drift + random horizontal spread
    particle.velocity.set((Math.random() - 0.5) * 0.5, 1.5, (Math.random() - 0.5) * 0.5);

    particle.age = 0;
    particle.maxAge = SMOKE_PARTICLE_LIFETIME + (Math.random() - 0.5) * 0.2;
    particle.active = true;
  }

  spawnBurst(position: Vector3, movementDirection: Vector3, count: number): void {
    for (let i = 0; i < count; i++) {
      this.spawn(position, movementDirection);
    }
  }

  spawnImpact(position: Vector3, count: number): void {
    for (let i = 0; i < count; i++) {
      const particle = this.#getInactiveParticle();
      if (!particle) return;

      // Spread around impact point to cover the object
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 0.6;
      this.#tempSpawnPos.set(
        position.x + Math.cos(angle) * radius,
        position.y + (Math.random() - 0.5) * 0.3,
        position.z + Math.sin(angle) * radius,
      );

      particle.mesh.position.copy(this.#tempSpawnPos);
      particle.mesh.scale.setScalar(0.6 + Math.random() * 0.6);
      particle.mesh.visible = true;

      // Drift outward and upward
      particle.velocity.set(
        Math.cos(angle) * (0.5 + Math.random() * 0.5),
        1.6 + Math.random() * 1.2,
        Math.sin(angle) * (0.5 + Math.random() * 0.5),
      );

      particle.age = 0;
      particle.maxAge = SMOKE_PARTICLE_LIFETIME + Math.random() * 0.2;
      particle.active = true;
    }
  }

  spawnArc(position: Vector3, dashDirection: Vector3, count: number, arcAngle: number): void {
    const mag = Math.sqrt(dashDirection.x * dashDirection.x + dashDirection.z * dashDirection.z);
    const behindX = mag > 0 ? -dashDirection.x / mag : -1;
    const behindZ = mag > 0 ? -dashDirection.z / mag : 0;

    for (let i = 0; i < count; i++) {
      const particle = this.#getInactiveParticle();
      if (!particle) return;

      const t = count > 1 ? i / (count - 1) : 0.5;
      const angle = (t - 0.5) * arcAngle;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const dirX = behindX * cos - behindZ * sin;
      const dirZ = behindX * sin + behindZ * cos;

      const radius = 0.35 + Math.random() * 0.15;
      this.#tempSpawnPos.set(position.x + dirX * radius, 0.1 + Math.random() * 0.2, position.z + dirZ * radius);

      particle.mesh.position.copy(this.#tempSpawnPos);
      particle.mesh.scale.setScalar(0.25 + Math.random() * 0.35);
      particle.mesh.visible = true;

      particle.velocity.set(
        dirX * (1.5 + Math.random() * 1.0),
        0.4 + Math.random() * 0.4,
        dirZ * (1.5 + Math.random() * 1.0),
      );

      particle.age = 0;
      particle.maxAge = SMOKE_PARTICLE_LIFETIME + (Math.random() - 0.5) * 0.15;
      particle.active = true;
    }
  }

  update(playerPosition: Vector3 | null, velocity: Vector3 | null, isDashing: boolean): void {
    const deltaTime = this.#time.delta * 0.001;

    // Update existing particles
    for (let i = 0; i < this.#particles.length; i++) {
      const particle = this.#particles[i]!;
      if (!particle.active) continue;

      particle.age += deltaTime;

      if (particle.age >= particle.maxAge) {
        particle.active = false;
        particle.mesh.visible = false;
        this.#freeList.push(i);
        continue;
      }

      const progress = particle.age / particle.maxAge;

      // Scale up then down (peaks at 50% lifetime)
      const scaleUp = Math.min(progress * 4, 1); // 0->1 in first 25%
      const scaleDown = 1 - Math.max(0, (progress - 0.5) * 2); // 1->0 in last 50%
      const scale = 0.3 + 0.7 * scaleUp * scaleDown;
      particle.mesh.scale.setScalar(scale);

      // Move upward
      particle.mesh.position.addScaledVector(particle.velocity, deltaTime);
    }

    // Spawn new particles if moving
    if (!playerPosition || !velocity) return;

    const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
    const isMoving = speed > 0.5;

    if (!isMoving) {
      this.#timeSinceLastSpawn = 0;
      return;
    }

    this.#timeSinceLastSpawn += deltaTime;

    const spawnInterval = isDashing ? SMOKE_SPAWN_INTERVAL * 0.5 : SMOKE_SPAWN_INTERVAL;

    if (this.#timeSinceLastSpawn >= spawnInterval) {
      this.#timeSinceLastSpawn = 0;
      // Spawn multiple particles per interval for denser cloud
      for (let i = 0; i < 3; i++) {
        this.spawn(playerPosition, velocity);
      }
    }
  }

  dispose(): void {
    this.#geometry.dispose();
    this.#material.dispose();

    for (const particle of this.#particles) {
      (particle.mesh.material as MeshStandardMaterial).dispose();
    }

    this.#group.removeFromParent();
  }
}
