import type { WordVecRenderer } from "./wordvecrenderer";

const AUTOPLAY_DELAY_MS = 500;

const CLS = {
  hover: "highlight",
  locked: "highlight-locked",
  sentence: "highlighted-sentence",
  connected: "connected-spans",
} as const;

interface TokenData {
  tok: string[][];
}

interface TokenEntry {
  token: number; // global token index
  sentence: number;
  span: HTMLElement;
  sentenceDiv: HTMLElement;
}

type RoleMap = { readonly [index: number]: string | null | undefined };

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

class Highlighter {
  private hovered: HTMLElement | null = null;
  private locked: HTMLElement | null = null;
  private sentenceSpans: HTMLElement[] = [];
  private connected: HTMLElement[] = [];

  hover(span: HTMLElement, sentenceDiv: HTMLElement): void {
    this.clearHovered();
    this.clearSentence();
    this.hovered = span;
    span.classList.add(CLS.hover);
    this.markSentence(sentenceDiv);
  }

  hoverSentence(sentenceDiv: HTMLElement): void {
    this.clearHovered();
    this.clearSentence();
    this.markSentence(sentenceDiv);
  }
  lock(span: HTMLElement, sentenceDiv: HTMLElement): void {
    this.clearHovered();
    this.clearLocked();
    this.clearSentence();
    this.locked = span;
    span.classList.add(CLS.locked);
    this.markSentence(sentenceDiv);
  }

  setConnected(spans: HTMLElement[]): void {
    this.clearConnected();
    this.connected = spans;
    spans.forEach((span) => span.classList.add(CLS.connected));
  }

  clearAll(): void {
    this.clearHovered();
    this.clearLocked();
    this.clearSentence();
    this.clearConnected();
  }

  private markSentence(sentenceDiv: HTMLElement): void {
    this.sentenceSpans = [...sentenceDiv.querySelectorAll<HTMLElement>("span")];
    this.sentenceSpans.forEach((span) => span.classList.add(CLS.sentence));
  }

  private clearHovered(): void {
    this.hovered?.classList.remove(CLS.hover);
    this.hovered = null;
  }

  private clearLocked(): void {
    this.locked?.classList.remove(CLS.locked);
    this.locked = null;
  }

  private clearSentence(): void {
    this.sentenceSpans.forEach((span) => span.classList.remove(CLS.sentence));
    this.sentenceSpans = [];
  }

  private clearConnected(): void {
    this.connected.forEach((span) => span.classList.remove(CLS.connected));
    this.connected = [];
  }
}

// ---------------------------------------------------------------------------
// autoplay
// ---------------------------------------------------------------------------
class Autoplayer {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private position = 0;
  length!: () => number;
  show!: (index: number) => boolean;
  onStop!: () => void;

  constructor(length: () => number, show: (index: number) => boolean, onStop: () => void) {
    this.length = length;
    this.show = show;
    this.onStop = onStop;
  }

  get isPlaying(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.isPlaying) return;
    if (this.position >= this.length()) this.position = 0;
    this.tick();
  }

  stop(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.onStop();
  }

  seek(index: number): void {
    this.position = index;
  }

  private tick = (): void => {
    if (this.position >= this.length()) {
      this.position = 0;
      this.stop();
      return;
    }

    if (!this.show(this.position)) {
      this.stop();
      return;
    }

    this.position++;
    this.timer = setTimeout(this.tick, AUTOPLAY_DELAY_MS);
  };
}

// ---------------------------------------------------------------------------
// full text view
// ---------------------------------------------------------------------------
export class FullTextPanel {
  private renderer: WordVecRenderer | null = null;
  private entries: TokenEntry[] = [];
  private readonly highlighter = new Highlighter();
  private readonly autoplayer: Autoplayer;
  private container: HTMLElement;
  private readonly isCenterCollapsed: () => boolean;

  constructor(container: HTMLElement, isCenterCollapsed: () => boolean, onAutoplayStopped: () => void) {
    this.autoplayer = new Autoplayer(
      () => this.entries.length,
      (index) => this.playEntry(index),
      onAutoplayStopped,
    );
    this.container = container;
    this.isCenterCollapsed = isCenterCollapsed;
    container.addEventListener("pointerover", this.onPointerOver);
    container.addEventListener("click", this.onClick);
  }
  // ----- setup -----

  attach(renderer: WordVecRenderer): void {
    this.renderer = renderer;
  }

