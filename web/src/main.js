// TODO: try out
// https://demos.explosion.ai/displacy
// The Brain--is wider than the Sky--
//  For--put them side by side--
//  The one the other will contain
//  Wit  is deeper tha  o Blue--
//  The one ti  bsorb--
//  As Sp  s--Buckets--do--
//  The Brain is just   weight of God--
//  For--Heft them--Po  und for Pound--
//  And they will   differ--if they do--
//  As Syllable from Sound--


import "./style.css";
import { COL_ORDER, POS_MAP, COL_LABELS, POS_TRANSITIONS } from "./words";
import { text, line, mkDefs, mkArrowMarker } from "./utils";

let tokens = [];
let view = "lace";
let sentences = [];

/** bigram index: normalized-word → Set<normalized-word> (followers) */
let bigramIndex = new Map();

/** surface map: normalized-word → most-common surface form */
let surfaceMap = new Map();

const DEMOS = [
  "To be gorgeous you must first be seen but to be seen allows you to be hunted",
  "She should never forget the beautiful, hidden truth.",
  "We must always remember that the dark and silent unknown can never truly be forgotten, even when we simply will it to be gone.",
];

// ---------------------------------------------------------------------------
// Lightweight English stemmer / normalizer
// Strips common inflectional suffixes so hate/hates/hated → hate, etc.
// Not perfect — covers the 90% case without any library.
// ---------------------------------------------------------------------------
function normalize(word) {
  let w = word.toLowerCase().replace(/[^a-z']/g, "");

  // contractions: don't → dont, i'm → im  (keep as single token)
  w = w.replace(/'/g, "");

  // irregular common forms
  const irregulars = {
    am: "be", is: "be", are: "be", was: "be", were: "be", been: "be", being: "be",
    has: "have", had: "have", having: "have",
    does: "do", did: "do", done: "do", doing: "do",
    goes: "go", went: "go", gone: "go", going: "go",
    said: "say", says: "say", saying: "say",
    ran: "run", runs: "run", running: "run",
    saw: "see", seen: "see", sees: "see", seeing: "see",
    got: "get", gets: "get", gotten: "get", getting: "get",
    made: "make", makes: "make", making: "make",
    came: "come", comes: "come", coming: "come",
    took: "take", takes: "take", taken: "take", taking: "take",
    knew: "know", knows: "know", known: "know", knowing: "know",
    thought: "think", thinks: "think", thinking: "think",
    bought: "buy", buys: "buy", buying: "buy",
    brought: "bring", brings: "bring", bringing: "bring",
    found: "find", finds: "find", finding: "find",
    gave: "give", gives: "give", given: "give", giving: "give",
    told: "tell", tells: "tell", telling: "tell",
    became: "become", becomes: "become", becoming: "become",
    began: "begin", begins: "begin", beginning: "begin",
    felt: "feel", feels: "feel", feeling: "feel",
    kept: "keep", keeps: "keep", keeping: "keep",
    left: "leave", leaves: "leave", leaving: "leave",
    let: "let", lets: "let", letting: "let",
    lost: "lose", loses: "lose", losing: "lose",
    meant: "mean", means: "mean", meaning: "mean",
    met: "meet", meets: "meet", meeting: "meet",
    put: "put", puts: "put", putting: "put",
    read: "read", reads: "read", reading: "read",
    sent: "send", sends: "send", sending: "send",
    set: "set", sets: "set", setting: "set",
    showed: "show", shows: "show", shown: "show", showing: "show",
    stood: "stand", stands: "stand", standing: "stand",
    wrote: "write", writes: "write", written: "write", writing: "write",
  };
  if (irregulars[w]) return irregulars[w];

  // -ies → -y  (carries → carry, tries → try)
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";

  // -ves → -f  (leaves → leaf) — skip, too many false positives

  // -ing  (running → run, running has double consonant)
  if (w.length > 5 && w.endsWith("ing")) {
    const stem = w.slice(0, -3);
    // double consonant: running → run
    if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2]) {
      return stem.slice(0, -1);
    }
    // silent e: making → make
    const vowels = "aeiou";
    if (stem.length > 2 && !vowels.includes(stem[stem.length - 1])) {
      return stem + "e";
    }
    return stem;
  }

  // -ed  (hated → hate, stopped → stop, played → play)
  if (w.length > 4 && w.endsWith("ed")) {
    const stem = w.slice(0, -2);
    if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2]) {
      return stem.slice(0, -1);
    }
    if (!["a","e","i","o","u"].includes(stem[stem.length - 1])) {
      return stem + "e";
    }
    return stem;
  }

  // -s / -es (hates → hate, watches → watch)
  if (w.length > 4 && w.endsWith("es") && !w.endsWith("oes")) {
    return w.slice(0, -2);
  }
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) {
    return w.slice(0, -1);
  }

  return w;
}

