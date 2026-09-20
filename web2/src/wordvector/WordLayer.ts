import { TRANSITION_PROPS_WHILE_SIMULATING } from "./config";
export class WordLayer {
  private els: HTMLElement[] = [];
  private connected = new Set<number>();
  private hot = new Set<number>();
  private hoverCb: ((token: number | null) => void) | null = null;

  private readonly root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;

    root.addEventListener("mouseover", (e) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(".vector-word");
      if (el && this.root.contains(el)) this.hoverCb?.(Number(el.dataset.index));
    });

    root.addEventListener("mouseout", (e) => {
      const to = (e.relatedTarget as Element | null)?.closest?.(".vector-word");
      if (to) return; // moving straight onto another word; its mouseover takes over
      this.hoverCb?.(null);
    });
  }

  onHover(cb: (token: number | null) => void): void {
    this.hoverCb = cb;
  }

  /** Builds the word elements once per dataset. */
  build(tokens: string[]): void {
    this.root.innerHTML = "";
    this.connected.clear();
    this.hot.clear();
    this.root.classList.remove("wv-focus");

    const fragment = document.createDocumentFragment();
    this.els = tokens.map((token, i) => {
      const el = document.createElement("div");
      el.textContent = token;
      el.dataset.word = token.toLocaleLowerCase();
      el.dataset.index = String(i);
      el.classList.add("vector-word");
      fragment.appendChild(el);
      return el;
    });
    this.root.appendChild(fragment);
  }

  place(index: number, x: number, y: number): void {
    const style = this.els[index]?.style;
    if (!style) return;
    style.left = `${x}px`;
    style.top = `${y}px`;
  }

  /** Empty string restores the stylesheet's own left/top transitions. */
  setTransitions(simulating: boolean): void {
    const value = simulating ? TRANSITION_PROPS_WHILE_SIMULATING : "";
    for (const el of this.els) el.style.transitionProperty = value;
  }

  /** Words that have at least one visible edge (the old "highlighted-word"). */
  setConnected(indices: ReadonlySet<number>): void {
    this.diffClass(this.connected, indices, "highlighted-word");
  }

  /** Hover focus: `null` clears it. Everything not in `indices` is pushed back via CSS. */
  setFocus(indices: ReadonlySet<number> | null): void {
    this.diffClass(this.hot, indices ?? new Set(), "wv-hot");
    this.root.classList.toggle("wv-focus", indices !== null);
  }

  /** Viewport coordinates of the origin that `left`/`top` are relative to. */
  origin(index: number): { left: number; top: number } {
    const parent = (this.els[index]?.offsetParent as HTMLElement | null) ?? this.root;
    const r = parent.getBoundingClientRect();
    return {
      left: r.left + parent.clientLeft - parent.scrollLeft,
      top: r.top + parent.clientTop - parent.scrollTop,
    };
  }

  private diffClass(current: Set<number>, next: ReadonlySet<number>, cls: string): void {
    for (const i of current) {
      if (!next.has(i)) this.els[i]?.classList.remove(cls);
    }
    for (const i of next) {
      if (!current.has(i)) this.els[i]?.classList.add(cls);
    }
    current.clear();
    next.forEach((i) => current.add(i));
  }
}