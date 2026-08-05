import { getCurrentWindow } from "@tauri-apps/api/window";

export type FontSize = "small" | "normal" | "large";

export interface AppSettings {
  theme: string;
  density: string;
  fontSize: FontSize;
  reduceMotion: boolean;
  alwaysOnTop: boolean;
  globalShortcuts: boolean;
}

export const defaultSettings: AppSettings = {
  theme: "mda",
  density: "normal",
  fontSize: "normal",
  reduceMotion: false,
  alwaysOnTop: false,
  globalShortcuts: true,
};

export function getSettings(): AppSettings {
  const stored = localStorage.getItem("app_settings");
  if (stored) {
    try {
      return { ...defaultSettings, ...JSON.parse(stored) };
    } catch (e) {
      console.error("Failed to parse settings", e);
    }
  }

  const legacyTheme = localStorage.getItem("theme");
  if (legacyTheme) {
    const settings = { ...defaultSettings, theme: legacyTheme };
    saveSettings(settings);
    localStorage.removeItem("theme");
    return settings;
  }

  return defaultSettings;
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem("app_settings", JSON.stringify(settings));
}

export async function applySettingsToDOM(settings: AppSettings): Promise<void> {
  const root = document.documentElement;
  root.setAttribute("data-theme", settings.theme);
  root.setAttribute("data-density", settings.density);
  root.setAttribute("data-text-size", settings.fontSize);
  root.setAttribute("data-reduced-motion", settings.reduceMotion ? "true" : "false");

  try {
    const appWindow = getCurrentWindow();
    await appWindow.setAlwaysOnTop(settings.alwaysOnTop);
  } catch (e) {
    console.warn("Could not set always on top", e);
  }
}

export function applySettings(settings: Partial<AppSettings>): void {
  const current = getSettings();
  const updated = { ...current, ...settings };
  saveSettings(updated);
  applySettingsToDOM(updated).catch((err) => {
    console.error("Failed to apply settings to DOM", err);
  });
}

export function initializeSettings(): void {
  applySettingsToDOM(getSettings()).catch((err) => {
    console.error("Failed to apply initial settings to DOM", err);
  });

  window.addEventListener("storage", (e) => {
    if (e.key === "app_settings" && e.newValue) {
      try {
        const newSettings = JSON.parse(e.newValue);
        applySettingsToDOM({ ...defaultSettings, ...newSettings }).catch((err) => {
          console.error("Failed to apply settings from storage event", err);
        });
      } catch (err) {
        // ignore
      }
    }
  });
}
