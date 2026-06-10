import { drawText, line, mkDefs, mkArrowMarker } from "./svgutils";
import { COL_ORDER, COL_LABELS, normalize } from "./words";
import { showOriginalOnly } from "./main";

// maybe we don't show the dependcy terms on the graph since it's a bit too rigid
// language A - B - C ...
// automatically translating and shifting towards another languange word by word

// TODO:
// add a button for translation / comparing side by side / overlapping
// make it an animation, with my own writing, make it personal, about the friction in language and translations

const PAD_L = 80,
  PAD_R = 20,
  PAD_T = 60,
  PAD_B = 50;
const HIDDEN_DEPS = new Set(["punct"]);

const PALETTE_EN = {
  LIGHT_BLUE: "#043f6c",
  BLACK: "#6f5201",
  LIGHT_GRAY: "#b0b0b0",
  RED: "#955151",
};

const PALETTE_ZH = {
  LIGHT_BLUE: "#043f6c",
  BLACK: "#6f5201",
  LIGHT_GRAY: "#b0b0b0",
  RED: "#955151",
};

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

class GraphState {
  constructor(language = "en") {
    this.selected = [];
    this.selectedChildren = [];
    this.hovered = "";
    this.hoveredChildren = [];
    this.language = language;
  }

  get palette() {
    return this.language === "en" ? PALETTE_EN : PALETTE_ZH;
  }

  get labelSet() {
    return this.language === "zh" ? DEP_LABELS_ZH : DEP_LABELS;
  }

  get lastSelected() {
    return this.selected[this.selected.length - 1];
  }

  get hasSelection() {
    return this.selected.length > 0;
  }

  get hasHover() {
    return this.hovered !== "";
  }

  get litIds() {
    return new Set([
      ...this.selected,
      ...this.selectedChildren,
      ...(this.hasHover ? [this.hovered, ...this.hoveredChildren] : []),
    ]);
  }

  selectToken(id, children) {
    this.selected.push(id);
    this.selectedChildren = children;
    this.hovered = "";
    this.hoveredChildren = [];
  }

  hoverToken(id, children) {
    this.hovered = id;
    this.hoveredChildren = children;
  }

  clearHover() {
    this.hovered = "";
    this.hoveredChildren = [];
  }
}

class TokenNode {
  constructor(svg, token, pos, state) {
    this.token = token;
    this.pos = pos;
    this.state = state;
    this.g = this._buildGroup(svg);
    this.textEl = this.g.querySelector(".token-label");
  }

  _buildGroup(svg) {
    const { x, y } = this.pos;
    const t = this.token;
    const pal = this.state.palette;

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "token-node");
    g.setAttribute("data-id", t.id);
    g.style.cursor = "default";

    const textEl = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text",
    );
    textEl.setAttribute("x", x);
    textEl.setAttribute("y", y);
    textEl.setAttribute("text-anchor", "middle");
    textEl.setAttribute("dominant-baseline", "central");
    textEl.setAttribute("font-size", "12");
    textEl.setAttribute("font-weight", "400");
    textEl.setAttribute("fill", pal.BLACK);
    textEl.setAttribute("class", "token-label");
    textEl.textContent = t.word;
    g.appendChild(textEl);

    const normWord = normalize(t.word);
    if (normWord !== t.word.toLowerCase()) {
      const subEl = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );
      subEl.setAttribute("x", x + 16);
      subEl.setAttribute("y", y);
      subEl.setAttribute("text-anchor", "start");
      subEl.setAttribute("dominant-baseline", "central");
      subEl.setAttribute("font-size", "9");
      subEl.setAttribute("fill", "#aaaaaa");
      subEl.textContent = normWord;
      g.appendChild(subEl);
    }

    const approxH = 26;
    const approxW = t.word.length * 10 + 16;
    const hitRect = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
    hitRect.setAttribute("x", x - approxW / 2);
    hitRect.setAttribute("y", y - approxH / 2);
    hitRect.setAttribute("width", approxW);
    hitRect.setAttribute("height", approxH);
    hitRect.setAttribute("fill", "transparent");
    g.appendChild(hitRect);

    return g;
  }

  setFill(color) {
    this.textEl.setAttribute("fill", color);
  }

  setPointerEvents(value) {
    this.g.style.pointerEvents = value;
  }
}


