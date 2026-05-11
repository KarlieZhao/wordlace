import { drawText, line, mkDefs, mkArrowMarker } from "./svgutils";
import { COL_ORDER, COL_LABELS, normalize } from "./words";
import { showOriginalOnly } from "./main";

const PAD_L = 120, PAD_R = 20, PAD_T = 50, PAD_B = 50;
const LIGHT_BLUE = "#043f6c"; //"#b9d1e3";
const BLACK =  "#6f5201"; // "#111111";
const LIGHT_GRAY = "#b0b0b0";
const RED = "#955151";

const HIDDEN_DEPS = new Set(["punct"]);

const DEP_LABELS = {
  nsubj: "nominal subject",
  obj: "direct object",
  iobj: "indirect object",
  csubj: "clausal subject",
  ccomp: "clausal complement",
  xcomp: "open clausal complement",
  obl: "oblique nominal",
  vocative: "vocative",
  expl: "expletive",
  dislocated: "dislocated element",
  advcl: "adverbial clause modifier",
  advmod: "adverbial modifier",
  discourse: "discourse element",
  aux: "auxiliary",
  cop: "copula",
  mark: "marker",
  nmod: "nominal modifier",
  appos: "appositional modifier",
  nummod: "numeric modifier",
  acl: "adjectival clause",
  amod: "adjectival modifier",
  det: "determiner",
  clf: "classifier",
  case: "case marking",
  conj: "conjunct",
  cc: "coordinating conjunction",
  fixed: "fixed multiword expression",
  flat: "flat multiword expression",
  compound: "compound",
  list: "list",
  parataxis: "parataxis",
  orphan: "orphan",
  goeswith: "goes with",
  reparandum: "reparandum",
  punct: "punctuation",
  root: "root of sentence",
  dep: "unspecified dependency",
  relcl: "relative clause modifier",
  prep: "prepositional modifier",
  pobj: "object of preposition",
  poss: "possession modifier",
  attr: "attribute",
  neg: "negation modifier",
  agent: "agent",
  pcomp: "complement of preposition",
  dobj: "direct object",
  nsubjpass: "passive nominal subject",
  auxpass: "passive auxiliary",
  oprd: "object predicate",
  meta: "meta modifier",
  intj: "interjection",
  quantmod: "quantifier modifier",
  predet: "predeterminer",
  preconj: "preconjunct",
  npadvmod: "noun phrase adverbial modifier",
  prt: "particle",
  nn: "noun compound modifier",
  acomp: "adjectival complement",
};

const state = {
  selected: [],
  selectedChildren: [],
  hovered: "",
  hoveredChildren: [],
};

function applyState(nodeEls, allEdgeLines, allEdgeLabels) {
  const { selected, selectedChildren, hovered, hoveredChildren } = state;
  const lastSelected = selected[selected.length - 1];
  const hasSelection = selected.length > 0;
  const hasHover = hovered !== "";

  if (!hasSelection && !hasHover) {
    Object.values(nodeEls).forEach(({ textEl }) => textEl.setAttribute("fill", BLACK));
    allEdgeLines().forEach((el) => restoreEdge(el));
    allEdgeLabels().forEach((el) => el.textContent = el.dataset.dep)
    return;
  }

  const litIds = new Set([
    ...selected,
    ...selectedChildren,
    ...(hasHover ? [hovered, ...hoveredChildren] : []),
  ]);

  Object.entries(nodeEls).forEach(([id, { textEl, g }]) => {
    id = parseInt(id);
    const isSelected = selected.includes(id);
    const isClickable = !hasSelection || selectedChildren.includes(id);
    textEl.setAttribute("fill", isSelected ? RED : litIds.has(id) ? BLACK : LIGHT_GRAY);
    g.style.pointerEvents = isClickable && !isSelected ? "auto" : "none";
  });

  allEdgeLines().forEach((el) => {
    const fromId = parseInt(el.dataset.fromId);
    const fromLastSelected = hasSelection && fromId === lastSelected;
    const fromHovered = hasHover && fromId === hovered;


    if (fromLastSelected) {
      el.style.opacity = "1"; restoreEdge(el); 
    }
    else if (fromHovered) { el.style.opacity = "0.5"; restoreEdge(el); }
    else { el.style.opacity = "0.08"; }
  });

  allEdgeLabels().forEach(el => {
    const fromId = parseInt(el.dataset.fromId);
    const fromLastSelected = hasSelection && fromId === lastSelected;
    const fromHovered = hasHover && fromId === hovered;
    // console.log(fromHovered, fromId, fromLastSelected)
    if (fromLastSelected) {
      el.textContent = DEP_LABELS[el.dataset.dep]
    } else if (fromHovered) {
      el.textContent = DEP_LABELS[el.dataset.dep]
    }
    else {
      el.textContent = el.dataset.dep
    }
  })
}

