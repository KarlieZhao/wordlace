import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, type Simulation } from "d3-force";
import type { ForceLink, ForceNode, Point } from "./basedependency";
import { FORCE } from "./config";
import type { DependencyGraph } from "./DependencyGraph";

export interface ForceOptions {
  graph: DependencyGraph;
  /** Sentences whose tokens take part in the simulation. */
  sentences: number[];
  /** Persistent positions; nodes write into these each tick. */
  points: Point[];
  onTick: (nodes: readonly ForceNode[]) => void;
  /** Per-token target Y (e.g. score-based row). Nodes without one stay at anchorY (no drift). */
  targetY?: (id: number) => number | undefined;
  /** Time for the y-pull to ramp from 0 to full strength. Default 1500ms. */
  seqYRampMs?: number;
}

/**
 * Wraps the d3 simulation. Nodes write into the shared `points` on every tick,
 * so stopping at any moment leaves words exactly where they are.
 */
export class ForceLayout {
  private simulation: Simulation<ForceNode, ForceLink> | null = null;

  /**
   * Custom "y" force: pulls each node from its anchorY toward its targetY,
   * with the pull's strength ramping smoothly from 0 to `strength` over `rampMs`.
   * Not d3.forceY(...) because forceY's target accessor is cached once at
   * initialize() and can't reflect a value that changes tick-to-tick.
   */
  private static createSeqYForce(nodes: ForceNode[], strength: number, rampMs: number) {
    let startTime: number | null = null;

    return (alpha: number) => {
      if (startTime === null) startTime = performance.now();
      const t = rampMs > 0 ? Math.min(1, (performance.now() - startTime) / rampMs) : 1;
      const eased = t * t * (3 - 2 * t); // smoothstep

      for (const node of nodes) {
        const target = node.anchorY + (node.targetY - node.anchorY) * eased;
        const y = node.y ?? node.anchorY;
        node.vy = (node.vy ?? 0) + (target - y) * strength * alpha;
      }
    };
  }

  /** Returns false if there was nothing to simulate. */
  start({ graph, sentences, points, onTick, targetY, seqYRampMs = 4000 }: ForceOptions): boolean {
    this.stop();

    const nodes: ForceNode[] = [];
    const nodeIds = new Set<number>();
    const links: ForceLink[] = [];
    const linkKeys = new Set<string>();

    for (const sentence of sentences) {
      const [start, end] = graph.sentenceRange(sentence);

      for (let id = start; id < end; id++) {
        const point = points[id];
        if (!point) continue;

        nodes.push({
          id,
          point,
          x: point.px,
          y: point.py,
          anchorX: point.px,
          anchorY: point.py,
          targetY: targetY?.(id) ?? point.py,
        });
        nodeIds.add(id);
      }

      for (const edge of graph.edges(sentence)) {
        const source = graph.globalIndex(sentence, edge.head);
        const child = graph.globalIndex(sentence, edge.child);

        // dm / pas / psd often share a pair; one spring per pair is enough.
        const key = source < child ? `${source}:${child}` : `${child}:${source}`;
        if (linkKeys.has(key)) continue;
        linkKeys.add(key);

        if (nodeIds.has(source) && nodeIds.has(child)) links.push({ source, target: child });
      }
    }

    if (!nodes.length) return false;

    const simulation = forceSimulation<ForceNode>(nodes)
      .force(
        "link",
        forceLink<ForceNode, ForceLink>(links)
          .id((n) => n.id)
          .distance(FORCE.linkDistance)
          .strength(FORCE.linkStrength),
      )
      .force("charge", forceManyBody<ForceNode>().strength(FORCE.chargeStrength).distanceMax(FORCE.chargeMaxDistance))
      .force("collide", forceCollide<ForceNode>(FORCE.collideRadius).strength(FORCE.collideStrength).iterations(2))
      .force("x", forceX<ForceNode>((n) => n.anchorX).strength(FORCE.anchorStrength))
      .force("y", ForceLayout.createSeqYForce(nodes, FORCE.anchorStrength, seqYRampMs))
      .alpha(FORCE.alpha)
      .alphaDecay(FORCE.alphaDecay)
      .velocityDecay(FORCE.velocityDecay);

    this.simulation = simulation;

    simulation.on("tick", () => {
      if (this.simulation !== simulation) return;

      for (const node of nodes) {
        if (node.x == null || node.y == null) continue;
        node.point.px = node.x;
        node.point.py = node.y;
      }
      onTick(nodes);
    });

    simulation.on("end", () => {
      if (this.simulation === simulation) this.simulation = null;
    });

    return true;
  }

  stop(): void {
    this.simulation?.stop();
    this.simulation = null;
  }
}
