import { drawText, line, mkDefs, mkArrowMarker } from "./svgutils";
import { COL_ORDER, COL_LABELS, normalize } from "./words";
import { showOriginalOnly } from "./main";

// collapse the same words into one label

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

//   cluster layout                    ─

function buildClusterLayout(tokens, W, H) {
  const cx = W / 2,
    cy = H / 2;

  // group tokens by POS
  const groups = {};
  tokens.forEach((t) => {
    if (!groups[t.pos]) groups[t.pos] = [];
    groups[t.pos].push(t);
  });

  const posKeys = Object.keys(groups);
  const n = posKeys.length;

  // place cluster centres on a ring
  const R = Math.min(cx, cy) * 0.52;
  const clusterCenters = {};
  posKeys.forEach((pos, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    clusterCenters[pos] = {
      x: cx + R * Math.cos(angle),
      y: cy + R * Math.sin(angle),
    };
  });

  // spread each cluster's words in a small sub-ring around its centre
  const tokenPos = {};
  posKeys.forEach((pos) => {
    const members = groups[pos];
    const cc = clusterCenters[pos];
    const m = members.length;
    if (m === 1) {
      tokenPos[members[0].id] = { x: cc.x, y: cc.y };
    } else {
      const r = Math.min(52, 16 * m);
      members.forEach((t, i) => {
        const a = (2 * Math.PI * i) / m - Math.PI / 2;
        tokenPos[t.id] = {
          x: cc.x + r * Math.cos(a),
          y: cc.y + r * Math.sin(a),
        };
      });
    }
  });

  return { tokenPos, clusterCenters, groups };
}

//   SVG helpers                     ─

function ns(tag) {
  return document.createElementNS("http://www.w3.org/2000/svg", tag);
}

function drawEdgeLine(parent, x1, y1, x2, y2, color, opacity, marker) {
  const el = ns("line");
  el.setAttribute("x1", x1);
  el.setAttribute("y1", y1);
  el.setAttribute("x2", x2);
  el.setAttribute("y2", y2);
  el.setAttribute("stroke", color);
  el.setAttribute("stroke-width", "1.2");
  el.setAttribute("opacity", opacity);
  if (marker) el.setAttribute("marker-end", marker);
  el.style.transition = "opacity 0.2s ease";
  parent.appendChild(el);
  return el;
}

//   cluster POS badge labels                 ─

function drawClusterLabels(svg, clusterCenters, W, H) {
  const cx = W / 2,
    cy = H / 2;
  const g = ns("g");
  g.setAttribute("pointer-events", "none");

  Object.entries(clusterCenters).forEach(([pos, center]) => {
    const angle = Math.atan2(center.y - cy, center.x - cx);
    const labelDist = 62;
    const lx = center.x + Math.cos(angle) * labelDist;
    const ly = center.y + Math.sin(angle) * labelDist;

    const t = ns("text");
    t.setAttribute("x", lx);
    t.setAttribute("y", ly);
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("dominant-baseline", "central");
    t.setAttribute("font-size", "10");
    t.setAttribute("font-weight", "600");
    t.setAttribute("fill", "#000");
    t.setAttribute("font-family", "IBM Plex Mono, monospace");
    t.textContent = pos;
    g.appendChild(t);
  });

  svg.appendChild(g);
}

//   main draw

