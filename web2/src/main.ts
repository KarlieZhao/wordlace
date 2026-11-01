import { loadJson } from "./utils";
import { WordVecRenderer } from "./wordvecrenderer";
const nextBtn = document.querySelector("#next-sentence") as HTMLButtonElement;

const dataURL = "/Not_Even_This_tokens.json";
const leftContainer = document.querySelector("#full-text") as HTMLDivElement;

// ================  HELPERS  ====================

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const highlightWordAndSentenceFromIndex = (sentence: number, token: number) => {
  const allSentences = leftContainer.querySelectorAll("div");
  const sentenceDiv = [...allSentences].find((div) => Number(div.dataset.sentence) === sentence);
  if (!sentenceDiv) return;
  const allSpans = sentenceDiv.querySelectorAll("span");
  const tokenSpan = [...allSpans].find((span) => Number(span.dataset.token) === token);
  if (!tokenSpan) return;

  lockHighlightWord(tokenSpan, sentenceDiv);
};

const highlightWordAndSentence = (wordSpan: HTMLElement, sentenceDiv: HTMLElement): void => {
    leftContainer.querySelectorAll<HTMLElement>("span").forEach((span) => {
      span.classList.remove("highlight");
      span.classList.remove("highlighted-sentence");
    });

  wordSpan.classList.add("highlight");
  sentenceDiv.querySelectorAll("span").forEach((span) => span.classList.add("highlighted-sentence"));
};

const lockHighlightWord = (wordSpan: HTMLElement, sentenceDiv: HTMLElement): void => {
  leftContainer.querySelectorAll<HTMLElement>("span").forEach((span) => {
    span.classList.remove("highlight-locked");
    span.classList.remove("highlight");
    span.classList.remove("highlighted-sentence");
    span.style.opacity = "0.5";
  });

  wordSpan.classList.add("highlight-locked");
  sentenceDiv.querySelectorAll("span").forEach((span) => span.classList.add("highlighted-sentence"));
};

// ====================================
const renderer = new WordVecRenderer(highlightWordAndSentenceFromIndex);

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
  if (!leftContainer) return;

  let offset = 0;
  leftContainer.innerHTML = data.tok
    .map((sentenceArr: string[], i: number) => {
      const spans = sentenceArr.map((w, j) => `<span data-token="${offset + j}">${escapeHtml(w)}</span>`).join(" ");
      offset += sentenceArr.length;
      return `<div class="full-sentence" data-sentence="${i}">${spans}</div>`;
    })
    .join("");

  const findClosestSentenceAndToken = (
    event: PointerEvent | MouseEvent,
  ): { sentence: number; token: number; wordSpan: HTMLSpanElement | null; sentenceDiv: HTMLDivElement | null } => {
    const wordSpan = (event.target as HTMLElement).closest("span");
    if (!wordSpan || !leftContainer.contains(wordSpan))
      return { sentence: -1, token: -1, wordSpan: null, sentenceDiv: null };

    const sentenceDiv = wordSpan.closest("div[data-sentence]") as HTMLDivElement | null;
    if (!sentenceDiv) return { sentence: -1, token: -1, wordSpan: null, sentenceDiv: null };

    const sentence = Number(sentenceDiv.dataset.sentence);
    const token = Number(wordSpan.dataset.token);
    return { sentence, token, wordSpan, sentenceDiv };
  };

  const showToken = (
    sentence: number,
    token: number,
    wordSpan: HTMLElement,
    sentenceDiv: HTMLElement,
    lock: boolean = false,
  ): void => {
    if (sentence !== renderer.currentSentence) renderer.render(sentence);
    renderer.hoverToken(token);
    highlightWordAndSentence(wordSpan, sentenceDiv);
    if (lock) lockHighlightWord(wordSpan, sentenceDiv);
  };

  leftContainer.addEventListener("pointerover", (event) => {
    if (renderer.lockedTokenIndex !== null) return; // hover is ignored while locked
    const { sentence, token, wordSpan, sentenceDiv } = findClosestSentenceAndToken(event);
    if (sentence < 0 || token < 0 || !wordSpan || !sentenceDiv) return;
    showToken(sentence, token, wordSpan, sentenceDiv);
  });

  leftContainer.addEventListener("click", (event) => {
    const { sentence, token, wordSpan, sentenceDiv } = findClosestSentenceAndToken(event);
    if (sentence < 0 || token < 0 || !wordSpan || !sentenceDiv) return;

    const isLocked = renderer.lockedTokenIndex !== null;
    const clickedOnLockedToken = sentence === renderer.currentSentence && token === renderer.lockedTokenIndex;

    // clicking a different word while locked moves the focus there before re-locking.
    if (isLocked && !clickedOnLockedToken) showToken(sentence, token, wordSpan, sentenceDiv, true);
    else if (clickedOnLockedToken) {
      leftContainer.querySelectorAll("span").forEach((s) => {
        s.classList.remove("highlight-locked");
        s.style.opacity = "1.0";
      });
    } else lockHighlightWord(wordSpan, sentenceDiv);

    renderer.onClickToken(token);
  });

  leftContainer.addEventListener("pointerleave", () => {
    if (renderer.lockedTokenIndex !== null) return;
    leftContainer.querySelectorAll("span.highlight").forEach((s) => s.classList.remove("highlight"));
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
