import { renderer, centerIsCollapsed } from "./main";
const fulltextContainer = document.querySelector("#full-text") as HTMLDivElement;

export let tokenSpans: HTMLElement[] = [];
let connectedSpans: HTMLElement[] = [];

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const cacheTokenSpans = () => {
  tokenSpans = [];

  fulltextContainer.querySelectorAll<HTMLElement>("span[data-token]").forEach((span) => {
    tokenSpans[Number(span.dataset.token)] = span;
  });
};

function lockHighlightWord(wordSpan: HTMLElement, sentenceDiv: HTMLElement): void {
  fulltextContainer.querySelectorAll<HTMLElement>("span").forEach((span) => {
    span.classList.remove("highlight-locked", "highlight", "highlighted-sentence");
  });

  wordSpan.classList.add("highlight-locked");

  sentenceDiv.querySelectorAll("span").forEach((span) => span.classList.add("highlighted-sentence"));
}

function highlightSentence(sentenceDiv: HTMLElement): void {
  fulltextContainer.querySelectorAll<HTMLElement>("span").forEach((span) => {
    span.classList.remove("highlight", "highlighted-sentence");
  });

  sentenceDiv.querySelectorAll("span").forEach((span) => span.classList.add("highlighted-sentence"));
}

function highlightWordAndSentence(wordSpan: HTMLElement, sentenceDiv: HTMLElement): void {
  fulltextContainer.querySelectorAll<HTMLElement>("span").forEach((span) => {
    span.classList.remove("highlight", "highlighted-sentence");
  });

  wordSpan.classList.add("highlight");

  sentenceDiv.querySelectorAll("span").forEach((span) => span.classList.add("highlighted-sentence"));
}

export function resetTextHighlight(): void {
  fulltextContainer.querySelectorAll<HTMLElement>("span").forEach((span) => {
    span.classList.remove("highlight", "highlight-locked", "highlighted-sentence", "connected-spans");
  });
}

export function setLeftRoleColoring(enabled: boolean) {
  fulltextContainer.classList.toggle("wv-roles", enabled);
}

export function highlightWordAndSentenceFromIndex(sentence: number, token: number) {
  const allSentences = fulltextContainer.querySelectorAll("div");

  const sentenceDiv = [...allSentences].find((div) => Number(div.dataset.sentence) === sentence);

  if (!sentenceDiv) return;

  const allSpans = sentenceDiv.querySelectorAll("span");

  const tokenSpan = [...allSpans].find((span) => Number(span.dataset.token) === token);

  if (!tokenSpan) return;

  lockHighlightWord(tokenSpan, sentenceDiv);
}

export function highlightConnectedSpans(indices: ReadonlySet<number> | null) {
  connectedSpans.forEach((span) => span.classList.remove("connected-spans"));

  connectedSpans = [];

  if (!indices) return;

  for (const index of indices) {
    const span = tokenSpans[index];
    if (!span) continue;

    span.classList.add("connected-spans");
    connectedSpans.push(span);
  }
}

export function populateLeftContainer(data: any) {
  if (!fulltextContainer) return;
  let offset = 0;
  fulltextContainer.innerHTML = data.tok
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

    if (!wordSpan || !fulltextContainer.contains(wordSpan)) {
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

  fulltextContainer.addEventListener("pointerover", (event) => {
    if (renderer.lockedTokenIndex !== null) return;

    const { sentence, token, wordSpan, sentenceDiv } = findClosestSentenceAndToken(event);

    if (sentence < 0 || token < 0 || !wordSpan || !sentenceDiv) return;
    if (centerIsCollapsed) {
      showToken(sentence, token, wordSpan, sentenceDiv);
      return;
    }
    if (sentence !== renderer.currentSentence) {
      renderer.render(sentence);
    }
    highlightSentence(sentenceDiv);
  });

  fulltextContainer.addEventListener("click", (event) => {
    const { sentence, token, wordSpan, sentenceDiv } = findClosestSentenceAndToken(event);

    if (sentence < 0 || token < 0 || !wordSpan || !sentenceDiv) return;

    const isLocked = renderer.lockedTokenIndex !== null;
    const clickedOnLockedToken = sentence === renderer.currentSentence && renderer.isLockedToken(token);

    if (isLocked && !clickedOnLockedToken) {
      showToken(sentence, token, wordSpan, sentenceDiv, true);
    } else if (clickedOnLockedToken) {
      fulltextContainer.querySelectorAll("span").forEach((span) => {
        span.classList.remove("highlight-locked");
      });
    } else {
      lockHighlightWord(wordSpan, sentenceDiv);
    }

    renderer.onClickToken(token);
  });
}
