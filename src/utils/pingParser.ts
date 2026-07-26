export interface PingResult {
  ms: number;
  status: "success" | "timeout";
}

const LATENCY_RE = /time[=<](\d+)ms/i;
const FAIL_RE = /(timed out|unreachable|perdidos|espera agotado)/i;

export function parsePingOutput(lines: string[]): PingResult[] {
  const results: PingResult[] = [];

  for (const line of lines) {
    if (FAIL_RE.test(line)) {
      results.push({ ms: 0, status: "timeout" });
      continue;
    }

    const match = LATENCY_RE.exec(line);
    if (match) {
      results.push({ ms: parseInt(match[1], 10), status: "success" });
    }
  }

  return results;
}
