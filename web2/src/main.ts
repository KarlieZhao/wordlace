import { loadJson } from "./utils";
import { WordVecRenderer } from "./wordvecrenderer";

const dataURL = "/so-to-speak-en_tokens.json";
const leftContainer = document.querySelector("#full-text") as HTMLDivElement;

// ================ HELPERS ====================

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
    span.classList.remove("highlight", "highlighted-sentence");
  });

  wordSpan.classList.add("highlight");

  sentenceDiv.querySelectorAll("span").forEach((span) => span.classList.add("highlighted-sentence"));
};

const lockHighlightWord = (wordSpan: HTMLElement, sentenceDiv: HTMLElement): void => {
  leftContainer.querySelectorAll<HTMLElement>("span").forEach((span) => {
    span.classList.remove("highlight-locked", "highlight", "highlighted-sentence");

    span.style.opacity = "0.5";
  });

  wordSpan.classList.add("highlight-locked");

  sentenceDiv.querySelectorAll("span").forEach((span) => span.classList.add("highlighted-sentence"));
};

const resetTextHighlight = (): void => {
  leftContainer.querySelectorAll<HTMLElement>("span").forEach((span) => {
    span.classList.remove("highlight", "highlight-locked", "highlighted-sentence", "connected-spans");

    span.style.opacity = "1";
  });
};

// ================ CONNECTED SPANS ====================

let tokenSpans: HTMLElement[] = [];
let connectedSpans: HTMLElement[] = [];

const cacheTokenSpans = () => {
  tokenSpans = [];

  leftContainer.querySelectorAll<HTMLElement>("span[data-token]").forEach((span) => {
    tokenSpans[Number(span.dataset.token)] = span;
  });
};

const highlightConnectedSpans = (indices: ReadonlySet<number> | null) => {
  connectedSpans.forEach((span) => span.classList.remove("connected-spans"));

  connectedSpans = [];

  if (!indices) return;

  for (const index of indices) {
    const span = tokenSpans[index];
    if (!span) continue;

    span.classList.add("connected-spans");
    connectedSpans.push(span);
  }
};

// ================ RENDERER ====================

const renderer = new WordVecRenderer(highlightWordAndSentenceFromIndex, highlightConnectedSpans);

// control eventlisteners
const controls = document.querySelector(".top-bar") as HTMLDivElement;
const srlCheckbox = controls.querySelector("#srl-toggle-input") as HTMLInputElement;
srlCheckbox.addEventListener("change", () => {
  renderer.setUseSrl(srlCheckbox.checked);
  resetTextHighlight();
});

function populateLeftContainer(data: any) {
  if (!leftContainer) return;
  let offset = 0;
  leftContainer.innerHTML = data.tok
    .map((sentenceArr: string[], i: number) => {
      const spans = sentenceArr
        .map((word, j) => `<span data-token="${offset + j}">${escapeHtml(word)}</span>`)
        .join(" ");

      offset += sentenceArr.length;

      return `<div class="full-sentence" data-sentence="${i}">${spans}</div>`;
    })
    .join("");

  cacheTokenSpans();

  const findClosestSentenceAndToken = (
    event: PointerEvent | MouseEvent,
  ): {
    sentence: number;
    token: number;
    wordSpan: HTMLSpanElement | null;
    sentenceDiv: HTMLDivElement | null;
  } => {
    const wordSpan = (event.target as HTMLElement).closest("span");

    if (!wordSpan || !leftContainer.contains(wordSpan)) {
      return {
        sentence: -1,
        token: -1,
        wordSpan: null,
        sentenceDiv: null,
      };
    }

    const sentenceDiv = wordSpan.closest("div[data-sentence]") as HTMLDivElement | null;

    if (!sentenceDiv) {
      return {
        sentence: -1,
        token: -1,
        wordSpan: null,
        sentenceDiv: null,
      };
    }

    return {
      sentence: Number(sentenceDiv.dataset.sentence),
      token: Number(wordSpan.dataset.token),
      wordSpan,
      sentenceDiv,
    };
  };

  const showToken = (
    sentence: number,
    token: number,
    wordSpan: HTMLElement,
    sentenceDiv: HTMLElement,
    lock = false,
  ): void => {
    if (sentence !== renderer.currentSentence) {
      renderer.render(sentence);
    }

    renderer.hoverToken(token);
    highlightWordAndSentence(wordSpan, sentenceDiv);

    if (lock) {
      lockHighlightWord(wordSpan, sentenceDiv);
    }
  };

  leftContainer.addEventListener("pointerover", (event) => {
    if (renderer.lockedTokenIndex !== null) return;

    const { sentence, token, wordSpan, sentenceDiv } = findClosestSentenceAndToken(event);

    if (sentence < 0 || token < 0 || !wordSpan || !sentenceDiv) return;

    showToken(sentence, token, wordSpan, sentenceDiv);
  });

  leftContainer.addEventListener("click", (event) => {
    const { sentence, token, wordSpan, sentenceDiv } = findClosestSentenceAndToken(event);

    if (sentence < 0 || token < 0 || !wordSpan || !sentenceDiv) return;

    const isLocked = renderer.lockedTokenIndex !== null;
    const clickedOnLockedToken = sentence === renderer.currentSentence && renderer.isLockedToken(token);

    if (isLocked && !clickedOnLockedToken) {
      showToken(sentence, token, wordSpan, sentenceDiv, true);
    } else if (clickedOnLockedToken) {
      leftContainer.querySelectorAll("span").forEach((span) => {
        span.classList.remove("highlight-locked");
        span.style.opacity = "1";
      });
    } else {
      lockHighlightWord(wordSpan, sentenceDiv);
    }

    renderer.onClickToken(token);
  });

  leftContainer.addEventListener("pointerleave", () => {
    if (renderer.lockedTokenIndex !== null) return;

    leftContainer.querySelectorAll("span.highlight").forEach((span) => span.classList.remove("highlight"));

    renderer.hoverToken(null);
  });
}

// ================ INIT ====================

async function init(): Promise<void> {
  const raw = await loadJson(dataURL);

  populateLeftContainer(raw);

  await renderer.init(raw);

  renderer.render(0);
}

init();
