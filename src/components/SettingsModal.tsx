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
  { value: "mda", label: "Claro (MDA)" },
  { value: "mda-dark", label: "Oscuro (MDA)" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "cupcake", label: "Cupcake" },
  { value: "bumblebee", label: "Bumblebee" },
  { value: "emerald", label: "Emerald" },
  { value: "corporate", label: "Corporate" },
  { value: "synthwave", label: "Synthwave" },
  { value: "retro", label: "Retro" },
  { value: "cyberpunk", label: "Cyberpunk" },
  { value: "valentine", label: "Valentine" },
  { value: "halloween", label: "Halloween" },
  { value: "garden", label: "Garden" },
  { value: "forest", label: "Forest" },
  { value: "aqua", label: "Aqua" },
  { value: "lofi", label: "Lofi" },
  { value: "pastel", label: "Pastel" },
  { value: "fantasy", label: "Fantasy" },
  { value: "wireframe", label: "Wireframe" },
  { value: "black", label: "Black" },
  { value: "luxury", label: "Luxury" },
  { value: "dracula", label: "Dracula" },
  { value: "cmyk", label: "CMYK" },
  { value: "autumn", label: "Autumn" },
  { value: "business", label: "Business" },
  { value: "acid", label: "Acid" },
  { value: "lemonade", label: "Lemonade" },
  { value: "night", label: "Night" },
  { value: "coffee", label: "Coffee" },
  { value: "winter", label: "Winter" },
  { value: "dim", label: "Dim" },
  { value: "nord", label: "Nord" },
  { value: "sunset", label: "Sunset" },
  { value: "caramellate", label: "Caramellate" },
  { value: "abyss", label: "Abyss" },
] as const;

const FONT_STEPS: FontSize[] = ["small", "normal", "large"];

export function SettingsModal() {
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [activeTab, setActiveTab] = useState<"general" | "shortcuts">("general");
  const modalRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "app_settings" && e.newValue) {
        try {
          setSettings(JSON.parse(e.newValue));
        } catch {
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

  const updateSetting = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const fontSizeIndex = FONT_STEPS.indexOf(settings.fontSize);
  const handleFontSlider = (v: number) =>
    updateSetting("fontSize", FONT_STEPS[v]);

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
        <div className="modal-box w-11/12 max-w-md max-h-3/4 p-5 flex flex-col">
          <h3 className="font-semibold text-sm text-base-content/50 uppercase tracking-wider mb-3">
            Ajustes
          </h3>

          <div role="tablist" className="tabs tabs-border tabs-sm mb-4">
            <button
              type="button"
              role="tab"
              className={`tab ${activeTab === "general" ? "tab-active" : ""}`}
              onClick={() => setActiveTab("general")}
            >
              General
            </button>
            <button
              type="button"
              role="tab"
              className={`tab ${activeTab === "shortcuts" ? "tab-active" : ""}`}
              onClick={() => setActiveTab("shortcuts")}
            >
              Atajos
            </button>
          </div>

          {activeTab === "general" && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs text-base-content/50 mb-1.5">Tema</p>
                <select
                  className="select select-bordered select-sm w-full max-w-xs"
                  value={settings.theme}
                  onChange={(e) => updateSetting("theme", e.target.value)}
                >
                  {THEMES.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Icon
                    icon="ph:layout"
                    className="size-4 text-base-content/50"
                  />
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
                  <Icon
                    icon="ph:text-aa"
                    className="size-4 text-base-content/50"
                  />
                  <span>Tamaño de fuente</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon
                    icon="ph:text-t"
                    className="size-3 text-base-content/40"
                  />
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={1}
                    value={fontSizeIndex}
                    onChange={(e) => handleFontSlider(Number(e.target.value))}
                    className="range range-xs flex-1"
                  />
                  <Icon
                    icon="ph:text-t"
                    className="size-5 text-base-content/40"
                  />
                </div>
                <div className="flex justify-between px-1 mt-0.5">
                  <span className="text-[10px] text-base-content/40">
                    Pequeño
                  </span>
                  <span className="text-[10px] text-base-content/40">Normal</span>
                  <span className="text-[10px] text-base-content/40">Grande</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2 text-sm">
                    <Icon
                      icon="ph:film-strip"
                      className="size-4 text-base-content/50"
                    />
                    <span>Reducir animaciones</span>
                  </div>
                  <input
                    type="checkbox"
                    className="toggle toggle-xs"
                    checked={settings.reduceMotion}
                    onChange={(e) =>
                      updateSetting("reduceMotion", e.target.checked)
                    }
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2 text-sm">
                    <Icon
                      icon="ph:push-pin"
                      className="size-4 text-base-content/50"
                    />
                    <span>Ventana siempre arriba</span>
                  </div>
                  <input
                    type="checkbox"
                    className="toggle toggle-xs toggle-primary"
                    checked={settings.alwaysOnTop}
                    onChange={(e) =>
                      updateSetting("alwaysOnTop", e.target.checked)
                    }
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === "shortcuts" && (
            <div className="flex flex-col gap-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2 text-sm">
                  <Icon
                    icon="ph:keyboard"
                    className="size-4 text-base-content/50"
                  />
                  <span>Atajos globales (teclado)</span>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-xs toggle-primary"
                  checked={settings.globalShortcuts}
                  onChange={(e) =>
                    updateSetting("globalShortcuts", e.target.checked)
                  }
                />
              </label>

              <div className="overflow-x-auto border border-base-content/10 rounded-lg">
                <table className="table table-xs w-full">
                  <thead>
                    <tr className="text-base-content/60">
                      <th>Atajo</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    <tr>
                      <td className="whitespace-nowrap">
                        <kbd className="kbd kbd-xs">Ctrl</kbd>+<kbd className="kbd kbd-xs">Espacio</kbd>
                      </td>
                      <td>Enfocar app y pegar portapapeles</td>
                    </tr>
                    <tr>
                      <td className="whitespace-nowrap">
                        <kbd className="kbd kbd-xs">Ctrl</kbd>+<kbd className="kbd kbd-xs">F9</kbd>
                      </td>
                      <td>Ping a IP/Host del portapapeles</td>
                    </tr>
                    <tr>
                      <td className="whitespace-nowrap">
                        <kbd className="kbd kbd-xs">Ctrl</kbd>+<kbd className="kbd kbd-xs">F10</kbd>
                      </td>
                      <td>Ping a Router (.250)</td>
                    </tr>
                    <tr>
                      <td className="whitespace-nowrap">
                        <kbd className="kbd kbd-xs">Ctrl</kbd>+<kbd className="kbd kbd-xs">F11</kbd>
                      </td>
                      <td>Ejecutar net time</td>
                    </tr>
                    <tr>
                      <td className="whitespace-nowrap">
                        <kbd className="kbd kbd-xs">Ctrl</kbd>+<kbd className="kbd kbd-xs">F12</kbd>
                      </td>
                      <td>Asistencia remota (msra)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

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

