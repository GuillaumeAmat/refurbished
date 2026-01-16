import type { ControllerProfile } from './ControllerProfile';

export const XboxProfile: ControllerProfile = {
  name: 'Xbox',
  matchPatterns: [/xbox/i, /xinput/i, /045e/i, /microsoft/i],
  leftStickX: 0,
  leftStickY: 1,
  buttons: {
    a: 0,
    b: 1,
    x: 2,
    y: 3,
    start: 9,
    back: 8,
    leftBumper: 4,
    rightBumper: 5,
  },
  deadzone: 0.15,
};
