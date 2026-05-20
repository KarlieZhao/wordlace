import re
import random
from ink.storage import read_log

POS_MAP = {
    "i": "PRON",
    "you": "PRON",
    "he": "PRON",
    "she": "PRON",
    "they": "PRON",
    "we": "PRON",
    "is": "VERB",
    "am": "VERB",
    "are": "VERB",
    "was": "VERB",
    "were": "VERB",
    "be": "VERB",
    "the": "DET",
    "a": "DET",
    "an": "DET",
    "and": "CONJ",
    "but": "CONJ",
    "or": "CONJ",
    "in": "PREP",
    "on": "PREP",
    "through": "PREP",
    "with": "PREP",
    "at": "PREP",
}


def tokenize(text: str) -> list[str]:
    return re.findall(r"\b[\w']+\b", text.lower())


def last_word(text: str) -> str:
    """
    Echo the last word back. Not sure how useful this is...
    """

    words = tokenize(text)

    if not words:
        return ""

    return words[-1]


def tag_pos(text: str) -> list[dict]:
    """
    Return list of token/POS pairs.
    """

    words = tokenize(text)

    tagged = []

    for word in words:

        if word in POS_MAP:
            pos = POS_MAP[word]

        elif word.endswith("ing"):
            pos = "VERB"

        elif word.endswith("ed"):
            pos = "VERB"

        elif word.endswith("ly"):
            pos = "ADV"

        else:
            pos = "NOUN"

        tagged.append({"word": word, "pos": pos})

    return tagged


def reduce(text: str) -> str:
    """
    Reduce sentence into a simpler residue. keeps mainly nouns + verbs
    """

    tagged = tag_pos(text)

    keep = []

    for token in tagged:
        if token["pos"] in ["NOUN", "VERB"]:
            keep.append(token["word"])

    return " ".join(keep)


def retrieve() -> str:
    """throw a random old idea back at me"""
    entries = read_log()

    if not entries:
        return ""

    input_text = ""
    valid_entries = [e for e in entries if e.get("input")]
    entry = random.choice(valid_entries)
    input_text = entry["input"]

    return f"{input_text}"
