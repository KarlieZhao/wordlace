#!/usr/bin/env python3
"""
fast, lightweight NLP toolkit that handles tasks like fuzzy-deduplication,
similarity and ranking with minimal inference-time dependencies and optimized for CPU hardware.
https://huggingface.co/dleemiller/word-llama-l2-supercat
"""

from wordllama import WordLlama

# Load the default WordLlama model
wl = WordLlama.load()

# Calculate similarity between two sentences
similarity_score = wl.similarity("i went to the car", "i went to the pawn shop")
print(similarity_score)  # Output: 0.06641249096796882

# Rank documents based on their similarity to a query
query = "i went to the car"
candidates = [
    "i went to the park",
    "i went to the shop",
    "i went to the truck",
    "i went to the vehicle",
]
ranked_docs = wl.rank(query, candidates)
print(ranked_docs)
# Output:
# [
#   ('i went to the vehicle', 0.7441646856486314),
#   ('i went to the truck', 0.2832691551894259),
#   ('i went to the shop', 0.19732814982305436),
#   ('i went to the park', 0.15101404519322253)
# ]

# additional inference methods
wl.deduplicate(candidates, threshold=0.8)  # fuzzy deduplication
# wl.cluster(ranked_docs, k=5, max_iterations=100, tolerance=1e-4) # labels using kmeans/kmeans++ init
# wl.filter(query, candidates, threshold=0.3) # filter candidates based on query
# wl.topk(query, candidates, k=3) # return topk strings based on query
