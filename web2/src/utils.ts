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
