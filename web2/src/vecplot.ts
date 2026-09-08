type Vectors = Record<string, [number, number]>;
type WordPos = { px: number; py: number }[];
type Sentences = string[][];

async function loadTokens(url: string): Promise<string[][]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load tokens from ${url}: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  const tokens = json.tok;
  return tokens as string[][];
}

async function loadVectors(url: string): Promise<Vectors> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load vectors from ${url}: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as Vectors;
}

function renderVectors(
  vectors: Vectors,
  container: HTMLElement,
): {
  positions: Record<string, { px: number; py: number }>;
  elements: Record<string, HTMLElement>;
} {
  const padding = 40;
  const words = Object.keys(vectors);
  const positions: Record<string, { px: number; py: number }> = {};
  const elements: Record<string, HTMLElement> = {};

  if (words.length === 0) {
    container.innerHTML = "";
    return { positions, elements };
  }

  const xs = words.map((w) => vectors[w][0]);
  const ys = words.map((w) => vectors[w][1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  container.style.position = "relative";
  container.style.overflow = "hidden";
  container.innerHTML = "";

  const rect = container.getBoundingClientRect();
  const width = rect.width || container.clientWidth || 800;
  const height = rect.height || container.clientHeight || 600;

  const toPx = (x: number, y: number) => {
    const px = padding + ((x - minX) / spanX) * (width - padding * 2);
    const py = padding + (1 - (y - minY) / spanY) * (height - padding * 2);
    return { px, py };
  };

  const fragment = document.createDocumentFragment();

  for (const word of words) {
    const [x, y] = vectors[word];
    const { px, py } = toPx(x, y);
    positions[word] = { px, py };

    const el = document.createElement("div");
    el.textContent = word;
    el.title = `${word} (${x.toFixed(3)}, ${y.toFixed(3)})`;
    el.dataset.word = word;
    el.classList.add("vector-word");
    el.style.position = "absolute";
    el.style.left = `${px}px`;
    el.style.top = `${py}px`;
    el.style.transform = "translate(-50%, -50%)";
    el.style.padding = "2px 6px";
    el.style.fontSize = "13px";
    el.style.fontFamily = `"Roboto Slab", "Helvetica Neue", Arial, sans-serif`;
    el.style.color = "#6d8daa";
    el.style.borderRadius = "4px";
    el.style.whiteSpace = "nowrap";
    el.style.zIndex = "1";
    el.style.transition = "opacity 0.2s ease, transform 0.2s ease, z-index 0.2s ease";

    fragment.appendChild(el);
    elements[word] = el;
  }

  container.appendChild(fragment);
  return { positions, elements };
}

function renderVectorsSeq(
  vectors: Vectors,
  tokens: string[][],
  container: HTMLElement,
): {
  positions: WordPos;
  // Record<string, { px: number; py: number }>;
  elements: Record<string, HTMLElement>;
} {
  const padding = 40;
  const words = Object.keys(vectors);
  const positions: WordPos = [];
  const elements: Record<string, HTMLElement> = {};

  if (words.length === 0) {
    container.innerHTML = "";
    return { positions, elements };
  }

  const xs = words.map((w) => vectors[w][0]);
  const ys = words.map((w) => vectors[w][1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  container.style.position = "relative";
  container.style.overflow = "hidden";
  container.innerHTML = "";

  const rect = container.getBoundingClientRect();
  const width = rect.width || container.clientWidth || 800;
  const height = rect.height || container.clientHeight || 600;

  const toPx = (x: number, y: number) => {
    const px = padding + ((x - minX) / spanX) * (width - padding * 2);
    const py = padding + (1 - (y - minY) / spanY) * (height - padding * 2);
    return { px, py };
  };

  const fragment = document.createDocumentFragment();
  const flattenedTokens = tokens.flat();
  flattenedTokens.forEach((word, tokenIndex) => {
    word = word.toLocaleLowerCase();

    let px = tokenIndex * 50,
      py = 200;
    if (word in vectors) {
      const [x, y] = vectors[word];
      py = toPx(x, y).py;
    }
    positions.push({ px, py });

    // console.log("saving vectors: ", word, positions[word]);
    const el = document.createElement("div");
    el.textContent = word;
    el.dataset.word = word;
    el.classList.add("vector-word");
    el.style.position = "absolute";
    el.style.left = `${px}px`;
    el.style.top = `${py}px`;
    el.style.transform = "translate(-50%, -50%)";
    el.style.padding = "2px 6px";
    el.style.fontSize = "13px";
    el.style.fontFamily = `"Roboto Slab", "Helvetica Neue", Arial, sans-serif`;
    el.style.color = "#6d8daa";
    el.style.borderRadius = "4px";
    el.style.whiteSpace = "nowrap";
    el.style.zIndex = "1";
    el.style.transition = "opacity 0.2s ease, transform 0.2s ease, z-index 0.2s ease";

    fragment.appendChild(el);
    elements[word] = el;
  });

  container.appendChild(fragment);
  return { positions, elements };
}

function renderEdges(
  sentences: Sentences,
  positions: WordPos,
  container: HTMLElement,
  sentenceIndices?: number[],
): Set<string> {
  // remove any previously drawn edge layer
  const existing = container.querySelector("svg.vector-edges");
  if (existing) existing.remove();

  const rect = container.getBoundingClientRect();
  const width = rect.width || container.clientWidth || 800;
  const height = rect.height || container.clientHeight || 600;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "vector-edges");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.style.position = "absolute";
  svg.style.left = "0";
  svg.style.top = "0";
  svg.style.pointerEvents = "none";
  svg.style.zIndex = "0";

  const indices = sentenceIndices ?? sentences.map((_, i) => i); 
  // TODO: handle this gracefully
  const pre = sentences.slice(0, indices[0]).reduce((prev, cur) => {
    return prev + cur.length;
  }, 0);

  // words that end up with at least one drawn edge touching them
  const connectedWords = new Set<string>();

  for (const i of indices) {
    const sentence = sentences[i];
    if (!sentence) continue;

    for (let j = 0; j < sentence.length - 1; j++) {
      const wordA = sentence[j].toLocaleLowerCase();
      const wordB = sentence[j + 1].toLocaleLowerCase();
      const a = positions[pre + j];
      const b = positions[pre + j + 1];

      if (!a || !b) continue; // skip if either token isn't in the current vector space

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.dataset.from = wordA;
      line.dataset.to = wordB;
      line.setAttribute("x1", String(a.px));
      line.setAttribute("y1", String(a.py));
      line.setAttribute("x2", String(b.px));
      line.setAttribute("y2", String(b.py));
      line.setAttribute("stroke", "#6d8daa");
      line.setAttribute("stroke-width", "1");
      line.setAttribute("stroke-opacity", "0.5");
      svg.appendChild(line);

      connectedWords.add(wordA);
      connectedWords.add(wordB);
    }
  }

  container.insertBefore(svg, container.firstChild);
  return connectedWords;
}

function applyEdgeEmphasis(elements: Record<string, HTMLElement>, connectedWords: Set<string>): void {
  for (const [word, el] of Object.entries(elements)) {
    if (connectedWords.has(word)) {
      el.style.opacity = "1";
      el.style.zIndex = "2";
      el.style.transform = "translate(-50%, -50%) scale(1)";
      el.style.color = "#283541";
    } else {
      el.style.opacity = "0.8";
      el.style.zIndex = "0";
      el.style.transform = "translate(-50%, -50%) scale(0.92)";
      el.style.color = "#859cae";
    }
  }
}

const vectors = await loadVectors("/public/Not_Even_This_tokens_vecs_axes.json");
const tok = await loadTokens("/public/Not_Even_This_tokens.json");

const wordContainer = document.querySelector(".word-plot") as HTMLDivElement;
const lineContainer = document.querySelector(".vector-plot") as HTMLDivElement;
const fullLineDiv = document.querySelector(".full-line") as HTMLDivElement;
const { positions, elements } = renderVectorsSeq(vectors, tok, wordContainer);
let sentenceIndex = 0;

function render() {
  lineContainer.innerHTML = "";
  const connectedWords = renderEdges(tok, positions, lineContainer, [sentenceIndex, sentenceIndex]);
  applyEdgeEmphasis(elements, connectedWords);
  fullLineDiv.innerHTML = tok[sentenceIndex].join(" ");
}

const nextBtn = document.querySelector("#next-sentence") as HTMLButtonElement;
nextBtn.addEventListener("click", () => {
  sentenceIndex++;
  sentenceIndex = sentenceIndex % tok.length;
  render();
});

render();
