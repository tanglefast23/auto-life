import type { AppPreferencesEnvelope, StoredCareer } from './career-state';
import type {
  AppPreferencesRepository,
  CareerLoadResult,
  CareerRepository,
  RecoveryBlob,
} from './career-repository';

export type BootState =
  | { status: 'loading-preferences' }
  | {
      status: 'loading-career';
      preferences: AppPreferencesEnvelope;
    }
  | {
      status: 'title';
      preferences: AppPreferencesEnvelope;
    }
  | {
      status: 'identity';
      preferences: AppPreferencesEnvelope;
    }
  | {
      status: 'resume';
      preferences: AppPreferencesEnvelope;
      career: StoredCareer;
      fallbackNotice: boolean;
      startSystemPaused: boolean;
    }
  | {
      status: 'recovery';
      preferences: AppPreferencesEnvelope;
      resetFence: number;
      blobs: RecoveryBlob[];
    };

export interface BootDependencies {
  preferences: AppPreferencesRepository;
  careers: CareerRepository;
  isHidden: () => boolean;
}

/**
 * Loads both persisted layers before returning any state that may construct a
 * GameLoop. State publication is explicit so mounted tests can prove ordering.
 */
export async function bootApplication(
  dependencies: BootDependencies,
  publish: (state: BootState) => void,
): Promise<BootState> {
  publish({ status: 'loading-preferences' });
  const preferences = await dependencies.preferences.load();
  publish({ status: 'loading-career', preferences });
  const loaded = await dependencies.careers.load();
  const final = stateForLoad(
    loaded,
    preferences,
    dependencies.isHidden(),
  );
  publish(final);
  return final;
}

function stateForLoad(
  loaded: CareerLoadResult,
  preferences: AppPreferencesEnvelope,
  hidden: boolean,
): BootState {
  if (loaded.status === 'empty') {
    return { status: 'title', preferences };
  }
  if (loaded.status === 'recovery') {
    return {
      status: 'recovery',
      preferences,
      resetFence: loaded.resetFence,
      blobs: loaded.blobs,
    };
  }
  return {
    status: 'resume',
    preferences,
    career: loaded.career,
    fallbackNotice: loaded.usedFallback,
    startSystemPaused: hidden,
  };
}

export function beginIdentity(
  state: Extract<BootState, { status: 'title' }>,
): Extract<BootState, { status: 'identity' }> {
  return {
    status: 'identity',
    preferences: state.preferences,
  };
}
