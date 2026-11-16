// Tiny external store for the saved theme ("theme" in localStorage), read by
// the dark-mode toggles through useSyncExternalStore.

const listeners = new Set<() => void>();

export function subscribeTheme(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function getIsDarkSnapshot(): boolean {
  try {
    return localStorage.getItem("theme") === "dark";
  } catch {
    return false;
  }
}

// The server (and the first hydration render) always starts in light mode.
export function getIsDarkServerSnapshot(): boolean {
  return false;
}

export function notifyThemeChange(): void {
  listeners.forEach((l) => l());
}
