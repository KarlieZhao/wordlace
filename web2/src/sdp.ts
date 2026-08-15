import { posX } from "./net";
import { escapeXml, POS_COLOR_MAP } from "./utils";
export type SdpRelation = [number, string];
export type SdpSentence = SdpRelation[][];

export type SdpMode = "dm" | "pas" | "psd";

export interface DepDoc {
  tok: string[][];
  pos: string[][];
  "sdp/dm"?: SdpSentence[];
  "sdp/pas"?: SdpSentence[];
  "sdp/psd"?: SdpSentence[];
}

interface Edge {
  id: string;
  sentence: number;
  child: number;
  head: number;
  relation: string;
  start: number;
  end: number;
  lane: number;
}

const ROW_HEIGHT = 20;

const CURVATURE = 12;

const MARGIN = {
  left: 50,
  right: 80,
  top: 30,
  bottom: 30,
};

const SENTENCE_GAP = 35;
const FONT_SIZE = 12;
const INDENT_WIDTH = 25;
const MIN_WIDTH = 500;

/**
 * Convert a relation into a safe CSS class.
 *
 * Examples:
 *
 *   ARG0
 *   coord_ARG1
 *   CONJ.member
 *
 * become:
 *
 *   relation-ARG0
 *   relation-coord_ARG1
 *   relation-CONJ-member
 */
function relationClass(relation: string): string {
  return "relation-" + relation.replace(/[^a-zA-Z0-9_-]/g, "-");
}

/* =========================================================
 * Build SDP edges
 * ========================================================= */
function buildSdpEdges(sentence: SdpSentence, sentenceIndex: number): Edge[] {
  const edges: Edge[] = [];

  sentence.forEach((relations, childIndex) => {
    // childIndex is 0-based internally
    const child = childIndex;

    relations.forEach(([hanlpHead, relation], relationIndex) => {
      // HanLP head is 1-based, convert to 0-based
      const head = hanlpHead - 1;

      // Ignore invalid references
      if (head <= 0 || head >= sentence.length || head === child) {
        return
      }

      edges.push({
        id: [sentenceIndex, head, child, relationIndex].join("-"),

        sentence: sentenceIndex,

        child,
        head,

        relation,

        start: Math.min(child, head),
        end: Math.max(child, head),

        lane: -1,
      });
    });
  });

  return edges;
}

/* =========================================================
 * Assign arc lanes
 *
 * Edges that overlap horizontally cannot occupy the
 * same lane.
 * ========================================================= */

function assignLanes(edges: Edge[]): number {
  const laneEnds: number[] = [];

  const sorted = [...edges].sort((a, b) => a.start - b.start || a.end - b.end);

  for (const edge of sorted) {
    let placed = false;

    for (let lane = 0; lane < laneEnds.length; lane++) {
      if (laneEnds[lane] <= edge.start) {
        edge.lane = lane;
        laneEnds[lane] = edge.end;
        placed = true;
        break;
      }
    }

    if (!placed) {
      edge.lane = laneEnds.length;
      laneEnds.push(edge.end);
    }
  }

  return laneEnds.length;
}

function calculateTextX(tokens: string[], pos: string[]): number[] {
  const textX: number[] = [];

  for (let i = 0; i <= tokens.length; i++) {
    if (i === 0) {
      textX.push(MARGIN.left);
    } else {
      textX.push(posX(pos[i]));
      // textX.push(MARGIN.left + (i - 1) * INDENT_WIDTH);
    }
  }

  return textX;
}

/* =========================================================
 * Render one sentence
 * ========================================================= */

