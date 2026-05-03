import { drawText, line, mkDefs, mkArrowMarker } from "./svgutils";
import { COL_ORDER, COL_LABELS, normalize } from "./words";
import { showOriginalOnly } from "./main";
const PAD_L = 80, PAD_R = 40, PAD_T = 50, PAD_B = 50;
const LIGHT_BLUE = "#b9d1e3";
const BLACK = "#111111";
const LIGHT_GRAY = "#b0b0b0";
const RED = "#955151";



// 1. if a node is clicked => add to selected
// 2. a selected node cannot be clicked again, but will always be highlighted
// 3. if mouse enters a node (B) that is the last selected node(A)'s child (related node), add all B's children to hoveredChildren
// 4. if mouse leave node B, remove B from hovered, and remove its children from hoveredChildren. Keep selected and its children highlighted, as well as the arrows.

const state = {
  selected: [],
  selectedChildren: [],
  hovered: "",
  hoveredChildren: [],
};

function applyState(nodeEls, allEdgeLines) {
  const { selected, selectedChildren, hovered, hoveredChildren } = state;
  const lastSelected = selected[selected.length - 1];
  const hasSelection = selected.length > 0;
  const hasHover = hovered !== "";

  // init: everything fully visible
  if (!hasSelection && !hasHover) {
    Object.values(nodeEls).forEach(({ textEl }) => textEl.setAttribute("fill", BLACK));
    allEdgeLines().forEach((el) => restoreEdge(el));
    return;
  }

  // Nodes
  // lit = selected nodes + their children + hovered node + its children
  const litIds = new Set([
    ...selected,
    ...selectedChildren,
    ...(hasHover ? [hovered, ...hoveredChildren] : []),
  ]);

  Object.entries(nodeEls).forEach(([id, { textEl, g }]) => {
    id = parseInt(id)
    const isSelected = selected.includes(id);
    const isClickable = !hasSelection || selectedChildren.includes(id);
    textEl.setAttribute("fill", isSelected ? RED : litIds.has(id) ? BLACK : LIGHT_GRAY);
    g.style.pointerEvents = isClickable && !isSelected ? "auto" : "none";
  });

  // Edges
  // Full opacity from last selected, half opacity from hovered, dim everything else.
  allEdgeLines().forEach((el) => {
    const fromId = parseInt(el.dataset.fromId);
    const fromLastSelected = hasSelection && fromId === lastSelected;
    const fromHovered = hasHover && fromId === hovered;

    if (fromLastSelected) { el.style.opacity = "1"; restoreEdge(el); }
    else if (fromHovered) { el.style.opacity = "0.5"; restoreEdge(el); }
    else { el.style.opacity = "0.08"; }
  });
}

