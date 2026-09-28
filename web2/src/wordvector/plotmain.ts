// import { smoothScrollTo } from "../utils";
import { WordVecRenderer, MOVE_TRANSITION_MS } from "./wordvecRenderer";

const expandXCheckbox = document.querySelector("#collapse-expand-x") as HTMLInputElement;
const expandYCheckbox = document.querySelector("#collapse-expand-y") as HTMLInputElement;
const nextBtn = document.querySelector("#next-sentence") as HTMLButtonElement;
const showAll = document.querySelector("#show-all") as HTMLInputElement;
const renderer = new WordVecRenderer();

const tokenURL = "/Not_Even_This_tokens_vecs_axes.json";
const vecURL = "/Not_Even_This_tokens.json";

function addListeners(): void {
  nextBtn.addEventListener("click", () => {
    renderer.nextSentence();
  });

  expandXCheckbox.addEventListener("change", () => {
    // smoothScrollTo(0, MOVE_TRANSITION_MS);
    expandYCheckbox.checked = false;
    renderer.setExpandMode(expandXCheckbox.checked, "x");
  });

  expandYCheckbox.addEventListener("change", () => {
    // smoothScrollTo(0, MOVE_TRANSITION_MS);
    expandXCheckbox.checked = false;
    renderer.setExpandMode(expandYCheckbox.checked, "y");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      renderer.nextSentence();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      renderer.prevSentence();
    }
  });
}

const setYexpand = () => {
  expandXCheckbox.checked = false;
  expandYCheckbox.checked = true;
  renderer.setExpandMode(expandYCheckbox.checked, "y");
};

const setXexpand = () => {
  expandYCheckbox.checked = false;
  expandXCheckbox.checked = true;
  renderer.setExpandMode(expandXCheckbox.checked, "x");
};

async function init(): Promise<void> {
  expandXCheckbox.checked = false;
  expandYCheckbox.checked = false;
  setXexpand();
  addListeners();
  await renderer.init(tokenURL, vecURL);
}

init();
