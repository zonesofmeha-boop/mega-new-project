# TCP Network Protocol Simulator & RFC 793 State Visualizer

A complete, production-grade interactive web application that deterministically simulates the Transmission Control Protocol (RFC 793) state machine, packet segmentation, transmission dynamics, congestion control, and failure recovery mechanisms.

![TCP Visualizer](public/tcp-icon.svg)

---

## Key Capabilities & Features

### 1. Pure TypeScript Discrete-Event Engine (`src/engine/`)
- **Zero UI Dependencies:** The engine core is 100% decoupled pure TypeScript, making it testable and portable to CLI or headless environments.
- **Deterministic Virtual Clock:** No non-deterministic `setTimeout` inside the engine. A priority event queue advances virtual time (in milliseconds) discretely.
- **Seeded PRNG:** Employs a Mulberry32 PRNG to guarantee exact, reproducible simulations and identical sequence traces across runs.
- **Immutable Snapshots & Time-Travel:** Every event creates an immutable, deep-frozen snapshot. Users can seamlessly step forward, step backward (`Next x5` then `Prev x5`), scrub the timeline, or jump directly to any event by clicking in the event log.

### 2. Table-Driven RFC 793 Finite State Machine (FSM)
- Fully models all **11 RFC 793 TCP states**:
  1. `CLOSED`
  2. `LISTEN`
  3. `SYN_SENT`
  4. `SYN_RECEIVED`
  5. `ESTABLISHED`
  6. `FIN_WAIT_1`
  7. `FIN_WAIT_2`
  8. `CLOSE_WAIT`
  9. `CLOSING`
  10. `LAST_ACK`
  11. `TIME_WAIT`
- **Safe & Pure Transition Function:** `transition(state, event)` never throws. Invalid transitions are logged and leave the socket state unchanged.
- **Shared Source of Truth:** The interactive `@xyflow/react` state diagram is generated directly from the same FSM table used by the simulation engine, highlighting the active state with glowing animations and trailing edge transitions.

### 3. Protocol Mechanics & Reliability Rules
- **Three-Way Handshake:** `SYN(x)` &rarr; `SYN+ACK(y, ack=x+1)` &rarr; `ACK(x+1, y+1)`. Both SYN and FIN flags consume exactly 1 sequence number; application payloads consume bytes equal to their length; ACKs are cumulative.
- **Segmentation by MSS & In-Order Reassembly:** Application streams are divided into Maximum Segment Size (MSS) units. Out-of-order segments are buffered in the receiver's reassembly queue, triggering Duplicate ACKs until holes are filled.
- **RTO with Exponential Backoff:** Retransmission Timeout (RTO) doubles on retransmissions (Jacobson/Karels algorithm: 200ms &rarr; 400ms &rarr; 800ms) up to maximum retry limits before aborting with `ETIMEDOUT`.
- **RFC 5681 Fast Retransmit:** Arrival of 3 duplicate ACKs triggers immediate retransmission of the lost sequence without awaiting RTO timer expiration.
- **Connection Teardown & 2MSL TIME_WAIT:** Supports graceful 4-way close, simultaneous close through `CLOSING`, and countdown of the 2MSL guard interval to prevent phantom segments from corrupting future connections on the same port tuple.

### 4. Interactive Failure Injection Panel (9 Failure Modes)
Each failure features a visual cue, plain-language explanation, and RFC recovery mechanics:
1. **Packet Loss:** Discards segment in transit; recovers via sender RTO.
2. **Packet Delay / Jitter:** Injects +150ms transit latency; updates SRTT and RTTVAR.
3. **Packet Duplication:** Clones segment; receiver detects duplicate sequence, discards data, and replies with immediate ACK.
4. **Corrupted Checksum:** Injects bit errors (0xDEAD); receiver silently discards bad checksum.
5. **Missing ACK:** Drops return acknowledgment; recovered via cumulative ACK or retransmission.
6. **Server Timeout (ETIMEDOUT):** Unresponsive server causes exponential backoff until max retries abort socket.
7. **Port Closed (Connection Refused):** SYN to closed server triggers immediate `RST` response (`ECONNREFUSED`).
8. **Mid-Connection Reset:** Injects unprovoked `RST` segment into an `ESTABLISHED` stream, abruptly dropping connection.
9. **Packet Reorder:** Reverses segment arrival order, testing reassembly queue buffering and duplicate ACKs.

### 5. 12 Pre-Configured Educational Scenarios
1. **Normal Connection Lifecycle:** End-to-end handshake, segmented data transfer, and 4-way termination.
2. **Three-Way Handshake Only:** Focus on sequence synchronization and ISN negotiation.
3. **SYN Lost in Transit:** Initial SYN dropped; RTO fires and retransmits.
4. **SYN-ACK Lost in Transit:** Server response dropped; server RTO retransmits SYN-ACK.
5. **Data Segment Lost:** Payload packet dropped; recovered via RTO retransmission.
6. **Fast Retransmit on 3 Duplicate ACKs:** Out-of-order packets generate 3 Dup ACKs, triggering RFC 5681 fast retransmit.
7. **Lost Acknowledgment (Missing ACK):** Reverse ACK dropped; covered by cumulative ACK or retransmission.
8. **Server Down (ETIMEDOUT):** Unresponsive server triggers maximum exponential backoff retries to `CLOSED`.
9. **Port Closed (Connection Refused):** Non-listening server generates `RST` to SYN.
10. **Mid-Stream Reset:** Middlebox or crash injects `RST` during active stream.
11. **Simultaneous Close:** Both parties close at the same moment, entering `CLOSING` state.
12. **Out-of-Order Delivery & Reassembly:** Reassembly queue buffers segments and plugs sequence holes.

