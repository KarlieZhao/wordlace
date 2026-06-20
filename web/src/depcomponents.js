import { views } from "./main";
import { drawText, line, mkDefs, mkArrowMarker } from "./svgutils";
import { COL_ORDER, COL_LABELS, normalize } from "./words";
import { PAD_T } from "./weave";

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

export class GraphState {
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

export class TokenNode {
  constructor(svg, token, pos, state) {
    this.token = token;
    this.pos = pos;
    this.state = state;
    this.g = this._buildGroup();
    this.textEl = this.g.querySelector(".token-label");
  }

  _buildGroup() {
    const { x, y } = this.pos;
    const t = this.token;
    const pal = this.state.palette;

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "token-node");
    g.setAttribute("class", t.pos.toLowerCase());
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

export class Edges {
  constructor(svg, tokens, tokenPos, state) {
    this.svg = svg;
    this.tokens = tokens;
    this.tokenPos = tokenPos;
    this.state = state;
    this.group = this._createGroup();
    // this.depEdges = this._drawDepEdges();
    this.depEdges = this._drawBracketEdges();
    // this.sequentialEdges = this._drawSequentialEdges();
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

  _drawBracketEdges() {
    const GAP = 10;
    const pal = this.state.palette;

    const outgoing = Object.fromEntries(this.tokens.map((t) => [t._key, []]));

    const sentenceKeyMap = new Map();

    // rebuild id → key lookup per sentence
    this.tokens.forEach((t) => {
      const si = t._key.split("_")[0];
      if (!sentenceKeyMap.has(si)) {
        sentenceKeyMap.set(si, new Map());
      }
      sentenceKeyMap.get(si).set(t.id, t._key);
    });

    this.tokens.forEach((tok) => {
      if (HIDDEN_DEPS?.has?.(tok.dep)) return;
      if (tok.head_id === tok.id) return;

      const si = tok._key.split("_")[0];
      const headKey = sentenceKeyMap.get(si)?.get(tok.head_id);

      if (!headKey) return;

      const a = this.tokenPos[tok._key];
      const b = this.tokenPos[headKey];

      if (!a || !b) return;

      // normalize direction
      const left = a.x < b.x ? a : b;
      const right = a.x < b.x ? b : a;

      const dist = Math.abs(tok.id - tok.head_id);

      // key aesthetic controls
      const height = 14 + dist * 10;
      const shoulder = 10;

      const y = a.y;

      const d = [
        `M ${left.x} ${y}`,
        `L ${left.x + shoulder} ${y - height}`,
        `L ${right.x - shoulder} ${y - height}`,
        `L ${right.x} ${y}`,
      ].join(" ");

      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );

      path.setAttribute("d", d);
      path.setAttribute("fill", "none");

      // style (keep consistent with your system)
      path.setAttribute(
        "stroke",
        tok.head_id > tok.id ? pal.BLACK : pal.LIGHT_BLUE,
      );

      path.setAttribute("stroke-width", "2");
      path.setAttribute("opacity", "0.5");

      path.dataset.fromKey = tok._key;
      path.dataset.toKey = headKey;
      path.dataset.dep = tok.dep;

      this.group.appendChild(path);

      // label on the “bridge”
      if (views?.showDeps || views?.showDepsLocked) {
        const midX = (left.x + right.x) / 2;

        const label = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "text",
        );

        label.setAttribute("x", midX);
        label.setAttribute("y", y - height - 4);
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("font-size", "9");
        label.setAttribute("fill", pal.LIGHT_GRAY);

        label.textContent = this.state.labelSet[tok.dep];

        label.dataset.fromKey = tok._key;
        label.dataset.dep = tok.dep;

        this.group.appendChild(label);
      }

      outgoing[tok._key].push({
        targetKey: headKey,
        pathEl: path,
      });
    });

    return outgoing;
  }
  _drawSequentialEdges() {
    const PUNCT = /^[^\p{L}\p{N}]+$/u;

    for (let i = 0; i < this.tokens.length - 1; i++) {
      const curr = this.tokens[i];
      const next = this.tokens[i + 1];

      const currText = curr.word || curr.token || curr.text || "";
      const nextText = next.word || next.token || next.text || "";

      if (PUNCT.test(currText) || PUNCT.test(nextText)) continue;

      this._createEdge(curr._key, next._key, {
        color: "#ff6565",
        marker: "url(#arr-red)",
        width: 3,
        opacity: 0.3,
        showArrow: true,
      });
    }
  }

