export interface StreamLinePayload {
  id: string;
  text: string;
}

export interface StreamDonePayload {
  id: string;
  exit_code: number | null;
}
