import type { ControllerProfile } from './ControllerProfile';

export const LogitechProfile: ControllerProfile = {
  name: 'Logitech',
  matchPatterns: [/logitech/i, /046d/i],
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
