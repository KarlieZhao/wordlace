import { drawText, line, mkDefs, mkArrowMarker } from "./svgutils";
import { COL_ORDER, COL_LABELS, normalize } from "./words";
import { showOriginalOnly } from "./main";

const PAD_L = 80, PAD_R = 20, PAD_T = 60, PAD_B = 50;
let PALETTE = {
  LIGHT_BLUE: "#043f6c",
  BLACK: "#6f5201",
  LIGHT_GRAY: "#b0b0b0",
  RED: "#955151",
};

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

 const DEP_LABELS_ZH = {
   nsubj: "主语",
   obj: "直接宾语",
   iobj: "间接宾语",
   csubj: "从句主语",
   ccomp: "从句补语",
   xcomp: "开放式从句补语",
   obl: "状语成分",
   vocative: "称呼语",
   expl: "虚位主语",
   dislocated: "移位成分",
   advcl: "状语从句",
   advmod: "状语修饰",
   discourse: "话语成分",
   aux: "助动词",
   cop: "系动词",
   mark: "标记词",
   nmod: "名词修饰",
   appos: "同位语",
   nummod: "数词修饰",
   acl: "定语从句",
   amod: "形容词修饰",
   det: "限定词",
   clf: "量词",
   case: "格标记",
   conj: "并列项",
   cc: "并列连词",
   fixed: "固定短语",
   flat: "扁平结构",
   compound: "复合词",
   list: "列表",
   parataxis: "并列结构",
   orphan: "孤立成分",
   goeswith: "拼写连写",
   reparandum: "自我修正",
   punct: "标点",
   root: "句子根",
   dep: "未指定依存关系",
   relcl: "关系从句",
   prep: "介词修饰",
   pobj: "介词宾语",
   poss: "所属修饰",
   attr: "属性",
   neg: "否定",
   agent: "施事",
   pcomp: "介词补语",
   dobj: "直接宾语",
   nsubjpass: "被动主语",
   auxpass: "被动助动词",
   oprd: "宾语补足语",
   meta: "元信息",
   intj: "感叹词",
   quantmod: "量词修饰",
   predet: "前限定词",
   preconj: "前并列词",
   npadvmod: "名词短语状语",
   prt: "小品词",
   nn: "名词修饰",
   acomp: "形容词补语",
 };

const state = {
  selected: [],
  selectedChildren: [],
  hovered: "",
  hoveredChildren: [],
  language: "zh",
};