// ---------------------------------------------------------------------------
// Core: build bigram index from a token array
// Returns { index: Map<norm, Set<norm>>, surface: Map<norm, string> }
// ---------------------------------------------------------------------------
function buildBigramIndex(toks) {
  const index = new Map();   // norm → Set of follower norms
  const surface = new Map(); // norm → preferred surface form

  // Register surface forms (first-seen wins as canonical)
  toks.forEach(t => {
    const norm = normalize(t.word);
    if (!surface.has(norm)) surface.set(norm, t.word.toLowerCase());
  });

  // Slide bigram window
  for (let i = 0; i < toks.length - 1; i++) {
    const fromNorm = normalize(toks[i].word);
    const toNorm   = normalize(toks[i + 1].word);

    if (!index.has(fromNorm)) index.set(fromNorm, new Set());
    index.get(fromNorm).add(toNorm);
  }
console.log(index, surface);
  return { index, surface };
}

// ---------------------------------------------------------------------------
// POS tagging (unchanged from your original)
// ---------------------------------------------------------------------------
function tagWord(w) {
  const lc = w.toLowerCase().replace(/[^a-z]/g, "");
  if (POS_MAP[lc]) return POS_MAP[lc];
  if (/ing$/.test(lc)) return "verb";
  if (/ed$/.test(lc)) return "pp.verb";
  if (/ly$/.test(lc)) return "adv";
  if (/(ful|less|ous|ive|al|ent|ant|ible|able)$/.test(lc)) return "adj";
  return "noun";
}

