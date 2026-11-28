import { loadJson } from "./utils";
import { WordVecRenderer } from "./wordvecrenderer";
import { FullTextPanel } from "./fulltext";

const dataURL = "so-to-speak-en_tokens.json";
// "Not_Even_This_tokens.json";

// ================ DOM ====================

function query<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el;
}

const main = query<HTMLElement>(document, ".main-container");
const controls = query<HTMLDivElement>(document, ".bottom-bar");

const fulltextContainer = query<HTMLDivElement>(document, "#full-text");
const collapseButton = query<HTMLDivElement>(main, "#collapse-button");
const centerContainer = query<HTMLDivElement>(main, ".right-section-container");
const centerContent = query<HTMLDivElement>(main, ".right-section");
const autoPlay = query<HTMLInputElement>(main, "#play-toggle-input");

const srlRadio = query<HTMLInputElement>(controls, "#srl-toggle-input");
const wordRadio = query<HTMLInputElement>(controls, "#srl-toggle-input-word");
const colorCodeByRole = query<HTMLInputElement>(controls, "#color-toggle-input");
const colorLabel = query<HTMLSpanElement>(controls, "#color-option");
const soundSwitch = query<HTMLInputElement>(controls, "#sound-toggle-input");
const soundSvg = query<HTMLSpanElement>(controls, "#sound-icon");
const mutedSvg = query<HTMLSpanElement>(controls, "#muted-icon");

const mode0Radio = query<HTMLInputElement>(controls, "#sound-mode-1-btn");
const mode1Radio = query<HTMLInputElement>(controls, "#sound-mode-2-btn");

const leftPanel = new FullTextPanel(
  fulltextContainer,
  () => centerIsCollapsed,
  () => {
    autoPlay.checked = false;
  },
);
export const renderer = new WordVecRenderer(leftPanel.highlightFocus, () => leftPanel.isAutoPlaying());
leftPanel.attach(renderer);

// ================ CENTER PANEL COLLAPSE ====================

export let centerIsCollapsed = false;
let audioUnlocked = false;
function collapseCenter(): void {
  centerIsCollapsed = true;
  main.classList.add("center-collapsed");
  setTimeout(() => {
    centerContent.classList.add("disabled");
    centerContainer.classList.add("disabled");
    centerContainer.style.pointerEvents = "all";
  }, 450);
}

function expandCenter(): void {
  if (!centerIsCollapsed) return;
  centerIsCollapsed = !centerIsCollapsed;
  main.classList.remove("center-collapsed");
  setTimeout(() => {
    centerContent.classList.remove("disabled");
    centerContainer.classList.remove("disabled");
  }, 400);
}
const expandSvg = collapseButton.querySelector("#expand-svg");
const collapseSvg = collapseButton.querySelector("#collapse-svg");
collapseButton.addEventListener("click", (e) => {
  e.stopPropagation();
  if (centerIsCollapsed) {
    expandCenter();
  } else {
    collapseCenter();
  }
  expandSvg?.classList.toggle("hidden", centerIsCollapsed);
  collapseSvg?.classList.toggle("hidden", !centerIsCollapsed);
});
centerContainer.addEventListener("click", expandCenter);

// ================ CONTROLS ====================

[srlRadio, wordRadio].forEach((radio) =>
  radio.addEventListener("change", () => {
    leftPanel.resetHighlight();
    void renderer.setUseSrl(srlRadio.checked).then(() => {
      leftPanel.applyRoles(renderer.tokenRoles);
    });
  }),
);

autoPlay.addEventListener("change", (e) => {
  e.stopPropagation();
  if (autoPlay.checked) {
    if (!audioUnlocked) renderer.unlockAudio();
    leftPanel.startAutoplay();
  } else {
    leftPanel.pauseAutoplay();
  }
});

colorCodeByRole.addEventListener("change", () => {
  const coloring = colorCodeByRole.checked;
  colorLabel.textContent = coloring ? "semantic role" : "none";
  renderer.setColorByRole(coloring);
  leftPanel.setRoleColoring(coloring);
});

soundSwitch.addEventListener("change", () => {
  renderer.setAudioEnabled(soundSwitch.checked);
  soundSvg.classList.toggle("hidden", !soundSwitch.checked);
  mutedSvg.classList.toggle("hidden", soundSwitch.checked);
});

[mode0Radio, mode1Radio].forEach((radio) => {
  radio.addEventListener("change", () => {
    renderer.setAudioMode(Number(radio.value) as 0 | 1);
  });
});
// =====================

async function init(): Promise<void> {
  const raw = await loadJson(dataURL);
  leftPanel.populate(raw);
  await renderer.init(raw);
  leftPanel.applyRoles(renderer.tokenRoles);
}

init();
