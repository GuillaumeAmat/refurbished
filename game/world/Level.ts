import { Group, type Scene, Vector3 } from 'three';

import type { LevelInfo } from '../levels';
import { Physics } from '../util/Physics';
import { Time } from '../util/Time';
import { Environment } from './Environment';
import { InteractionSystem } from './InteractionSystem';
import { LevelBuilder } from './LevelBuilder';
import { Floor } from './object/Floor';
import type { LevelObject } from './object/LevelObject';
import { OnboardingManager } from './OnboardingManager';
import { Player } from './Player';

export class Level {
  #screenGroup: Group;
  #scene: Scene;
  #group: Group;
  #levelInfo: LevelInfo;

  #floor!: Floor;
  #levelBuilder!: LevelBuilder;
  #player1: Player | null = null;
  #player2: Player | null = null;
  #interactionSystem!: InteractionSystem;
  #onboardingManager!: OnboardingManager;
  #physics: Physics;

  #interactive = true;
  #cachedMidpoint = new Vector3();

  constructor(screenGroup: Group, scene: Scene, levelInfo: LevelInfo) {
    this.#screenGroup = screenGroup;
    this.#scene = scene;
    this.#physics = Physics.getInstance();
    this.#levelInfo = levelInfo;

    this.#group = new Group();
    this.#screenGroup.add(this.#group);
  }

  public async init(): Promise<void> {
    await this.#physics.init();

    this.#floor = new Floor(this.#levelInfo);
    this.#floor.create(this.#group);

    this.#levelBuilder = new LevelBuilder(this.#levelInfo.data);
    this.#levelBuilder.buildFromMatrix(this.#group);

    this.#player1 = new Player(this.#group, this.#scene, 1, this.#levelInfo.spawnPositions[0]!);
    this.#player2 = new Player(this.#group, this.#scene, 2, this.#levelInfo.spawnPositions[1]!);
    Environment.getInstance()?.registerPlayer(this.#player1);
    Environment.getInstance()?.registerPlayer(this.#player2);

    this.#interactionSystem = new InteractionSystem(this.#group, this.#levelInfo.data);
    this.#interactionSystem.registerPlayer(this.#player1);
    this.#interactionSystem.registerPlayer(this.#player2);
    this.#interactionSystem.setInteractables(this.#levelBuilder.getInteractables());

    this.#onboardingManager = new OnboardingManager(this.#group, this.#levelBuilder.getInteractables());
    this.#interactionSystem.setOnboardingManager(this.#onboardingManager);

    this.#setupInputCallbacks();
  }

  #setupInputCallbacks(): void {
    this.#player1?.onInteract(() => {
      this.#interactionSystem.handleInteraction(1);
    });
    this.#player2?.onInteract(() => {
      this.#interactionSystem.handleInteraction(2);
    });
  }

  public getPlayerMidpoint(): Vector3 | null {
    const p1 = this.#player1?.getPosition();
    const p2 = this.#player2?.getPosition();
    if (!p1 || !p2) return null;
    return this.#cachedMidpoint.addVectors(p1, p2).multiplyScalar(0.5);
  }

  public getPlayerDistance(): number | null {
    const p1 = this.#player1?.getPosition();
    const p2 = this.#player2?.getPosition();
    if (!p1 || !p2) return null;
    return p1.distanceTo(p2);
  }

  public getInteractables(): LevelObject[] {
    return this.#levelBuilder.getInteractables();
  }

  public setInteractive(interactive: boolean): void {
    this.#interactive = interactive;
  }

  public startOnboarding(): void {
    this.#onboardingManager.start();
  }

  public dispose(): void {
    this.#player1?.cleanup();
    this.#player2?.cleanup();
    this.#onboardingManager.dispose();
    this.#floor.dispose();
    this.#levelBuilder.dispose();
    this.#group.removeFromParent();
  }

  public update() {
    if (!this.#interactive) return;
    this.#physics.update(Time.getInstance().delta);
    this.#player1?.update();
    this.#player2?.update();
    this.#interactionSystem.update();
    this.#onboardingManager.update();
  }
}