function renderSentenceSvg(
  tokens: string[],
  pos: string[],
  sdp: SdpSentence,
  sentenceIndex: number,
  offsetY: number,
): {
  svg: string;
  laneCount: number;
} {
  const edges = buildSdpEdges(sdp, sentenceIndex);
  const laneCount = assignLanes(edges);
  const parts: string[] = [];
  const textX = calculateTextX(tokens, pos);
  const rowY = (token: number) => offsetY + (token - 0.5) * ROW_HEIGHT;

  /* =============== ========================================
   * Arcs
   * ======================================================= */

  edges.forEach((edge) => {
    const xHead = textX[edge.head + 1] + 50;
    const xChild = textX[edge.child + 1] + 50;
    const yHead = rowY(edge.head + 1);
    const yChild = rowY(edge.child + 1);

    const dx = xChild - xHead;
    const dy = yChild - yHead;

    const length = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = -dy / length;
    const py = dx / length;

    const distance = Math.sqrt(
      Math.pow(xHead - xChild, 2) + Math.pow(yHead - yChild, 2),
    );

    const bulge = ((edge.lane + 1) * CURVATURE * distance) / 100;

    const ctrl1x = xHead + dx * 0.3 + px * bulge;
    const ctrl1y = yHead + dy * 0.3 + py * bulge;
    const ctrl2x = xHead + dx * 0.7 + px * bulge;
    const ctrl2y = yHead + dy * 0.7 + py * bulge;
    const arcId = `sdp-edge-${edge.id}`;

    const relationCls = relationClass(edge.relation);

    /*
     * Path.
     *
     * marker-end is intentional:
     *
     * HEAD ─────────→ CHILD
     */

    parts.push(`
      <path
        id="${arcId}"
        class="
          sdp-arc
          ${relationCls}
        "
        data-sentence="${sentenceIndex}"
        data-edge="${escapeXml(edge.id)}"
        data-head="${edge.head}"
        data-child="${edge.child}"
        data-relation="${escapeXml(edge.relation)}"
        d="
          M ${xHead} ${yHead}
          C
            ${ctrl1x} ${ctrl1y},
            ${ctrl2x} ${ctrl2y},
            ${xChild} ${yChild}
        "
        marker-end="url(#sdp-arrow)"
      />
    `);

    /*
     * Relation label.
     *
     * It exists in the DOM but is normally hidden.
     * CSS reveals it when its edge is highlighted.
     */

    const labelX = xHead + dx * 0.5 + px * bulge;

    const labelY = yHead + dy * 0.5 + py * bulge;

    parts.push(`
      <text
        class="
          sdp-relation
          ${relationCls}
        "
        data-sentence="${sentenceIndex}"
        data-edge="${escapeXml(edge.id)}"
        x="${labelX}"
        y="${labelY - 3}"
        text-anchor="middle"
        pointer-events="none"
      >
        ${escapeXml(edge.relation)}
      </text>
    `);
  });

  /* =======================================================
   * Words
   * ======================================================= */

  tokens.forEach((token, index) => {
    const word = index + 1;

    const x = textX[word];

    const y = rowY(word);

    const posTag = pos[index] ?? "";

    const fillColor =
      posTag && posTag in POS_COLOR_MAP ? POS_COLOR_MAP[posTag] : "#666";

    parts.push(`
        <text
          class="sdp-word"
          data-sentence="${sentenceIndex}"
          data-word="${word}"
          data-pos="${escapeXml(posTag)}"
          x="${x}"
          y="${y}"
          fill="${fillColor}"
        >
          ${escapeXml(token)}
        </text>
      `);
  });

  return {
    svg: parts.join("\n"),
    laneCount,
  };
}

/* =========================================================
 * Main renderer
 * ========================================================= */

export function renderSdpDocSvg(doc: DepDoc, mode: SdpMode = "dm"): string {
  const sdpKey = `sdp/${mode}` as "sdp/dm" | "sdp/pas" | "sdp/psd";

  const sdpData = doc[sdpKey];

  if (!sdpData) {
    console.warn(`HanLP document does not contain ${sdpKey}`);

    return `
      <svg
        class="dependency-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <text x="20" y="30">
          No ${escapeXml(sdpKey)} data available.
        </text>
      </svg>
    `;
  }

  let y = MARGIN.top;

  let maxWidth = MIN_WIDTH;

  let totalHeight = MARGIN.top;

  const bodies: string[] = [];

  /*
   * Render every sentence.
   */

  sdpData.forEach((sentence, sentenceIndex) => {
    const tokens = doc.tok[sentenceIndex] ?? [];

    const pos = doc.pos[sentenceIndex] ?? [];

    /*
     * Calculate lane count first.
     */

    const edges = buildSdpEdges(sentence, sentenceIndex);

    const laneCount = assignLanes(edges);

    /*
     * Render sentence.
     */

    const rendered = renderSentenceSvg(tokens, pos, sentence, sentenceIndex, y);

    bodies.push(
      `
        <g
          class="sdp-sentence"
          data-sentence="${sentenceIndex}"
        >
          ${rendered.svg}
        </g>
        `,
    );

    /*
     * Width.
     *
     * Token positions are based on token order,
     * with additional room for the outer arcs.
     */

    const tokenWidth =
      MARGIN.left + Math.max(0, tokens.length - 1) * INDENT_WIDTH;

    const arcWidth = laneCount * CURVATURE * 2;

    maxWidth = Math.max(maxWidth, tokenWidth + arcWidth + MARGIN.right);

    /*
     * Height.
     */

    y += tokens.length * ROW_HEIGHT + SENTENCE_GAP;

    totalHeight = y;
  });

  const height = Math.max(totalHeight + MARGIN.bottom, 100);

  return `
    <svg
      class="dependency-svg"
      xmlns="http://www.w3.org/2000/svg"
      width="${maxWidth}"
      height="${height}"
      viewBox="0 0 ${maxWidth} ${height}"
      data-sdp-mode="${mode}"
    >

      <defs>

        <marker
          id="sdp-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path
            d="
              M 0 0
              L 10 5
              L 0 10
              z
            "
            class="sdp-arrow"
          />
        </marker>

      </defs>

      ${bodies.join("\n")}

    </svg>
  `;
}

/* =========================================================
 * Hover interaction
 * ========================================================= */