class Edges {
  constructor(svg, tokens, tokenPos, state) {
    this.svg = svg;
    this.tokens = tokens;
    this.tokenPos = tokenPos;
    this.state = state;
    this.group = this._createGroup();
    this.outgoingEdges = showOriginalOnly
      ? this._drawSequentialEdges()
      : this._drawDepEdges();
  }

  _createGroup() {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "edge-layer");
    this.svg.appendChild(g);
    return g;
  }

  getLines() {
    return this.svg.querySelectorAll(".edge-layer line");
  }

  getLabels() {
    return this.svg.querySelectorAll(".edge-layer text");
  }

  _drawSequentialEdges() {
    const GAP = 12;
    const pal = this.state.palette;
    const outgoing = Object.fromEntries(this.tokens.map((t) => [t.id, []]));

    this.tokens.forEach((tok, i) => {
      const next = this.tokens[i + 1];
      if (!next) return;

      const a = this.tokenPos[tok.id];
      const b = this.tokenPos[next.id];
      if (!a || !b) return;

      const [nx, ny, len] = this._unitVector(a, b);
      if (len < 1) return;

      const lineEl = line(
        this.group,
        a.x + nx * GAP,
        a.y + ny * GAP,
        b.x - nx * (GAP + 6),
        b.y - ny * (GAP + 6),
        pal.BLACK,
        1,
        "url(#arr-black)",
      );
      lineEl.style.transition = "opacity 0.2s ease";
      lineEl.dataset.fromId = tok.id;
      lineEl.dataset.toId = next.id;
      lineEl.dataset.immediate = "1";
      outgoing[tok.id].push({ lineEl, targetId: next.id });
    });

    return outgoing;
  }

  _drawDepEdges() {
    const GAP = 12;
    const pal = this.state.palette;
    const labelSet = this.state.labelSet;
    const outgoing = Object.fromEntries(this.tokens.map((t) => [t.id, []]));

    this.tokens.forEach((tok) => {
      if (HIDDEN_DEPS.has(tok.dep)) return;
      if (tok.head_id === tok.id) return;

      const a = this.tokenPos[tok.id];
      const b = this.tokenPos[tok.head_id];
      if (!a || !b) return;

      const [nx, ny, len] = this._unitVector(a, b);
      if (len < 1) return;

      const isDownward = tok.head_id > tok.id;
      const color = isDownward ? pal.BLACK : pal.LIGHT_BLUE;
      const marker = isDownward ? "url(#arr-black)" : "url(#arr-blue)";

      const lineEl = line(
        this.group,
        a.x + nx * GAP,
        a.y + ny * GAP,
        b.x - nx * (GAP + 6),
        b.y - ny * (GAP + 6),
        color,
        isDownward ? 1 : 0.7,
        marker,
      );
      lineEl.style.transition = "opacity 0.2s ease";
      lineEl.dataset.fromId = tok.id;
      lineEl.dataset.toId = tok.head_id;
      lineEl.dataset.immediate = isDownward ? "1" : "0";
      lineEl.dataset.dep = tok.dep;
      lineEl.style.cursor = "pointer";

      const midX = (a.x + nx * GAP + b.x - nx * (GAP + 6)) / 2;
      const midY = (a.y + ny * GAP + b.y - ny * (GAP + 6)) / 2;

      const labelEl = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );
      labelEl.setAttribute("x", midX);
      labelEl.setAttribute("y", midY - 5);
      labelEl.setAttribute("text-anchor", "middle");
      labelEl.setAttribute("font-size", "9");
      labelEl.setAttribute("font-family", "IBM Plex Mono");
      labelEl.setAttribute("fill", pal.LIGHT_GRAY);
      labelEl.setAttribute("pointer-events", "none");
      labelEl.dataset.fromId = tok.id;
      labelEl.dataset.dep = tok.dep;
      labelEl.textContent = labelSet[tok.dep];
      this.group.appendChild(labelEl);

      outgoing[tok.id].push({ lineEl, targetId: tok.head_id });
    });

    return outgoing;
  }

  _unitVector(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    return [dx / len, dy / len, len];
  }

  dimAll() {
    this.getLines().forEach((el) => {
      el.style.opacity = "0.08";
    });
  }

  restoreEdge(el) {
    const isImmediate = el.dataset.immediate === "1";
    const pal = this.state.palette;
    el.setAttribute("stroke", isImmediate ? pal.BLACK : "#7bafd4");
    el.setAttribute(
      "marker-end",
      isImmediate ? "url(#arr-black)" : "url(#arr-blue)",
    );
    el.style.opacity = "1.0";
  }
}

