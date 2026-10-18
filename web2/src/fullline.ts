export class FullLine {
  private readonly container: HTMLDivElement;
  private hotIndex: number | null = null;
  private lockedIndex: number | null = null;

  constructor(container: HTMLDivElement, onHover: (token: number | null) => void, onClick: (token: number) => void) {
    this.container = container;

    container.addEventListener("mouseover", (e) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(".full-line-word");
      if (el) onHover(Number(el.dataset.index));
    });

    container.addEventListener("mouseout", (e) => {
      const to = (e.relatedTarget as Element | null)?.closest?.(".full-line-word");
      if (to) return;
      onHover(null);
    });
    container.addEventListener("click", (e) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(".full-line-word");
      if (el) onClick(Number(el.dataset.index));
    });
  }

  // render, setHot, spanLeft, spanAt unchanged

  /** Rebuilds the line for tokens [start, end) and positions it at `left` px. */
  render(words: readonly string[], start: number, end: number, left: number): void {
    this.hotIndex = null; // rebuilding clears hot spans
    this.container.innerHTML = "";
    this.lockedIndex = null;
    for (let i = start; i < end; i++) {
      const span = document.createElement("div");
      span.dataset.index = String(i);
      span.textContent = words[i] + " ";
      span.classList.add("full-line-word");
      this.container.appendChild(span);
    }

    this.container.style.left = `${left}px`;
  }

  setHot(token: number | null): void {
    if (this.hotIndex !== null) {
      this.spanAt(this.hotIndex)?.classList.remove("wv-hot");
    }
    this.hotIndex = token;
    if (token !== null) {
      this.spanAt(token)?.classList.add("wv-hot");
    }
  }

  /** Viewport-relative left edge of a token's span, or null if it isn't rendered. */
  spanLeft(index: number): number | null {
    const span = this.spanAt(index);
    return span ? span.getBoundingClientRect().left : null;
  }

  private spanAt(index: number): HTMLElement | null {
    return this.container.querySelector<HTMLElement>(`[data-index="${index}"]`);
  }

  setLocked(token: number | null): void {
    if (this.lockedIndex !== null) {
      this.spanAt(this.lockedIndex)?.classList.remove("wv-locked");
    }
    this.lockedIndex = token;
    if (token !== null) {
      this.spanAt(token)?.classList.add("wv-locked");
    }
  }
}
