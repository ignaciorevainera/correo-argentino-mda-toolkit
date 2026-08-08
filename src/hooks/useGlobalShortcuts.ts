import { useEffect, useRef } from "react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { getCurrentWindow } from "@tauri-apps/api/window";

const SHORTCUT_MAPPING = [
  { shortcut: "CommandOrControl+F9", action: "F9" },
  { shortcut: "CommandOrControl+F10", action: "F10" },
  { shortcut: "CommandOrControl+F11", action: "F11" },
  { shortcut: "CommandOrControl+F12", action: "F12" },
] as const;

export function useGlobalShortcuts(
  enabled: boolean,
  onShortcut: (action: string, clipboardText: string) => void
) {
  const onShortcutRef = useRef(onShortcut);
  useEffect(() => {
    onShortcutRef.current = onShortcut;
  }, [onShortcut]);

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;
    const registeredShortcuts: string[] = [];

    const setupShortcuts = async () => {
      for (const { shortcut, action } of SHORTCUT_MAPPING) {
        try {
          await register(shortcut, async (event) => {
            if (event.state === "Pressed") {
              console.log(`[GlobalShortcut] Triggered ${shortcut}`);
              try {
                const win = getCurrentWindow();
                await win.show();
                await win.unminimize();
                await win.setFocus();
              } catch (err) {
                console.error("[GlobalShortcut] Error focusing window:", err);
              }
              let clipboardText = "";
              try {
                clipboardText = (await readText()) || "";
              } catch (err) {
                console.error("[GlobalShortcut] Error reading clipboard:", err);
                clipboardText = "";
              }
              onShortcutRef.current(action, clipboardText);
            }
          });
          console.log(`[GlobalShortcut] Registered ${shortcut}`);
          if (isMounted) {
            registeredShortcuts.push(shortcut);
          } else {
            await unregister(shortcut).catch(() => {});
          }
        } catch (err) {
          console.error(`[GlobalShortcut] Failed to register ${shortcut}:`, err);
        }
      }
    };

    setupShortcuts();

    return () => {
      isMounted = false;
      registeredShortcuts.forEach((shortcut) => {
        unregister(shortcut).catch(() => {});
      });
    };
  }, [enabled]);
}
