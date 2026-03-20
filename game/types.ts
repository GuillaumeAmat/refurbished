export type ResourceType = 'battery' | 'frame' | 'screen' | 'phone' | 'package';
export type ResourceState = 'broken' | 'repaired';

export type OnboardingIconType =
  | 'button-a'
  | 'button-x'
  | 'batteryBroken'
  | 'frameBroken'
  | 'screenBroken'
  | 'batteryRepaired'
  | 'frameRepaired'
  | 'screenRepaired'
  | 'phone'
  | 'packageOpen'
  | 'packageClosed';

export interface GripConfig {
  // Object position relative to body
  objectOffsetX: number;
  objectOffsetY: number;
  objectOffsetZ: number;
  // Object rotation
  objectRotationX: number;
  objectRotationY: number;
  objectRotationZ: number;
  // Object scale
  objectScale: number;
  // Hand position settings
  handOffsetX: number;
  handOffsetY: number;
  handOffsetZ: number;
  // Hand rotation settings
  handRotationX: number;
  handRotationY: number;
  handRotationZ: number;
}
