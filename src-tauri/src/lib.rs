use encoding_rs::WINDOWS_1252;
use serde::Serialize;
use std::process::Command as StdCommand;
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Serialize, Clone)]
pub struct CommandResult {
    pub command: String,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

struct AppState {
    running: Mutex<bool>,
}

fn decode_windows_output(bytes: Vec<u8>) -> String {
    if bytes.is_empty() {
        return String::new();
    }
    match String::from_utf8(bytes.clone()) {
        Ok(s) => s,
        Err(_) => {
            let (decoded, _, _) = WINDOWS_1252.decode(&bytes);
            decoded.into_owned()
        }
    }
}

fn run_single_command(command: &str) -> CommandResult {
    let output = StdCommand::new("cmd")
        .args(["/c", command])
        .output();

    match output {
        Ok(out) => CommandResult {
            command: command.to_string(),
            stdout: decode_windows_output(out.stdout),
            stderr: decode_windows_output(out.stderr),
            exit_code: out.status.code(),
        },
        Err(e) => CommandResult {
            command: command.to_string(),
            stdout: String::new(),
            stderr: format!("Failed to execute: {}", e),
            exit_code: None,
        },
    }
}

#[tauri::command]
fn execute_diagnostic(
    hostname: String,
    state: State<'_, AppState>,
) -> Result<Vec<CommandResult>, String> {
    {
        let mut running = state.running.lock().map_err(|e| e.to_string())?;
        if *running {
            return Err("A diagnostic run is already in progress.".to_string());
        }
        *running = true;
    }

    let commands = vec![
        format!("ping -n 4 {}", hostname),
        format!("net time \\\\{}", hostname),
        format!("nslookup {}", hostname),
    ];

    let results: Vec<CommandResult> = commands
        .iter()
        .map(|cmd| run_single_command(cmd))
        .collect();

    {
        let mut running = state.running.lock().map_err(|e| e.to_string())?;
        *running = false;
    }

    Ok(results)
}

#[tauri::command]
fn run_net_user(username: String, state: State<'_, AppState>) -> Result<CommandResult, String> {
    let command = format!("net user {}", username);
    let result = run_single_command(&command);
    Ok(result)
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
        .manage(AppState {
            running: Mutex::new(false),
        })
        .invoke_handler(tauri::generate_handler![
            execute_diagnostic,
            run_net_user,
            run_msra_offer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
