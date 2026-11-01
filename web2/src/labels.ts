import { type DepRepresentation } from "./basedependency";

/**
 * Human-readable names for the semantic-dependency labels in the raw data.
 *
 * Each label describes the role of the token that carries the relation (the
 * "child" in the renderer) relative to its head, e.g. dm "BV" means the child
 * is the bound variable (the noun) of a determiner head.
 *
 * The three schemes come from SemEval-2015 Task 18 (SDP):
 *   dm  - DELPH-IN MRS-derived bi-lexical dependencies
 *   pas - Enju predicate-argument structures (HPSG)
 *   psd - Prague Semantic Dependencies (tectogrammatical functors)
 *
 * NOTE: compiled from the published label inventories, anything missing falls back to the raw label (see `isKnownLabel`).
 */

export const REPRESENTATION_NAMES: Record<DepRepresentation, string> = {
  dm: "DELPH-IN MRS (DM)",
  pas: "Enju predicate-argument (PAS)",
  psd: "Prague semantic dependencies (PSD)",
};

/* ------------------------------------------------------------------ */
/* POS                                                                */
/* ------------------------------------------------------------------ */

export const POS_LABELS: Record<string, string> = {
  ADJ: "adjective",
  ADP: "preposition",
  ADV: "adverb",
  AUX: "auxiliary verb",
  CCONJ: "coordinating conjunction",
  DET: "determiner",
  INTJ: "interjection",
  NOUN: "noun",
  NUM: "number",
  PART: "particle",
  PRON: "pronoun",
  PROPN: "proper noun",
  PUNCT: "punctuation",
  SCONJ: "subordinating conjunction",
  SYM: "symbol",
  VERB: "verb",
  X: "other",
};

/* ------------------------------------------------------------------ */
/* DM                                                                  */
/* ------------------------------------------------------------------ */


export const DM_LABELS: Record<string, string> = {
  compound: "compound",
  compound_name: "name compound",
  poss: "possessor",
  mwe: "multi-word expression",
  loc: "location",
  times: "time",
  part: "part",
  subord: "subordinate clause",
  comp: "complementizer",
  comp_so: "complementizer (so)",
  neg: "negation",
  appos: "apposition",

  ARG1: "participant",
  ARG2: "secondary participant",
  ARG3: "recipient / destination",
  ARG4: "source",
  ARG5: "additional participant",

  BV: "determiner",

  manner: "manner",
  time: "time",
  quantity: "quantity",
  direction: "direction",
};

/* ------------------------------------------------------------------ */
/* PAS  (labels look like "verb_ARG1", "prep_MOD", ...)                */
/* ------------------------------------------------------------------ */


const PAS_PREDICATES: Record<string, string> = {
  adj: "adjective",
  adv: "adverb",
  app: "apposition",
  aux: "auxiliary",
  comp: "complementizer",
  conj: "conjunction",
  coord: "coordination",
  det: "determiner",
  lgs: "logical subject",
  noun: "noun",
  prep: "preposition",
  prt: "particle",
  punct: "punctuation",
  quote: "quotation",
  verb: "verb",
};

const PAS_ROLES: Record<string, string> = {
  ARG1: "primary participant",
  ARG2: "secondary participant",
  ARG3: "recipient / destination",
  ARG4: "source / origin",

  MOD: "modifier",
  det_ARG1: "determiner",
  det_ARG2: "determiner",
  verb_ARG1: "verb participant",
  verb_ARG2: "verb secondary participant",
  noun_ARG1: "noun participant",
  noun_ARG2: "noun secondary participant",
  adj_ARG1: "adjective participant",
  adj_ARG2: "adjective secondary participant",
  prep_ARG1: "preposition object",
  prep_ARG2: "preposition complement",
  conj_ARG1: "conjunction participant",
  conj_ARG2: "conjunction secondary participant",
};

/** Every predicate x role combination, e.g. "verb_ARG1" -> "verb argument 1". */
export const PAS_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(PAS_PREDICATES).flatMap(([pred, predName]) =>
    Object.entries(PAS_ROLES).map(([role, roleName]) => [`${pred}_${role}`, `${predName} ${roleName}`]),
  ),
);

