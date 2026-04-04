//   // nouns
//   "noun":                        "NN",
//   "noun, singular":              "NN",
//   "noun, plural":                "NNS",
//   "proper noun, singular":       "NNP",
//   "proper noun, plural":         "NNPS",

//   // pronouns
//   "pronoun, personal":           "PRP",
//   "pronoun, possessive":         "PRP$",
//   "wh-pronoun":                  "WP",
//   "wh-pronoun, possessive":      "WP$",

//   // verbs
//   "verb, base form":             "VB",
//   "verb, 3rd person singular":   "VBZ",
//   "verb, past tense":            "VBD",
//   "verb, non-3rd person singular present": "VBP",
//   "verb, past participle":       "VBN",
//   "verb, gerund / present participle": "VBG",

//   // adjectives
//   "adjective":                   "JJ",
//   "adjective, comparative":      "JJR",
//   "adjective, superlative":      "JJS",

//   // adverbs
//   "adverb":                      "RB",
//   "adverb, comparative":         "RBR",
//   "adverb, superlative":         "RBS",
//   "wh-adverb":                   "WRB",

//   // determiners & predeterminers
//   "determiner":                  "DT",
//   "predeterminer":               "PDT",
//   "possessive ending":           "POS",
//   "wh-determiner":               "WDT",

//   // prepositions & particles
//   "preposition / subordinating conjunction": "IN",
//   "particle":                    "RP",
//   "infinitival to":              "TO",

//   // modals & auxiliaries
//   "modal":                       "MD",

//   // conjunctions
//   "coordinating conjunction":    "CC",

//   // numbers & symbols
//   "cardinal number":             "CD",
//   "list item marker":            "LS",
//   "symbol":                      "SYM",
//   "currency":                    "$",
//   "opening quotation mark":      "``",
//   "closing quotation mark":      "''",
//   "opening parenthesis":         "-LRB-",
//   "closing parenthesis":         "-RRB-",
//   "punctuation":                 ".",
//   "comma":                       ",",
//   "colon / semicolon / ellipsis": ":",

//   // other
//   "existential there":           "EX",
//   "foreign word":                "FW",
//   "interjection":                "UH",


// Grammar: which POS can follow which POS
export const POS_TRANSITIONS = {
  // Determiner: before adj, noun, or adverb modifying noun
  DT:  ["JJ", "JJR", "JJS", "NN", "NNS", "NNP", "NNPS", "RB"],

  // Pronoun: before modal, verb, adverb, or another verb form
  PRP: ["MD", "VB", "VBZ", "VBD", "VBP", "VBG", "RB", "VBN"],

  // Possessive pronoun (my, your, his): before noun or adj
  PRP$: ["NN", "NNS", "NNP", "JJ", "JJR"],

  // Modal: before base verb or adverb
  MD:  ["VB", "RB", "VBN", "VBG"],

  // Base verb: before noun, det, prep, adverb, particle, pronoun
  VB:  ["DT", "NN", "NNS", "NNP", "IN", "RB", "RP", "PRP", "JJ", "VBG", "VB"],

  // Verb present 3sg (runs, takes): same as VB
  VBZ: ["DT", "NN", "NNS", "NNP", "IN", "RB", "RP", "PRP", "JJ", "VBG", "VBN"],

  // Verb past (ran, took)
  VBD: ["DT", "NN", "NNS", "NNP", "IN", "RB", "RP", "PRP", "JJ", "VBG", "VBN"],

  // Verb present non-3sg (I run, we take)
  VBP: ["DT", "NN", "NNS", "NNP", "IN", "RB", "RP", "PRP", "JJ", "VBG", "VBN"],

  // Verb gerund/present-participle (running): before noun, prep, adverb
  VBG: ["DT", "NN", "NNS", "NNP", "IN", "RB", "PRP", "JJ"],

  // Verb past-participle (forgotten, seen): before prep, adverb, noun
  VBN: ["IN", "RB", "DT", "NN", "NNS", "PRP", "CC"],

  // Adjective: before noun, another adj, or coordinating conj
  JJ:  ["NN", "NNS", "NNP", "NNPS", "JJ", "JJR", "JJS", "CC"],
  JJR: ["NN", "NNS", "CC", "IN"],   // comparative (darker)
  JJS: ["NN", "NNS", "CC"],          // superlative (darkest)

  // Singular noun: before verb, prep, conj, another noun, or modal
  NN:  ["VB", "VBZ", "VBD", "VBP", "VBN", "VBG", "IN", "CC", "MD", "NN", "NNS", "POS"],

  // Plural noun
  NNS: ["VB", "VBZ", "VBD", "VBP", "VBN", "VBG", "IN", "CC", "MD", "POS"],

  // Proper noun singular (London, Alice)
  NNP: ["VB", "VBZ", "VBD", "VBP", "IN", "CC", "MD", "NNP", "NN"],

  // Proper noun plural
  NNPS: ["VB", "VBZ", "VBD", "VBP", "IN", "CC", "MD"],

  // Adverb: before verb, adj, another adverb, or modal
  RB:  ["VB", "VBZ", "VBD", "VBP", "VBG", "VBN", "JJ", "JJR", "RB", "RBR", "MD"],
  RBR: ["JJ", "JJR", "VB", "RB"],   // comparative adverb (more quickly)
  RBS: ["JJ", "VB", "RB"],           // superlative adverb (most quickly)

  // Preposition/subordinating conj: before det, noun, pronoun, verb
  IN:  ["DT", "NN", "NNS", "NNP", "PRP", "VBG", "JJ", "RB", "WDT", "WP"],

  // Coordinating conjunction (and, but, or): restarts almost anything
  CC:  ["DT", "NN", "NNS", "NNP", "PRP", "VB", "VBD", "VBP", "VBZ", "JJ", "RB", "MD", "IN"],

  // Particle (to in infinitive): before base verb only
  TO:  ["VB"],

  // Wh-determiner (that, which, what as relative): before noun or verb
  WDT: ["NN", "NNS", "VB", "VBZ", "VBD", "VBP", "MD"],

  // Wh-pronoun (who, what): before verb or modal
  WP:  ["VB", "VBZ", "VBD", "VBP", "MD", "RB"],

  // Wh-adverb (when, where, why, how): before pronoun, noun, modal, verb
  WRB: ["PRP", "DT", "NN", "MD", "VB", "VBP", "RB"],

  // Existential there: before verb
  EX:  ["VB", "VBZ", "VBD", "VBP", "MD"],

  // Possessive ending ('s): before noun, adj
  POS: ["NN", "NNS", "JJ", "NNP"],
};