export function drawColumn(tokens, bigramIndex) {
  const writer = document.getElementById("writer");
  const svg = document.getElementById("svg");
  svg.innerHTML = "";

  const W = svg.clientWidth || 800;
  const H = svg.clientHeight || 600;
  const rowCount = COL_ORDER.length;
  if (!rowCount) return;

  const rowH = 50; //(H - PAD_T - PAD_B) / Math.max(rowCount - 1, 1);
  const colW = (W - PAD_L - PAD_R) / Math.max(tokens.length, 1);

  // Each POS gets a Y position (row)
  const rowY = Object.fromEntries(COL_ORDER.map((p, i) => [p, PAD_T + i * rowH]));
  // Each token gets an X position (column)
  const tokenPos = buildTokenPositions(tokens, rowY, colW);
  const normToIds = buildNormToIds(tokens);

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.style.height = "";

  const defs = mkDefs(svg);
  mkArrowMarker(defs, "arr-black", BLACK);
  mkArrowMarker(defs, "arr-blue", LIGHT_BLUE);

  // Row labels (POS labels on the left)
  const headerGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  headerGroup.setAttribute("pointer-events", "none");
  COL_ORDER.forEach((p) => {
    drawText(
      headerGroup,
      `rowheader-${p}`,
      PAD_L - 10,
      rowY[p],
      COL_LABELS[p] || p,
      11,
      400,
      LIGHT_GRAY,
      "end",
      "IBM Plex Mono",
    );
  });
  svg.appendChild(headerGroup);

  const hitrect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  hitrect.setAttribute("fill", "transparent");
  requestAnimationFrame(() => {
    const pad = { x: 8, y: 12 };
    const bbox = headerGroup.getBBox();
    hitrect.setAttribute("x", bbox.x - pad.x);
    hitrect.setAttribute("y", bbox.y - pad.y);
    hitrect.setAttribute("width", bbox.width + pad.x * 2);
    hitrect.setAttribute("height", bbox.height + pad.y * 2);
  });
  svg.appendChild(hitrect);

  const edgeGroupBlue = document.createElementNS("http://www.w3.org/2000/svg", "g");
  edgeGroupBlue.setAttribute("class", "edge-layer edge-layer-blue");
  svg.appendChild(edgeGroupBlue);

  const edgeGroupBlack = document.createElementNS("http://www.w3.org/2000/svg", "g");
  edgeGroupBlack.setAttribute("class", "edge-layer edge-layer-black");
  svg.appendChild(edgeGroupBlack);

  const outgoingEdges = drawEdges(tokens, bigramIndex, normToIds, tokenPos, edgeGroupBlack, edgeGroupBlue);

  const labelGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  labelGroup.setAttribute("class", "label-layer");
  svg.appendChild(labelGroup);

  const nodeEls = {};
  const allEdgeLines = () => svg.querySelectorAll(".edge-layer line");

  // Token node
  tokens.forEach((t) => {
    const pos = tokenPos[t.id];
    if (!pos) return;

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "token-node");
    g.setAttribute("data-id", t.id);
    g.style.cursor = "default";

    const textEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
    textEl.setAttribute("x", pos.x);
    textEl.setAttribute("y", pos.y);
    textEl.setAttribute("text-anchor", "middle");
    textEl.setAttribute("dominant-baseline", "central");
    textEl.setAttribute("font-size", "17");
    textEl.setAttribute("font-weight", "400");
    textEl.setAttribute("fill", BLACK);
    textEl.setAttribute("class", "token-label");
    textEl.textContent = t.word;
    g.appendChild(textEl);

    const normWord = normalize(t.word);
    if (normWord !== t.word.toLowerCase()) {
      const subEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
      subEl.setAttribute("x", pos.x);
      subEl.setAttribute("y", pos.y + 16);
      subEl.setAttribute("text-anchor", "middle");
      subEl.setAttribute("dominant-baseline", "central");
      subEl.setAttribute("font-size", "9");
      subEl.setAttribute("fill", "#aaaaaa");
      subEl.setAttribute("class", "token-norm");
      subEl.textContent = normWord;
      g.appendChild(subEl);
    }

    const approxH = 26;
    const approxW = t.word.length * 10 + 16;
    const hitRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    hitRect.setAttribute("x", pos.x - approxW / 2);
    hitRect.setAttribute("y", pos.y - approxH / 2);
    hitRect.setAttribute("width", approxW);
    hitRect.setAttribute("height", approxH);
    hitRect.setAttribute("fill", "transparent");
    g.appendChild(hitRect);

    labelGroup.appendChild(g);
    nodeEls[t.id] = { g, textEl };

    g.addEventListener("mouseenter", () => {
      state.hovered = t.id;
      state.hoveredChildren = outgoingEdges[t.id].map((e) => e.targetId);
      applyState(nodeEls, allEdgeLines);
    });

    g.addEventListener("mouseleave", () => {
      state.hovered = "";
      state.hoveredChildren = [];
      applyState(nodeEls, allEdgeLines);
    });

    g.addEventListener("click", () => {
      writer.innerHTML += t.word + " ";
      state.selected.push(t.id);
      state.selectedChildren = outgoingEdges[t.id].map((e) => e.targetId);
      // hovered state resets on click — the next mouseenter will re-populate it
      state.hovered = "";
      state.hoveredChildren = [];
      applyState(nodeEls, allEdgeLines);
    });
  });

  // Row header hover (highlight tokens in the hovered POS row)
  hitrect.addEventListener("mousemove", (e) => {
    const mouseY = e.clientY - svg.getBoundingClientRect().top;
    const p = COL_ORDER.reduce((best, col) =>
      Math.abs(rowY[col] - mouseY) < Math.abs(rowY[best] - mouseY) ? col : best,
    );
    headerGroup.querySelectorAll("text").forEach((el) => el.setAttribute("fill", LIGHT_GRAY));
    headerGroup.querySelector(`#rowheader-${p}`).setAttribute("fill", BLACK);
    // dim everything except nodes in this POS row
    Object.entries(nodeEls).forEach(([id, { textEl }]) => {
      id = parseInt(id);
      const tok = tokens.find((t) => t.id === id);
      textEl.setAttribute("fill", tok?.pos === p ? BLACK : "#ccc");
    });
    dimArrows(allEdgeLines());
  });

  hitrect.addEventListener("mouseleave", () => {
    headerGroup.querySelectorAll("text").forEach((el) => el.setAttribute("fill", LIGHT_GRAY));
    applyState(nodeEls, allEdgeLines);
  });
}

