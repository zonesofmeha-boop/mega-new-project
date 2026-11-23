import React, { useState } from 'react';
import { TcpSimulator } from '../engine/simulator';
import {
  CheckCircle,
  HelpCircle,
  RotateCcw,
  SkipForward,
  Search,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface Lesson {
  id: number;
  title: string;
  subtitle: string;
  concept: string;
  rfcSection: string;
  keyPoints: string[];
  quiz: QuizQuestion;
  defaultAction: (sim: TcpSimulator) => void;
}

const LESSONS: Lesson[] = [
  {
    id: 1,
    title: 'The Three-Way Handshake',
    subtitle: 'Synchronizing Sequence Numbers (SYN \u2192 SYN+ACK \u2192 ACK)',
    concept:
      'Before two hosts can exchange data reliably, they must negotiate initial sequence numbers (ISNs). Client sends SYN(x); Server responds with SYN(y) + ACK(x+1); Client concludes with ACK(y+1). Both SYN segments consume exactly 1 sequence number.',
    rfcSection: 'RFC 793 Section 3.4',
    keyPoints: [
      'ISNs are chosen pseudo-randomly to prevent sequence prediction attacks.',
      'SYN flag consumes 1 byte of sequence space even with 0 bytes payload.',
      'Connection transitions from CLOSED \u2192 SYN_SENT \u2192 ESTABLISHED on client.',
    ],
    quiz: {
      question:
        'If Client sends SYN with SEQ=1000, what will the Server’s ACK number be in its SYN-ACK response?',
      options: ['1000', '1001', '0', '1002'],
      correctIndex: 1,
      explanation:
        'Under RFC 793, the SYN flag consumes 1 sequence number. Therefore, ACK = SEQ + 1 = 1001.',
    },
    defaultAction: (sim) => {
      sim.clientOpen();
      sim.step();
      sim.step();
      sim.step();
      sim.step();
    },
  },
  {
    id: 2,
    title: 'Sequence & Acknowledgment Numbers',
    subtitle: 'Byte-Stream Indexing & Cumulative ACKs',
    concept:
      'Unlike message-oriented protocols (like UDP), TCP views communication as a continuous stream of octets (bytes). The Sequence Number identifies the byte offset of the first byte in the segment. The Acknowledgment Number indicates the next byte the receiver expects.',
    rfcSection: 'RFC 793 Section 3.2',
    keyPoints: [
      'ACKs are cumulative: ACK=5000 confirms receipt of all bytes up to 4999.',
      'Data payload consumes sequence numbers equal to its byte length.',
      'Pure ACKs (without payload) do not consume sequence numbers.',
    ],
    quiz: {
      question:
        'A sender transmits 20 bytes with SEQ=500. What is the ACK number expected from the receiver upon delivery?',
      options: ['500', '519', '520', '521'],
      correctIndex: 2,
      explanation:
        'The segment spans bytes 500 through 519 (20 bytes). The receiver acknowledges the next expected byte, which is 520.',
    },
    defaultAction: (sim) => {
      sim.clientOpen();
      sim.step();
      sim.step();
      sim.step();
      sim.step();
      sim.sendData('TCP Byte Stream', 'client');
      sim.step();
      sim.step();
    },
  },
  {
    id: 3,
    title: 'Flow Control & Maximum Segment Size (MSS)',
    subtitle: 'Preventing Receiver Buffer Overflow',
    concept:
      'MSS defines the maximum payload bytes a TCP segment can carry (excluding IP and TCP headers). The receiver also advertises its Receive Window (RCV.WND), telling the sender how much buffer capacity remains.',
    rfcSection: 'RFC 793 Section 3.7',
    keyPoints: [
      'Standard Ethernet MTU is 1500 bytes; MSS = 1500 - 20 (IP) - 20 (TCP) = 1460 bytes.',
      'TCP segmentation splits application data into chunks \u2264 MSS.',
      'Receiver window prevents fast senders from swamping slow receivers.',
    ],
    quiz: {
      question: 'What is the standard formula for TCP MSS over a standard Ethernet MTU of 1500 bytes?',
      options: ['1500 - 40 = 1460 bytes', '1500 + 40 = 1540 bytes', '1024 bytes', '65535 bytes'],
      correctIndex: 0,
      explanation:
        'Standard IPv4 header is 20 bytes and TCP header is 20 bytes. MSS = 1500 - 40 = 1460 bytes.',
    },
    defaultAction: (sim) => {
      sim.clientOpen();
      sim.step();
      sim.step();
      sim.step();
      sim.step();
      sim.sendData('Large Stream Segmentation Example', 'client');
      sim.step();
      sim.step();
    },
  },
  {
    id: 4,
    title: 'Retransmission & RTO Exponential Backoff',
    subtitle: 'Guaranteed Reliability Over Unreliable IP',
    concept:
      'When a packet is lost in transit, the receiver never sends an ACK. The sender’s Retransmission Timeout (RTO) timer ticks down. When it expires, TCP doubles its RTO (Karn/Jacobson exponential backoff) and retransmits.',
    rfcSection: 'RFC 6298 & RFC 793',
    keyPoints: [
      'Sender maintains a copy of unacknowledged data in its send buffer.',
      'Exponential backoff avoids compounding network congestion.',
      'After maximum retries (e.g. 4-5 attempts), TCP aborts with ETIMEDOUT.',
    ],
    quiz: {
      question:
        'What happens to the Retransmission Timeout (RTO) when a packet is repeatedly lost and retransmitted?',
      options: [
        'It decreases to send faster',
        'It stays exactly constant',
        'It doubles exponentially (e.g. 200ms -> 400ms -> 800ms)',
        'It is reset to 0',
      ],
      correctIndex: 2,
      explanation:
        'Exponential backoff doubles the RTO on successive failures to prevent aggravating network collapse during severe congestion.',
    },
    defaultAction: (sim) => {
      sim.clientOpen();
      sim.setFailure('packet_loss', true, { remainingUses: 1 });
      sim.step();
      sim.step();
      sim.step();
    },
  },
  {
    id: 5,
    title: 'Fast Retransmit & 3 Duplicate ACKs',
    subtitle: 'RFC 5681 Fast Recovery Without Waiting for RTO',
    concept:
      'If packet #1 is lost but packets #2, #3, and #4 arrive, the receiver sends a Duplicate ACK for each out-of-order packet specifying the missing sequence number. When the sender sees 3 Duplicate ACKs, it immediately retransmits.',
    rfcSection: 'RFC 5681 Section 3.2',
    keyPoints: [
      'Waiting for RTO expiration stalls pipeline throughput.',
      'Duplicate ACKs indicate that subsequent packets made it through, so only the gap is missing.',
      '3 Duplicate ACKs trigger immediate Fast Retransmit without waiting for the timer.',
    ],
    quiz: {
      question: 'How many duplicate ACKs must a sender receive before triggering Fast Retransmit?',
      options: ['1', '2', '3', '5'],
      correctIndex: 2,
      explanation:
        'RFC 5681 specifies 3 duplicate ACKs to distinguish between occasional packet reordering and genuine packet loss.',
    },
    defaultAction: (sim) => {
      sim.clientOpen();
      sim.step();
      sim.step();
      sim.step();
      sim.step();
    },
  },
  {
    id: 6,
    title: 'Graceful Connection Teardown (4-Way Close)',
    subtitle: 'FIN \u2192 ACK and FIN \u2192 ACK',
    concept:
      'Because TCP is full-duplex, each simplex direction must be closed independently. The active closing party sends FIN; the passive side responds with ACK (entering CLOSE_WAIT). When the passive application finishes, it sends its own FIN, which is acknowledged.',
    rfcSection: 'RFC 793 Section 3.5',
    keyPoints: [
      'FIN consumes 1 sequence number, just like SYN.',
      'CLOSE_WAIT means peer has closed its direction, but local app may still send data.',
      '4 segments total: FIN(A) -> ACK(B) -> FIN(B) -> ACK(A).',
    ],
    quiz: {
      question: 'Which state does an endpoint enter immediately upon receiving a FIN while in ESTABLISHED?',
      options: ['FIN_WAIT_1', 'CLOSE_WAIT', 'LAST_ACK', 'CLOSED'],
      correctIndex: 1,
      explanation:
        'Upon receiving a FIN, the receiver sends an ACK and transitions from ESTABLISHED to CLOSE_WAIT to allow its application to finish sending data.',
    },
    defaultAction: (sim) => {
      sim.clientOpen();
      sim.step();
      sim.step();
      sim.step();
      sim.step();
      sim.closeConnection('client');
      sim.step();
      sim.step();
    },
  },
  {
    id: 7,
    title: 'The TIME_WAIT State & 2MSL',
    subtitle: 'Preventing Phantom Packets and Premature Port Reuse',
    concept:
      'The party that initiates the active close must remain in TIME_WAIT for 2 Maximum Segment Lifetimes (2MSL). This ensures that the final ACK was delivered and that any delayed segments from this connection dissipate before the port can be reused.',
    rfcSection: 'RFC 793 Section 3.5',
    keyPoints: [
      'MSL (Maximum Segment Lifetime) is typically 60 to 120 seconds.',
      'If the final ACK is lost, peer will retransmit FIN, which can be answered while in TIME_WAIT.',
      'Prevents old duplicate packets from corrupting new connections on the same port tuple.',
    ],
    quiz: {
      question: 'Why does an endpoint wait 2MSL in the TIME_WAIT state before deleting its socket?',
      options: [
        'To download more data',
        'To allow straggler packets to die out and guarantee final ACK delivery',
        'Because the operating system is locked',
        'To keep the CPU cooled down',
      ],
      correctIndex: 1,
      explanation:
        '2MSL provides enough time for both the final ACK and any possible retransmitted FIN to clear the network without corrupting future connections.',
    },
    defaultAction: (sim) => {
      sim.clientOpen();
      sim.step();
      sim.step();
      sim.step();
      sim.step();
      sim.closeConnection('client');
      sim.step();
      sim.step();
      sim.closeConnection('server');
      sim.step();
      sim.step();
    },
  },
  {
    id: 8,
    title: 'Abnormal Resets & The TCP State Machine',
    subtitle: 'RFC 793 11-State FSM & RST Handling',
    concept:
      'An RST segment causes immediate connection termination without a 4-way handshake. RST is generated when a SYN hits a closed port (ECONNREFUSED) or when an application process crashes.',
    rfcSection: 'RFC 793 Section 3.4',
    keyPoints: [
      'RST segments carry neither payload nor require acknowledgment.',
      'All 11 states form a deterministic finite state machine.',
      'Invalid transitions in robust implementations are ignored rather than crashing the protocol stack.',
    ],
    quiz: {
      question: 'What is sent in response to a SYN packet aimed at a closed port where no server is listening?',
      options: ['ICMP Error only', 'SYN+ACK', 'RST segment', 'FIN segment'],
      correctIndex: 2,
      explanation:
        'RFC 793 Section 3.4 requires the host to immediately respond with an RST (Reset) segment to notify the sender that connection is refused.',
    },
    defaultAction: (sim) => {
      sim.clientOpen();
      sim.step();
      sim.step();
      sim.step();
      sim.step();
      sim.abortConnection('client');
      sim.step();
      sim.step();
    },
  },
];

const GLOSSARY = [
  { term: 'SYN (Synchronize)', def: 'Control flag in first packet of connection to synchronize sequence numbers.' },
  { term: 'ACK (Acknowledgment)', def: 'Control flag indicating the Acknowledgment Field contains the next expected sequence number.' },
  { term: 'FIN (Finish)', def: 'Control flag indicating sender has no more data to transmit.' },
  { term: 'RST (Reset)', def: 'Control flag causing immediate, abrupt connection abort without graceful teardown.' },
  { term: 'ISN / ISS', def: 'Initial Sequence Number chosen by sender during handshake initiation.' },
  { term: 'MSS (Maximum Segment Size)', def: 'The largest payload byte count TCP can send in a single IP packet (default 1460 on Ethernet).' },
  { term: 'RTO (Retransmission Timeout)', def: 'Timer length after which an unacknowledged segment is considered lost and retransmitted.' },
  { term: '2MSL (Maximum Segment Lifetime)', def: 'Guard timer duration spent in TIME_WAIT to absorb stray network packets.' },
  { term: 'Cumulative ACK', def: 'Acknowledgment mechanism where ACK=N implicitly confirms all bytes < N.' },
  { term: 'TCB (Transmission Control Block)', def: 'Operating system kernel data structure storing all state and sequence numbers for a TCP socket.' },
];

export const LearnPage: React.FC = () => {
  const [selectedLessonId, setSelectedLessonId] = useState<number>(1);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [showQuizResult, setShowQuizResult] = useState<Record<number, boolean>>({});
  const [glossarySearch, setGlossarySearch] = useState<string>('');

  // Mini simulator instance for the active lesson
  const lesson = LESSONS.find((l) => l.id === selectedLessonId) || LESSONS[0];
  const [miniSim, setMiniSim] = useState<TcpSimulator>(() => {
    const s = new TcpSimulator({ seed: 55, serverStartsInListen: true });
    lesson.defaultAction(s);
    return s;
  });

  const handleSelectLesson = (id: number) => {
    setSelectedLessonId(id);
    const targetLesson = LESSONS.find((l) => l.id === id)!;
    const s = new TcpSimulator({ seed: 55, serverStartsInListen: true });
    targetLesson.defaultAction(s);
    setMiniSim(s);
  };

  const handleMiniStep = () => {
    if (miniSim.canStep()) {
      miniSim.step();
      setMiniSim(Object.assign(Object.create(Object.getPrototypeOf(miniSim)), miniSim));
    }
  };

  const handleMiniReset = () => {
    const s = new TcpSimulator({ seed: 55, serverStartsInListen: true });
    lesson.defaultAction(s);
    setMiniSim(s);
  };

  const handleSelectAnswer = (optionIndex: number) => {
    setQuizAnswers((prev) => ({ ...prev, [lesson.id]: optionIndex }));
    setShowQuizResult((prev) => ({ ...prev, [lesson.id]: true }));
  };

  const filteredGlossary = GLOSSARY.filter(
    (g) =>
      g.term.toLowerCase().includes(glossarySearch.toLowerCase()) ||
      g.def.toLowerCase().includes(glossarySearch.toLowerCase())
  );

  const snapshot = miniSim.getSnapshot();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="pb-6 border-b border-border">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            TCP Protocol Masterclass &amp; Quizzes
          </h1>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-primary-muted text-primary border border-primary/20">
            8 Interactive Lessons
          </span>
        </div>
        <p className="text-sm text-foreground-muted mt-1">
          Master RFC 793 mechanics with interactive step-by-step simulations and knowledge checks.
        </p>
      </div>

      {/* Main Layout: Lessons Sidebar + Content Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Lessons List Navigation */}
        <div className="bg-surface border border-border rounded-xl p-3 shadow-sm space-y-1">
          <span className="text-xs font-bold text-foreground-muted uppercase tracking-wider px-2 py-1 block">
            Lessons Roadmap
          </span>
          {LESSONS.map((l) => {
            const isSelected = l.id === selectedLessonId;
            return (
              <button
                key={l.id}
                onClick={() => handleSelectLesson(l.id)}
                className={`w-full text-left p-2.5 rounded-lg text-xs font-medium flex items-center justify-between gap-2 transition-all ${
                  isSelected
                    ? 'bg-primary text-white font-bold shadow-sm'
                    : 'text-foreground-muted hover:text-foreground hover:bg-surface-elevated'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-surface-elevated text-foreground'
                    }`}
                  >
                    {l.id}
                  </span>
                  <span className="truncate">{l.title}</span>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'opacity-100' : 'opacity-40'}`} />
              </button>
            );
          })}
        </div>

        {/* Active Lesson Viewport */}
        <div className="lg:col-span-3 space-y-6">
          {/* Lesson Content Card */}
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-mono font-bold uppercase text-primary">
                  Lesson #{lesson.id} &bull; {lesson.rfcSection}
                </span>
                <h2 className="text-xl font-bold text-foreground mt-0.5">{lesson.title}</h2>
                <p className="text-xs font-medium text-foreground-muted mt-0.5">{lesson.subtitle}</p>
              </div>
            </div>

            <p className="text-sm text-foreground/90 leading-relaxed font-sans">
              {lesson.concept}
            </p>

            <div className="bg-surface-elevated p-4 rounded-xl border border-border space-y-2">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider block">
                Key Protocol Rules:
              </span>
              <ul className="space-y-1.5 text-xs text-foreground-muted">
                {lesson.keyPoints.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Interactive Mini Simulator */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-warning" />
                  Live Engine Mini Sandbox
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleMiniReset}
                    className="p-1.5 rounded-lg bg-surface-elevated border border-border hover:bg-border text-foreground text-xs"
                    title="Reset Sandbox"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleMiniStep}
                    disabled={!miniSim.canStep()}
                    className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-40 text-white text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    Step Forward
                  </button>
                </div>
              </div>

              {/* State badges & Last Log */}
              <div className="bg-background/80 p-3 rounded-xl border border-border font-mono text-xs space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span>
                    Client State:{' '}
                    <span className="font-bold text-primary">{snapshot.client.state}</span> (SND.NXT={snapshot.client.sndNxt})
                  </span>
                  <span>
                    Server State:{' '}
                    <span className="font-bold text-accent">{snapshot.server.state}</span> (RCV.NXT={snapshot.server.rcvNxt})
                  </span>
                </div>
                <div className="text-[11px] text-foreground-muted truncate">
                  Latest: {snapshot.lastEventDescription}
                </div>
              </div>
            </div>

            {/* Knowledge Check Quiz */}
            <div className="pt-4 border-t border-border">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5 mb-2">
                <HelpCircle className="w-4 h-4 text-primary" />
                Lesson Quiz: Check Your Understanding
              </span>

              <p className="text-sm font-semibold text-foreground mb-3">
                {lesson.quiz.question}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {lesson.quiz.options.map((opt, optIdx) => {
                  const hasAnswered = showQuizResult[lesson.id];
                  const isSelected = quizAnswers[lesson.id] === optIdx;
                  const isCorrect = optIdx === lesson.quiz.correctIndex;

                  let btnStyle = 'bg-surface-elevated hover:bg-border border-border text-foreground';
                  if (hasAnswered) {
                    if (isCorrect) {
                      btnStyle = 'bg-success/20 border-success text-success font-bold';
                    } else if (isSelected) {
                      btnStyle = 'bg-danger/20 border-danger text-danger';
                    }
                  }

                  return (
                    <button
                      key={optIdx}
                      onClick={() => handleSelectAnswer(optIdx)}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-all ${btnStyle}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {showQuizResult[lesson.id] && (
                <div
                  className={`p-3 rounded-lg border text-xs leading-relaxed ${
                    quizAnswers[lesson.id] === lesson.quiz.correctIndex
                      ? 'bg-success/15 border-success/30 text-success'
                      : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                  }`}
                >
                  <span className="font-bold block mb-1">
                    {quizAnswers[lesson.id] === lesson.quiz.correctIndex
                      ? 'Correct!'
                      : 'Incorrect.'}
                  </span>
                  {lesson.quiz.explanation}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* TCP Technical Glossary */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
          <div>
            <h3 className="text-lg font-bold text-foreground">RFC 793 Protocol Glossary</h3>
            <p className="text-xs text-foreground-muted">
              Quick reference for core TCP terms, timers, and sequence variables.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-foreground-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search terms..."
              value={glossarySearch}
              onChange={(e) => setGlossarySearch(e.target.value)}
              className="w-full bg-surface-elevated border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredGlossary.map((g) => (
            <div key={g.term} className="bg-surface-elevated p-3 rounded-lg border border-border">
              <span className="font-bold font-mono text-xs text-primary block mb-1">
                {g.term}
              </span>
              <p className="text-xs text-foreground-muted leading-relaxed font-sans">{g.def}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
