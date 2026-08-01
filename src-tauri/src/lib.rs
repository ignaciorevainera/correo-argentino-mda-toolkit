use encoding_rs::WINDOWS_1252;
use serde::Serialize;
use std::collections::HashMap;
use std::os::windows::process::CommandExt;
use std::process::Command as StdCommand;
use std::sync::{Arc, Mutex};
use tauri::{menu::{Menu, MenuItem}, tray::TrayIconBuilder, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[derive(Debug, Serialize, Clone)]
pub struct StreamLinePayload {
    pub id: String,
    pub text: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct StreamDonePayload {
    pub id: String,
    pub exit_code: Option<i32>,
}

fn decode_windows_output(bytes: Vec<u8>) -> String {
    if bytes.is_empty() {
        return String::new();
    }
    match String::from_utf8(bytes) {
        Ok(s) => s,
        Err(e) => {
            let (decoded, _, _) = WINDOWS_1252.decode(e.as_bytes());
            decoded.into_owned()
        }
    }
}

const CREATE_NO_WINDOW: u32 = 0x08000000;

type PidMap = Arc<Mutex<HashMap<String, u32>>>;

fn kill_process_tree(pid: u32) -> std::io::Result<std::process::ExitStatus> {
    StdCommand::new("taskkill")
        .creation_flags(CREATE_NO_WINDOW)
        .args(["/F", "/T", "/PID", &pid.to_string()])
        .spawn()?
        .wait()
}

fn spawn_cmd(command: &str) -> std::io::Result<tokio::process::Child> {
    Command::new("cmd")
        .args(["/c", command])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
}

async fn stream_output<R: tokio::io::AsyncRead + Unpin>(
    mut reader: BufReader<R>,
    window: tauri::Window,
    id: String,
) {
    let mut buffer = Vec::new();
    loop {
        match reader.read_until(b'\n', &mut buffer).await {
            Ok(0) => break,
            Ok(_) => {
                if buffer.ends_with(b"\n") {
                    buffer.pop();
                    if buffer.ends_with(b"\r") {
                        buffer.pop();
                    }
                }
                let text = decode_windows_output(std::mem::take(&mut buffer));
                let _ = window.emit(
                    "command-line",
                    StreamLinePayload {
                        id: id.clone(),
                        text,
                    },
                );
            }
            Err(_) => break,
        }
    }
}

#[tauri::command]
async fn run_command_stream(
    window: tauri::Window,
    state: tauri::State<'_, PidMap>,
    id: String,
    command: String,
) -> Result<(), String> {
    let mut child = spawn_cmd(&command).map_err(|e| format!("Failed to spawn: {}", e))?;

    if let Some(pid) = child.id() {
        state.lock().unwrap().insert(id.clone(), pid);
    }

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "No stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "No stderr".to_string())?;

    let win_stdout = window.clone();
    let id_stdout = id.clone();
    let stdout_handle = tokio::spawn(async move {
        stream_output(BufReader::new(stdout), win_stdout, id_stdout).await;
    });

    let win_stderr = window.clone();
    let id_stderr = id.clone();
    let stderr_handle = tokio::spawn(async move {
        stream_output(BufReader::new(stderr), win_stderr, id_stderr).await;
    });

    let _ = stdout_handle.await;
    let _ = stderr_handle.await;

    let status = child
        .wait()
        .await
        .map_err(|e| format!("Wait error: {}", e))?;

    state.lock().unwrap().remove(&id);

    let _ = window.emit(
        "command-done",
        StreamDonePayload {
            id,
            exit_code: status.code(),
        },
    );

    Ok(())
}

#[tauri::command]
async fn stop_command_stream(
    state: tauri::State<'_, PidMap>,
    id: String,
) -> Result<(), String> {
    let pid = state.lock().unwrap().remove(&id);
    if let Some(pid) = pid {
        kill_process_tree(pid).map_err(|e| format!("Failed to kill process: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn run_msra_offer(hostname: String) -> Result<(), String> {
    StdCommand::new("msra.exe")
        .creation_flags(CREATE_NO_WINDOW)
        .args(["/offerRA", &hostname])
        .spawn()
        .map_err(|e| format!("Failed to launch Remote Assistance: {}", e))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            run_command_stream,
            stop_command_stream,
            run_msra_offer
        ])
        
        .setup(|app| {
            app.manage(Arc::new(Mutex::new(HashMap::<String, u32>::new())));
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_clipboard_manager::init())?;
                app.handle().plugin(tauri_plugin_global_shortcut::Builder::new().build())?;
            }

            let quit_i = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Mostrar", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        std::process::exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })

        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn hidden_cmd_streams_output_through_pipes() {
        let child = spawn_cmd("ping -n 2 127.0.0.1").expect("cmd must spawn");
        let output = child.wait_with_output().await.expect("wait must succeed");
        assert!(output.status.success(), "ping must exit 0");
        assert!(
            String::from_utf8_lossy(&output.stdout).contains("127.0.0.1"),
            "ping stdout must still be captured and contain the target"
        );
    }

    #[tokio::test]
    async fn hidden_std_command_captures_output() {
        let output = StdCommand::new("cmd")
            .creation_flags(CREATE_NO_WINDOW)
            .args(["/c", "echo hidden-ok"])
            .output()
            .expect("cmd must run");
        assert!(output.status.success());
        assert_eq!(String::from_utf8_lossy(&output.stdout).trim(), "hidden-ok");
    }

    #[tokio::test]
    async fn hidden_cmd_stderr_still_streams() {
        let child = spawn_cmd("echo err-ok 1>&2").expect("cmd must spawn");
        let output = child.wait_with_output().await.expect("wait must succeed");
        assert!(output.status.success());
        assert_eq!(String::from_utf8_lossy(&output.stderr).trim(), "err-ok");
    }

    #[tokio::test]
    async fn kill_process_tree_terminates_infinite_ping() {
        let mut child = spawn_cmd("ping -t 127.0.0.1").expect("cmd must spawn");
        let pid = child.id().expect("pid must exist");

        let kill_status = kill_process_tree(pid).expect("taskkill must run");
        assert!(kill_status.success(), "taskkill must exit 0");

        let status = child.wait().await.expect("wait must succeed");
        assert!(!status.success(), "killed process must not exit successfully");
    }
}

