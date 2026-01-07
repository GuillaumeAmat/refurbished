export interface ControllerProfile {
  name: string;
  matchPatterns: RegExp[];
  leftStickX: number;
  leftStickY: number;
  buttons: {
    a: number;
    b: number;
    x: number;
    y: number;
    start: number;
    back: number;
    leftBumper: number;
    rightBumper: number;
  };
  deadzone: number;
}