  populate(data: TokenData): void {
    this.autoplayer.stop();
    this.autoplayer.seek(0);
    this.highlighter.clearAll();

    let offset = 0;
    this.container.innerHTML = data.tok
      .map((words, sentenceIdx) => {
        const spans = words.map((word, j) => `<span data-token="${offset + j}">${escapeHtml(word)}</span>`).join(" ");
        offset += words.length;
        return `<div class="full-sentence" data-sentence="${sentenceIdx}">${spans}</div>`;
      })
      .join("");

    this.entries = [];
    this.container.querySelectorAll<HTMLElement>("span[data-token]").forEach((span) => {
      const sentenceDiv = span.closest<HTMLElement>("div[data-sentence]")!;
      const token = Number(span.dataset.token);
      this.entries[token] = { token, sentence: Number(sentenceDiv.dataset.sentence), span, sentenceDiv };
    });
  }

  // ----- autoplay -----

  startAutoplay(): void {
    this.autoplayer.start();
  }

  pauseAutoplay(): void {
    this.autoplayer.stop();
  }

  // ----- styling -----

  resetHighlight(): void {
    this.highlighter.clearAll();
  }

  setRoleColoring(enabled: boolean): void {
    this.container.classList.toggle("wv-roles", enabled);
  }

  applyRoles(roles: RoleMap): void {
    this.entries.forEach((entry, i) => {
      const role = roles[i];
      if (role) entry.span.dataset.role = role;
      else delete entry.span.dataset.role;
    });
  }

  lockWord = (sentence: number, token: number): void => {
    const entry = this.entries[token];
    if (!entry || entry.sentence !== sentence) return;
    this.highlighter.lock(entry.span, entry.sentenceDiv);
  };

  highlightConnected = (indices: ReadonlySet<number> | null): void => {
    const spans: HTMLElement[] = [];
    indices?.forEach((i) => {
      const entry = this.entries[i];
      if (entry) spans.push(entry.span);
    });
    this.highlighter.setConnected(spans);
  };

  // ----- internals -----

  private showSentence(entry: TokenEntry): void {
    const renderer = this.renderer;
    if (!renderer) return;

    if (entry.sentence !== renderer.currentSentence) {
      renderer.render(entry.sentence);
    }
    this.highlighter.hoverSentence(entry.sentenceDiv);
  }
  private showToken(entry: TokenEntry, lock = false): void {
    const renderer = this.renderer;
    if (!renderer) return;

    if (entry.sentence !== renderer.currentSentence) {
      renderer.render(entry.sentence);
    }
    renderer.hoverToken(entry.token);

    if (lock) this.highlighter.lock(entry.span, entry.sentenceDiv);
    else this.highlighter.hover(entry.span, entry.sentenceDiv);
  }

  private playEntry(index: number): boolean {
    const entry = this.entries[index];
    if (!entry || !this.renderer || this.renderer.lockedTokenIndex !== null) return false;
    this.showToken(entry);
    return true;
  }

  private pauseAt(entry: TokenEntry): void {
    this.autoplayer.stop();
    this.autoplayer.seek(entry.token + 1);
  }

  private entryFromEvent(event: Event): TokenEntry | null {
    if (!(event.target instanceof Element)) return null;
    const span = event.target.closest<HTMLElement>("span[data-token]");
    if (!span || !this.container.contains(span)) return null;
    return this.entries[Number(span.dataset.token)] ?? null;
  }

  private onPointerOver = (event: PointerEvent): void => {
    if (!this.renderer || this.renderer.lockedTokenIndex !== null) return;

    const entry = this.entryFromEvent(event);
    if (!entry) return;

    this.pauseAt(entry);

    if (this.isCenterCollapsed()) {
      this.showToken(entry); // center hidden: show the single token
    } else {
      this.showSentence(entry); // center visible: just show the whole sentence
    }
  };

  private onClick = (event: MouseEvent): void => {
    const renderer = this.renderer;
    const entry = this.entryFromEvent(event);
    if (!renderer || !entry) return;

    this.pauseAt(entry);

    const isLocked = renderer.lockedTokenIndex !== null;
    const clickedOnLockedToken = entry.sentence === renderer.currentSentence && renderer.isLockedToken(entry.token);

    if (isLocked && !clickedOnLockedToken) {
      this.showToken(entry, true);
    }

    renderer.onClickToken(entry.token);
  };
}
