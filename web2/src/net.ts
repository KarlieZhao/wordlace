import type { DepDoc, DepEdgeRaw } from "./types";
import { POS_COLOR_MAP } from "./types";
/**
 * Words are stacked vertically (one per row) in sentence order. Each
 * word's HORIZONTAL position (x) is now determined by its POS tag —
 * every distinct POS gets its own column, so e.g. all NOUNs line up
 * under one another, all VERBs under another, etc. Each dependency
 * draws a curved SVG path from the head's (row, pos-column) to the
 * child's (row, pos-column), bulging left through a "lane" so
 * overlapping dependencies don't cross each other. An arrowhead marks
 * the child (dependent) end. Root words get a small dot instead of an
 * incoming arrow.
 *
 * Lane assignment is the same greedy interval-graph coloring used
 * before — it decides how far a arc bulges perpendicular to the
 * head->child line.
 *
 *
 *
 * TODO:
 * left side: full text as pixel bit map
 * right side: user editor
 *
 *
 * use lem, fea
 */

interface Edge {
  child: number;
  head: number;
  start: number;
  end: number;
  lane: number;
}

const ROW_HEIGHT = 15;
const CURVATURE = 2;
const MARGIN = { left: 50, top: 30 };
const SENTENCE_GAP = 20;
const fontsize = 12;
const COLUMN_WIDTH = 30;

// Fixed column order for POS tags, derived once from POS_COLOR_MAP so
// every sentence/document uses the same x position for a given POS.
const POS_ORDER: string[] = Object.keys(POS_COLOR_MAP);
const UNKNOWN_POS_COLUMN = POS_ORDER.length; // fallback column for unmapped POS tags

function posColumn(posTag: string | undefined): number {
  if (posTag) {
    const idx = POS_ORDER.indexOf(posTag);
    if (idx !== -1) return idx;
  }
  return UNKNOWN_POS_COLUMN;
}

function posX(posTag: string | undefined): number {
  return MARGIN.left + posColumn(posTag) * COLUMN_WIDTH;
}

function buildEdges(deps: DepEdgeRaw[]): Edge[] {
  const edges: Edge[] = [];
  deps.forEach(([head], idx) => {
    const child = idx + 1;
    if (head === 0) return; // root, no incoming edge
    edges.push({
      child,
      head,
      start: Math.min(child, head),
      end: Math.max(child, head),
      lane: -1,
    });
  });
  return edges;
}

function assignLanes(edges: Edge[]): number {
  const laneEnds: number[] = [];
  const sorted = [...edges].sort((a, b) => a.start - b.start || a.end - b.end);
  for (const e of sorted) {
    let placed = false;
    for (let l = 0; l < laneEnds.length; l++) {
      if (laneEnds[l] <= e.start) {
        e.lane = l;
        laneEnds[l] = e.end;
        placed = true;
        break;
      }
    }
    if (!placed) {
      e.lane = laneEnds.length;
      laneEnds.push(e.end);
    }
  }
  return laneEnds.length;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderSentenceSvg(
  tokens: string[],
  deps: DepEdgeRaw[],
  offsetY: number,
  pos: string[],
): string {
  const edges = buildEdges(deps);
  assignLanes(edges);
  const hasHead = new Set(edges.map((e) => e.child));

  const parts: string[] = [];

  // word row -> y, POS -> x
  const rowY = (r: number) => offsetY + (r - 0.5) * ROW_HEIGHT;
  const textX: number[] = [0]; // index 0 unused (rows are 1-based)
  for (let r = 1; r <= tokens.length; r++) {
    textX.push(posX(pos[r - 1]));
  }

  // arcs
  edges.forEach((e) => {
    const xHead = textX[e.head];
    const xChild = textX[e.child];
    const yHead = rowY(e.head);
    const yChild = rowY(e.child);

    const dx = xChild - xHead;
    const dy = yChild - yHead;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    const px = -dy / len;
    const py = dx / len;

    const dist = Math.sqrt(
      Math.pow(xHead - xChild, 2) + Math.pow(yHead - yChild, 2),
    );
    const bulge = ((e.lane + 1) * CURVATURE * dist) / 100;

    const ctrl1x = xHead + dx * 0.3 + px * bulge;
    const ctrl1y = yHead + dy * 0.3 + py * bulge;
    const ctrl2x = xHead + dx * 0.7 + px * bulge;
    const ctrl2y = yHead + dy * 0.7 + py * bulge;

    parts.push(
      `<path d="M ${xHead} ${yHead} C ${ctrl1x} ${ctrl1y}, ${ctrl2x} ${ctrl2y}, ${xChild} ${yChild}" class="dep-arc" marker-start="url(#arrow)" />`,
    );
  });

  // words
  for (let r = 1; r <= tokens.length; r++) {
    const cx = textX[r];
    const cy = rowY(r);
    const isRoot = !hasHead.has(r);
    if (isRoot) {
      parts.push(
        `<circle cx="${cx - 8}" cy="${cy - fontsize / 4}" r="${fontsize / 4}" class="dep-root-dot" />`,
      );
    }
    const cls = isRoot ? "dep-word dep-root" : "dep-word";
    const fillColor =
      pos[r - 1] && pos[r - 1] in POS_COLOR_MAP
        ? POS_COLOR_MAP[pos[r - 1]]
        : "#666";
    parts.push(
      `<text x="${cx}" y="${cy}" class="${cls}" fill="${fillColor}">${escapeXml(tokens[r - 1])}</text>`,
    );
  }

  return parts.join("\n");
}
export function renderDocSvg(doc: DepDoc): string {
  let maxLaneCount = 0;
  let maxColumn = 0;
  const perSentenceLanes: number[] = [];

  doc.tok.forEach((tokens, i) => {
    const edges = buildEdges(doc.dep[i]);
    const laneCount = assignLanes(edges);
    perSentenceLanes.push(laneCount);
    maxLaneCount = Math.max(maxLaneCount, laneCount);

    const pos = doc.pos[i];
    for (let r = 1; r <= tokens.length; r++) {
      maxColumn = Math.max(maxColumn, posColumn(pos[r - 1]));
    }
  });

  const width =
    MARGIN.left +
    (maxColumn + 1) * COLUMN_WIDTH +
    maxLaneCount * CURVATURE +
    100; // + room for text

  let y = 20;
  const bodies: string[] = [];
  doc.tok.forEach((tokens, i) => {
    const pos = doc.pos[i];
    bodies.push(renderSentenceSvg(tokens, doc.dep[i], y, pos));
    y += tokens.length * ROW_HEIGHT + SENTENCE_GAP;
  });
  const height = y;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#aaa" />
    </marker>
  </defs>
  ${bodies.join("\n")}
</svg>`;
}