export function setupSdpHover(container: HTMLElement): void {
  const svg = container.querySelector<SVGSVGElement>(".dependency-svg");

  if (!svg) {
    return;
  }

  /*
   * WORD / ARC ENTER
   *
   * mouseover bubbles, so delegation works.
   */

  svg.addEventListener("mouseover", (event) => {
    const target = event.target as Element | null;

    if (!target) {
      return;
    }

    const word = target.closest<SVGTextElement>(".sdp-word");

    if (word) {
      const sentence = Number(word.dataset.sentence);

      const wordIndex = Number(word.dataset.word);

      highlightSdpWord(svg, sentence, wordIndex);

      return;
    }

    const arc = target.closest<SVGPathElement>(".sdp-arc");

    if (arc) {
      const sentence = Number(arc.dataset.sentence);

      const head = Number(arc.dataset.head);

      const child = Number(arc.dataset.child);

      const edgeId = arc.dataset.edge;

      highlightSdpEdge(svg, sentence, head, child, edgeId);
    }
  });

  /*
   * Clear hover when the mouse actually leaves
   * the SVG.
   */

  svg.addEventListener("mouseleave", () => {
    clearSdpHighlight(svg);
  });
}

/* =========================================================
 * Highlight word
 * ========================================================= */

function highlightSdpWord(
  svg: SVGSVGElement,
  sentenceIndex: number,
  wordIndex: number,
): void {
  clearSdpHighlight(svg);

  svg.classList.add("has-sdp-hover");

  /*
   * Highlight hovered word.
   */

  const word = svg.querySelector<SVGTextElement>(
    `.sdp-word[data-sentence="${sentenceIndex}"]` +
      `[data-word="${wordIndex}"]`,
  );

  word?.classList.add("is-sdp-highlighted");

  /*
   * Find every edge touching this word.
   */

  const edges = svg.querySelectorAll<SVGPathElement>(
    `.sdp-arc[data-sentence="${sentenceIndex}"]`,
  );

  edges.forEach((edge) => {
    const head = Number(edge.dataset.head);

    const child = Number(edge.dataset.child);

    if (head !== wordIndex && child !== wordIndex) {
      return;
    }

    /*
     * Highlight the edge.
     */

    edge.classList.add("is-sdp-highlighted");

    /*
     * Highlight relation label.
     */

    const edgeId = edge.dataset.edge;

    if (edgeId) {
      const label = svg.querySelector<SVGTextElement>(
        `.sdp-relation[data-edge="${edgeId}"]`,
      );

      label?.classList.add("is-sdp-highlighted");
    }

    /*
     * Highlight the other word.
     */

    const otherWord = head === wordIndex ? child : head;

    const connectedWord = svg.querySelector<SVGTextElement>(
      `.sdp-word[data-sentence="${sentenceIndex}"]` +
        `[data-word="${otherWord}"]`,
    );

    connectedWord?.classList.add("is-sdp-connected");
  });
}

/* =========================================================
 * Highlight edge
 * ========================================================= */

function highlightSdpEdge(
  svg: SVGSVGElement,
  sentenceIndex: number,
  head: number,
  child: number,
  edgeId?: string,
): void {
  clearSdpHighlight(svg);

  svg.classList.add("has-sdp-hover");

  /*
   * Highlight edge.
   */

  let edge: SVGPathElement | null = null;

  if (edgeId) {
    edge = svg.querySelector<SVGPathElement>(`.sdp-arc[data-edge="${edgeId}"]`);
  }

  if (!edge) {
    const edges = svg.querySelectorAll<SVGPathElement>(
      `.sdp-arc[data-sentence="${sentenceIndex}"]`,
    );

    edge =
      Array.from(edges).find(
        (candidate) =>
          Number(candidate.dataset.head) === head &&
          Number(candidate.dataset.child) === child,
      ) ?? null;
  }

  edge?.classList.add("is-sdp-highlighted");

  /*
   * Highlight relation label.
   */

  if (edgeId) {
    const label = svg.querySelector<SVGTextElement>(
      `.sdp-relation[data-edge="${edgeId}"]`,
    );

    label?.classList.add("is-sdp-highlighted");
  }

  /*
   * Highlight both words.
   */

  const headWord = svg.querySelector<SVGTextElement>(
    `.sdp-word[data-sentence="${sentenceIndex}"]` + `[data-word="${head}"]`,
  );

  const childWord = svg.querySelector<SVGTextElement>(
    `.sdp-word[data-sentence="${sentenceIndex}"]` + `[data-word="${child}"]`,
  );

  headWord?.classList.add("is-sdp-highlighted");

  childWord?.classList.add("is-sdp-connected");
}

/* =========================================================
 * Clear hover
 * ========================================================= */

function clearSdpHighlight(svg: SVGSVGElement): void {
  svg.classList.remove("has-sdp-hover");

  svg
    .querySelectorAll(".is-sdp-highlighted, " + ".is-sdp-connected")
    .forEach((element) => {
      element.classList.remove("is-sdp-highlighted", "is-sdp-connected");
    });
}

export function renderSdp(
  container: HTMLElement,
  doc: DepDoc,
  mode: SdpMode = "dm",
): void {
  container.innerHTML = renderSdpDocSvg(doc, mode);
  setupSdpHover(container);
}
