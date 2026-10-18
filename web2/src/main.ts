import { loadJson } from "./utils";
import { WordVecRenderer } from "./wordvecrenderer";
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

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function populateLeftContainer(data: any) {
  const leftContainer = document.querySelector("#full-text");
  if (!leftContainer) return;

  let offset = 0;
  leftContainer.innerHTML = data.tok
    .map((sentenceArr: string[], i: number) => {
      const spans = sentenceArr
        .map((w, j) => `<span data-token="${offset + j}">${escapeHtml(w)}</span>`)
        .join(" ");
      offset += sentenceArr.length;
      return `<div data-sentence="${i}">${spans}</div>`;
    })
    .join("");

  leftContainer.addEventListener("pointerover", (event) => {
    const wordSpan = (event.target as HTMLElement).closest("span");
    if (!wordSpan || !leftContainer.contains(wordSpan)) return;

    leftContainer
      .querySelectorAll("span.highlight")
      .forEach((s) => s.classList.remove("highlight"));
    wordSpan.classList.add("highlight");

    const sentenceDiv = wordSpan.closest("div[data-sentence]") as HTMLElement | null;
    if (!sentenceDiv) return;

    const sentence = Number(sentenceDiv.dataset.sentence);
    const token = Number(wordSpan.dataset.token);

    // Switch sentence first so the edges exist before we focus the word.
    if (sentence !== renderer.currentSentence) renderer.render(sentence);
    renderer.hoverToken(token);
  });

  // pointerleave (not pointerout) so moving between spans doesn't clear and re-focus.
  leftContainer.addEventListener("pointerleave", () => {
    leftContainer
      .querySelectorAll("span.highlight")
      .forEach((s) => s.classList.remove("highlight"));
    renderer.hoverToken(null);
  });
}

async function init(): Promise<void> {
  addListeners();
  const raw = await loadJson(dataURL);
  populateLeftContainer(raw);
  await renderer.init(raw);
  renderer.render(0);

}

init();
