/**
 * RFC 793 Internet Checksum computation and hex dump utilities.
 * Computes 16-bit one's complement sum of 16-bit words.
 */

export function calculateChecksum(
  srcPort: number,
  dstPort: number,
  seqNum: number,
  ackNum: number,
  dataOffset: number,
  flagsByte: number,
  windowSize: number,
  payload: string,
  srcIp: string = '192.168.1.10',
  dstIp: string = '192.168.1.20'
): number {
  let sum = 0;

  // Pseudo-header IP addresses (each 32-bit broken into two 16-bit words)
  const parseIpWords = (ip: string): number[] => {
    const parts = ip.split('.').map((p) => parseInt(p, 10) & 0xff);
    if (parts.length !== 4) return [0x7f00, 0x0001]; // default 127.0.0.1
    return [(parts[0] << 8) | parts[1], (parts[2] << 8) | parts[3]];
  };

  const srcWords = parseIpWords(srcIp);
  const dstWords = parseIpWords(dstIp);

  sum += srcWords[0] + srcWords[1];
  sum += dstWords[0] + dstWords[1];
  sum += 0x0006; // Protocol TCP (6)
  const tcpLength = dataOffset * 4 + payload.length;
  sum += tcpLength;

  // TCP Header words
  sum += srcPort & 0xffff;
  sum += dstPort & 0xffff;
  sum += (seqNum >>> 16) & 0xffff;
  sum += seqNum & 0xffff;
  sum += (ackNum >>> 16) & 0xffff;
  sum += ackNum & 0xffff;
  sum += ((dataOffset & 0x0f) << 12) | (flagsByte & 0x3f);
  sum += windowSize & 0xffff;
  sum += 0; // Urgent pointer

  // Payload words
  for (let i = 0; i < payload.length; i += 2) {
    const high = payload.charCodeAt(i) & 0xff;
    const low = i + 1 < payload.length ? payload.charCodeAt(i + 1) & 0xff : 0;
    sum += (high << 8) | low;
  }

  // Fold 32-bit sum into 16 bits
  while (sum > 0xffff) {
    sum = (sum & 0xffff) + (sum >>> 16);
  }

  // One's complement
  return (~sum) & 0xffff;
}

export function flagsToByte(flags: {
  urg: boolean;
  ack: boolean;
  psh: boolean;
  rst: boolean;
  syn: boolean;
  fin: boolean;
}): number {
  let byte = 0;
  if (flags.urg) byte |= 0x20;
  if (flags.ack) byte |= 0x10;
  if (flags.psh) byte |= 0x08;
  if (flags.rst) byte |= 0x04;
  if (flags.syn) byte |= 0x02;
  if (flags.fin) byte |= 0x01;
  return byte;
}

export function generateHexDump(
  srcPort: number,
  dstPort: number,
  seqNum: number,
  ackNum: number,
  flagsByte: number,
  windowSize: number,
  checksum: number,
  payload: string
): string {
  const bytes: number[] = [
    (srcPort >>> 8) & 0xff,
    srcPort & 0xff,
    (dstPort >>> 8) & 0xff,
    dstPort & 0xff,
    (seqNum >>> 24) & 0xff,
    (seqNum >>> 16) & 0xff,
    (seqNum >>> 8) & 0xff,
    seqNum & 0xff,
    (ackNum >>> 24) & 0xff,
    (ackNum >>> 16) & 0xff,
    (ackNum >>> 8) & 0xff,
    ackNum & 0xff,
    0x50, // Data offset: 5 (20 bytes), reserved: 0
    flagsByte & 0xff,
    (windowSize >>> 8) & 0xff,
    windowSize & 0xff,
    (checksum >>> 8) & 0xff,
    checksum & 0xff,
    0x00, // Urgent pointer high
    0x00, // Urgent pointer low
  ];

  for (let i = 0; i < payload.length; i++) {
    bytes.push(payload.charCodeAt(i) & 0xff);
  }

  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const chunk = bytes.slice(i, i + 16);
    const hexParts = chunk.map((b) => b.toString(16).padStart(2, '0').toUpperCase());
    const ascii = chunk
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
      .join('');
    const offset = i.toString(16).padStart(4, '0').toUpperCase();
    lines.push(`${offset}  ${hexParts.join(' ').padEnd(48, ' ')}  |${ascii}|`);
  }

  return lines.join('\n');
}