if (state.language === "en") {
 
  PALETTE = {
    LIGHT_BLUE: "#59a1d7",
    BLACK: "#d0af57",
    LIGHT_GRAY: "#646464",
    RED: "#d76f6f",
  };
} else {
   PALETTE = {
    LIGHT_BLUE: "#043f6c",
    BLACK: "#6f5201",
    LIGHT_GRAY: "#b0b0b0",
    RED: "#955151",
  };

}
function applyState(nodeEls, allEdgeLines, allEdgeLabels) {
  const { selected, selectedChildren, hovered, hoveredChildren } = state;
  const lastSelected = selected[selected.length - 1];
  const hasSelection = selected.length > 0;
  const hasHover = hovered !== "";
    const labelSet = state.language === "zh" ? DEP_LABELS_ZH : DEP_LABELS;


  if (!hasSelection && !hasHover) {
    Object.values(nodeEls).forEach(({ textEl }) =>
      textEl.setAttribute("fill", PALETTE.BLACK),
    );
    allEdgeLines().forEach((el) => restoreEdge(el));
    allEdgeLabels().forEach(
      (el) => (el.textContent = labelSet[el.dataset.dep]),
    );
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
    textEl.setAttribute(
      "fill",
      isSelected ? PALETTE.RED : litIds.has(id) ? PALETTE.BLACK : PALETTE.LIGHT_GRAY,
    );
    g.style.pointerEvents = isClickable && !isSelected ? "auto" : "none";
  });

  allEdgeLines().forEach((el) => {
    const fromId = parseInt(el.dataset.fromId);
    const fromLastSelected = hasSelection && fromId === lastSelected;
    const fromHovered = hasHover && fromId === hovered;

    if (fromLastSelected) {
      el.style.opacity = "1";
      restoreEdge(el);
    } else if (fromHovered) {
      el.style.opacity = "0.5";
      restoreEdge(el);
    } else {
      el.style.opacity = "0.08";
    }
  });

  allEdgeLabels().forEach((el) => {
    const fromId = parseInt(el.dataset.fromId);
    const fromLastSelected = hasSelection && fromId === lastSelected;
    const fromHovered = hasHover && fromId === hovered;
    // console.log(fromHovered, fromId, fromLastSelected)
    // if (fromLastSelected || fromHovered) {
    //   el.textContent = labelSet[el.dataset.dep];
    // } else {
      el.textContent = labelSet[el.dataset.dep];
    // }
  });


}
export function drawColumn(tokens) {
  const writer = document.getElementById("writer");
  const svg = document.getElementById("svg");
  if (state.language === "en") svg.style.backgroundColor = "#333";
  svg.innerHTML = "";

  const W = svg.clientWidth * 1.1 || 800;
  const H = svg.clientHeight || 600;
  const colCount = COL_ORDER.length;
  if (!colCount) return;

  const colW = 60; //Math.min(100, (W - PAD_L - PAD_R) / Math.max(colCount - 1, 1));
  const rowH = (H - PAD_T - PAD_B) / Math.max(tokens.length, 1);

  const colX = Object.fromEntries(
    COL_ORDER.map((p, i) => [p, PAD_L + i * colW]),
  );
  const tokenPos = buildTokenPositions(tokens, colX, rowH);

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.style.height = "";

  const defs = mkDefs(svg);
  mkArrowMarker(defs, "arr-black", PALETTE.BLACK);
  mkArrowMarker(defs, "arr-blue", PALETTE.LIGHT_BLUE);

  // col headers
  const headerGroup = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "g",
  );
  headerGroup.setAttribute("pointer-events", "none");
  COL_ORDER.forEach((p) => {
    drawText(
      headerGroup,
      `rowheader-${p}`,
      colX[p],
      PAD_T - 10,
      COL_LABELS[p] || p,
      11,
      400,
      PALETTE.LIGHT_GRAY,
      "middle",
      "IBM Plex Mono",
    );
  });
  svg.appendChild(headerGroup);

  const hitrect = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "rect",
  );
  hitrect.setAttribute("fill", "transparent");
  requestAnimationFrame(() => {
    const pad = { x: 12, y: 8 };
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

  const labelGroup = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "g",
  );
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

    const textEl = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text",
    );
    textEl.setAttribute("x", pos.x);
    textEl.setAttribute("y", pos.y);
    textEl.setAttribute("text-anchor", "middle");
    textEl.setAttribute("dominant-baseline", "central");
    textEl.setAttribute("font-size", "12");
    textEl.setAttribute("font-weight", "400");
    textEl.setAttribute("fill", PALETTE.BLACK);
    textEl.setAttribute("class", "token-label");
    textEl.textContent = t.word;
    g.appendChild(textEl);

    const normWord = normalize(t.word);
    if (normWord !== t.word.toLowerCase()) {
      const subEl = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );
      subEl.setAttribute("x", pos.x + 16);
      subEl.setAttribute("y", pos.y);
      subEl.setAttribute("text-anchor", "start");
      subEl.setAttribute("dominant-baseline", "central");
      subEl.setAttribute("font-size", "9");
      subEl.setAttribute("fill", "#aaaaaa");
      subEl.textContent = normWord;
      g.appendChild(subEl);
    }

    const approxH = 26,
      approxW = t.word.length * 10 + 16;
    const hitRect = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
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

  // col header hover
  // find nearest POS column by mouseX
  hitrect.addEventListener("mousemove", (e) => {
    const mouseX = e.clientX - svg.getBoundingClientRect().left;
    const p = COL_ORDER.reduce((best, col) =>
      Math.abs(colX[col] - mouseX) < Math.abs(colX[best] - mouseX) ? col : best,
    );
    headerGroup
      .querySelectorAll("text")
      .forEach((el) => el.setAttribute("fill", PALETTE.LIGHT_GRAY));
    headerGroup.querySelector(`#rowheader-${p}`).setAttribute("fill", PALETTE.BLACK);
    Object.entries(nodeEls).forEach(([id, { textEl }]) => {
      id = parseInt(id);
      const tok = tokens.find((t) => t.id === id);
      textEl.setAttribute("fill", tok?.pos === p ? PALETTE.BLACK : "#ccc");
    });
    dimArrows(allEdgeLines());
  });
  hitrect.addEventListener("mouseleave", () => {
    headerGroup
      .querySelectorAll("text")
      .forEach((el) => el.setAttribute("fill", PALETTE.LIGHT_GRAY));
    applyState(nodeEls, allEdgeLines, allEdgeLabels);
  });
}

