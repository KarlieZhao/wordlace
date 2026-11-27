import type { FocusInfo, WordVecRenderer } from "./wordvecrenderer";

const CLS = {
  key: "key-word",
  connected: "connected-words",
  sentence: "highlighted-sentence",
} as const;
const AUTOPLAY_DELAY_MS = 500;

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
  private key: HTMLElement[] = [];
  private connected: HTMLElement[] = [];
  private sentenceSpans: HTMLElement[] = [];

  setFocus(key: HTMLElement[], connected: HTMLElement[], sentenceDiv: HTMLElement | null): void {
    this.clearAll();
    this.key = key;
    this.connected = connected;
    key.forEach((span) => span.classList.add(CLS.key));
    connected.forEach((span) => span.classList.add(CLS.connected));
    if (sentenceDiv) this.markSentence(sentenceDiv);
  }

  hoverSentence(sentenceDiv: HTMLElement): void {
    this.clearKey();
    this.clearSentence();
    this.markSentence(sentenceDiv);
  }

  clearAll(): void {
    this.clearKey();
    this.clearSentence();
    this.clearConnected();
  }

  private markSentence(sentenceDiv: HTMLElement): void {
    this.sentenceSpans = [...sentenceDiv.querySelectorAll<HTMLElement>("span")];
    this.sentenceSpans.forEach((span) => span.classList.add(CLS.sentence));
  }

  private clearKey(): void {
    this.key.forEach((span) => span.classList.remove(CLS.key));
    this.key = [];
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
  private parent: HTMLDivElement;
  private containerBbox: { top: number } = { top: 0 };
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
    this.parent = document.querySelector(".fulltext-scroll-container") as HTMLDivElement;
    this.containerBbox = this.parent.getBoundingClientRect();
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
  isAutoPlaying() {
    return this.autoplayer?.isPlaying || false;
  }
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

  highlightFocus = (focus: FocusInfo | null): void => {
    if (!focus) {
      this.highlighter.clearAll();
      return;
    }

    const firstKey = focus.key.values().next().value as number | undefined;
    const sentenceDiv = firstKey === undefined ? null : (this.entries[firstKey]?.sentenceDiv ?? null);
    const keys = this.spansOf(focus.key);
    this.highlighter.setFocus(keys, this.spansOf(focus.connected), sentenceDiv);

    const elBbox = keys[0].getBoundingClientRect();

    const relativeTop = elBbox.top - this.containerBbox.top + this.parent.scrollTop;
    const targetTop = relativeTop - this.parent.clientHeight / 2 + elBbox.height / 2;
    this.parent.scrollTo({ top: targetTop, behavior: "smooth" });
  };

  private spansOf(indices: ReadonlySet<number>): HTMLElement[] {
    const spans: HTMLElement[] = [];
    indices.forEach((i) => {
      const entry = this.entries[i];
      if (entry) spans.push(entry.span);
    });
    return spans;
  }

  private showSentence(entry: TokenEntry): void {
    const renderer = this.renderer;
    if (!renderer) return;

    if (entry.sentence !== renderer.currentSentence) {
      renderer.render(entry.sentence);
    }
    this.highlighter.hoverSentence(entry.sentenceDiv);
  }

  private showToken(entry: TokenEntry): void {
    const renderer = this.renderer;
    if (!renderer) return;

    if (entry.sentence !== renderer.currentSentence) {
      renderer.render(entry.sentence);
    }
    renderer.hoverToken(entry.token);
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

    if (entry.sentence !== renderer.currentSentence) {
      renderer.render(entry.sentence);
    }
    renderer.onClickToken(entry.token);
  };
}