### 6. Interactive Learning Center & Masterclass
- **8 Interactive Lessons:**
  1. The Three-Way Handshake
  2. Sequence & Acknowledgment Numbers
  3. Flow Control & MSS Segmentation
  4. Retransmission & RTO Exponential Backoff
  5. Fast Retransmit & 3 Duplicate ACKs
  6. Graceful Connection Teardown (4-Way Close)
  7. The TIME_WAIT State & 2MSL
  8. Abnormal Resets & The TCP State Machine
- **Live Engine Mini-Sandbox:** Each lesson embeds an interactive simulator stepping on the real protocol engine.
- **Knowledge Check Quizzes:** Interactive multiple-choice questions with instant scoring, feedback, and RFC 793 citations.
- **Searchable TCP Glossary:** Comprehensive quick-reference dictionary for all protocol terms, timers, and sequence variables.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React 18 + Vite |
| **Language** | TypeScript 5 (Strict Mode, `noUnusedLocals`, `noFallthroughCasesInSwitch`) |
| **State Management** | Zustand 5 |
| **Diagrams & Flow** | `@xyflow/react` (React Flow 12) |
| **Charts & Metrics** | Recharts 2 |
| **Animations** | Framer Motion 11 |
| **Styling** | Tailwind CSS 3 (Dark/Light themes with CSS Variables) |
| **Icons** | Lucide React |
| **Test Runner** | Vitest 2 + JSDOM |

---

## Getting Started

### Prerequisites
- Node.js &ge; 18.x
- npm &ge; 9.x

### Installation
```bash
git clone <repo-url>
cd tcp-network-protocol-simulator
npm install
```

### Development Server
```bash
npm run dev
```
Open `http://localhost:5173/` in your browser.

### Run Unit & Invariant Test Suite
```bash
npm test
```

### TypeScript Verification & Production Build
```bash
npm run typecheck
npm run build
npm run preview
```

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause simulation |
| `&rarr;` (Right Arrow) | Step forward 1 event |
| `&larr;` (Left Arrow) | Step backward 1 event |
| `R` / `r` | Reset simulation to step 0 |

---

## Architecture Overview

```
src/
├── engine/                 # 100% Pure TypeScript Protocol Engine (No React)
│   ├── types.ts            # TCB, TCP Packets, Flags, FSM, and Event Definitions
│   ├── fsm.ts              # RFC 793 State Machine Table & Transition Rules
│   ├── packet.ts           # Segment builder, Checksum, Sequence Arithmetic
│   ├── checksum.ts         # 16-bit Internet Checksum & Hex Dump Formatter
│   ├── prng.ts             # Mulberry32 Seeded Pseudo-Random Generator
│   ├── failures.ts         # Failure definitions, visual cues, recovery mechanics
│   ├── simulator.ts        # Discrete-event engine with virtual clock & invariant checks
│   ├── scenarios.ts        # 12 pre-configured educational network scenarios
│   └── __tests__/          # Vitest suite verifying FSM, handshakes, RTO, invariants
├── store/
│   └── useSimulatorStore.ts# Zustand store connecting engine to UI
├── components/             # Reusable UI Components
│   ├── Header.tsx          # Top navigation & theme toggle
│   ├── ControlsBar.tsx     # Play/pause/step/scrubber/speed controls
│   ├── EndpointCard.tsx    # TCB counters, SND/RCV variables, buffer streams
│   ├── NetworkTransit.tsx  # In-flight animated packet wire
│   ├── SequenceDiagram.tsx # Vertical ladder diagram with packet selection
│   ├── StateDiagram.tsx    # @xyflow/react interactive FSM graph
│   ├── PacketInspector.tsx # 32-bit header field breakdown & Hex Dump
│   ├── EventLog.tsx        # Filterable event log with time-travel click-to-seek
│   ├── StatsPanel.tsx      # RTT line chart & packet type distribution
│   ├── ExplanationCard.tsx # Contextual RFC 793 explanation & failure cues
│   ├── FailurePanel.tsx    # 9 failure injection triggers
│   ├── MessageComposer.tsx # Live MSS segmentation and custom text sender
│   └── ErrorBoundary.tsx   # React error boundary
└── pages/
    ├── VisualizerPage.tsx  # Interactive visualizer dashboard
    ├── ScenariosPage.tsx   # 12-scenario gallery with search and category filters
    ├── LearnPage.tsx       # 8 interactive lessons, mini-sandbox, and quiz
    └── AboutPage.tsx       # RFC 793 design, verification, and invariants
```

---

## License
MIT License. Built for computer networks education, systems research, and protocol visualization.
