#!/usr/bin/env python3

import gensim.downloader as api
import json
from itertools import combinations

# a 2D coords via PCA for plotting
from sklearn.decomposition import PCA
import numpy as np


"""
Principal Component Analysis (PCA) is a way to reduce high-dimensional data down 
to fewer dimensions while keeping as much of the important structure as possible.

Instead of letting PCA pick directions, you can define axes yourself using word-vector differences.
"""


def semantic_axis(model, pos_word, neg_word):
    v = model[pos_word] - model[neg_word]
    return v / np.linalg.norm(v)


def run_word2vec(words, x_axis=("female", "male"), y_axis=("joy", "pain")):
    model = api.load("glove-wiki-gigaword-300")
    words_normalized =[]
    for w in words:
        norm = w.lower()
        if norm in model.key_to_index:
            words_normalized.append(norm)

    x_dir = semantic_axis(model, *x_axis)
    y_dir = semantic_axis(model, *y_axis)

    output = {}
    for word in words_normalized:
        # TODO: what to do when word is not in model? 
        v = model[word]
        output[word] = [float(v @ x_dir), float(v @ y_dir)]

    return output


# def run_word2vec(words):
#     model = api.load("glove-wiki-gigaword-300")
#     words = [w for w in words if w in model.key_to_index]

#     # similarities = {}
#     # for w1, w2 in combinations(words, 2):
#     #     similarities[f"{w1}|{w2}"] = float(model.similarity(w1, w2))

#     vecs = np.array([model[w] for w in words])
#     coords = PCA(n_components=2).fit_transform(vecs).tolist()
#     output = {}
#     for index, word in enumerate(words):
#         output[word] = coords[index]

#     return output


if __name__ == "__main__":
    filename = "Not_Even_This_tokens"
    with open(f"./output/{filename}.json", "r") as file:
        input = json.load(file)
        tokens = [item for sublist in input["tok"] for item in sublist]
        vecs = run_word2vec(tokens)
        with open(f"./output/{filename}_vecs_axes.json", "w", encoding="utf-8") as f:
            json.dump(vecs, f, ensure_ascii=False, indent=2)
            print("done.")