  _drawDepEdges() {
    const GAP = 12;
    const pal = this.state.palette;
    const labelSet = this.state.labelSet;
    const outgoing = Object.fromEntries(this.tokens.map((t) => [t._key, []]));
    const sentenceKeyMap = new Map();

    this.tokens.forEach((t) => {
      const si = t._key.split("_")[0];
      if (!sentenceKeyMap.has(si)) {
        sentenceKeyMap.set(si, new Map());
      }
      sentenceKeyMap.get(si).set(t.id, t._key);
    });

    this.tokens.forEach((tok) => {
      if (HIDDEN_DEPS.has(tok.dep)) return;
      if (tok.head_id === tok.id) return;

      const si = tok._key.split("_")[0];
      const headKey = sentenceKeyMap.get(si)?.get(tok.head_id);

      if (!headKey) return;

      const isDownward = tok.head_id > tok.id;
      const edge = this._createEdge(tok._key, headKey, {
        gap: GAP,
        color: isDownward ? pal.BLACK : pal.LIGHT_BLUE,
        marker: isDownward ? "url(#arr-black)" : "url(#arr-blue)",
        width: 0.8,
        dep: tok.dep,
        showArrow: false,
      });

      if (!edge) return;

      edge.dataset.immediate = isDownward ? "1" : "0";
      edge.style.cursor = "pointer";

      outgoing[tok._key].push({
        lineEl: edge,
        targetKey: headKey,
      });

      if (!(views.showDeps || views.showDepsLocked)) return;

      const a = this.tokenPos[tok._key];
      const b = this.tokenPos[headKey];

      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;

      const { text } = drawText(
        this.group,
        null,
        midX,
        midY - 5,
        labelSet[tok.dep],
        9,
        400,
        pal.LIGHT_GRAY,
        "middle",
        "IBM Plex Mono",
        "dep-labels",
      );

      text.dataset.fromKey = tok._key;
      text.dataset.dep = tok.dep;
    });

    return outgoing;
  }

  _createEdge(fromKey, toKey, opts = {}) {
    const defs = mkDefs(this.svg);
    // mkArrowMarker(defs, "arr-black", "#000");
    // mkArrowMarker(defs, "arr-blue", "#509cff");
    mkArrowMarker(defs, "arr-red", "#ff6565");
    const {
      color = "#999",
      marker = "url(#arr-black)",
      width = 1,
      gap = 0,
      opacity = 0.6,
      dep = null,
      showArrow = true,
    } = opts;

    const a = this.tokenPos[fromKey];
    const b = this.tokenPos[toKey];

    if (!a || !b) return null;

    const [nx, ny, len] = this._unitVector(a, b);
    if (len < 1) return null;

    const edge = line(
      this.group,
      a.x + nx * gap,
      a.y + ny * gap,
      b.x - nx * (gap + 6),
      b.y - ny * (gap + 6),
      color,
      width,
      showArrow ? marker : null,
    );

    edge.setAttribute("stroke", color);
    edge.style.stroke = color;

    if (!showArrow) {
      edge.removeAttribute("marker-end");
    }

    edge.dataset.fromKey = fromKey;
    edge.dataset.toKey = toKey;

    if (dep) edge.dataset.dep = dep;

    edge.style.opacity = opacity;
    edge.style.transition = "opacity 0.2s ease";

    return edge;
  }

  _unitVector(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    return [dx / len, dy / len, len];
  }

  dimAll() {
    // this.getLines().forEach((el) => (el.style.opacity = "0.08"));
  }

  restoreEdge(el) {
    const isImmediate = el.dataset.immediate === "1";
    const pal = this.state.palette;
    el.setAttribute("stroke", isImmediate ? pal.BLACK : "#7bafd4");
    // el.setAttribute(
    // "marker-end",
    // isImmediate ? "url(#arr-black)" : "url(#arr-blue)",
    // );
    // el.style.opacity = "1.0";
  }
}

export class ColumnHeader {
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
      if (p !== "PUNCT") {
        drawText(
          g,
          `rowheader-${p}`,
          this.colX[p],
          PAD_T - 20,
          COL_LABELS[p] || p,
          11,
          400,
          pal.LIGHT_GRAY,
          "middle",
          "IBM Plex Mono",
        );
      }
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
    // this.dimAll();
    // const pal = this.state.palette;
    // const el = this.group.querySelector(`#rowheader-${posTag}`);
    // if (el) el.setAttribute("fill", pal.BLACK);
  }
}

export class VerseDivider {
  constructor(svg, x1, x2, y, color) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "line");
    el.setAttribute("x1", x1);
    el.setAttribute("y1", y);
    el.setAttribute("x2", x2);
    el.setAttribute("y2", y);
    el.setAttribute("stroke", color);
    el.setAttribute("stroke-width", "0.5");
    el.setAttribute("stroke-opacity", "0.7");
    svg.appendChild(el);
  }
}