export function drawColumn(tokens) {
  const writer = document.getElementById("writer");
  const svg = document.getElementById("svg");
  svg.innerHTML = "";

  const W = svg.clientWidth || 800;
  const H = svg.clientHeight || 600;
  const rowCount = COL_ORDER.length;
  if (!rowCount) return;

  const rowH = Math.min(50, (H - PAD_T - PAD_B) / Math.max(rowCount - 1, 1));
  const colW = (W - PAD_L - PAD_R) / Math.max(tokens.length, 1);

  const rowY = Object.fromEntries(COL_ORDER.map((p, i) => [p, PAD_T + i * rowH]));
  const tokenPos = buildTokenPositions(tokens, rowY, colW);

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.style.height = "";

  const defs = mkDefs(svg);
  mkArrowMarker(defs, "arr-black", BLACK);
  mkArrowMarker(defs, "arr-blue", LIGHT_BLUE);

  // row labels
  const headerGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  headerGroup.setAttribute("pointer-events", "none");
  COL_ORDER.forEach((p) => {
    drawText(headerGroup, `rowheader-${p}`, PAD_L - 10, rowY[p],
      COL_LABELS[p] || p, 11, 400, LIGHT_GRAY, "end", "IBM Plex Mono");
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

  const edgeGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  edgeGroup.setAttribute("class", "edge-layer");
  svg.appendChild(edgeGroup);

  const labelGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  labelGroup.setAttribute("class", "label-layer");
  svg.appendChild(labelGroup);

  const nodeEls = {};
  const allEdgeLines = () => svg.querySelectorAll(".edge-layer line");
  const allEdgeLabels = () => svg.querySelectorAll(".edge-layer text");

  const outgoingEdges = drawDepEdges(tokens, tokenPos, edgeGroup);

  // Token nodes
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
    textEl.setAttribute("font-size", "12");
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
      subEl.textContent = normWord;
      g.appendChild(subEl);
    }

    const approxH = 26, approxW = t.word.length * 10 + 16;
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
      applyState(nodeEls, allEdgeLines, allEdgeLabels);
    });
    g.addEventListener("mouseleave", () => {
      state.hovered = "";
      state.hoveredChildren = [];
      applyState(nodeEls, allEdgeLines, allEdgeLabels);
    });
    g.addEventListener("click", () => {
      writer.innerHTML += t.word + " ";
      state.selected.push(t.id);
      state.selectedChildren = outgoingEdges[t.id].map((e) => e.targetId);
      state.hovered = "";
      state.hoveredChildren = [];
      applyState(nodeEls, allEdgeLines, allEdgeLabels);
    });
  });

  // Row header hover
  hitrect.addEventListener("mousemove", (e) => {
    const mouseY = e.clientY - svg.getBoundingClientRect().top;
    const p = COL_ORDER.reduce((best, col) =>
      Math.abs(rowY[col] - mouseY) < Math.abs(rowY[best] - mouseY) ? col : best);
    headerGroup.querySelectorAll("text").forEach((el) => el.setAttribute("fill", LIGHT_GRAY));
    headerGroup.querySelector(`#rowheader-${p}`).setAttribute("fill", BLACK);
    Object.entries(nodeEls).forEach(([id, { textEl }]) => {
      id = parseInt(id);
      const tok = tokens.find((t) => t.id === id);
      textEl.setAttribute("fill", tok?.pos === p ? BLACK : "#ccc");
    });
    dimArrows(allEdgeLines());
  });
  hitrect.addEventListener("mouseleave", () => {
    headerGroup.querySelectorAll("text").forEach((el) => el.setAttribute("fill", LIGHT_GRAY));
    applyState(nodeEls, allEdgeLines, allEdgeLabels);
  });
}