// ---------------------------------------------------------------------------
// Parse sentence, build bigram index, then draw
// ---------------------------------------------------------------------------
function parseSentence() {
  const raw = document.getElementById("sentence-input").value.trim();
  if (!raw) return;

  const words = raw.match(/[\w']+/g) || [];
  tokens = words.map((w, i) => ({ word: w, pos: tagWord(w), id: i }));

  // Build bigram index
  const result = buildBigramIndex(tokens);
  bigramIndex = result.index;
  surfaceMap  = result.surface;

  document.getElementById("empty").style.display = "none";
  initSVG();
  draw();
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/**
 * Given a raw word, return its normalized followers as surface forms.
 * e.g. queryFollowers("hates") → ["this", "that"]
 */
export function queryFollowers(word) {
  const norm = normalize(word);
  const followers = bigramIndex.get(norm);
  if (!followers) return [];
  return [...followers].map(n => surfaceMap.get(n) || n);
}

/**
 * Return the full bigram index as a plain object (norm → [surface forms])
 * Useful for debugging or exporting.
 */
export function getIndex() {
  const out = {};
  bigramIndex.forEach((followers, word) => {
    const surfaceWord = surfaceMap.get(word) || word;
    out[surfaceWord] = [...followers].map(n => surfaceMap.get(n) || n);
  });
  return out;
}

// ---------------------------------------------------------------------------
// UI helpers (unchanged)
// ---------------------------------------------------------------------------
function init() {
  document.getElementById("tab-linear").addEventListener("click", () => switchView("linear"));
  document.getElementById("tab-column").addEventListener("click", () => switchView("lace"));
  // FIX: was parseSentence() (calls immediately) — should be reference
  document.getElementById("draw").addEventListener("click", parseSentence);
}

function switchView(v) {
  view = v;
  document.getElementById("tab-linear").classList.toggle("active", v === "linear");
  document.getElementById("tab-column").classList.toggle("active", v === "lace");
  draw();
}

function draw() {
  if (!tokens.length) return;
  view === "linear" ? drawLinear() : drawColumn();
}

function initSVG() {
  const svg = document.getElementById("svg");
  svg.innerHTML = "";
  const W = svg.clientWidth || 600;
  const stepY = 58;
  const startY = 60;
  const totalH = startY + tokens.length * stepY + 60;
  svg.setAttribute("viewBox", `0 0 ${W} ${totalH}`);
  svg.style.height = totalH + "px";
}

// ---------------------------------------------------------------------------
// Draw: Linear (unchanged)
// ---------------------------------------------------------------------------
function drawLinear() {
  const startY = 60;
  const stepY = 58;
  const svg = document.getElementById("svg");
  svg.innerHTML = "";

  const W = svg.clientWidth || 600;
  const cx = W / 2;

  const defs = mkDefs(svg);
  mkArrowMarker(defs, "arr", "#111111");

  tokens.forEach((t, i) => {
    const y = startY + i * stepY;
    if (i < tokens.length - 1) {
      const arrowY1 = y + 14;
      const arrowY2 = y + stepY - 14;
      line(svg, cx, arrowY1, cx, arrowY2, "#111111", 1, "url(#arr)");
    }
    text(svg, cx, y, t.word, 18, 400, "#111111", "middle");
  });
}

// ---------------------------------------------------------------------------
// Draw: Column — now uses bigramIndex for edges
// ---------------------------------------------------------------------------
function drawColumn() {
  const svg = document.getElementById("svg");
  svg.innerHTML = "";
  const W = svg.clientWidth || 800;
  const H = svg.clientHeight || 600;

  const usedPos = COL_ORDER.filter((p) => tokens.some((t) => t.pos === p));
  const colCount = usedPos.length;
  if (!colCount) return;

  const PAD_L = 60, PAD_R = 60, PAD_T = 60, PAD_B = 40;
  const colW = (W - PAD_L - PAD_R) / Math.max(colCount - 1, 1);

  const colX = {};
  usedPos.forEach((p, i) => { colX[p] = PAD_L + i * colW; });

  const rowH = (H - PAD_T - PAD_B) / Math.max(tokens.length, 1);
  const tokenPos = {};
  tokens.forEach((t, globalIndex) => {
    tokenPos[t.id] = {
      x: colX[t.pos],
      y: PAD_T + globalIndex * rowH + rowH / 2,
    };
  });

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.style.height = "";

  const defs = mkDefs(svg);
  mkArrowMarker(defs, "arr-black", "#111111");
  mkArrowMarker(defs, "arr-blue",  "#7bafd4");

  // Column headers
  usedPos.forEach((p) => {
    text(svg, colX[p], 30, COL_LABELS[p] || p, 11, 400, "#b0b0b0", "middle", "IBM Plex Mono");
  });

  const edgeGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  edgeGroup.setAttribute("class", "edge-layer");
  svg.appendChild(edgeGroup);

  // outgoingEdges[tokenId] = [ { lineEl, targetId, isImmediate } ]
  const outgoingEdges = {};
  tokens.forEach((t) => { outgoingEdges[t.id] = []; });

  // Build a lookup: normWord → token ids that share that norm
  const normToIds = new Map();
  tokens.forEach((t) => {
    const n = normalize(t.word);
    if (!normToIds.has(n)) normToIds.set(n, []);
    normToIds.get(n).push(t.id);
  });

  // Draw edges from bigramIndex
  // For each token, look up what follows its normalized form,
  // then draw arrows to every token whose norm matches a follower norm.
  tokens.forEach((fromTok, fromIdx) => {
    const fromNorm     = normalize(fromTok.word);
    const followerNorms = bigramIndex.get(fromNorm);
    if (!followerNorms) return;

    followerNorms.forEach((toNorm) => {
      const toIds = normToIds.get(toNorm) || [];
      toIds.forEach((toId) => {
        const toIdx = tokens.findIndex(t => t.id === toId);

        // Skip self-loops and backward edges
        // (backward edges are valid in a general bigram graph but visually noisy;
        //  keep them — remove the toIdx <= fromIdx guard if you want them)
        if (toId === fromTok.id) return;

        const a = tokenPos[fromTok.id];
        const b = tokenPos[toId];
        if (!a || !b) return;

        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) return;

        // "Immediate" = the token directly after in the original sequence
        const isImmediate = toIdx === fromIdx + 1;
        const color  = isImmediate ? "#111111" : "#7bafd4";
        const marker = isImmediate ? "url(#arr-black)" : "url(#arr-blue)";

        const nx = dx / len, ny = dy / len;
        const GAP = 12;

        const lineEl = line(
          edgeGroup,
          a.x + nx * GAP,
          a.y + ny * GAP,
          b.x - nx * (GAP + 6),
          b.y - ny * (GAP + 6),
          color, 1, marker,
        );
        lineEl.style.transition = "opacity 0.2s ease, stroke 0.2s ease";
        lineEl.dataset.fromId   = fromTok.id;
        lineEl.dataset.toId     = toId;
        lineEl.dataset.immediate = isImmediate ? "1" : "0";

        outgoingEdges[fromTok.id].push({ lineEl, targetId: toId, isImmediate });
      });
    });
  });

  // Label layer
  const labelGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  labelGroup.setAttribute("class", "label-layer");
  svg.appendChild(labelGroup);

  const nodeEls = {};

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
    textEl.setAttribute("fill", "#111111");
    textEl.setAttribute("class", "token-label");
    textEl.textContent = t.word;

    // Normalized form shown as a small subtitle
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

    const hitRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    const approxW = t.word.length * 10 + 16;
    hitRect.setAttribute("x", pos.x - approxW / 2);
    hitRect.setAttribute("y", pos.y - 13);
    hitRect.setAttribute("width", approxW);
    hitRect.setAttribute("height", 26);
    hitRect.setAttribute("fill", "transparent");

    g.appendChild(textEl);
    g.appendChild(hitRect);
    labelGroup.appendChild(g);
    nodeEls[t.id] = { g, textEl };

    // Hover: highlight outgoing bigram edges
    g.addEventListener("mouseenter", () => {
      const myEdges = outgoingEdges[t.id];

      edgeGroup.querySelectorAll("line").forEach((el) => {
        el.style.opacity = "0.08";
      });
      Object.values(nodeEls).forEach(({ textEl: te }) => {
        te.setAttribute("fill", "#cccccc");
      });

      // Highlight reachable nodes
      const reachableIds = new Set([t.id]);
      myEdges.forEach(({ lineEl, targetId }) => {
        lineEl.style.opacity = "1";
        reachableIds.add(targetId);
      });

      reachableIds.forEach(id => {
        if (nodeEls[id]) nodeEls[id].textEl.setAttribute("fill", "#111111");
      });
    });

    g.addEventListener("mouseleave", () => {
      edgeGroup.querySelectorAll("line").forEach((el) => {
        el.style.opacity = "";
        el.style.strokeWidth = "";
        const isImmediate = el.dataset.immediate === "1";
        el.setAttribute("stroke", isImmediate ? "#111111" : "#7bafd4");
        el.setAttribute("marker-end", isImmediate ? "url(#arr-black)" : "url(#arr-blue)");
      });
      Object.values(nodeEls).forEach(({ textEl: te }) => {
        te.setAttribute("fill", "#111111");
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Demo loader
// ---------------------------------------------------------------------------
function loadDemo(i) {
  document.getElementById("sentence-input").value = DEMOS[i];
  parseSentence();
}

// ---------------------------------------------------------------------------
// Resize handler
// ---------------------------------------------------------------------------
let rez;
window.addEventListener("resize", () => {
  clearTimeout(rez);
  rez = setTimeout(draw, 100);
});

document.getElementById("sentence-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") parseSentence();
});

init();
loadDemo(2);
