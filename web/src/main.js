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

// TODO:
// the traces and shapes matter a lot: word flow and choices
// 1. performance issues (long sentences)
// 2. explore word positions: part of speech, word vector? (2d coordinates)
// 3. try a chinese version => chinese tokenizer | part of speech detector or smth
// 4. explore n-gram model for better outcome?
// 5. fix issues with the current POS_TRANSITIONS

import "./style.css";
import { drawColumn } from "./weave";
import { drawLinear } from "./braid";
import { POS_TRANSITIONS } from "./words";
import nlp from "compromise/two";

let tokens = [];
let view = "lace";

/** bigram index: normalized-word → Set<normalized-word> (followers) */
let bigramIndex = new Map();

/** surface map: normalized-word → most-common surface form */
let surfaceMap = new Map();

const DEMOS = [
  "To be gorgeous you must first be seen, but to be seen allows you to be hunted.",
  "She should never forget the beautiful, hidden truth.",
  "In this essay I try to sketch out what that upside might look like—what a world with powerful AI might look like if everything goes right.",
  "We must always remember that the dark and silent unknown can never truly be forgotten, even when we simply will it to be gone.",
  "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity.",
  "All happy families are alike; each unhappy family is unhappy in its own way.",
  "Not all those who wander are lost.",
  "I took a deep breath and listened to the old brag of my heart: I am, I am, I am.",
  "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.",
  "So we beat on, boats against the current, borne back ceaselessly into the past.",
  "There is no greater agony than bearing an untold story inside you.",
  "One must always be careful of books, and what is inside them, for words have the power to change us.",
  "I am an invisible man, No, I am not a spook like those who haunted Edgar Allan Poe; nor am I one of your Hollywood-movie ectoplasms. I am a man of substance, of flesh and bone, fiber and liquids — and I might even be said to possess a mind.",
  "Ships at a distance have every man's wish on board. For some they come in with the tide. For others they sail forever on the horizon, never out of sight, never landing until the Watcher turns his eyes away in resignation, his dreams mocked to death by Time.",
];

function getColTag(term) {
  const tags = new Set(term.tags);
  const word = term.normal;
  if (word === "to") return "TO";
  if (tags.has("Pronoun")) return "PRP";
  if (tags.has("Determiner")) return "DT";
  if (tags.has("Conjunction")) return "CC";
  if (tags.has("Preposition")) return "IN";
  if (tags.has("Modal")) return "MD";
  if (tags.has("PastTense") || tags.has("Participle")) return "VBN";
  if (tags.has("Verb")) return "VB";
  if (tags.has("Adverb")) return "RB";
  if (tags.has("Adjective")) return "JJ";
  if (tags.has("Foreign")) return "FW";
  return "NN";
}

function parseSentence() {
  const raw = document.getElementById("sentence-input").value.trim();
  if (!raw) return;

  const doc = nlp(raw);
  const terms = doc.json()[0].terms;
  const currentTokens = terms.map((t, i) => ({
    word: t.text,
    norm: t.normal,
    pos: getColTag(t),
    id: i,
  }));

  const surface = new Map();
  for (const t of currentTokens) {
    if (!surface.has(t.norm)) {
      surface.set(t.norm, t.word.toLowerCase());
    }
  }

  // build POS-based bigram index:
  // for each token, find which POS tags can follow its POS from POS_TRANSITIONS
  // then collect the norms of tokens in the sentence that match those POS tags.
  const index = new Map();
  const posByNorm = new Map(); // norm → pos (use the last one if repeated)
  for (const t of currentTokens) {
    posByNorm.set(t.norm, t.pos);
  }

  for (const fromTok of currentTokens) {
    const allowedPos = POS_TRANSITIONS[fromTok.pos] || [];
    const followers = new Set();

    for (const toTok of currentTokens) {
      if (toTok.id === fromTok.id) continue;
      if (allowedPos.includes(toTok.pos)) {
        followers.add(toTok.norm);
      }
    }

    if (followers.size > 0) {
      index.set(fromTok.norm, followers);
    }
  }

  tokens = currentTokens;
  bigramIndex = index;
  surfaceMap = surface;

  initSVG();
  draw();
}

// UI
let demoCount = 0;
export let showOriginalOnly = false;

function init() {
  document.getElementById("tab-ngram").addEventListener("click", () => switchView("linear"));
  document.getElementById("tab-pos").addEventListener("click", () => switchView("lace"));
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
  document.getElementById("tab-ngram").classList.toggle("active", v === "linear");
  document.getElementById("tab-pos").classList.toggle("active", v === "lace");
  draw();
}

function draw() {
  if (!tokens.length) return;
  view === "linear" ? drawLinear(tokens) : drawColumn(tokens, bigramIndex);
}

function initSVG() {
  const svg = document.getElementById("svg");
  const container = document.querySelector("#canvas-wrap");
  svg.innerHTML = "";
  const W = container.clientWidth * 0.85 || 600;
  const H = container.clientHeight || 600;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.style.height = H + "px";
}

function loadDemo(i) {
  document.getElementById("sentence-input").value = DEMOS[i];
  parseSentence();
}

// Resize handler
let rez;
window.addEventListener("resize", () => {
  clearTimeout(rez);
  rez = setTimeout(draw, 100);
});

document.getElementById("sentence-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") parseSentence();
});

init();
loadDemo(demoCount);
