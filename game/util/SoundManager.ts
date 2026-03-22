import { Howl, Howler } from 'howler';

import {
  AUDIO_FADE_MS,
  AUDIO_FADE_OUT_MS,
  PHASE_TRANSITION_MS,
  TRACK_GAP_MS,
  VOLUME_GAME,
  VOLUME_MENU,
} from '../constants';

export type AudioPhase = 'menu' | 'game' | 'silent';

export class SoundManager {
  static #instance: SoundManager;

  #muted = false;
  #playlist: Howl[];
  #currentIndex = 0;
  #gapTimer: ReturnType<typeof setTimeout> | null = null;
  #phaseTimer: ReturnType<typeof setTimeout> | null = null;
  #phase: AudioPhase = 'silent';
  #playing = false;

  constructor() {
    SoundManager.#instance = this;
    Howler.volume(1);

    this.#playlist = [
      new Howl({ src: ['/game/audio/track/track_1.opus', '/game/audio/track/track_1.mp3'], preload: true }),
      new Howl({ src: ['/game/audio/track/track_2.opus', '/game/audio/track/track_2.mp3'], preload: true }),
      new Howl({ src: ['/game/audio/track/track_3.opus', '/game/audio/track/track_3.mp3'], preload: true }),
    ];
  }

  static getInstance(): SoundManager {
    return SoundManager.#instance;
  }

  setPhase(phase: AudioPhase): void {
    if (phase === this.#phase) return;

    const previousPhase = this.#phase;
    this.#phase = phase;

    if (phase === 'silent') {
      this.#stopPlayback(AUDIO_FADE_OUT_MS);
      return;
    }

    if (previousPhase !== 'silent') {
      // Switching between menu <-> game: 2s silence gap
      this.#stopPlayback();
      this.#phaseTimer = setTimeout(() => {
        this.#phaseTimer = null;
        this.#startPlayback();
      }, PHASE_TRANSITION_MS);
    } else {
      this.#startPlayback();
    }
  }

  pausePlayback(): void {
    this.#clearPhaseTimer();
    this.#clearGapTimer();

    const current = this.#playlist[this.#currentIndex];
    if (current.playing()) {
      current.fade(current.volume(), 0, AUDIO_FADE_MS);
      setTimeout(() => current.pause(), AUDIO_FADE_MS);
    }
    this.#playing = false;
  }

  resumePlayback(): void {
    if (this.#playing) return;
    this.#playing = true;

    const targetVol = this.#phase === 'menu' ? VOLUME_MENU : VOLUME_GAME;
    const current = this.#playlist[this.#currentIndex];
    current.volume(0);
    current.play();
    current.fade(0, targetVol, AUDIO_FADE_MS);
    this.#attachEndHandler(current);
  }

  waitForLoad(): Promise<void> {
    const promises = this.#playlist.map((howl) =>
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

  dispose(): void {
    this.#clearGapTimer();
    this.#clearPhaseTimer();
    for (const howl of this.#playlist) {
      howl.off('end');
      howl.unload();
    }
  }

  #startPlayback(): void {
    this.#currentIndex = 0;
    this.#playing = true;
    this.#playCurrentTrack();
  }

  #stopPlayback(fadeMs = AUDIO_FADE_MS): void {
    this.#clearGapTimer();
    this.#clearPhaseTimer();

    for (const howl of this.#playlist) {
      howl.off('end');
      if (howl.playing()) {
        howl.fade(howl.volume(), 0, fadeMs);
        setTimeout(() => howl.stop(), fadeMs);
      }
    }
    this.#playing = false;
  }

  #playCurrentTrack(): void {
    const howl = this.#playlist[this.#currentIndex];
    const targetVol = this.#phase === 'menu' ? VOLUME_MENU : VOLUME_GAME;
    howl.seek(0);
    howl.volume(0);
    howl.play();
    howl.fade(0, targetVol, AUDIO_FADE_MS);
    this.#attachEndHandler(howl);
  }

  #attachEndHandler(howl: Howl): void {
    howl.off('end');
    howl.once('end', () => {
      if (!this.#playing) return;
      this.#currentIndex = (this.#currentIndex + 1) % this.#playlist.length;
      this.#gapTimer = setTimeout(() => {
        this.#gapTimer = null;
        if (this.#playing) this.#playCurrentTrack();
      }, TRACK_GAP_MS);
    });
  }

  #clearGapTimer(): void {
    if (this.#gapTimer !== null) {
      clearTimeout(this.#gapTimer);
      this.#gapTimer = null;
    }
  }

  #clearPhaseTimer(): void {
    if (this.#phaseTimer !== null) {
      clearTimeout(this.#phaseTimer);
      this.#phaseTimer = null;
    }
  }
}
