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

// TODO:
// the traces and shapes matter a lot: word flow and choices
// 1. performance issues (long sentences)
// 2. explore word positions: part of speech, word vector? (2d coordinates)
// 3. try a chinese version => chinese tokenizer | part of speech detector or smth
// 4. explore n-gram model for better outcome?
// 5. fix issues with the current POS_TRANSITIONS

import "./style.css";
import { DependencyGraph } from "./weave";
import { drawLinear } from "./braid";
import { POS_TRANSITIONS } from "./words";

let view = "lace";

const DEMOS = [
  "To be gorgeous you must first be seen, but to be seen allows you to be hunted.",
];

function parseSentence() {
  const tokens = allTokens[demoCount];

  const index = new Map();
  const posByNorm = new Map();

  for (const t of tokens) {
    posByNorm.set(t.norm, t.pos);
  }

  for (const fromTok of tokens) {
    const allowedPos = POS_TRANSITIONS[fromTok.pos] || [];
    const followers = new Set();

    for (const toTok of tokens) {
      if (toTok.id === fromTok.id) continue;
      if (allowedPos.includes(toTok.pos)) {
        followers.add(toTok.norm);
      }
    }

    if (followers.size > 0) {
      index.set(fromTok.norm, followers);
    }
  }

  initSVG();
  draw();
}

// UI
let demoCount = 0;
let allTokens = [];
export let showOriginalOnly = false;

async function init() {
  const response = await fetch("/data/tokens_en.json");
  allTokens = await response.json();

  loadDemo(demoCount);

  document
    .getElementById("tab-ngram")
    .addEventListener("click", () => switchView("linear"));
  document
    .getElementById("tab-pos")
    .addEventListener("click", () => switchView("lace"));
  document.getElementById("draw").addEventListener("click", parseSentence);
  document.getElementById("prev-demo").addEventListener("click", () => {
    demoCount--;
    if (demoCount < 0) demoCount = DEMOS.length - 1;
    loadDemo(demoCount % DEMOS.length);
  });
  document.getElementById("next-demo").addEventListener("click", () => {
    demoCount++;
    loadDemo(demoCount % DEMOS.length);
  });

  document.querySelector("#hide-blue").addEventListener("mouseenter", () => {
    showOriginalOnly = true;
    loadDemo(demoCount);
  });

  document.querySelector("#hide-blue").addEventListener("mouseout", () => {
    showOriginalOnly = false;
    loadDemo(demoCount);
  });
}

function switchView(v) {
  view = v;
  document
    .getElementById("tab-ngram")
    .classList.toggle("active", v === "linear");
  document.getElementById("tab-pos").classList.toggle("active", v === "lace");
  draw();
}

function draw() {
  if (!allTokens[demoCount]?.length) return;
  if (view === "linear") {
    drawLinear(allTokens[demoCount]);
  } else {
    const graph = new DependencyGraph("en");
    graph.draw(allTokens[demoCount]);
  }
}

function initSVG() {
  const svg = document.getElementById("svg");
  const container = document.querySelector("#canvas-wrap");
  svg.innerHTML = "";
  const W = container.clientWidth || 600;
  const H = 900; //container.clientHeight || 600;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.style.height = H + "px";
}

function loadDemo(i) {
  document.getElementById("sentence-input").value = DEMOS[i];
  parseSentence();
}

// resize
let rez;
window.addEventListener("resize", () => {
  clearTimeout(rez);
  rez = setTimeout(draw, 100);
});

document.getElementById("sentence-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") parseSentence();
});

init();
