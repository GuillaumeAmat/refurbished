import { Howl, Howler } from 'howler';

import { AUDIO_TRACK_FADE_MS } from '../constants';

export class SoundManager {
  static #instance: SoundManager;

  #muted = false;

  #sounds: Record<string, Howl> = {
    menuTrack: new Howl({
      src: ['/game/audio/track/menu.opus', '/game/audio/track/menu.mp3'],
      loop: true,
      preload: true,
    }),
    levelTrack: new Howl({
      src: ['/game/audio/track/level.opus', '/game/audio/track/level.mp3'],
      loop: false,
      preload: true,
    }),
    selectSound: new Howl({
      src: ['/game/audio/effect/select.opus', '/game/audio/effect/select.mp3'],
      preload: true,
    }),
  };

  constructor() {
    SoundManager.#instance = this;
  }

  static getInstance(): SoundManager {
    return SoundManager.#instance;
  }

  playSound(name: string): void {
    this.#sounds[name]?.play();
  }

  stopTrack(name: string): void {
    const howl = this.#sounds[name];
    if (!howl || !howl.playing()) return;
    howl.fade(howl.volume(), 0, AUDIO_TRACK_FADE_MS);
    howl.once('fade', () => howl.pause());
  }

  resumeTrack(name: string, loop = true, resetOnResume = false): void {
    const howl = this.#sounds[name];
    if (!howl) return;
    howl.loop(loop);
    if (howl.playing()) return;
    if (resetOnResume) howl.seek(0);
    howl.volume(0);
    howl.play();
    howl.fade(0, 1, AUDIO_TRACK_FADE_MS);
  }

  waitForLoad(): Promise<void> {
    const promises = Object.values(this.#sounds).map((howl) =>
      howl.state() === 'loaded'
        ? Promise.resolve()
        : new Promise<void>((resolve) => howl.once('load', () => resolve())),
    );
    return Promise.all(promises).then(() => undefined);
  }

  toggleMute(): void {
    this.#muted = !this.#muted;
    Howler.mute(this.#muted);
  }

  getTrackDuration(name: string): Promise<number> {
    const howl = this.#sounds[name];
    if (!howl) return Promise.resolve(0);
    if (howl.state() === 'loaded') return Promise.resolve(howl.duration());
    return new Promise((resolve) => howl.once('load', () => resolve(howl.duration())));
  }
}
