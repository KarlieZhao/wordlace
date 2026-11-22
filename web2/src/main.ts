import { loadJson } from "./utils";
import { WordVecRenderer } from "./wordvecrenderer";
import {
  populateLeftContainer,
  resetTextHighlight,
  highlightWordAndSentenceFromIndex,
  setLeftRoleColoring,
  highlightConnectedSpans,
  tokenSpans,
} from "./fulltext";
const dataURL = "so-to-speak-en_tokens.json";
// "Not_Even_This_tokens.json";

export const renderer = new WordVecRenderer(highlightWordAndSentenceFromIndex, highlightConnectedSpans);

export const applyLeftRoles = () => {
  const roles = renderer.tokenRoles;

  tokenSpans.forEach((span, i) => {
    if (!span) return;

    const role = roles[i];

    if (role) span.dataset.role = role;
    else delete span.dataset.role;
  });
};

// control eventlisteners
const controls = document.querySelector(".bottom-bar") as HTMLDivElement;
const slrRadio = controls.querySelector("#srl-toggle-input") as HTMLInputElement;
const wordRadio = controls.querySelector("#srl-toggle-input-word") as HTMLInputElement;
const main = document.querySelector<HTMLElement>(".main-container")!;
const collapseCenter = main.querySelector("#collapse-button") as HTMLDivElement;
const centerContainer = main.querySelector(".right-section-container") as HTMLDivElement;
const centerContent = main.querySelector(".right-section") as HTMLDivElement;
export let centerIsCollapsed = false;

collapseCenter.addEventListener("click", (e) => {
  e.stopPropagation();
  centerIsCollapsed = true;
  main.classList.add("center-collapsed");
  setTimeout(() => {
    centerContent.classList.add("disabled");
    centerContainer.classList.add("disabled");
    centerContainer.style.pointerEvents = "all";
  }, 450);
});

centerContainer.addEventListener("click", () => {
  if (!centerIsCollapsed) return;
  centerIsCollapsed = false;
  main.classList.remove("center-collapsed");
  setTimeout(() => {
    centerContent.classList.remove("disabled");
    centerContainer.classList.remove("disabled");
  }, 400);
});

slrRadio.addEventListener("change", () => {
  renderer.setUseSrl(slrRadio.checked);
  resetTextHighlight();
});

wordRadio.addEventListener("change", () => {
  renderer.setUseSrl(slrRadio.checked);
  resetTextHighlight();
});

const colorCodeByRole = controls.querySelector("#color-toggle-input") as HTMLInputElement;
const colorSpan = controls.querySelector("#color-option") as HTMLSpanElement;
colorCodeByRole.addEventListener("change", () => {
  colorSpan.textContent = colorCodeByRole.checked ? "semantic role" : "none";
  renderer.setColorByRole(colorCodeByRole.checked);
  setLeftRoleColoring(colorCodeByRole.checked);
});

// ================ INIT ====================

async function init(): Promise<void> {
  const raw = await loadJson(dataURL);
  populateLeftContainer(raw);

  await renderer.init(raw);
  applyLeftRoles();
}

init();
