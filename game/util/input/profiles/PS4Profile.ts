import type { ControllerProfile } from './ControllerProfile';

export const PS4Profile: ControllerProfile = {
  name: 'PlayStation',
  matchPatterns: [/playstation/i, /dualshock/i, /054c/i, /wireless controller/i],
  leftStickX: 0,
  leftStickY: 1,
  buttons: {
    a: 0, // Cross
    b: 1, // Circle
    x: 2, // Square
    y: 3, // Triangle
    start: 9, // Options
    back: 8, // Share
    leftBumper: 4, // L1
    rightBumper: 5, // R1
  },
  deadzone: 0.15,
};
