import type { AppPreferences } from './career-state';

export interface AudioBus {
  apply(settings: AppPreferences['audio']): void;
  readonly muted: boolean;
}

/**
 * P5 owns control truth but no audio assets. This implementation deliberately
 * makes no sound while keeping the exact state P6's real mixer will consume.
 */
export class SilentAudioBus implements AudioBus {
  private settings: AppPreferences['audio'];

  constructor(initial: AppPreferences['audio']) {
    this.settings = { ...initial };
  }

  get muted(): boolean {
    return this.settings.muted;
  }

  apply(settings: AppPreferences['audio']): void {
    this.settings = { ...settings };
  }
}
