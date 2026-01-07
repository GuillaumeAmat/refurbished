import type { ControllerProfile } from './ControllerProfile';

export const LogitechProfile: ControllerProfile = {
  name: 'Logitech',
  matchPatterns: [/logitech/i, /046d/i],
  leftStickX: 0,
  leftStickY: 1,
  buttons: {
    a: 1,
    b: 2,
    x: 0,
    y: 3,
    start: 9,
    back: 8,
    leftBumper: 4,
    rightBumper: 5,
  },
  deadzone: 0.15,
};
