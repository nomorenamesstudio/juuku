import { useEffect, useState } from 'react';
import { type VersionInfo, getVersion } from './api';
import { readPref, writePref } from './prefs';

export const DISMISS_KEY = 'juuku.update.dismissed';

/**
 * One answer per session — the server already caches it for hours — plus the version
 * the user dismissed, so the dot and the banner both go quiet until a newer one
 * shows up. Module state with listeners, because the cog and the settings banner
 * are different components.
 */
export interface UpdateState {
  info: VersionInfo | null;
  /** a newer version is out and this one was not dismissed */
  show: boolean;
  /** the version that is being announced, for "hidden until …" copy */
  latest: string | null;
  dismiss: () => void;
}

let info: VersionInfo | null = null;
let requested = false;
let listeners: (() => void)[] = [];

function dismissed(): string | null {
  const value = readPref<string | null>(DISMISS_KEY, null);
  return typeof value === 'string' ? value : null;
}

function snapshot(): Omit<UpdateState, 'dismiss'> {
  const latest = info?.latest ?? null;
  return {
    info,
    latest,
    show: Boolean(info?.updateAvailable && latest && dismissed() !== latest),
  };
}

function bump() {
  for (const listener of listeners) listener();
}

export function useUpdate(): UpdateState {
  const [state, setState] = useState(snapshot);

  useEffect(() => {
    const listener = () => setState(snapshot());
    listeners.push(listener);
    if (!requested) {
      requested = true;
      getVersion().then(
        (payload) => {
          info = payload;
          bump();
        },
        () => {
          // no answer is not an update
        },
      );
    }
    return () => {
      listeners = listeners.filter((item) => item !== listener);
    };
  }, []);

  return {
    ...state,
    dismiss: () => {
      if (!state.latest) return;
      writePref(DISMISS_KEY, state.latest);
      bump();
    },
  };
}