export function drawColumn(tokens) {
  const writer = document.getElementById("writer");
  const svg = document.getElementById("svg");
  svg.innerHTML = "";

  const W = svg.clientWidth || 800;
  const H = svg.clientHeight || 600;

  const { tokenPos, clusterCenters, groups } = buildClusterLayout(tokens, W, H);

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.style.height = "";

  const defs = mkDefs(svg);
  mkArrowMarker(defs, "arr-black", PALETTE.BLACK);
  mkArrowMarker(defs, "arr-blue", PALETTE.LIGHT_BLUE);

  const edgeGroup = ns("g");
  edgeGroup.setAttribute("class", "edge-layer");
  svg.appendChild(edgeGroup);
  const clusterLabelGroup = ns("g");
  svg.appendChild(clusterLabelGroup);
  const nodeGroup = ns("g");
  nodeGroup.setAttribute("class", "node-layer");
  svg.appendChild(nodeGroup);

  drawClusterLabels(clusterLabelGroup, clusterCenters, W, H);

  const nodeEls = {};
  const allEdgeLines = () => svg.querySelectorAll(".edge-layer line");
  const allEdgeLabels = () => svg.querySelectorAll(".edge-layer text");

  const outgoingEdges = drawDepEdges(tokens, tokenPos, edgeGroup);

  // token nodes
  tokens.forEach((t) => {
    const pos = tokenPos[t.id];
    if (!pos) return;

    const g = ns("g");
    g.setAttribute("class", "token-node");
    g.setAttribute("data-id", t.id);
    g.style.cursor = "pointer";

    const approxW = Math.max(t.word.length * 8 + 20, 40);
    const approxH = 28;

    const textEl = ns("text");
    textEl.setAttribute("x", pos.x);
    textEl.setAttribute("y", pos.y);
    textEl.setAttribute("text-anchor", "middle");
    textEl.setAttribute("dominant-baseline", "central");
    textEl.setAttribute("font-size", "12");
    textEl.setAttribute("font-weight", "500");
    textEl.setAttribute("fill", "#000");
    textEl.setAttribute("font-family", "IBM Plex Mono, monospace");
    textEl.setAttribute("class", "token-label");
    textEl.textContent = t.word;
    g.appendChild(textEl);

    const normWord = normalize(t.word);
    if (normWord !== t.word.toLowerCase()) {
      const subEl = ns("text");
      subEl.setAttribute("x", pos.x + approxW / 2 + 4);
      subEl.setAttribute("y", pos.y);
      subEl.setAttribute("text-anchor", "start");
      subEl.setAttribute("dominant-baseline", "central");
      subEl.setAttribute("font-size", "9");
      subEl.setAttribute("fill", "#aaaaaa");
      subEl.textContent = normWord;
      g.appendChild(subEl);
    }

    const hitRect = ns("rect");
    hitRect.setAttribute("x", pos.x - approxW / 2);
    hitRect.setAttribute("y", pos.y - approxH / 2);
    hitRect.setAttribute("width", approxW);
    hitRect.setAttribute("height", approxH);
    hitRect.setAttribute("fill", "transparent");
    g.appendChild(hitRect);

    nodeGroup.appendChild(g);
    nodeEls[t.id] = { g, textEl };

    g.addEventListener("mouseenter", () => {
      state.hovered = t.id;
      state.hoveredChildren = outgoingEdges[t.id].map((e) => e.targetId);
      applyState(nodeEls, allEdgeLines, allEdgeLabels, tokens);
    });
    g.addEventListener("mouseleave", () => {
      state.hovered = "";
      state.hoveredChildren = [];
      applyState(nodeEls, allEdgeLines, allEdgeLabels, tokens);
    });
    g.addEventListener("click", () => {
      writer.innerHTML += t.word + " ";
      if (state.selected.includes(t.id)) {
        state.selected = state.selected.filter((x) => x !== t.id);
        state.selectedChildren = [];
      } else {
        state.selected = [t.id];
        state.selectedChildren = outgoingEdges[t.id].map((e) => e.targetId);
      }
      state.hovered = "";
      state.hoveredChildren = [];
      applyState(nodeEls, allEdgeLines, allEdgeLabels, tokens);
    });
  });

  applyState(nodeEls, allEdgeLines, allEdgeLabels, tokens);
}

