use encoding_rs::WINDOWS_1252;
use serde::Serialize;
use std::process::Command as StdCommand;
use tauri::Emitter;
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
    id: String,
    command: String,
) -> Result<(), String> {
    let mut child = Command::new("cmd")
        .args(["/c", &command])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn: {}", e))?;

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
fn run_msra_offer(hostname: String) -> Result<(), String> {
    StdCommand::new("msra.exe")
        .args(["/offerRA", &hostname])
        .spawn()
        .map_err(|e| format!("Failed to launch Remote Assistance: {}", e))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![run_command_stream, run_msra_offer])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
