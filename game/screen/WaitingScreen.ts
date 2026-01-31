import { Group, type Mesh, MeshStandardMaterial, type Scene } from 'three';
import type { Actor, AnyActorLogic, Subscription } from 'xstate';

import { createTextMesh } from '../lib/createTextMesh';
import { GamepadManager } from '../util/input/GamepadManager';
import { Resources } from '../util/Resources';

export class WaitingScreen {
  #stageActor: Actor<AnyActorLogic>;
  #scene: Scene;
  #resources: Resources;
  #gamepadManager: GamepadManager;
  #subscription: Subscription;

  #group: Group;
  #titleMesh: Mesh | null = null;
  #player1Mesh: Mesh | null = null;
  #player2Mesh: Mesh | null = null;
  #backMesh: Mesh | null = null;
  #material: MeshStandardMaterial;
  #connectedMaterial: MeshStandardMaterial;

  // Bound listener references for cleanup
  #onControllersReadyChange: () => void;
  #onGamepadAssigned: () => void;
  #onGamepadReconnected: () => void;
  #onGamepadDisconnected: () => void;

  constructor(stageActor: Actor<AnyActorLogic>, scene: Scene) {
    this.#stageActor = stageActor;
    this.#scene = scene;
    this.#resources = Resources.getInstance();
    this.#gamepadManager = GamepadManager.getInstance();

    this.#group = new Group();
    this.#group.position.set(0, 30, 0);
    this.#scene.add(this.#group);

    this.#subscription = this.#stageActor.subscribe((state) => {
      if (state.matches('WaitingForControllers')) {
        this.show();
      } else {
        this.hide();
      }
    });

    this.#material = new MeshStandardMaterial({
      color: '#FBD954',
      metalness: 0.3,
      roughness: 0.4,
    });

    this.#connectedMaterial = new MeshStandardMaterial({
      color: '#54FB7D',
      metalness: 0.3,
      roughness: 0.4,
    });

    this.#onControllersReadyChange = () => {
      this.updateStatus();
      if (this.#gamepadManager.areControllersReady()) {
        this.#stageActor.send({ type: 'controllersReady' });
      }
    };
    this.#onGamepadAssigned = () => this.updateStatus();
    this.#onGamepadReconnected = () => this.updateStatus();
    this.#onGamepadDisconnected = () => this.updateStatus();

    this.#gamepadManager.addEventListener('controllersReadyChange', this.#onControllersReadyChange);
    this.#gamepadManager.addEventListener('gamepadAssigned', this.#onGamepadAssigned);
    this.#gamepadManager.addEventListener('gamepadReconnected', this.#onGamepadReconnected);
    this.#gamepadManager.addEventListener('gamepadDisconnected', this.#onGamepadDisconnected);

    this.createText();
  }

  private createText() {
    const font = this.#resources.getFontAsset('interFont');

    if (!font) {
      return;
    }

    this.#titleMesh = createTextMesh('Connect Controllers', font, {
      extrusionDepth: 0.1,
      size: 1.2,
      material: this.#material,
    });
    this.#titleMesh.position.set(0, 4, 0);
    this.#group.add(this.#titleMesh);

    this.#player1Mesh = createTextMesh('Player 1: Waiting...', font, {
      extrusionDepth: 0.05,
      size: 0.7,
      material: this.#material,
    });
    this.#player1Mesh.position.set(0, 1.5, 0);
    this.#group.add(this.#player1Mesh);

    this.#player2Mesh = createTextMesh('Player 2: Waiting...', font, {
      extrusionDepth: 0.05,
      size: 0.7,
      material: this.#material,
    });
    this.#player2Mesh.position.set(0, 0, 0);
    this.#group.add(this.#player2Mesh);

    this.#backMesh = createTextMesh('Back', font, {
      extrusionDepth: 0.05,
      size: 0.8,
      material: this.#material,
    });
    this.#backMesh.position.set(0, -2, 0);
    this.#group.add(this.#backMesh);

    this.updateStatus();
  }

  private updateStatus() {
    const status = this.#gamepadManager.getConnectionStatus();
    this.updatePlayerMesh(this.#player1Mesh, 1, status.player1);
    this.updatePlayerMesh(this.#player2Mesh, 2, status.player2);
  }

  private updatePlayerMesh(mesh: Mesh | null, playerId: number, connected: boolean) {
    if (!mesh) return;

    const font = this.#resources.getFontAsset('interFont');
    if (!font) return;

    const text = connected ? `Player ${playerId}: Connected` : `Player ${playerId}: Waiting...`;
    const material = connected ? this.#connectedMaterial : this.#material;

    this.#group.remove(mesh);

    const newMesh = createTextMesh(text, font, {
      extrusionDepth: 0.05,
      size: 0.7,
      material,
    });
    newMesh.position.copy(mesh.position);
    this.#group.add(newMesh);

    if (playerId === 1) {
      this.#player1Mesh = newMesh;
    } else {
      this.#player2Mesh = newMesh;
    }
  }

  private show() {
    this.#group.visible = true;
    this.updateStatus();

    if (this.#gamepadManager.areControllersReady()) {
      this.#stageActor.send({ type: 'controllersReady' });
    }
  }

  private hide() {
    this.#group.visible = false;
  }

  public update() {
    if (!this.#group.visible) return;
  }

  public dispose() {
    this.#subscription.unsubscribe();
    this.#gamepadManager.removeEventListener('controllersReadyChange', this.#onControllersReadyChange);
    this.#gamepadManager.removeEventListener('gamepadAssigned', this.#onGamepadAssigned);
    this.#gamepadManager.removeEventListener('gamepadReconnected', this.#onGamepadReconnected);
    this.#gamepadManager.removeEventListener('gamepadDisconnected', this.#onGamepadDisconnected);
  }
}
