import { loadJson } from "../utils";
import { WordVecRenderer } from "./wordvecRenderer";
const nextBtn = document.querySelector("#next-sentence") as HTMLButtonElement;
const renderer = new WordVecRenderer();

const dataURL = "/Not_Even_This_tokens.json";

function addListeners(): void {
  nextBtn.addEventListener("click", () => renderer.nextSentence());

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

function populateLeftContainer(data: any) {
  const leftContainer = document.querySelector("#full-text");
  if (!leftContainer) return;

  leftContainer.innerHTML = "";

  data.tok.forEach((sentenceArr: string[]) => {
    leftContainer.innerHTML += "<div><span>" + sentenceArr.join("</span> <span>") + "</span></div>";
  });

  leftContainer.addEventListener("pointerover", (event) => {
    const target = event.target as HTMLElement;

    const wordSpan = target.closest("span");

    if (!wordSpan || !leftContainer.contains(wordSpan)) return;
    leftContainer.querySelectorAll("span.highlight").forEach((span) => span.classList.remove("highlight"));
    wordSpan.classList.add("highlight");
  });

  leftContainer.addEventListener("pointerout", () => {
    leftContainer.querySelectorAll("span.highlight").forEach((span) => span.classList.remove("highlight"));
  });
}

async function init(): Promise<void> {
  addListeners();
  const raw = await loadJson(dataURL);
  populateLeftContainer(raw);
  await renderer.init(raw);
  renderer.render(2);
}

init();