/* ------------------------------------------------------------------ */
/* PSD  (Prague functors; "-arg" = obligatory argument, ".member" =    */
/*       member of a coordination)                                     */
/* ------------------------------------------------------------------ */

export const PSD_LABELS: Record<string, string> = {
  ACMP: "accompaniment",
  ACT: "actor",
  ADDR: "addressee",
  ADVS: "adversative (but)",
  AIM: "purpose",
  APP: "appurtenance (possessor)",
  APPS: "apposition",
  ATT: "attitude",
  BEN: "benefactor",
  CAUS: "cause",
  CM: "conjunction modifier",
  CNCS: "concession",
  COMPL: "predicative complement",
  COND: "condition",
  CONFR: "confrontation",
  CONJ: "conjunction (and)",
  CPR: "comparison",
  CRIT: "criterion",
  CSQ: "consequence",
  CTERF: "counterfactual condition",
  DIFF: "difference",
  DIR1: "direction: from",
  DIR2: "direction: through",
  DIR3: "direction: to",
  DISJ: "disjunction (or)",
  DPHR: "dependent part of phrase",
  EFF: "effect",
  ETHD: "ethical dative",
  EXT: "extent",
  FPHR: "foreign phrase",
  GRAD: "gradation",
  HER: "heritage",
  ID: "identity",
  INTF: "expletive",
  INTT: "intention",
  LOC: "location",
  MANN: "manner",
  MAT: "material",
  MEANS: "means",
  MOD: "modal modifier",
  ORIG: "origin",
  PAR: "parenthesis",
  PARTL: "particle",
  PAT: "patient",
  PN: "proper name",
  PREC: "preceding context",
  PRED: "predicate",
  REAS: "reason",
  REG: "regard",
  RESL: "result",
  RESTR: "restriction",
  RHEM: "rhematizer (focus particle)",
  RSTR: "restrictor (modifier of a noun)",
  SUBS: "substitution",
  TFHL: "time: for how long",
  TFRWH: "time: from when",
  THL: "time: duration",
  THO: "time: how often",
  TOWH: "time: to when",
  TPAR: "time: parallel to",
  TSIN: "time: since when",
  TTILL: "time: until when",
  TWHEN: "time: when",
  VOCAT: "vocative",
};

/* ------------------------------------------------------------------ */
/* Lookup                                                              */
/* ------------------------------------------------------------------ */

const ARG_SUFFIX = "-arg";
const MEMBER_SUFFIX = ".member";

/** DM conjunctions are labelled by the conjunction itself: "_and_c", "_as+well+as_c". */
const DM_CONJUNCTION = /^_(.+)_c$/;

function lookup(rep: DepRepresentation, label: string): string | null {
  switch (rep) {
    case "dm": {
      if (DM_LABELS[label]) return DM_LABELS[label];
      const m = DM_CONJUNCTION.exec(label);
      return m ? `conjunction "${m[1].replace(/\+/g, " ")}"` : null;
    }
    case "pas":
      return PAS_LABELS[label] ?? null;
    case "psd": {
      let base = label;
      let suffix = "";
      if (base.endsWith(ARG_SUFFIX)) {
        base = base.slice(0, -ARG_SUFFIX.length);
        suffix = " (argument)";
      } else if (base.endsWith(MEMBER_SUFFIX)) {
        base = base.slice(0, -MEMBER_SUFFIX.length);
        suffix = " member";
      }
      const name = PSD_LABELS[base];
      return name ? name + suffix : null;
    }
  }
}

/** Readable name for a label; falls back to the raw label if unknown. */
export function labelName(rep: DepRepresentation, label: string): string {
  return lookup(rep, label) ?? label;
}

/** Handy for finding labels the dictionaries don't cover. */
export function isKnownLabel(rep: DepRepresentation, label: string): boolean {
  return lookup(rep, label) !== null;
}