// ─── ColumnHeader ──────────────────────────────────────────────────────────────

class ColumnHeader {
  constructor(svg, colX, state) {
    this.svg = svg;
    this.colX = colX;
    this.state = state;
    this.group = this._buildGroup();
    this.hitRect = this._buildHitRect();
  }

  _buildGroup() {
    const pal = this.state.palette;
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("pointer-events", "none");

    COL_ORDER.forEach((p) => {
      drawText(
        g,
        `rowheader-${p}`,
        this.colX[p],
        PAD_T - 10,
        COL_LABELS[p] || p,
        11,
        400,
        pal.LIGHT_GRAY,
        "middle",
        "IBM Plex Mono",
      );
    });

    this.svg.appendChild(g);
    return g;
  }

  _buildHitRect() {
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("fill", "transparent");

    requestAnimationFrame(() => {
      const pad = { x: 12, y: 8 };
      const bbox = this.group.getBBox();
      rect.setAttribute("x", bbox.x - pad.x);
      rect.setAttribute("y", bbox.y - pad.y);
      rect.setAttribute("width", bbox.width + pad.x * 2);
      rect.setAttribute("height", bbox.height + pad.y * 2);
    });

    this.svg.appendChild(rect);
    return rect;
  }

  dimAll() {
    const pal = this.state.palette;
    this.group
      .querySelectorAll("text")
      .forEach((el) => el.setAttribute("fill", pal.LIGHT_GRAY));
  }

  highlight(posTag) {
    const pal = this.state.palette;
    this.dimAll();
    const el = this.group.querySelector(`#rowheader-${posTag}`);
    if (el) el.setAttribute("fill", pal.BLACK);
  }
}

export class DependencyGraph {
  constructor(language = "en") {
    this.state = new GraphState(language);
    this.writer = document.getElementById("writer");
    this.svg = document.getElementById("svg");
    this.nodeMap = {}; // id → TokenNode
    this.edgeLayer = null;
    this.header = null;
  }

  draw(tokens) {
    this.svg.innerHTML = "";
    this.nodeMap = {};

    const W = this.svg.clientWidth * 1.1 || 800;
    const H = this.svg.clientHeight || 600;
    console.log(W, H);
    const colCount = COL_ORDER.length;
    if (!colCount) return;

    const colW = 60;
    const rowH = (H - PAD_T - PAD_B) / Math.max(tokens.length, 1);

    const colX = Object.fromEntries(
      COL_ORDER.map((p, i) => [p, PAD_L + i * colW]),
    );
    const tokenPos = this._buildTokenPositions(tokens, colX, rowH);

    this.svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    this.svg.style.height = "";

    const defs = mkDefs(this.svg);
    const pal = this.state.palette;
    mkArrowMarker(defs, "arr-black", pal.BLACK);
    mkArrowMarker(defs, "arr-blue", pal.LIGHT_BLUE);

    this.header = new ColumnHeader(this.svg, colX, this.state);
    this.edgeLayer = new Edges(this.svg, tokens, tokenPos, this.state);

    const labelGroup = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g",
    );
    labelGroup.setAttribute("class", "label-layer");
    this.svg.appendChild(labelGroup);

