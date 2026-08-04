import { useEffect, useState, useRef } from "react";
import { Icon } from "@iconify/react";
import {
  getSettings,
  saveSettings,
  applySettingsToDOM,
  AppSettings,
  FontSize,
} from "../utils/settings";

const THEMES = [
  { value: "mda",       label: "Claro" },
  { value: "mda-dark",  label: "Oscuro" },
  { value: "cyberpunk", label: "Cyberpunk" },
  { value: "retro",     label: "Retro" },
  { value: "aqua",      label: "Aqua" },
] as const;

const FONT_STEPS: FontSize[] = ["small", "normal", "large"];

export function SettingsModal() {
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const modalRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "app_settings" && e.newValue) {
        try {
          setSettings(JSON.parse(e.newValue));
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    saveSettings(settings);
    applySettingsToDOM(settings);
  }, [settings]);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const fontSizeIndex = FONT_STEPS.indexOf(settings.fontSize);
  const handleFontSlider = (v: number) => updateSetting("fontSize", FONT_STEPS[v]);

  const factoryReset = () => {
    localStorage.clear();
    window.location.reload();
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-sm btn-ghost btn-circle text-base-content/30"
        onClick={() => modalRef.current?.showModal()}
        title="Configuración"
      >
        <Icon icon="ph:gear-six" className="size-5" />
      </button>

      <dialog ref={modalRef} className="modal text-base-content">
        <div className="modal-box w-11/12 max-w-sm p-5">
          <h3 className="font-semibold text-sm text-base-content/50 uppercase tracking-wider mb-4">
            Ajustes
          </h3>

          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs text-base-content/50 mb-1.5">Tema</p>
              <div className="flex flex-wrap gap-1">
                {THEMES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateSetting("theme", value)}
                    className={`btn btn-xs rounded-full ${
                      settings.theme === value
                        ? "btn-primary"
                        : "btn-ghost border border-base-content/20"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Icon icon="ph:layout" className="size-4 text-base-content/50" />
                <span>Densidad</span>
              </div>
              <div className="join">
                <button
                  type="button"
                  className={`join-item btn btn-xs ${settings.density === "compact" ? "btn-primary" : "btn-ghost border border-base-content/20"}`}
                  onClick={() => updateSetting("density", "compact")}
                >
                  Compacta
                </button>
                <button
                  type="button"
                  className={`join-item btn btn-xs ${settings.density === "normal" ? "btn-primary" : "btn-ghost border border-base-content/20"}`}
                  onClick={() => updateSetting("density", "normal")}
                >
                  Normal
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 text-sm mb-2">
                <Icon icon="ph:text-aa" className="size-4 text-base-content/50" />
                <span>Tamaño de fuente</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon icon="ph:text-t" className="size-3 text-base-content/40" />
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={1}
                  value={fontSizeIndex}
                  onChange={(e) => handleFontSlider(Number(e.target.value))}
                  className="range range-xs flex-1"
                />
                <Icon icon="ph:text-t" className="size-5 text-base-content/40" />
              </div>
              <div className="flex justify-between px-1 mt-0.5">
                <span className="text-[10px] text-base-content/40">Pequeño</span>
                <span className="text-[10px] text-base-content/40">Normal</span>
                <span className="text-[10px] text-base-content/40">Grande</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2 text-sm">
                  <Icon icon="ph:film-strip" className="size-4 text-base-content/50" />
                  <span>Reducir animaciones</span>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-xs"
                  checked={settings.reduceMotion}
                  onChange={(e) => updateSetting("reduceMotion", e.target.checked)}
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2 text-sm">
                  <Icon icon="ph:push-pin" className="size-4 text-base-content/50" />
                  <span>Ventana siempre arriba</span>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-xs toggle-primary"
                  checked={settings.alwaysOnTop}
                  onChange={(e) => updateSetting("alwaysOnTop", e.target.checked)}
                />
              </label>
            </div>
          </div>

          <div className="modal-action mt-4">
            <button
              type="button"
              className="btn btn-xs btn-ghost text-error/70"
              onClick={factoryReset}
            >
              Restablecer
            </button>
            <form method="dialog">
              <button className="btn btn-xs btn-primary">Cerrar</button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </>
  );
}