//helpers
function buildTokenPositions(tokens, rowY, colW) {
  const tokenPos = {};
  tokens.forEach((t, i) => {
    tokenPos[t.id] = {
      x: PAD_L + i * colW + colW / 2,
      y: rowY[t.pos],
    };
  });
  return tokenPos;
}

function buildNormToIds(tokens) {
  const map = new Map();
  tokens.forEach((t) => {
    const n = normalize(t.word);
    if (!map.has(n)) map.set(n, []);
    map.get(n).push(t.id);
  });
  return map;
}

function drawEdges(tokens, bigramIndex, normToIds, tokenPos, edgeGroupBlack, edgeGroupBlue) {
  const outgoingEdges = Object.fromEntries(tokens.map(t => [t.id, []]));
  const GAP = 12;

  tokens.forEach((fromTok, fromIdx) => {
    const fromNorm = normalize(fromTok.word);
    const followerNorms = bigramIndex.get(fromNorm);
    if (!followerNorms) return;

    followerNorms.forEach((toNorm) => {
      (normToIds.get(toNorm) || []).forEach((toId) => {
        if (toId === fromTok.id) return;

        const a = tokenPos[fromTok.id];
        const b = tokenPos[toId];
        if (!a || !b) return;

        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) return;

        const toIdx = tokens.findIndex(t => t.id === toId);
        const isImmediate = toIdx === fromIdx + 1;
        if (showOriginalOnly && !isImmediate) return;
        const color = isImmediate ? BLACK : LIGHT_BLUE;
        const marker = isImmediate ? "url(#arr-black)" : "url(#arr-blue)";
        const nx = dx / len, ny = dy / len;

        const lineEl = line(
          isImmediate ? edgeGroupBlack : edgeGroupBlue,
          a.x + nx * GAP, a.y + ny * GAP,
          b.x - nx * (GAP + 6), b.y - ny * (GAP + 6),
          color, isImmediate ? 1 : 0.7, marker,
        );
        lineEl.style.transition = "opacity 0.2s ease, stroke 0.2s ease";
        lineEl.dataset.fromId = fromTok.id;
        lineEl.dataset.toId = toId;
        lineEl.dataset.immediate = isImmediate ? "1" : "0";

        outgoingEdges[fromTok.id].push({ lineEl, targetId: toId, isImmediate });
      });
    });
  });

  return outgoingEdges;
}

function dimArrows(arrows) {
  arrows.forEach(el => { el.style.opacity = "0.08"; });
}
function restoreEdge(el) {
  const isImmediate = el.dataset.immediate === "1";
  el.setAttribute("stroke", isImmediate ? BLACK : "#7bafd4");
  el.setAttribute("marker-end", isImmediate ? "url(#arr-black)" : "url(#arr-blue)");
  el.style.opacity = "1.0"
}
