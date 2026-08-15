import type { DepDoc, DepEdgeRaw } from "./types";

/**
 * Words are stacked vertically (one per row) in sentence order, at a
 * shared x position. Each dependency draws a curved SVG path from the
 * head's row to the child's row, bulging left through a "lane" so
 * overlapping dependencies don't cross each other. An arrowhead marks
 * the child (dependent) end. Root words get a small dot instead of an
 * incoming arrow.
 *
 * Lane assignment is the same greedy interval-graph coloring used
 * before — it decides how far left an arc bulges, standing in for a
 * real x-axis layout.
 *
 *
 *
 * TODO:
 * left side: full text as pixel bit map
 * right side: user editor
 *
 * try turning it 90 degree => landscape mode
 */

interface Edge {
  child: number;
  head: number;
  start: number;
  end: number;
  lane: number;
}

const ROW_HEIGHT = 220;
const CURVATURE = 10;
const MARGIN = { left: 10, top: 30 };

const INDENT_WIDTH = 40;

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
): string {
  const edges = buildEdges(deps);
  assignLanes(edges);
  const hasHead = new Set(edges.map((e) => e.child));

  const parts: string[] = [];
  const textX: number[] = [];

  // build word x positions
  // TODO: the words with dependencies/edges connecting them are pulled closer together
  // but maybe also influenced by part of speech? or something else?
  // x position makes it look interesting and less generic

  // heads[r] = head token index for word r (1-indexed); heads[0] is a dummy/unused slot
  const heads: number[] = [0];
  deps.forEach(([head]) => heads.push(head));

  // depth[r] = number of hops from r up to its sentence root
  const depth: number[] = new Array(tokens.length + 1).fill(-1);

  function getDepth(r: number, seen: Set<number>): number {
    if (depth[r] !== -1) return depth[r];
    const h = heads[r];
    if (h === 0 || seen.has(r)) {
      // root, or a cycle in malformed data — treat as depth 0
      depth[r] = 0;
      return 0;
    }
    seen.add(r);
    depth[r] = getDepth(h, seen) + 1;
    return depth[r];
  }

  for (let r = 1; r <= tokens.length; r++) {
    getDepth(r, new Set());
  }

  textX.push(0);
  for (let r = 1; r <= tokens.length; r++) {
    textX.push(MARGIN.left + depth[r] * INDENT_WIDTH); //+ Math.random()*100);
  }
  // arcs
  edges.forEach((e) => {
    const xHead = MARGIN.left + 50 * e.head;
    const xChild = MARGIN.left + 50 * e.child;
    const yHead = textX[e.head] + offsetY;
    const yChild = textX[e.child] + offsetY;

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
    const cx = MARGIN.left + 50 * r;
    const cy = textX[r] + offsetY;
    const isRoot = !hasHead.has(r);
    if (isRoot) {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="4" class="dep-root-dot" />`);
    }
    const cls = isRoot ? "dep-word dep-root" : "dep-word";
    parts.push(
      `<text x="${cx}" y="${cy}" class="${cls}">${escapeXml(tokens[r - 1])}</text>`,
    );
  }

  return parts.join("\n");
}

export function renderDocSvg(doc: DepDoc): string {
  let maxLaneCount = 0;
  let maxWordLen = 0;
  const perSentenceLanes: number[] = [];

  doc.tok.forEach((tokens, i) => {
    const edges = buildEdges(doc.dep[i]);
    const laneCount = assignLanes(edges);
    perSentenceLanes.push(laneCount);
    maxLaneCount = Math.max(maxLaneCount, laneCount);
    tokens.forEach((t) => (maxWordLen = Math.max(maxWordLen, t.length)));
  });

  const width = 2000; //TODO: calcuate the width correctly
  let y = MARGIN.top;
  const bodies: string[] = [];
  doc.tok.forEach((tokens, i) => {
    bodies.push(renderSentenceSvg(tokens, doc.dep[i], y));
    y += ROW_HEIGHT;
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
