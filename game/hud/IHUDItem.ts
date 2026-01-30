import type { Group } from 'three';

export interface IHUDItem {
  getGroup(): Group;
  getHeight(): number;
  show(): void;
  hide(): void;
  update(): void;
  dispose(): void;
}
