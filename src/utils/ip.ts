export type IpClassification =
  | { kind: "ip"; value: string }
  | { kind: "hostname"; value: string }
  | { kind: "invalid-ip"; value: string };

const IPV4_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const LOOKS_LIKE_IP_RE = /^\d+(\.\d+){1,}$/;

export function classifyIpInput(input: string): IpClassification {
  const value = input.trim();

  if (IPV4_RE.test(value)) {
    const octets = value.split(".").map((octet) => parseInt(octet, 10));
    if (octets.every((octet) => octet >= 0 && octet <= 255)) {
      return { kind: "ip", value };
    }
  }

  if (LOOKS_LIKE_IP_RE.test(value)) {
    return { kind: "invalid-ip", value };
  }

  return { kind: "hostname", value };
}