    tokens.forEach((t) => {
      const pos = tokenPos[t.id];
      if (!pos) return;
      const node = new TokenNode(this.svg, t, pos, this.state);
      labelGroup.appendChild(node.g);
      this.nodeMap[t.id] = node;
      this._attachTokenEvents(node, t);
    });

    this._attachHeaderEvents(tokens, colX);
    this._applyState();
  }

  
  _buildTokenPositions(tokens, colX, rowH) {
    const positions = {};
    tokens.forEach((t, i) => {
      positions[t.id] = {
        x: colX[t.pos],
        y: PAD_T + i * rowH + rowH / 2,
      };
    });
    return positions;
  }

  _attachTokenEvents(node, token) {
    const { g } = node;
    const outgoing = this.edgeLayer.outgoingEdges;

    g.addEventListener("mouseenter", () => {
      this.state.hoverToken(
        token.id,
        outgoing[token.id].map((e) => e.targetId),
      );
      this._applyState();
    });

    g.addEventListener("mouseleave", () => {
      this.state.clearHover();
      this._applyState();
    });

    g.addEventListener("click", () => {
      this.writer.innerHTML += token.word + " ";
      this.state.selectToken(
        token.id,
        outgoing[token.id].map((e) => e.targetId),
      );
      this._applyState();
    });
  }

  _attachHeaderEvents(tokens, colX) {
    const { hitRect } = this.header;

    hitRect.addEventListener("mousemove", (e) => {
      const mouseX = e.clientX - this.svg.getBoundingClientRect().left;
      const nearestPos = COL_ORDER.reduce((best, col) =>
        Math.abs(colX[col] - mouseX) < Math.abs(colX[best] - mouseX)
          ? col
          : best,
      );
      this.header.highlight(nearestPos);
      const pal = this.state.palette;
      Object.values(this.nodeMap).forEach((node) => {
        const fill = node.token.pos === nearestPos ? pal.BLACK : "#ccc";
        node.setFill(fill);
      });
      this.edgeLayer.dimAll();
    });

    hitRect.addEventListener("mouseleave", () => {
      this.header.dimAll();
      this._applyState();
    });
  }

  _applyState() {
    const { state } = this;
    const pal = state.palette;
    const labelSet = state.labelSet;

    if (!state.hasSelection && !state.hasHover) {
      Object.values(this.nodeMap).forEach((node) => node.setFill(pal.BLACK));
      this.edgeLayer.getLines().forEach((el) => this.edgeLayer.restoreEdge(el));
      this.edgeLayer.getLabels().forEach((el) => {
        el.textContent = labelSet[el.dataset.dep];
      });
      return;
    }

    const litIds = state.litIds;

    Object.entries(this.nodeMap).forEach(([id, node]) => {
      id = parseInt(id);
      const isSelected = state.selected.includes(id);
      const isClickable =
        !state.hasSelection || state.selectedChildren.includes(id);

      node.setFill(
        isSelected ? pal.RED : litIds.has(id) ? pal.BLACK : pal.LIGHT_GRAY,
      );
      node.setPointerEvents(isClickable && !isSelected ? "auto" : "none");
    });

    this.edgeLayer.getLines().forEach((el) => {
      const fromId = parseInt(el.dataset.fromId);
      const fromLastSelected =
        state.hasSelection && fromId === state.lastSelected;
      const fromHovered = state.hasHover && fromId === state.hovered;

      if (fromLastSelected) {
        el.style.opacity = "1";
        this.edgeLayer.restoreEdge(el);
      } else if (fromHovered) {
        el.style.opacity = "0.5";
        this.edgeLayer.restoreEdge(el);
      } else {
        el.style.opacity = "0.08";
      }
    });

    this.edgeLayer.getLabels().forEach((el) => {
      el.textContent = labelSet[el.dataset.dep];
    });
  }
}