// --- helpers ---

function buildTokenPositions(tokens, rowY, colW) {
  const tokenPos = {};
  tokens.forEach((t, i) => {
    tokenPos[t.id] = { x: PAD_L + i * colW + colW / 2, y: rowY[t.pos] };
  });
  return tokenPos;
}

function drawDepEdges(tokens, tokenPos, edgeGroup) {
  const outgoingEdges = Object.fromEntries(tokens.map((t) => [t.id, []]));
  const GAP = 12;
  const tokenById = Object.fromEntries(tokens.map((t) => [t.id, t]));

  if (showOriginalOnly) {
    tokens.forEach((tok, i) => {
      const next = tokens[i + 1];
      if (!next) return;
      const a = tokenPos[tok.id];
      const b = tokenPos[next.id];
      if (!a || !b) return;
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) return;
      const nx = dx / len, ny = dy / len;
      const lineEl = line(
        edgeGroup,
        a.x + nx * GAP, a.y + ny * GAP,
        b.x - nx * (GAP + 6), b.y - ny * (GAP + 6),
        BLACK, 1, "url(#arr-black)",
      );
      lineEl.style.transition = "opacity 0.2s ease";
      lineEl.dataset.fromId = tok.id;
      lineEl.dataset.toId = next.id;
      lineEl.dataset.immediate = "1";
      outgoingEdges[tok.id].push({ lineEl, targetId: next.id });
    });
    return outgoingEdges;
  }
  tokens.forEach((tok) => {
    if (HIDDEN_DEPS.has(tok.dep)) return;
    // Skip root (head points to itself)
    if (tok.head_id === tok.id) return;

    const a = tokenPos[tok.id];
    const b = tokenPos[tok.head_id];
    if (!a || !b) return;

    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;

    const nx = dx / len, ny = dy / len;

    // Color by dependency direction: left-arc vs right-arc
    const isRightward = tok.head_id > tok.id;
    const color = isRightward ? BLACK : LIGHT_BLUE;
    const marker = isRightward ? "url(#arr-black)" : "url(#arr-blue)";

    const lineEl = line(
      edgeGroup,
      a.x + nx * GAP, a.y + ny * GAP,
      b.x - nx * (GAP + 6), b.y - ny * (GAP + 6),
      color, isRightward ? 1 : 0.7, marker,
    );
    lineEl.style.transition = "opacity 0.2s ease";
    lineEl.dataset.fromId = tok.id;
    lineEl.dataset.toId = tok.head_id;
    lineEl.dataset.immediate = isRightward ? "1" : "0";
    lineEl.dataset.dep = tok.dep;
    lineEl.style.cursor = "pointer";

    // Dep label tag shown along the edge midpoint
    const midX = (a.x + nx * GAP + b.x - nx * (GAP + 6)) / 2;
    const midY = (a.y + ny * GAP + b.y - ny * (GAP + 6)) / 2;

    const labelEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
    labelEl.setAttribute("x", midX);
    labelEl.setAttribute("y", midY - 5);
    labelEl.setAttribute("text-anchor", "middle");
    labelEl.setAttribute("font-size", "9");
    labelEl.setAttribute("font-family", "IBM Plex Mono");
    labelEl.setAttribute("fill", LIGHT_GRAY);
    labelEl.setAttribute("pointer-events", "none");
    labelEl.dataset.fromId = tok.id;
    labelEl.dataset.dep = tok.dep;
    labelEl.textContent = tok.dep;
    edgeGroup.appendChild(labelEl);
    outgoingEdges[tok.id].push({ lineEl, targetId: tok.head_id });
  });

  return outgoingEdges;
}

function dimArrows(arrows) {
  arrows.forEach((el) => { el.style.opacity = "0.08"; });
}

function restoreEdge(el) {
  const isImmediate = el.dataset.immediate === "1";
  el.setAttribute("stroke", isImmediate ? BLACK : "#7bafd4");
  el.setAttribute("marker-end", isImmediate ? "url(#arr-black)" : "url(#arr-blue)");
  el.style.opacity = "1.0";
}