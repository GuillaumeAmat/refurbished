export interface InputVector {
  x: number; // -1 to 1
  z: number; // -1 to 1
}

export interface InputSource {
  getMovement(): InputVector;
  isButtonPressed(button: string): boolean;
  isButtonJustPressed(button: string): boolean;
  getButtonHoldDuration(button: string): number;
  onButtonUp(callback: (button: string) => void): void;
  cleanup(): void;
  readonly connected: boolean;
}
