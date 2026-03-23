import { Group } from 'three';

import { createTextPlane, type TextPlaneResult } from '../lib/createTextPlane';
import { SessionManager } from '../state/SessionManager';
import { Debug } from '../util/Debug';
import { Time } from '../util/Time';
import type { IHUDItem } from './IHUDItem';

type Urgency = 'normal' | 'warning' | 'critical' | 'timesUp';

const URGENCY_WARNING_THRESHOLD = 30;
const URGENCY_CRITICAL_THRESHOLD = 15;

const BG_COLORS: Record<Urgency, string> = {
  normal: '#FFFFFF',
  warning: '#FF9800',
  critical: '#F44336',
  timesUp: '#F44336',
};

const TEXT_COLORS: Record<Urgency, string> = {
  normal: '#000000',
  warning: '#000000',
  critical: '#FFFFFF',
  timesUp: '#FFFFFF',
};

// Shake parameters per urgency
const SHAKE_AMPLITUDE: Record<Urgency, number> = {
  normal: 0,
  warning: 0.012,
  critical: 0.02,
  timesUp: 0.02,
};

const SHAKE_ROTATION: Record<Urgency, number> = {
  normal: 0,
  warning: 0.015,
  critical: 0.03,
  timesUp: 0.03,
};

const SHAKE_FREQ_X = 23;
const SHAKE_FREQ_Y = 19;
const SHAKE_FREQ_ROT = 17;

export class TimeHUD implements IHUDItem {
  #group: Group;
  #text: TextPlaneResult | null = null;
  #sessionManager: SessionManager;
  #onTimeChanged: EventListener;
  #urgency: Urgency = 'normal';
  #shakeTime = 0;

  #params = {
    height: 0.44,
    fontSize: 244,
    borderRadius: 9,
    paddingX: 52,
    paddingY: 44,
    paddingTop: 44,
    posX: 0,
    posY: 0.1,
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    rotation: 0,
  };

  constructor() {
    this.#group = new Group();
    this.#sessionManager = SessionManager.getInstance();

    this.#onTimeChanged = ((event: CustomEvent) => {
      this.#updateText(event.detail.remaining);
    }) as EventListener;
    this.#sessionManager.addEventListener('timeChanged', this.#onTimeChanged);

    this.#createText(this.#sessionManager.getRemainingTime());
    this.#setupDebug();
  }

  #formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  #getUrgencyForTime(seconds: number): Urgency {
    if (seconds <= 0) return 'timesUp';
    if (seconds <= URGENCY_CRITICAL_THRESHOLD) return 'critical';
    if (seconds <= URGENCY_WARNING_THRESHOLD) return 'warning';
    return 'normal';
  }

  #applyUrgency(urgency: Urgency) {
    if (urgency === this.#urgency) return;
    this.#urgency = urgency;
    this.#text?.updateBackgroundColor(BG_COLORS[urgency]);
    this.#text?.updateColor(TEXT_COLORS[urgency]);
  }

  #createText(seconds?: number) {
    const time = seconds ?? this.#sessionManager.getRemainingTime();

    if (this.#text) {
      this.#text.dispose();
      this.#text.mesh.removeFromParent();
    }

    this.#text = createTextPlane(this.#formatTime(time), {
      height: this.#params.height,
      fontSize: this.#params.fontSize,
      color: TEXT_COLORS[this.#urgency],
      backgroundColor: BG_COLORS[this.#urgency],
      dropShadowColor: 'rgba(0,0,0,0.3)',
      dropShadowBlur: this.#params.shadowBlur,
      dropShadowOffsetX: this.#params.shadowOffsetX,
      dropShadowOffsetY: this.#params.shadowOffsetY,
      borderRadius: this.#params.borderRadius,
      backgroundPaddingX: this.#params.paddingX,
      backgroundPaddingY: this.#params.paddingY,
      backgroundPaddingTop: this.#params.paddingTop,
      referenceText: '0000',
    });
    this.#text.mesh.position.x = -this.#text.width / 2 + this.#params.posX;
    this.#text.mesh.position.y = this.#params.posY;
    this.#text.mesh.rotation.z = this.#params.rotation;
    this.#group.add(this.#text.mesh);
  }

  #setupDebug() {
    const debug = Debug.getInstance();
    if (!debug?.active) return;

    const folder = debug.gui.addFolder('Time HUD');
    const rebuild = () => this.#createText();
    const updateTransform = () => {
      if (!this.#text) return;
      this.#text.mesh.position.x = -this.#text.width / 2 + this.#params.posX;
      this.#text.mesh.position.y = this.#params.posY;
      this.#text.mesh.rotation.z = this.#params.rotation;
    };

    folder.add(this.#params, 'height', 0.1, 1, 0.01).name('Height').onChange(rebuild);
    folder.add(this.#params, 'fontSize', 32, 300, 1).name('Font Size').onChange(rebuild);
    folder.add(this.#params, 'posX', -2, 2, 0.01).name('Position X').onChange(updateTransform);
    folder.add(this.#params, 'posY', -2, 2, 0.01).name('Position Y').onChange(updateTransform);
    folder.add(this.#params, 'rotation', -0.5, 0.5, 0.01).name('Rotation').onChange(updateTransform);
    folder.add(this.#params, 'shadowBlur', 0, 40, 1).name('Shadow Blur').onChange(rebuild);
    folder.add(this.#params, 'shadowOffsetX', -20, 20, 1).name('Shadow X').onChange(rebuild);
    folder.add(this.#params, 'shadowOffsetY', -20, 20, 1).name('Shadow Y').onChange(rebuild);
    folder.close();
  }

  #updateText(seconds: number) {
    if (!this.#text) return;
    this.#applyUrgency(this.#getUrgencyForTime(seconds));
    this.#text.updateText(this.#formatTime(seconds));
    this.#text.mesh.position.x = -this.#text.width / 2 + this.#params.posX;
  }

  showTimesUp() {
    this.#applyUrgency('timesUp');
    this.#text?.updateText('Time!');
    if (this.#text) {
      this.#text.mesh.position.x = -this.#text.width / 2 + this.#params.posX;
    }
  }

  reset() {
    this.#urgency = 'normal';
    this.#shakeTime = 0;
    this.#createText();
  }

  getGroup(): Group {
    return this.#group;
  }

  getHeight(): number {
    return this.#params.height;
  }

  show() {
    this.#group.visible = true;
  }

  hide() {
    this.#group.visible = false;
  }

  update() {
    if (!this.#text || this.#urgency === 'normal') return;

    const delta = Time.getInstance().delta / 1000;
    this.#shakeTime += delta;

    const amp = SHAKE_AMPLITUDE[this.#urgency];
    const rotAmp = SHAKE_ROTATION[this.#urgency];
    const baseX = -this.#text.width / 2 + this.#params.posX;
    const baseY = this.#params.posY;

    this.#text.mesh.position.x = baseX + Math.sin(this.#shakeTime * SHAKE_FREQ_X) * amp;
    this.#text.mesh.position.y = baseY + Math.sin(this.#shakeTime * SHAKE_FREQ_Y) * amp;
    this.#text.mesh.rotation.z = this.#params.rotation + Math.sin(this.#shakeTime * SHAKE_FREQ_ROT) * rotAmp;
  }

  dispose() {
    this.#sessionManager.removeEventListener('timeChanged', this.#onTimeChanged);
    this.#text?.dispose();
  }
}
