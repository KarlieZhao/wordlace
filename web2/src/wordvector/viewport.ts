/** Nearest scrollable element, starting with `el` itself; null means the page scrolls. */
export function findScrollParent(el: HTMLElement): HTMLElement | null {
  for (
    let p: HTMLElement | null = el;
    p && p !== document.body && p !== document.documentElement;
    p = p.parentElement
  ) {
    const style = getComputedStyle(p);
    const scrollsX = /(auto|scroll|overlay)/.test(style.overflowX) && p.scrollWidth > p.clientWidth;
    const scrollsY = /(auto|scroll|overlay)/.test(style.overflowY) && p.scrollHeight > p.clientHeight;
    if (scrollsX || scrollsY) return p;
  }
  return null;
}

/**
 * Reports the mouse's clientX/clientY while the pointer is inside the visible area of
 * `anchor`'s scroll container (or the window). Throttled to one call per frame.
 * It also re-reports after scrolling, because the content under a stationary
 * mouse changes when the page moves.
 */
export class PointerTracker {
  private readonly anchor: HTMLElement;
  private readonly onMove: (clientX: number, clientY: number) => void;
  private lastX: number | null = null;
  private lastY: number | null = null;
  private frame: number | null = null;

  constructor(anchor: HTMLElement, onMove: (clientX: number, clientY: number) => void) {
    this.anchor = anchor;
    this.onMove = onMove;
  }

  start(): void {
    document.addEventListener("mousemove", this.handleMove, { passive: true });
    // `scroll` doesn't bubble, but it can be captured from the document.
    document.addEventListener("scroll", this.handleScroll, { capture: true, passive: true });
  }

  stop(): void {
    document.removeEventListener("mousemove", this.handleMove);
    document.removeEventListener("scroll", this.handleScroll, { capture: true });
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  private handleMove = (event: MouseEvent): void => {
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.schedule();
  };

  private handleScroll = (): void => {
    if (this.lastY !== null) this.schedule();
  };

  private schedule(): void {
    if (this.frame !== null) return;

    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      if (this.lastX === null || this.lastY === null) return;

      const scroller = findScrollParent(this.anchor);
      const view = scroller
        ? scroller.getBoundingClientRect()
        : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

      const inside =
        this.lastX >= view.left &&
        this.lastX <= view.left + view.width &&
        this.lastY >= view.top &&
        this.lastY <= view.top + view.height;

      if (inside) this.onMove(this.lastX, this.lastY);
    });
  }
}
