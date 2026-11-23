import { TcpPacket, PacketType, TcpFlags, EndpointId, BufferSegment } from './types';
import { calculateChecksum, flagsToByte, generateHexDump } from './checksum';

let packetCounter = 0;

export function resetPacketCounter(): void {
  packetCounter = 0;
}

export function generatePacketId(type: PacketType): string {
  packetCounter++;
  return `PKT-${type}-${packetCounter.toString().padStart(4, '0')}`;
}

/**
 * 32-bit TCP Sequence Comparison handling wrapping arithmetic according to RFC 793.
 */
export function seqLessThan(a: number, b: number): boolean {
  return ((a - b) | 0) < 0;
}

export function seqLessThanOrEqual(a: number, b: number): boolean {
  return ((a - b) | 0) <= 0;
}

export function seqGreaterThan(a: number, b: number): boolean {
  return ((a - b) | 0) > 0;
}

export function seqDiff(a: number, b: number): number {
  return (a - b) | 0;
}

/**
 * Segments raw application message payload into discrete MSS chunks.
 */
export function segmentMessage(
  message: string,
  mss: number,
  startSeq: number
): BufferSegment[] {
  if (!message || message.length === 0) {
    return [];
  }

  const effectiveMss = Math.max(1, mss);
  const segments: BufferSegment[] = [];
  let currSeq = startSeq;

  for (let i = 0; i < message.length; i += effectiveMss) {
    const chunk = message.slice(i, i + effectiveMss);
    segments.push({
      seq: currSeq,
      data: chunk,
      length: chunk.length,
      retries: 0,
    });
    currSeq = (currSeq + chunk.length) >>> 0;
  }

  return segments;
}

export function buildPacket(params: {
  source: EndpointId;
  destination: EndpointId;
  srcPort: number;
  dstPort: number;
  seqNum: number;
  ackNum: number;
  flags: TcpFlags;
  type: PacketType;
  payload?: string;
  windowSize?: number;
  sentAtTime?: number;
  deliverAtTime?: number;
  isRetransmission?: boolean;
}): TcpPacket {
  const payload = params.payload || '';
  const windowSize = params.windowSize ?? 65535;
  const dataOffset = 5; // standard 20-byte TCP header without options
  const flagsByte = flagsToByte(params.flags);

  const checksum = calculateChecksum(
    params.srcPort,
    params.dstPort,
    params.seqNum,
    params.ackNum,
    dataOffset,
    flagsByte,
    windowSize,
    payload
  );

  const hexDump = generateHexDump(
    params.srcPort,
    params.dstPort,
    params.seqNum,
    params.ackNum,
    flagsByte,
    windowSize,
    checksum,
    payload
  );

  return {
    id: generatePacketId(params.type),
    source: params.source,
    destination: params.destination,
    srcPort: params.srcPort,
    dstPort: params.dstPort,
    seqNum: params.seqNum >>> 0,
    ackNum: params.ackNum >>> 0,
    flags: { ...params.flags },
    type: params.type,
    payload,
    length: payload.length,
    windowSize,
    checksum,
    urgentPointer: 0,
    dataOffset,
    hexDump,
    sentAtTime: params.sentAtTime ?? 0,
    deliverAtTime: params.deliverAtTime ?? 0,
    isRetransmission: params.isRetransmission,
    status: 'in-flight',
  };
}

export function createSynPacket(
  source: EndpointId,
  destination: EndpointId,
  seqNum: number,
  srcPort: number,
  dstPort: number,
  windowSize: number = 65535
): TcpPacket {
  return buildPacket({
    source,
    destination,
    srcPort,
    dstPort,
    seqNum,
    ackNum: 0,
    flags: { syn: true, ack: false, fin: false, rst: false, psh: false, urg: false },
    type: 'SYN',
    windowSize,
  });
}

export function createSynAckPacket(
  source: EndpointId,
  destination: EndpointId,
  seqNum: number,
  ackNum: number,
  srcPort: number,
  dstPort: number,
  windowSize: number = 65535
): TcpPacket {
  return buildPacket({
    source,
    destination,
    srcPort,
    dstPort,
    seqNum,
    ackNum,
    flags: { syn: true, ack: true, fin: false, rst: false, psh: false, urg: false },
    type: 'SYN_ACK',
    windowSize,
  });
}

export function createAckPacket(
  source: EndpointId,
  destination: EndpointId,
  seqNum: number,
  ackNum: number,
  srcPort: number,
  dstPort: number,
  isDupAck: boolean = false,
  windowSize: number = 65535
): TcpPacket {
  return buildPacket({
    source,
    destination,
    srcPort,
    dstPort,
    seqNum,
    ackNum,
    flags: { syn: false, ack: true, fin: false, rst: false, psh: false, urg: false },
    type: isDupAck ? 'DUP_ACK' : 'ACK',
    windowSize,
  });
}

export function createDataPacket(
  source: EndpointId,
  destination: EndpointId,
  seqNum: number,
  ackNum: number,
  payload: string,
  srcPort: number,
  dstPort: number,
  isRetransmission: boolean = false,
  windowSize: number = 65535
): TcpPacket {
  return buildPacket({
    source,
    destination,
    srcPort,
    dstPort,
    seqNum,
    ackNum,
    flags: { syn: false, ack: true, fin: false, rst: false, psh: true, urg: false },
    type: 'DATA',
    payload,
    windowSize,
    isRetransmission,
  });
}

export function createFinPacket(
  source: EndpointId,
  destination: EndpointId,
  seqNum: number,
  ackNum: number,
  srcPort: number,
  dstPort: number,
  windowSize: number = 65535
): TcpPacket {
  return buildPacket({
    source,
    destination,
    srcPort,
    dstPort,
    seqNum,
    ackNum,
    flags: { syn: false, ack: true, fin: true, rst: false, psh: false, urg: false },
    type: 'FIN',
    windowSize,
  });
}

export function createFinAckPacket(
  source: EndpointId,
  destination: EndpointId,
  seqNum: number,
  ackNum: number,
  srcPort: number,
  dstPort: number,
  windowSize: number = 65535
): TcpPacket {
  return buildPacket({
    source,
    destination,
    srcPort,
    dstPort,
    seqNum,
    ackNum,
    flags: { syn: false, ack: true, fin: true, rst: false, psh: false, urg: false },
    type: 'FIN_ACK',
    windowSize,
  });
}

export function createRstPacket(
  source: EndpointId,
  destination: EndpointId,
  seqNum: number,
  ackNum: number,
  srcPort: number,
  dstPort: number
): TcpPacket {
  return buildPacket({
    source,
    destination,
    srcPort,
    dstPort,
    seqNum,
    ackNum,
    flags: { syn: false, ack: false, fin: false, rst: true, psh: false, urg: false },
    type: 'RST',
    windowSize: 0,
  });
}