export const POS_MAP = {
  // pronouns
  i: "PRP",
  you: "PRP",
  he: "PRP",
  she: "PRP",
  we: "PRP",
  they: "PRP",
  it: "PRP",
  me: "PRP",
  him: "PRP",
  her: "PRP",
  us: "PRP",
  them: "PRP",
  // modal / aux verbs
  must: "MD",
  should: "MD",
  can: "MD",
  could: "MD",
  would: "MD",
  will: "MD",
  shall: "MD",
  may: "MD",
  might: "MD",
  // copula / aux
  be: "VB",
  is: "VB",
  are: "VB",
  was: "VB",
  were: "VB",
  been: "VB",
  am: "VB",
  being: "VB",
  // "to be" special
  to: "TO",
  // conjunctions
  when: "CC",
  but: "CC",
  and: "CC",
  or: "CC",
  yet: "CC",
  so: "CC",
  for: "CC",
  // common adverbs
  even: "RB",
  first: "RB",
  then: "RB",
  always: "RB",
  never: "RB",
  often: "RB",
  just: "RB",
  only: "RB",
  also: "RB",
  still: "RB",
  again: "RB",
  finally: "RB",
  simply: "RB",
  truly: "RB",
  deeply: "RB",
  // prepositions
  in: "IN",
  on: "IN",
  at: "IN",
  by: "IN",
  with: "IN",
  from: "IN",
  of: "IN",
  about: "IN",
  through: "IN",
  into: "IN",
  over: "IN",
  under: "IN",
  between: "IN",
  among: "IN",
  // articles / determiners
  the: "DT",
  a: "DT",
  an: "DT",
  this: "DT",
  that: "DT",
  these: "DT",
  those: "DT",
  my: "DT",
  your: "DT",
  his: "DT",
  its: "DT",
  our: "DT",
  their: "DT",
  // common adjectives
  unknown: "JJ",
  gorgeous: "JJ",
  beautiful: "JJ",
  terrible: "JJ",
  wonderful: "JJ",
  small: "JJ",
  big: "JJ",
  large: "JJ",
  good: "JJ",
  bad: "JJ",
  new: "JJ",
  old: "JJ",
  young: "JJ",
  free: "JJ",
  real: "JJ",
  true: "JJ",
  false: "JJ",
  hard: "JJ",
  soft: "JJ",
  dark: "JJ",
  bright: "JJ",
  wild: "JJ",
  quiet: "JJ",
  silent: "JJ",
  open: "JJ",
  // past participles / passive
  seen: "VBN",
  hunted: "VBN",
  known: "VBN",
  loved: "VBN",
  found: "VBN",
  lost: "VBN",
  given: "VBN",
  taken: "VBN",
  made: "VBN",
  done: "VBN",
  called: "VBN",
  used: "VBN",
  allowed: "VBN",
  broken: "VBN",
  born: "VBN",
  shown: "VBN",
  written: "VBN",
  spoken: "VBN",
  hidden: "VBN",
  forgotten: "VBN",
  gone: "VBN",
  // verbs
  allows: "VB",
  allow: "VB",
  see: "VB",
  look: "VB",
  go: "VB",
  come: "VB",
  make: "VB",
  think: "VB",
  know: "VB",
  want: "VB",
  need: "VB",
  feel: "VB",
  seem: "VB",
  appear: "VB",
  become: "VB",
  stay: "VB",
  leave: "VB",
  move: "VB",
  turn: "VB",
  show: "VB",
  tell: "VB",
  ask: "VB",
  take: "VB",
  give: "VB",
  find: "VB",
  keep: "VB",
  call: "VB",
  try: "VB",
  let: "VB",
  put: "VB",
  run: "VB",
  walk: "VB",
  stand: "VB",
  sit: "VB",
  hold: "VB",
  live: "VB",
  work: "VB",
  play: "VB",
  stop: "VB",
  start: "VB",
  begin: "VB",
  end: "VB",
  close: "VB",
  believe: "VB",
  forget: "VB",
  remember: "VB",
  understand: "VB",
  touch: "VB",
  reach: "VB",
  catch: "VB",
  release: "VB",
  escape: "VB",
  breathe: "VB",
  watch: "VB",
  listen: "VB",
  speak: "VB",
  //nouns
  truth: "NN",
};

export const COL_ORDER = [
  "PRP",
  "TO",
  "DT",
  "IN",
  "MD",
  "RB",
  "CC",
  "VB",
  "VBN",
  "JJ",
  "NN",
  "FW",
];

export const COL_LABELS = {
  PRP: "pronoun",
  TO: "particle",
  DT: "det.",
  IN: "prep.",
  MD: "modal",
  RB: "adverb",
  CC: "conj.",
  VB: "verb",
  VBN: "pp. verb",
  JJ: "adj.",
  NN: "noun",
  FW: "other",
};
