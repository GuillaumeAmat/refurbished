import { Resources } from './Resources';

export class SoundManager {
  static #instance: SoundManager;

  constructor() {
    SoundManager.#instance = this;
  }

  static getInstance(): SoundManager {
    return SoundManager.#instance;
  }

  playSound(name: string): void {
    const sound = Resources.getInstance().getAudioAsset(name);
    if (!sound) return;
    sound.currentTime = 0;
    sound.play();
  }

  playTrack(name: string, volume: number): void {
    const sound = Resources.getInstance().getAudioAsset(name);
    if (!sound) return;
    sound.loop = true;
    sound.volume = volume;
    sound.currentTime = 0;
    sound.play();
  }

  stopTrack(name: string): void {
    const sound = Resources.getInstance().getAudioAsset(name);
    if (!sound) return;
    sound.pause();
  }
}
