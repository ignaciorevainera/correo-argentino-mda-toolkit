use encoding_rs::WINDOWS_1252;
use serde::Serialize;
use std::collections::HashMap;
use std::net::ToSocketAddrs;
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
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
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

fn get_vpn_source_ip() -> Option<String> {
    let output = StdCommand::new("ipconfig")
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;
    let text = decode_windows_output(output.stdout);

    let mut is_vpn = false;
    for line in text.lines() {
        let trimmed = line.trim();
        if line.contains("Adaptador") || line.contains("adapter") {
            let lower = line.to_lowercase();
            is_vpn = lower.contains("check point") || lower.contains("vpn");
        }
        if is_vpn && (trimmed.contains("IPv4") || trimmed.contains("Dirección IPv4")) {
            if let Some(pos) = trimmed.rfind(':') {
                let ip = trimmed[pos + 1..].trim();
                let ip_clean: String = ip.chars().filter(|c| c.is_ascii_digit() || *c == '.').collect();
                if !ip_clean.is_empty() && ip_clean != "0.0.0.0" {
                    return Some(ip_clean);
                }
            }
        }
    }
    None
}

fn inject_vpn_source_ip(command: &str) -> String {
    let trimmed = command.trim();
    if (trimmed.starts_with("ping ") || trimmed == "ping") && !trimmed.contains(" -S ") {
        if let Some(vpn_ip) = get_vpn_source_ip() {
            if trimmed.starts_with("ping ") {
                return format!("ping -S {} {}", vpn_ip, &trimmed[5..]);
            }
        }
    }
    command.to_string()
}

#[tauri::command]
async fn run_command_stream(
    window: tauri::Window,
    state: tauri::State<'_, PidMap>,
    id: String,
    command: String,
) -> Result<(), String> {
    let final_command = inject_vpn_source_ip(&command);
    let mut child = spawn_cmd(&final_command).map_err(|e| format!("Failed to spawn: {}", e))?;

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
        let status = kill_process_tree(pid).map_err(|e| format!("Failed to kill process {}: {}", pid, e))?;
        if !status.success() {
            return Err(format!("Failed to kill process {}: taskkill exited {:?}", pid, status.code()));
        }
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

const VNC_PORT: u16 = 5901;
const VNC_PASSWORD: &str = "d9abf665";

fn build_vnc_args(hostname: &str) -> Vec<String> {
    vec![
        format!("{}::{}", hostname, VNC_PORT),
        "-password".to_string(),
        VNC_PASSWORD.to_string(),
    ]
}

#[tauri::command]
fn run_vnc(hostname: String) -> Result<(), String> {
    StdCommand::new("vncviewer.exe")
        .creation_flags(CREATE_NO_WINDOW)
        .args(build_vnc_args(&hostname))
        .spawn()
        .map_err(|e| format!("No se pudo abrir VNC Viewer: {}", e))?;
    Ok(())
}

#[tauri::command]
fn resolve_host(hostname: String) -> Result<String, String> {
    let addrs = (hostname.as_str(), 0u16)
        .to_socket_addrs()
        .map_err(|e| format!("No se pudo resolver '{}': {}", hostname, e))?;
    let ip = addrs
        .filter_map(|addr| match addr.ip() {
            std::net::IpAddr::V4(v4) => Some(v4.to_string()),
            _ => None,
        })
        .next()
        .ok_or_else(|| format!("Sin dirección IPv4 para '{}'", hostname))?;
    Ok(ip)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            run_command_stream,
            stop_command_stream,
            run_msra_offer,
            run_vnc,
            resolve_host
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

    #[test]
    fn build_vnc_args_uses_port_5901_and_password() {
        let args = build_vnc_args("10.20.30.40");
        assert_eq!(
            args,
            vec![
                "10.20.30.40::5901".to_string(),
                "-password".to_string(),
                "d9abf665".to_string(),
            ]
        );
    }

    #[test]
    fn build_vnc_args_preserves_qualified_hostname() {
        let args = build_vnc_args("pc-123.correo.local");
        assert_eq!(args[0], "pc-123.correo.local::5901");
        assert_eq!(args[1], "-password");
        assert_eq!(args[2], "d9abf665");
    }

    #[test]
    fn run_vnc_command_uses_helper_args() {
        let args = build_vnc_args("192.168.1.10");
        assert_eq!(args[0], "192.168.1.10::5901");
        assert_eq!(args[1], "-password");
        assert!(!args[2].is_empty());
    }

    #[test]
    fn inject_vpn_source_ip_leaves_non_ping_commands() {
        assert_eq!(inject_vpn_source_ip("nslookup host.correo.local"), "nslookup host.correo.local");
        assert_eq!(inject_vpn_source_ip("net time \\\\host"), "net time \\\\host");
    }

    #[test]
    fn inject_vpn_source_ip_preserves_existing_s_flag() {
        assert_eq!(inject_vpn_source_ip("ping -S 10.0.0.1 10.0.0.2"), "ping -S 10.0.0.1 10.0.0.2");
    }
}

