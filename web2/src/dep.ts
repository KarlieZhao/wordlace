import type { DepDoc, DepEdgeRaw } from "./types";
import { POS_COLOR_MAP } from "./utils";

export type LayoutMode = "tree" | "net";

interface Edge {
  child: number;
  head: number;
  start: number;
  end: number;
  lane: number;
}

interface LayoutConfig {
  marginLeft: number;
  curvature: number;
  unitWidth: number;
}

const SENTENCE_GAP = 15;
const fontsize = 12;
const ROW_HEIGHT = fontsize / 2;

const LAYOUT_CONFIG: Record<LayoutMode, LayoutConfig> = {
  net: { marginLeft: 50, curvature: 5, unitWidth: 20 },
  tree: { marginLeft: 150, curvature: 10, unitWidth: 20 },
};

export const POS_ORDER: string[] = Object.keys(POS_COLOR_MAP);
const UNKNOWN_POS_COLUMN = POS_ORDER.length; // fallback

function posColumn(posTag: string | undefined): number {
  if (posTag) {
    const idx = POS_ORDER.indexOf(posTag);
    if (idx !== -1) return idx;
  }
  return UNKNOWN_POS_COLUMN;
}

export function posX(posTag: string | undefined): number {
  const cfg = LAYOUT_CONFIG.net;
  return cfg.marginLeft + posColumn(posTag) * cfg.unitWidth;
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

// Dependency-tree depth per row (used only by "depth" mode), via the
// recursive walk from the second file.
function computeDepths(tokens: string[], deps: DepEdgeRaw[]): number[] {
  const heads: number[] = [0];
  deps.forEach(([head]) => heads.push(head));

  const depth: number[] = new Array(tokens.length + 1).fill(-1);

  function getDepth(r: number, seen: Set<number>): number {
    if (depth[r] !== -1) return depth[r];
    const h = heads[r];
    if (h === 0 || seen.has(r)) {
      depth[r] = 0;
      return 0;
    }
    seen.add(r);
    depth[r] = getDepth(h, seen) + 1;
    return depth[r];
  }

  for (let r = 1; r <= tokens.length; r++) getDepth(r, new Set());
  return depth;
}

// x-position per row (1-indexed, index 0 unused), depending on mode.
function computeTextX(
  tokens: string[],
  deps: DepEdgeRaw[],
  pos: string[],
  mode: LayoutMode,
): number[] {
  const cfg = LAYOUT_CONFIG[mode];
  const textX: number[] = [0];

  if (mode === "net") {
    for (let r = 1; r <= tokens.length; r++) {
      textX.push(posX(pos[r - 1]));
    }
  } else {
    const depth = computeDepths(tokens, deps);
    for (let r = 1; r <= tokens.length; r++) {
      textX.push(cfg.marginLeft + depth[r] * cfg.unitWidth);
    }
  }

  return textX;
}

function renderSentenceSvg(
  tokens: string[],
  deps: DepEdgeRaw[],
  offsetY: number,
  pos: string[],
  sentenceIndex: number,
  mode: LayoutMode,
): string {
  const cfg = LAYOUT_CONFIG[mode];
  const edges = buildEdges(deps);
  assignLanes(edges);
  const hasHead = new Set(edges.map((e) => e.child));

  const textX = computeTextX(tokens, deps, pos, mode);
  const rowY = (r: number) => offsetY + (r - 0.5) * ROW_HEIGHT;

  const parts: string[] = [];

  // arcs
  edges.forEach((e, edgeIndex) => {
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
    const bulge = ((e.lane + 1) * cfg.curvature * dist) / 100;

    const ctrl1x = xHead + dx * 0.3 + px * bulge;
    const ctrl1y = yHead + dy * 0.3 + py * bulge;
    const ctrl2x = xHead + dx * 0.7 + px * bulge;
    const ctrl2y = yHead + dy * 0.7 + py * bulge;

    parts.push(`
      <path
        class="dep-arc"
        data-sentence="${sentenceIndex}"
        data-edge="${edgeIndex}"
        data-head="${e.head}"
        data-child="${e.child}"
        d="M ${xHead} ${yHead}
           C ${ctrl1x} ${ctrl1y},
             ${ctrl2x} ${ctrl2y},
             ${xChild} ${yChild}"
        marker-start="url(#arrow)"
      />
    `);
  });

  // words
  for (let r = 1; r <= tokens.length; r++) {
    const cx = textX[r];
    const cy = rowY(r);
    const isRoot = !hasHead.has(r);

    if (isRoot) {
      parts.push(`
        <circle
          cx="${cx - 8}"
          cy="${cy - fontsize / 4}"
          r="${fontsize / 4}"
          class="dep-root-dot"
          data-sentence="${sentenceIndex}"
          data-word="${r}"
        />
      `);
    }

    const cls = isRoot ? "dep-word dep-root" : "dep-word";
    const fillColor =
      pos[r - 1] && pos[r - 1] in POS_COLOR_MAP
        ? POS_COLOR_MAP[pos[r - 1]]
        : "#666";

    // parts.push(`
    //   <text
    //     x="${cx}"
    //     y="${cy}"
    //     class="${cls}"
    //     data-sentence="${sentenceIndex}"
    //     data-word="${r}"
    //     fill="${fillColor}"
    //   >${escapeXml(tokens[r - 1])}</text>
    // `);

    // zoom to rects, kinda cool
    parts.push(`
      <rect
      x="${cx}"
      y="${cy}"
      width="${fontsize * 1.2}px"
      height="5px"
      class="${cls}"
      data-sentence="${sentenceIndex}"
      data-word="${r}"
      fill="${fillColor}"
    ></rect>
    `);
  }

  return parts.join("\n");
}

export function renderDocSvg(doc: DepDoc, mode: LayoutMode): string {
  const cfg = LAYOUT_CONFIG[mode];
  let maxLaneCount = 0;
  let maxExtent = 0; // max POS column ("pos" mode) or max tree depth ("depth" mode)

  doc.tok.forEach((tokens, i) => {
    const edges = buildEdges(doc.dep[i]);
    const laneCount = assignLanes(edges);
    maxLaneCount = Math.max(maxLaneCount, laneCount);

    const pos = doc.pos[i];
    if (mode === "net") {
      for (let r = 1; r <= tokens.length; r++) {
        maxExtent = Math.max(maxExtent, posColumn(pos[r - 1]));
      }
    } else {
      const depth = computeDepths(tokens, doc.dep[i]);
      for (let r = 1; r <= tokens.length; r++) {
        maxExtent = Math.max(maxExtent, depth[r]);
      }
    }
  });

  const width =
    cfg.marginLeft +
    (maxExtent + 1) * cfg.unitWidth +
    maxLaneCount * cfg.curvature +
    100; // + room for text

  let y = 20;
  const bodies: string[] = [];
  doc.tok.forEach((tokens, i) => {
    const pos = doc.pos[i];
    bodies.push(renderSentenceSvg(tokens, doc.dep[i], y, pos, i, mode));
    y += tokens.length * ROW_HEIGHT + SENTENCE_GAP;
  });
  const height = y;

  return `
    <svg
      class="dependency-svg"
      xmlns="http://www.w3.org/2000/svg"
      width="${width}"
      height="${height}"
      viewBox="0 0 ${width} ${height}"
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" class="dep-arrow" />
        </marker>
      </defs>
      ${bodies.join("\n")}
    </svg>
  `;
}

// ---------------------------------------------------------------------
// Hover interaction (mode-agnostic — relies only on data-* attributes,
// so it works the same for either layout)
// ---------------------------------------------------------------------

export function addHoverEvents(container: HTMLElement): void {
  const svg = container.querySelector<SVGSVGElement>(".dependency-svg");
  if (!svg) return;

  svg.addEventListener("mouseover", (event) => {
    const target = event.target as Element | null;
    if (!target) return;
    const word = target.closest<SVGTextElement>(".dep-word");
    const arc = target.closest<SVGPathElement>(".dep-arc");

    if (word) {
      highlightWord(
        svg,
        Number(word.dataset.sentence),
        Number(word.dataset.word),
      );
      return;
    }

    if (arc) {
      highlightEdge(
        svg,
        Number(arc.dataset.sentence),
        Number(arc.dataset.head),
        Number(arc.dataset.child),
      );
    }
  });

  svg.addEventListener("mouseout", (event) => {
    const target = event.target as Element | null;
    if (!target) return;

    const related = event.relatedTarget as Node | null;
    if (related && svg.contains(related)) return;

    clearHighlights(svg);
  });
}

function highlightWord(
  svg: SVGSVGElement,
  sentenceIndex: number,
  wordIndex: number,
): void {
  clearHighlights(svg);
  svg.classList.add("has-hover");

  const word = svg.querySelector<SVGTextElement>(
    `.dep-word[data-sentence="${sentenceIndex}"][data-word="${wordIndex}"]`,
  );
  word?.classList.add("is-highlighted");

  const rootDot = svg.querySelector<SVGCircleElement>(
    `.dep-root-dot[data-sentence="${sentenceIndex}"][data-word="${wordIndex}"]`,
  );
  rootDot?.classList.add("is-highlighted");

  const edges = svg.querySelectorAll<SVGPathElement>(
    `.dep-arc[data-sentence="${sentenceIndex}"]`,
  );

  edges.forEach((edge) => {
    const head = Number(edge.dataset.head);
    const child = Number(edge.dataset.child);
    if (head !== wordIndex && child !== wordIndex) return;

    edge.classList.add("is-highlighted");

    const otherWord = head === wordIndex ? child : head;

    const connectedWord = svg.querySelector<SVGTextElement>(
      `.dep-word[data-sentence="${sentenceIndex}"][data-word="${otherWord}"]`,
    );
    connectedWord?.classList.add("is-connected");

    const connectedRootDot = svg.querySelector<SVGCircleElement>(
      `.dep-root-dot[data-sentence="${sentenceIndex}"][data-word="${otherWord}"]`,
    );
    connectedRootDot?.classList.add("is-connected");
  });
}

function highlightEdge(
  svg: SVGSVGElement,
  sentenceIndex: number,
  head: number,
  child: number,
): void {
  clearHighlights(svg);
  svg.classList.add("has-hover");

  const edge = Array.from(
    svg.querySelectorAll<SVGPathElement>(
      `.dep-arc[data-sentence="${sentenceIndex}"]`,
    ),
  ).find(
    (el) =>
      Number(el.dataset.head) === head && Number(el.dataset.child) === child,
  );
  edge?.classList.add("is-highlighted");

  [head, child].forEach((wordIndex) => {
    const word = svg.querySelector<SVGTextElement>(
      `.dep-word[data-sentence="${sentenceIndex}"][data-word="${wordIndex}"]`,
    );
    word?.classList.add("is-highlighted");

    const rootDot = svg.querySelector<SVGCircleElement>(
      `.dep-root-dot[data-sentence="${sentenceIndex}"][data-word="${wordIndex}"]`,
    );
    rootDot?.classList.add("is-highlighted");
  });
}

function clearHighlights(svg: SVGSVGElement): void {
  svg.classList.remove("has-hover");
  svg.querySelectorAll(".is-highlighted, .is-connected").forEach((el) => {
    el.classList.remove("is-highlighted", "is-connected");
  });
}
