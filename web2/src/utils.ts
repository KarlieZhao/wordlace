import { type WordVecs } from "./types";

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const POS_COLOR_MAP: Record<string, string> = {
  ADJ: "#001219",
  ADV: "#005F73",
  PRON: "#0A9396",
  PROPN: "#94D2BD",
  DET: "#E9D8A6",
  VERB: "#126667",

  NOUN: "#EE9B00",
  ADP: "#CA6702",
  CCONJ: "#BB3E03",
  AUX: "#9b5440",
  SCONJ: "#AE2012",
  PART: "#B6992D",
  PUNCT: "#cb9792",
};

interface SimilarWordResult {
  word: string;
  score: number;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must be the same length");
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must be the same length");
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

export function findSimilarWords(
  vectors: WordVecs,
  targetWord: string,
  threshold: number,
  metric: "cosine" | "euclidean" = "euclidean",
  includeSelf: boolean = false,
): SimilarWordResult[] {
  const targetVector = vectors[targetWord];

  if (!targetVector) {
    console.warn(`Word "${targetWord}" not found in vector dictionary`);
    return [];
  }

  const results: SimilarWordResult[] = [];

  for (const [word, vector] of Object.entries(vectors)) {
    if (!includeSelf && word === targetWord) continue;

    const score =
      metric === "cosine" ? cosineSimilarity(targetVector, vector) : euclideanDistance(targetVector, vector);

    const isClose = metric === "cosine" ? score >= threshold : score <= threshold;

    if (isClose) {
      results.push({ word, score });
    }
  }

  // Sort: highest similarity first for cosine, lowest distance first for euclidean
  results.sort((a, b) => (metric === "cosine" ? b.score - a.score : a.score - b.score));

  return results;
}
