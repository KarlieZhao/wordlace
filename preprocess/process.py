#!/usr/bin/env python3
import json
import os
import shutil

import spacy  # pyright: ignore[reportMissingImports]
import en_core_web_sm  # pyright: ignore[reportMissingImports]
import zh_core_web_sm  # pyright: ignore[reportMissingImports]
from spacy import displacy  # pyright: ignore[reportMissingImports]

HERE = os.path.dirname(os.path.realpath(__file__))

nlp_en = spacy.load("en_core_web_sm")
# nlp_zh = spacy.load("zh_core_web_sm")

nlp_en = en_core_web_sm.load()
# nlp_zh = zh_core_web_sm.load()


def get_phrase_data(doc):
    token_to_chunk = {}
    for chunk in doc.noun_chunks:
        for token in chunk:
            token_to_chunk[token.i] = chunk

    phrases = []
    visited = set()

    for token in doc:
        if token.i in token_to_chunk:
            chunk = token_to_chunk[token.i]
            if chunk.start not in visited:
                visited.add(chunk.start)
                root = chunk.root
                phrases.append(
                    {
                        "word": chunk.text,
                        "norm": root.norm_,
                        "pos": root.pos_,
                        "id": chunk.start,
                        "dep": root.dep_,
                        "head_id": root.head.i,
                        "is_phrase": True,
                        "span": [chunk.start, chunk.end],  # token range
                    }
                )
        else:
            # Non-noun tokens (verbs, conjunctions, etc.) cannot be "phrased"
            phrases.append(
                {
                    "word": token.text,
                    "norm": token.norm_,
                    "pos": token.pos_,
                    "id": token.i,
                    "dep": token.dep_,
                    "head_id": token.head.i,
                    "is_phrase": False,
                    "span": [token.i, token.i + 1],
                }
            )

    return phrases


def main():
    lines = [
        "To be gorgeous you must first be seen, but to be seen allows you to be hunted.",
        "She should never forget the beautiful, hidden truth.",
        "In this essay I try to sketch out what that upside might look like—what a world with powerful AI might look like if everything goes right.",
        "We must always remember that the dark and silent unknown can never truly be forgotten, even when we simply will it to be gone.",
        "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity.",
        "All happy families are alike; each unhappy family is unhappy in its own way.",
        "Not all those who wander are lost.",
        "I took a deep breath and listened to the old brag of my heart: I am, I am, I am.",
        "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.",
        "So we beat on, boats against the current, borne back ceaselessly into the past.",
        "There is no greater agony than bearing an untold story inside you.",
        "One must always be careful of books, and what is inside them, for words have the power to change us.",
        "I am an invisible man, No, I am not a spook like those who haunted Edgar Allan Poe; nor am I one of your Hollywood-movie ectoplasms. I am a man of substance, of flesh and bone, fiber and liquids — and I might even be said to possess a mind.",
        "Ships at a distance have every man's wish on board. For some they come in with the tide. For others they sail forever on the horizon, never out of sight, never landing until the Watcher turns his eyes away in resignation, his dreams mocked to death by Time.",
    ]

    result = []
    for line in lines:
        doc_en = nlp_en(line)
        result.append(get_phrase_data(doc_en))

    output_path = os.path.join("output", "tokens.json")
    destination = os.path.join(os.path.dirname(HERE), "web", "data")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    shutil.copy(output_path, destination)
    print("Data copied to ", os.path.join(destination, "tokens.json"))


if __name__ == "__main__":
    main()
    print("done.")
