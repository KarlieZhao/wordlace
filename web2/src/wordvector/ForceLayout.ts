import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type Simulation } from "d3-force";
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
}

/**
 * Wraps the d3 simulation. Nodes write into the shared `points` on every tick,
 * so stopping at any moment leaves words exactly where they are.
 */
export class ForceLayout {
  private simulation: Simulation<ForceNode, ForceLink> | null = null;

  /** Returns false if there was nothing to simulate. */
  start({ graph, sentences, points, onTick }: ForceOptions): boolean {
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
          // Anchor to where the word is *now*, so it never snaps back.
          anchorX: point.px,
          anchorY: point.py,
        });
        nodeIds.add(id);
      }

      for (const edge of graph.edges(sentence)) {
        const source = graph.globalIndex(sentence, edge.head);
        const target = graph.globalIndex(sentence, edge.child);

        // dm / pas / psd often share a pair; one spring per pair is enough.
        const key = source < target ? `${source}:${target}` : `${target}:${source}`;
        if (linkKeys.has(key)) continue;
        linkKeys.add(key);

        if (nodeIds.has(source) && nodeIds.has(target)) links.push({ source, target });
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
      .force("y", forceY<ForceNode>((n) => n.anchorY).strength(FORCE.anchorStrength))
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
