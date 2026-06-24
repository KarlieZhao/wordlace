import { views } from "./main";
import { drawText, line, mkDefs, mkArrowMarker } from "./svgutils";
import { COL_ORDER, COL_LABELS, normalize } from "./words";
import { PAD_T } from "./weave";
import { PALETTE } from "./palette";

const HIDDEN_DEPS = new Set(["punct"]);
const SVGNS = "http://www.w3.org/2000/svg";

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
    this.svg = svg
    this.token = token;
    this.pos = pos;
    this.state = state;
    this.g = this._buildGroup();
    this.textEl = this.g.querySelector(".token-label");
  }

  _buildGroup() {
    const { x, y } = this.pos;
    const t = this.token;

    const g = document.createElementNS(SVGNS, "g");
    g.setAttribute("class", "token-node");
    g.setAttribute("class", t.pos.toLowerCase());
    g.setAttribute("data-id", t.id);
    g.style.cursor = "default";

    const nodeColor = PALETTE.POS[this.token.pos] ?? PALETTE.black;
    
    const textEl = document.createElementNS(SVGNS, "text");
    textEl.setAttribute("x", x);
    textEl.setAttribute("y", y);
    textEl.setAttribute("text-anchor", "middle");
    textEl.setAttribute("dominant-baseline", "central");
    textEl.setAttribute("font-size", "12");
    textEl.setAttribute("font-weight", "400");
    textEl.setAttribute("fill", nodeColor);
    textEl.classList.add("token-label");
    if (["NOUN", "VERB"].includes(this.token.pos)){
      textEl.classList.add("strong");
    }
    textEl.textContent = t.word;
    g.appendChild(textEl);

    // attempt at using dom divs instead of svg text
    // for easy google translate -- outcome isnt great

    // const textEl = document.createElement("div")
    // textEl.style.left = 170 + x + 'px';
    // textEl.style.top = y+80 + 'px';
    // textEl.setAttribute("fill", pal.BLACK);
    // textEl.setAttribute("class", "token-label");
    // textEl.textContent = t.word;
    // this.svg.parentElement.appendChild(textEl);

    const normWord = normalize(t.word);
    if (normWord !== t.word.toLowerCase()) {
      const subEl = document.createElementNS(SVGNS, "text");
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
    const hitRect = document.createElementNS(SVGNS, "rect");
    hitRect.setAttribute("x", x - approxW / 2);
    hitRect.setAttribute("y", y - approxH / 2);
    hitRect.setAttribute("width", approxW);
    hitRect.setAttribute("height", approxH);
    hitRect.setAttribute("fill", "transparent");
    g.appendChild(hitRect);

    return g;
  }

  setFill(color) {
    // this.textEl.setAttribute("fill", color);
  }

  setPointerEvents(value) {
    this.g.style.pointerEvents = value;
  }
}

export class Edges {
  constructor(svg, tokens, tokenPos, state, defs) {
    this.svg = svg;
    this.tokens = tokens;
    this.tokenPos = tokenPos;
    this.state = state;
    this.group = this._createGroup();
    this.depEdges = this._drawCurves();
    this.sequentialEdges = this._drawSequentialEdges(defs);
  }

  _createGroup() {
    const g = document.createElementNS(SVGNS, "g");
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

  _drawSequentialEdges(defs) {
    const PUNCT = /^[^\p{L}\p{N}]+$/u;

    for (let i = 0; i < this.tokens.length - 1; i++) {
      const curr = this.tokens[i];
      const next = this.tokens[i + 1];

      const currText = curr.word || curr.token || curr.text || "";
      const nextText = next.word || next.token || next.text || "";

      if (PUNCT.test(currText) || PUNCT.test(nextText)) continue;

      this._createEdge(curr._key, next._key, defs, {
        color: PALETTE.lightGray,
        marker: "url(#arr)",
        width: 3,
        opacity: 0.4,
        showArrow: true,
      });
    }
  }

  _drawCurves() {
    const GAP = 12;
    const CURVE_MIN_DIST = 50;

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

      const a = this.tokenPos[tok._key];
      const b = this.tokenPos[headKey];
      if (!a || !b) return;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const isDownward = tok.head_id > tok.id;
      const color = isDownward ? PALETTE["02"][1] : PALETTE["01"][5];
      const marker = isDownward ? "url(#arr-black)" : "url(#arr-blue)";

      const path = document.createElementNS(SVGNS, "path");

      let d;
      let midX, midY;

      if (dist < CURVE_MIN_DIST) {
        const ux = dx / (dist || 1);
        const uy = dy / (dist || 1);

        const x1 = a.x + ux * GAP;
        const y1 = a.y + uy * GAP;
        const x2 = b.x - ux * (GAP + 6);
        const y2 = b.y - uy * (GAP + 6);

        d = `M ${x1} ${y1} L ${x2} ${y2}`;
        midX = (x1 + x2) / 2;
        midY = (y1 + y2) / 2;
      } else {
        const curve = Math.min(40, Math.max(10, dist * 0.2));
        const nx = -dy / dist;
        const ny = dx / dist;

        const cx = (a.x + b.x) / 2 + nx * (isDownward ? curve : -curve);
        const cy = (a.y + b.y) / 2 + ny * (isDownward ? curve : -curve);

        const ux = dx / dist;
        const uy = dy / dist;

        d = `M ${a.x + ux * GAP} ${a.y + uy * GAP} Q ${cx} ${cy} ${b.x - ux * (GAP + 6)} ${b.y - uy * (GAP + 6)}`;
        midX = cx;
        midY = cy;
      }

      path.setAttribute("d", d);
      path.setAttribute("stroke", color);
      // path.setAttribute("opacity", isDownward ? "0.6" : "0.4");
      path.setAttribute("marker-end", marker);

      path.dataset.fromKey = tok._key;
      path.dataset.toKey = headKey;
      path.dataset.dep = tok.dep;

      this.group.appendChild(path);
      outgoing[tok._key].push({
        lineEl: path,
        targetKey: headKey,
      });

      if (!(views.showDeps || views.showDepsLocked)) return;

      const { text } = drawText(
        this.group,
        null,
        midX,
        midY - 5,
        labelSet[tok.dep],
        9,
        400,
        PALETTE.lightGray,
        "middle",
        "IBM Plex Mono",
        "dep-labels",
      );

      text.dataset.fromKey = tok._key;
      text.dataset.dep = tok.dep;
    });

    return outgoing;
  }

  _createEdge(fromKey, toKey, defs, opts = {}) {
    // mkArrowMarker(defs, "arr-black", "#000");
    mkArrowMarker(defs, "arr", PALETTE.lightGray);
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
    el.setAttribute("stroke", isImmediate ? PALETTE.black : "#7bafd4");
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
    const g = document.createElementNS(SVGNS, "g");
    g.setAttribute("pointer-events", "none");
    // this.drawPOSHeaders();
    return g;
  }

  drawPOSHeaders() {
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
          PALETTE.lightGray,
          "middle",
          "IBM Plex Mono",
        );
      }
    });
    this.svg.appendChild(g);
  }
  _buildHitRect() {
    const rect = document.createElementNS(SVGNS, "rect");
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
      .forEach((el) => el.setAttribute("fill", PALETTE.lightGray));
  }

  highlight(posTag) {
    // this.dimAll();
    // const pal = this.state.palette;
    // const el = this.group.querySelector(`#rowheader-${posTag}`);
    // if (el) el.setAttribute("fill", pal.BLACK);
  }
}