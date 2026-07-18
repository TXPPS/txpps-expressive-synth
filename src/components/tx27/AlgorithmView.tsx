import { ALGORITHMS } from "@/lib/audio/algorithms";

// ── Geometry (viewBox 120×120) ──────────────────────────────────────────────
// 2×2 operator grid: ops 1–2 (indices 0,1) on the bottom row nearest the
// output bus, ops 3–4 (indices 2,3) on top. Blocks are sized for OP labels.
const OP_W = 24;
const OP_H = 16;
const POS: Record<number, { x: number; y: number }> = {
  0: { x: 16, y: 58 },
  1: { x: 62, y: 58 },
  2: { x: 16, y: 14 },
  3: { x: 62, y: 14 },
};
const BUS_Y = 98;
const BUS_X1 = 10;
const BUS_X2 = 102;

function center(i: number) {
  return { x: POS[i].x + OP_W / 2, y: POS[i].y + OP_H / 2 };
}

/** Point on the border of block `i` (padded by `gap`) along the line from its
 *  center toward `to` — so connection lines start/end at block edges. */
function edgePoint(i: number, to: { x: number; y: number }, gap: number) {
  const c = center(i);
  const dx = to.x - c.x;
  const dy = to.y - c.y;
  const hw = OP_W / 2 + gap;
  const hh = OP_H / 2 + gap;
  const t = Math.min(
    dx !== 0 ? hw / Math.abs(dx) : Infinity,
    dy !== 0 ? hh / Math.abs(dy) : Infinity,
  );
  return { x: c.x + dx * t, y: c.y + dy * t };
}

/**
 * FM routing map. Carriers are filled + accent-stroked with a drop line into
 * the OUT bus; modulators are dark outlined blocks. Modulation edges carry
 * arrowheads (source → destination); the feedback op wears a curved
 * self-loop. When `active` is true (a note is sounding) the carriers and
 * output path glow via the .algo-live CSS class.
 */
export function AlgorithmView({ id, active = false }: { id: number; active?: boolean }) {
  const algo = ALGORITHMS[id - 1];
  if (!algo) return null;
  const fb = POS[algo.feedbackOp];

  return (
    <svg
      viewBox="0 0 120 120"
      className={`h-full w-full algo-svg ${active ? "algo-live" : ""}`}
      role="img"
      aria-label={`Algorithm ${algo.id}: ${algo.name}. Carriers: ${algo.carriers
        .map((c) => `OP${c + 1}`)
        .join(", ")}.`}
    >
      <defs>
        <marker
          id="txAlgoArrowMod"
          viewBox="0 0 6 6"
          refX="5"
          refY="3"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="var(--tx-lcd)" />
        </marker>
        <marker
          id="txAlgoArrowOut"
          viewBox="0 0 6 6"
          refX="5"
          refY="3"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="var(--tx-accent)" />
        </marker>
      </defs>

      {/* modulation edges: source → destination with arrowhead at the dest */}
      {algo.modulations.map(([s, d], i) => {
        const a = edgePoint(s, center(d), 1);
        const b = edgePoint(d, center(s), 3.5);
        return (
          <line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="var(--tx-lcd)"
            strokeWidth="1.1"
            opacity="0.75"
            markerEnd="url(#txAlgoArrowMod)"
          />
        );
      })}

      {/* feedback self-loop on the feedback operator (arc out of the right
          edge, back into the top edge) */}
      <path
        d={`M ${fb.x + OP_W} ${fb.y + 4} C ${fb.x + OP_W + 15} ${fb.y + 2}, ${fb.x + OP_W + 15} ${fb.y - 11}, ${fb.x + OP_W - 7} ${fb.y - 3.5}`}
        fill="none"
        stroke="var(--tx-accent)"
        strokeWidth="1"
        opacity="0.85"
        markerEnd="url(#txAlgoArrowOut)"
      />

      {/* carrier → output bus. Bottom-row carriers drop straight down;
          top-row carriers route around the outside so they never cross the
          block below them. */}
      {algo.carriers.map((c) => {
        const cx = POS[c].x + OP_W / 2;
        const bottom = POS[c].y + OP_H + 1;
        if (POS[c].y < POS[0].y) {
          const outerX = c === 2 ? 11 : 91; // left col hugs left margin, right col right
          return (
            <path
              key={c}
              className="algo-drop"
              d={`M ${cx} ${bottom} L ${cx} 42 L ${outerX} 42 L ${outerX} ${BUS_Y - 3}`}
              fill="none"
              stroke="var(--tx-accent)"
              strokeWidth="1.1"
              strokeLinejoin="round"
              markerEnd="url(#txAlgoArrowOut)"
            />
          );
        }
        return (
          <line
            key={c}
            className="algo-drop"
            x1={cx}
            y1={bottom}
            x2={cx}
            y2={BUS_Y - 3}
            stroke="var(--tx-accent)"
            strokeWidth="1.1"
            markerEnd="url(#txAlgoArrowOut)"
          />
        );
      })}

      {/* output bus */}
      <line
        className="algo-bus"
        x1={BUS_X1}
        y1={BUS_Y}
        x2={BUS_X2}
        y2={BUS_Y}
        stroke="var(--tx-accent)"
        strokeWidth="1.3"
        markerEnd="url(#txAlgoArrowOut)"
      />
      <text
        x={(BUS_X1 + BUS_X2) / 2}
        y={BUS_Y + 12}
        textAnchor="middle"
        fontSize="6"
        letterSpacing="2"
        fill="var(--tx-accent)"
        opacity="0.9"
        fontFamily="var(--font-display), monospace"
      >
        OUT
      </text>

      {/* operator blocks (drawn last so routing lines tuck behind them) */}
      {[0, 1, 2, 3].map((i) => {
        const p = POS[i];
        const isCarrier = algo.carriers.includes(i);
        return (
          <g key={i}>
            <rect
              className={isCarrier ? "algo-carrier" : "algo-mod"}
              x={p.x}
              y={p.y}
              width={OP_W}
              height={OP_H}
              rx="2.5"
              fill={isCarrier ? "var(--tx-accent-dim)" : "#161613"}
              stroke={isCarrier ? "var(--tx-accent)" : "var(--tx-lcd-dim)"}
              strokeWidth={isCarrier ? 1.2 : 0.9}
            />
            <text
              x={p.x + OP_W / 2}
              y={p.y + OP_H / 2 + 2.4}
              textAnchor="middle"
              fontSize="7"
              letterSpacing="0.6"
              fill="var(--tx-lcd)"
              opacity={isCarrier ? 1 : 0.75}
              fontFamily="var(--font-display), monospace"
            >
              OP{i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
