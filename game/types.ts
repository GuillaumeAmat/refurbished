export type ResourceType = 'battery' | 'frame' | 'screen' | 'phone' | 'package';
export type ResourceState = 'broken' | 'repaired';

export interface GripConfig {
  // Object position relative to body
  objectOffsetX: number;
  objectOffsetY: number;
  objectOffsetZ: number;
  // Object rotation
  objectRotationX: number;
  objectRotationY: number;
  objectRotationZ: number;
  // Hand position settings
  handOffsetX: number;
  handOffsetY: number;
  handOffsetZ: number;
  // Hand rotation settings
  handRotationX: number;
  handRotationY: number;
  handRotationZ: number;
}
