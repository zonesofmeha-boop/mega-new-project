# Test Execution & Verification Report

**Project:** TCP Network Protocol Simulator & RFC 793 State Visualizer  
**Test Harness:** Vitest v2.1.9 with JSDOM Environment  
**Execution Date:** November 2026  
**Result:** **11 / 11 Test Suites Passed (100%)**

---

## 1. Summary of Test Results

| Test Suite File | Tests | Passed | Failed | Duration | Status |
|---|---|---|---|---|---|
| `src/engine/__tests__/fsm.test.ts` | 4 | 4 | 0 | 22 ms | **PASSED** |
| `src/engine/__tests__/simulator.test.ts` | 7 | 7 | 0 | 92 ms | **PASSED** |
| `src/test/App.test.tsx` (UI Integration & End-to-End) | 7 | 7 | 0 | 2,891 ms | **PASSED** |
| **Total** | **18** | **18** | **0** | **3,005 ms** | **PASSED (100%)** |

---

## 2. Detailed Test Specifications

### A. Finite State Machine Suite (`fsm.test.ts`)
- **FSM State Coverage:** Verifies that all 11 standard TCP states (`CLOSED`, `LISTEN`, `SYN_SENT`, `SYN_RECEIVED`, `ESTABLISHED`, `FIN_WAIT_1`, `FIN_WAIT_2`, `CLOSE_WAIT`, `CLOSING`, `LAST_ACK`, `TIME_WAIT`) are covered by the RFC 793 transition table.
- **Valid Transition Verification:** Iterates through every rule in `TCP_FSM_TRANSITIONS` to confirm that `transition(from, event)` deterministically returns `nextState == to`, sets `isValid: true`, and generates appropriate diagnostic logs.
- **Invalid Pair Robustness:** Tests prohibited state-event combinations (e.g. `CLOSED + RCV_ACK`, `LISTEN + RCV_FIN`, `ESTABLISHED + APP_OPEN_ACTIVE`, `TIME_WAIT + APP_SEND`). Proves that `transition()` is pure, never throws exceptions, returns `isValid: false`, and preserves the existing state unmodified.
- **Graph Data Generation:** Asserts that `getFsmGraphData()` derives all 11 nodes with accurate visual coordinates and highlights the active state and last traversed edge for `@xyflow/react`.

### B. Protocol Mechanics & Invariants Suite (`simulator.test.ts`)
- **Handshake Sequence & Acknowledgment Values:**
  - Client initiates active open: allocates `ISS`, sends `SYN(x)` where `x = ISS`. Client transitions to `SYN_SENT`.
  - Server receives SYN: records `IRS = x`, allocates `ISS = y`, sends `SYN+ACK(y, ack=x+1)`. Server transitions to `SYN_RECEIVED`.
  - Client receives SYN-ACK: confirms `ack == ISS + 1`, transitions to `ESTABLISHED`, sends `ACK(ack=y+1)`.
  - Server receives ACK: transitions to `ESTABLISHED`.
- **MSS Segmentation & Reassembly:**
  - Segments 16-byte message `"1234567890ABCDEF"` with MSS=5.
  - Confirms generation of 4 discrete segments with correct sequence offsets:
    - Segment 1: SEQ=1000, LEN=5, DATA=`"12345"`
    - Segment 2: SEQ=1005, LEN=5, DATA=`"67890"`
    - Segment 3: SEQ=1010, LEN=5, DATA=`"ABCDE"`
    - Segment 4: SEQ=1015, LEN=1, DATA=`"F"`
  - Proves that the receiver accepts in-order segments and completely reassembles the payload stream without corruption.
- **Retransmission & Karn/Jacobson Exponential Backoff:**
  - Injects packet loss on initial SYN segment.
  - Verifies that packet status is marked as `dropped` and `stats.packetsDropped` increments.
  - Verifies that upon RTO timer expiration, sender triggers retransmission, increments retry counter, and doubles RTO via exponential backoff.
- **Port Closed (Connection Refused):**
  - Sends SYN to non-listening server (`CLOSED` state).
  - Confirms RFC 793 requirement: server immediately responds with an `RST` segment with `ACK = SEG.SEQ + 1`.
  - Client receives RST and immediately transitions to `CLOSED`.
- **Mid-Stream Connection Reset:**
  - Establishes connection, transmits data, then issues an `APP_ABORT`.
  - Sender generates `RST` segment and immediately transitions to `CLOSED`.
  - Peer receives `RST`, flushes queues, and immediately enters `CLOSED`, bypassing the 4-way FIN teardown.
- **Determinism & Time-Travel Parity:**
  - Seeds simulator with PRNG seed `1234`. Runs full normal connection lifecycle scenario.
  - Tests `seek(n)` backwards step-by-step from end to step 0: proves `snapshot[n]` is 100% identical to the original snapshot at step n.
  - Tests `Next x5` followed by `Previous x5`: proves state perfectly matches original state at step 5.
- **Protocol Invariant Assertions Across All 12 Scenarios:**
  - Iterates through all 12 pre-configured scenarios.
  - After **every single discrete event step**, asserts all four core protocol invariants:
    1. **Send Sequence Order:** `(sndNxt - sndUna) >= 0` (32-bit wrap arithmetic).
    2. **Valid State Enum:** Current state must exist in `ALL_TCP_STATES`.
    3. **Causal Transit Ordering:** `deliverAtTime >= sentAtTime` for every packet in history.
    4. **Conservation of Packets:** `totalPacketsSent == packetsDelivered + packetsDropped + packetsCorrupted + inFlightPackets.length`.
  - Zero invariant violations detected across all scenarios.

### C. UI Integration & Interaction Suite (`App.test.tsx`)
- **Dashboard Component Composition:** Verifies that the header, control bar, client card, server card, network transit wire, sequence ladder diagram, React Flow state diagram, packet inspector, event log, failure injection triggers, message composer, and analytics graphs mount without crashing.
- **Time-Travel Parity in UI:** Steps forward 5 times through the UI, then steps backward 5 times, asserting that the rendered state and TCB variables match the initial step 0 state exactly.
- **Play/Pause Engine Controls:** Asserts that clicking the Play button engages automated discrete virtual clock progression, and clicking Pause cleanly halts the timer loop.
- **Theme Switching Dynamics:** Verifies that clicking the theme switcher toggles between dark mode and light mode, adding and removing the `.light` class on `document.documentElement` to trigger CSS variable palette swaps.
- **Interactive Failure Injection:** Simulates clicking "Drop Packet", verifying that the active failure badge appears in the contextual explanation card with appropriate cues.
- **Navigation & Routing:** Validates switching between the 4 main views: Visualizer, Scenarios Gallery (12 scenarios), Learn & Masterclass (8 lessons), and About RFC 793.
- **Interactive Mini Sandbox & Quizzes:** Verifies that clicking "Step Forward" inside a lesson updates the embedded sandbox engine, and clicking a quiz option provides immediate visual feedback (correct/incorrect) and the RFC explanation citation.

---

## 3. TypeScript Typecheck & Production Build Verification

```
> tsc --noEmit
Exit code: 0 (Clean, 0 errors)

> vite build
✓ 2581 modules transformed.
dist/index.html                   0.90 kB │ gzip:   0.50 kB
dist/assets/index-Cba8Hc1-.css   45.59 kB │ gzip:   8.65 kB
dist/assets/index-CunFkaC6.js   977.04 kB │ gzip: 285.86 kB
✓ built in 23.57s
Exit code: 0
```