//   dependency edges
function drawDepEdges(tokens, tokenPos, edgeGroup) {
  const outgoingEdges = Object.fromEntries(tokens.map((t) => [t.id, []]));
  const GAP = 18;
  const labelSet = state.language === "zh" ? DEP_LABELS_ZH : DEP_LABELS;

  if (showOriginalOnly) {
    tokens.forEach((tok, i) => {
      const next = tokens[i + 1];
      if (!next) return;
      const a = tokenPos[tok.id];
      const b = tokenPos[next.id];
      if (!a || !b) return;
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) return;
      const nx = dx / len,
        ny = dy / len;
      const lineEl = drawEdgeLine(
        edgeGroup,
        a.x + nx * GAP,
        a.y + ny * GAP,
        b.x - nx * (GAP + 6),
        b.y - ny * (GAP + 6),
        PALETTE.BLACK,
        "0.5",
        "url(#arr-black)",
      );
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

    const dx = b.x - a.x,
      dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;
    const nx = dx / len,
      ny = dy / len;

    const isDownward = tok.head_id > tok.id;
    const color = isDownward ? PALETTE.BLACK : PALETTE.LIGHT_BLUE;
    const marker = isDownward ? "url(#arr-black)" : "url(#arr-blue)";

    const lineEl = drawEdgeLine(
      edgeGroup,
      a.x + nx * GAP,
      a.y + ny * GAP,
      b.x - nx * (GAP + 6),
      b.y - ny * (GAP + 6),
      color,
      "0.5",
      marker,
    );
    lineEl.dataset.fromId = tok.id;
    lineEl.dataset.toId = tok.head_id;
    lineEl.dataset.immediate = isDownward ? "1" : "0";
    lineEl.dataset.dep = tok.dep;
    lineEl.style.cursor = "pointer";

    const midX = (a.x + nx * GAP + b.x - nx * (GAP + 6)) / 2;
    const midY = (a.y + ny * GAP + b.y - ny * (GAP + 6)) / 2;

    const labelEl = ns("text");
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

function applyState(nodeEls, allEdgeLines, allEdgeLabels, tokens) {
  const { selected, selectedChildren, hovered, hoveredChildren } = state;
  const lastSelected = selected[selected.length - 1];
  const hasSelection = selected.length > 0;
  const hasHover = hovered !== "";
  const labelSet = state.language === "zh" ? DEP_LABELS_ZH : DEP_LABELS;

  if (!hasSelection && !hasHover) {
    Object.entries(nodeEls).forEach(([id, { textEl, g }]) => {
      textEl.setAttribute("fill", "#000");
      textEl.setAttribute("opacity", "1");
      g.style.pointerEvents = "auto";
    });
    allEdgeLines().forEach((el) => {
      el.setAttribute("opacity", "0.5");
      restoreEdge(el);
    });
    allEdgeLabels().forEach((el) => {
      el.setAttribute("opacity", "0.7");
      el.textContent = labelSet[el.dataset.dep];
    });
    return;
  }

  const litIds = new Set([
    ...selected,
    ...selectedChildren,
    ...(hasHover ? [hovered, ...hoveredChildren] : []),
  ]);

  Object.entries(nodeEls).forEach(([id, { textEl, g }]) => {
    id = parseInt(id);
    const tok = tokens.find((t) => t.id === id);
    const isSelected = selected.includes(id);
    const isLit = litIds.has(id);

    if (isSelected) {
      textEl.setAttribute("fill", PALETTE.RED);
      textEl.setAttribute("opacity", "1");
    } else if (isLit) {
      textEl.setAttribute("opacity", "1");
    } else {
      textEl.setAttribute("opacity", "0.15");
    }

    const isClickable = !hasSelection || selectedChildren.includes(id);
    g.style.pointerEvents = isClickable && !isSelected ? "auto" : "none";
  });

  allEdgeLines().forEach((el) => {
    const fromId = parseInt(el.dataset.fromId);
    if (hasSelection && fromId === lastSelected) {
      el.setAttribute("opacity", "1");
      restoreEdge(el);
    } else if (hasHover && fromId === hovered) {
      el.setAttribute("opacity", "0.6");
      restoreEdge(el);
    } else {
      el.setAttribute("opacity", "0.05");
    }
  });

  allEdgeLabels().forEach((el) => {
    const fromId = parseInt(el.dataset.fromId);
    el.textContent = labelSet[el.dataset.dep];
    if (
      (hasSelection && fromId === lastSelected) ||
      (hasHover && fromId === parseInt(hovered))
    ) {
      el.setAttribute("opacity", "1");
    } else {
      el.setAttribute("opacity", "0.05");
    }
  });
}

function dimArrows(arrows) {
  arrows.forEach((el) => {
    el.setAttribute("opacity", "0.05");
  });
}

function restoreEdge(el) {
  const isImmediate = el.dataset.immediate === "1";
  el.setAttribute("stroke", isImmediate ? PALETTE.BLACK : PALETTE.LIGHT_BLUE);
  el.setAttribute(
    "marker-end",
    isImmediate ? "url(#arr-black)" : "url(#arr-blue)",
  );
}
