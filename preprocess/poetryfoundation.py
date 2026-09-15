#!/usr/bin/env python3

import sys
import re
import json
import csv

def split_into_sentences(text: str):
    if not text:
        return []

    # Collapse any whitespace (spaces, tabs, newlines) into a single space
    text = re.sub(r"\s+", " ", text).strip()

    # Split the text into pieces on:
    #  - after a sentence-ending punctuation mark (. ! ?), optionally followed by closing quotes/parentheses, then whitespace
    #  - OR on a standalone dash/en-dash surrounded by spaces (e.g. " - " or " – ")
    pieces = re.split(r'(?<=[.!?;:])[\'"”’)]*\s+|\s[-–]\s', text)

    # Strip whitespace from each piece and drop any empty results
    sentences = [p.strip() for p in pieces if p.strip()]

    return sentences
def main():
    TARGET_AUTOR = "William Shakespeare"
    input_path = "./input/poetry_foundation.csv"
    output_path = f"./input/{TARGET_AUTOR.lower().replace(' ', '_')}.json"

    csv.field_size_limit(sys.maxsize)

    megalist = []
    poem_count = 0

    with open(input_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        lower_map = {name.lower(): name for name in fieldnames}
        author_col = lower_map.get("author", "Author")
        content_col = lower_map.get("content", "Content")

        for row in reader:
            author = (row.get(author_col) or "").strip()
            if author != TARGET_AUTOR:
                continue

            content = row.get(content_col) or ""
            sentences = split_into_sentences(content)
            megalist.extend(sentences)
            poem_count += 1

    with open(output_path, "w", encoding="utf-8") as out:
        json.dump(megalist, out, indent=2, ensure_ascii=False)

    print(f"Found {poem_count} poem(s).")
    print(f"Extracted {len(megalist)} sentence(s) total.")
    print(f"Wrote output to: {output_path}")


if __name__ == "__main__":
    main()
