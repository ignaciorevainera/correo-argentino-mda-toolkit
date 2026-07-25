export interface CommandResult {
  command: string;
  stdout: string;
  stderr: string;
  exit_code: number | null;
}
