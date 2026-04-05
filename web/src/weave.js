import { drawText, line, mkDefs, mkArrowMarker } from "./svgutils";
import { COL_ORDER, COL_LABELS } from "./words";
import { normalize } from "./words";

const PAD_L = 60, PAD_R = 60, PAD_T = 60, PAD_B = 40;
const LIGHT_BLUE = "#b9d1e3";
const BLACK = "#111111"
const LIGHT_GRAY = "#b0b0b0"


export function drawColumn(tokens, bigramIndex) {
  const writer = document.getElementById("writer")
  const svg = document.getElementById("svg");
  svg.innerHTML = "";
  const W = svg.clientWidth || 800;
  const H = svg.clientHeight || 600;

  // const usedPos = COL_ORDER.filter((p) => tokens.some((t) => t.pos === p));
  const colCount = COL_ORDER.length;
  if (!colCount) return;

  const colW = (W - PAD_L - PAD_R) / Math.max(colCount - 1, 1);

  const colX = {};
  COL_ORDER.forEach((p, i) => { colX[p] = PAD_L + i * colW; });

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
  mkArrowMarker(defs, "arr-black", BLACK);
  mkArrowMarker(defs, "arr-blue", LIGHT_BLUE);

  // column headers
  const headerGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  headerGroup.setAttribute("pointer-events", "none");
  COL_ORDER.forEach((p) => {
    drawText(headerGroup, `colheader-${p}`, colX[p], 30, COL_LABELS[p] || p, 11, 400, LIGHT_GRAY, "middle", "IBM Plex Mono");
  });
  svg.appendChild(headerGroup);

  // hit rect
  const hitrect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
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
  hitrect.addEventListener("mousemove", (e) => {
    const svgRect = svg.getBoundingClientRect();
    const mouseX = e.clientX - svgRect.left;

    // find closest column
    const p = COL_ORDER.reduce((best, col) =>
      Math.abs(colX[col] - mouseX) < Math.abs(colX[best] - mouseX) ? col : best
    );

    setArrowOpacity(svg.querySelectorAll(".edge-layer line"), "0.08");
    setTextNodetatus(nodeEls, "#ccc");
    headerGroup.querySelectorAll(`text`).forEach(ele => ele.setAttribute("fill", LIGHT_GRAY))
    headerGroup.querySelector(`#colheader-${p}`).setAttribute("fill", BLACK)
    tokens.forEach(t => { if (t.pos === p) nodeEls[t.id].textEl.setAttribute("fill", BLACK) });
  });

  hitrect.addEventListener("mouseleave", () => {
    headerGroup.querySelectorAll(`text`).forEach(ele => ele.setAttribute("fill", LIGHT_GRAY))
    setArrowOpacity(svg.querySelectorAll(".edge-layer line"), "1.0");
    setTextNodetatus(nodeEls, BLACK);
  });

  const edgeGroupBlue = document.createElementNS("http://www.w3.org/2000/svg", "g");
  edgeGroupBlue.setAttribute("class", "edge-layer edge-layer-blue");
  svg.appendChild(edgeGroupBlue);

  const edgeGroupBlack = document.createElementNS("http://www.w3.org/2000/svg", "g");
  edgeGroupBlack.setAttribute("class", "edge-layer edge-layer-black");
  svg.appendChild(edgeGroupBlack);

  // outgoingEdges[tokenId] = [ { lineEl, targetId, isImmediate } ]
  const outgoingEdges = {};
  tokens.forEach((t) => { outgoingEdges[t.id] = []; });

  const normToIds = new Map();
  tokens.forEach((t) => {
    const n = normalize(t.word);
    if (!normToIds.has(n)) normToIds.set(n, []);
    normToIds.get(n).push(t.id);
  });

  // for each token, look up what follows its normalized form,
  // then draw arrows to every token whose norm matches a follower norm.
  tokens.forEach((fromTok, fromIdx) => {
    const fromNorm = normalize(fromTok.word);
    const followerNorms = bigramIndex.get(fromNorm);
    if (!followerNorms) return;

    followerNorms.forEach((toNorm) => {
      const toIds = normToIds.get(toNorm) || [];
      toIds.forEach((toId) => {
        const toIdx = tokens.findIndex(t => t.id === toId);

        // skip self-loops (and backward edges?)
        if (toId === fromTok.id) return;

        const a = tokenPos[fromTok.id];
        const b = tokenPos[toId];
        if (!a || !b) return;

        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) return;

        const isImmediate = toIdx === fromIdx + 1;  // the token directly after in the original sequence
        const color = isImmediate ? BLACK : LIGHT_BLUE;
        const marker = isImmediate ? "url(#arr-black)" : "url(#arr-blue)";

        const nx = dx / len, ny = dy / len;
        const GAP = 12;

        const edgeGroup = isImmediate ? edgeGroupBlack : edgeGroupBlue;
        const lineEl = line(
          edgeGroup,
          a.x + nx * GAP,
          a.y + ny * GAP,
          b.x - nx * (GAP + 6),
          b.y - ny * (GAP + 6),
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
    textEl.setAttribute("fill", BLACK);
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

    // === HOVER ===
    g.addEventListener("mouseenter", () => {

      setArrowOpacity(svg.querySelectorAll(".edge-layer line"), "0.08")
      setTextNodetatus(nodeEls, "#ccc")

      // highlight reachable nodes
      const highlightEdges = outgoingEdges[t.id];
      const reachableIds = new Set([t.id]);
      highlightEdges.forEach(({ lineEl, targetId }) => {
        lineEl.style.opacity = "1";
        reachableIds.add(targetId);
      });

      reachableIds.forEach(id => {
        if (nodeEls[id]) nodeEls[id].textEl.setAttribute("fill", BLACK);
      });
    });

    g.addEventListener("mouseleave", () => {
      setArrowOpacity(svg.querySelectorAll(".edge-layer line"), "")
      setTextNodetatus(nodeEls, BLACK)
    });

    g.addEventListener("click", () => {
      //TODO: find the best form for the constructed sentence
      writer.innerHTML += t.word + " ";
    })
  });
}

function setTextNodetatus(nodeEls, color) {
  Object.values(nodeEls).forEach(({ textEl: te }) => {
    te.setAttribute("fill", color);
  });
}

function setArrowOpacity(arrows, opacity) {
  arrows.forEach((el) => {
    el.style.opacity = opacity;
    const isImmediate = el.dataset.immediate === "1";
    el.setAttribute("stroke", isImmediate ? BLACK : "#7bafd4");
    el.setAttribute("marker-end", isImmediate ? "url(#arr-black)" : "url(#arr-blue)");
  });
}