// helpers
function buildTokenPositions(tokens, colX, rowH) {
  const tokenPos = {};
  tokens.forEach((t, i) => {
    // X from POS category, Y from token order
    tokenPos[t.id] = { x: colX[t.pos], y: PAD_T + i * rowH + rowH / 2 };
  });
  return tokenPos;
}

function drawDepEdges(tokens, tokenPos, edgeGroup) {
  const outgoingEdges = Object.fromEntries(tokens.map((t) => [t.id, []]));
  const GAP = 12;

  const labelSet = state.language === "zh" ? DEP_LABELS_ZH : DEP_LABELS;
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
        PALETTE.BLACK, 1, "url(#arr-black)",
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
    if (tok.head_id === tok.id) return;

    const a = tokenPos[tok.id];
    const b = tokenPos[tok.head_id];
    if (!a || !b) return;

    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;

    const nx = dx / len, ny = dy / len;

    // "Downward" in the new layout = higher token index = larger Y
    const isDownward = tok.head_id > tok.id;
    const color = isDownward ? PALETTE.BLACK : PALETTE.LIGHT_BLUE;
    const marker = isDownward ? "url(#arr-black)" : "url(#arr-blue)";

    const lineEl = line(
      edgeGroup,
      a.x + nx * GAP, a.y + ny * GAP,
      b.x - nx * (GAP + 6), b.y - ny * (GAP + 6),
      color, isDownward ? 1 : 0.7, marker,
    );
    lineEl.style.transition = "opacity 0.2s ease";
    lineEl.dataset.fromId = tok.id;
    lineEl.dataset.toId = tok.head_id;
    lineEl.dataset.immediate = isDownward ? "1" : "0";
    lineEl.dataset.dep = tok.dep;
    lineEl.style.cursor = "pointer";

    const midX = (a.x + nx * GAP + b.x - nx * (GAP + 6)) / 2;
    const midY = (a.y + ny * GAP + b.y - ny * (GAP + 6)) / 2;

    const labelEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
    labelEl.setAttribute("x", midX);
    labelEl.setAttribute("y", midY - 5);
    labelEl.setAttribute("text-anchor", "middle");
    labelEl.setAttribute("font-size", "9");
    labelEl.setAttribute("font-family", "IBM Plex Mono");
    labelEl.setAttribute("fill", PALETTE.LIGHT_GRAY);
    labelEl.setAttribute("pointer-events", "none");
    labelEl.dataset.fromId = tok.id;
    labelEl.dataset.dep = tok.dep;
    labelEl.textContent = labelSet[tok.dep];
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
  el.setAttribute("stroke", isImmediate ? PALETTE.BLACK : "#7bafd4");
  el.setAttribute("marker-end", isImmediate ? "url(#arr-black)" : "url(#arr-blue)");
  el.style.opacity = "1.0";
}