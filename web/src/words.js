import nlp from 'compromise/two';

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
  DT: ["JJ", "JJR", "JJS", "NN", "NNS", "NNP", "NNPS", "RB"],

  // Pronoun: before modal, verb, adverb, or another verb form
  PRP: ["MD", "VB", "VBZ", "VBD", "VBP", "VBG", "RB", "VBN"],

  // Possessive pronoun (my, your, his): before noun or adj
  PRP$: ["NN", "NNS", "NNP", "JJ", "JJR"],

  // Modal: before base verb or adverb
  MD: ["VB", "VBP", "VBZ", "RB", "VBN", "VBG"],

  // Base verb: before noun, det, prep, adverb, particle, pronoun
  VB: ["DT", "NN", "NNS", "NNP", "IN", "RB", "RP", "PRP", "JJ", "VBG", "VB"],

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
  JJ: ["NN", "NNS", "NNP", "NNPS", "JJ", "JJR", "JJS", "CC"],
  JJR: ["NN", "NNS", "CC", "IN"],   // comparative
  JJS: ["NN", "NNS", "CC"],          // superlative

  // Singular noun: before verb, prep, conj, another noun, or modal
  NN: ["VB", "VBZ", "VBD", "VBP", "VBN", "VBG", "IN", "CC", "MD", "NN", "NNS", "POS"],

  // Plural noun
  NNS: ["VB", "VBZ", "VBD", "VBP", "VBN", "VBG", "IN", "CC", "MD", "POS"],

  // Proper noun singular (London, Alice)
  NNP: ["VB", "VBZ", "VBD", "VBP", "IN", "CC", "MD", "NNP", "NN"],

  // Proper noun plural
  NNPS: ["VB", "VBZ", "VBD", "VBP", "IN", "CC", "MD"],

  // Adverb: before verb, adj, another adverb, or modal
  RB: ["VB", "VBZ", "VBD", "VBP", "VBG", "VBN", "JJ", "JJR", "RB", "RBR", "MD"],
  RBR: ["JJ", "JJR", "VB", "RB"],   // comparative adverb (more quickly)
  RBS: ["JJ", "VB", "RB"],           // superlative adverb (most quickly)

  // Preposition/subordinating conj: before det, noun, pronoun, verb
  IN: ["DT", "NN", "NNS", "NNP", "PRP", "VBG", "JJ", "RB", "WDT", "WP"],

  // Coordinating conjunction (and, but, or): restarts almost anything
  CC: ["DT", "NN", "NNS", "NNP", "PRP", "VB", "VBD", "VBP", "VBZ", "JJ", "RB", "MD", "IN"],

  // Particle (to in infinitive): before base verb only
  TO: ["VB"],

  // Wh-determiner (that, which, what as relative): before noun or verb
  WDT: ["NN", "NNS", "VB", "VBZ", "VBD", "VBP", "MD"],

  // Wh-pronoun (who, what): before verb or modal
  WP: ["VB", "VBZ", "VBD", "VBP", "MD", "RB"],

  // Wh-adverb (when, where, why, how): before pronoun, noun, modal, verb
  WRB: ["PRP", "DT", "NN", "MD", "VB", "VBP", "RB"],

  // Existential there: before verb
  EX: ["VB", "VBZ", "VBD", "VBP", "MD"],

  // Possessive ending ('s): before noun, adj
  POS: ["NN", "NNS", "JJ", "NNP"],
};


export const COL_ORDER = ["PRP", "NN", "RB", "VB", "VBN", "JJ", "IN", "MD", "DT", "CC", "TO", "FW"];

export const COL_LABELS = {
  PRP: "pronoun",
  NN: "noun",
  RB: "adverb",
  VB: "verb",
  VBN: "pp. verb",
  JJ: "adj.",
  IN: "prep.",
  MD: "modal",
  DT: "det.",
  CC: "conj.",
  TO: "particle",
  FW: "other",
};

export const normalize = (str) => nlp(str).out('normal').trim();


/**
 * given a raw word, return its normalized followers as surface forms.
 * e.g. queryFollowers("hates") → ["this", "that"]
 */
export function queryFollowers(word) {
  const norm = normalize(word);
  const followers = bigramIndex.get(norm);
  if (!followers) return [];
  return [...followers].map(n => surfaceMap.get(n) || n);
}

/**
 * return the full bigram index as a plain object, for debugging
 */
export function getIndex() {
  const out = {};
  bigramIndex.forEach((followers, word) => {
    const surfaceWord = surfaceMap.get(word) || word;
    out[surfaceWord] = [...followers].map(n => surfaceMap.get(n) || n);
  });
  return out;
}
