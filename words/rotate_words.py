import csv
from pathlib import Path

# Directory where this script lives (words/)
SCRIPT_DIR = Path(__file__).resolve().parent

INPUT_CSV = SCRIPT_DIR / "words.csv"
OUTPUT_CSV = SCRIPT_DIR / "rotated_words.csv"

words = {}
word_set = set()

with open(INPUT_CSV, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        word = row["word"].strip().lower()
        length_raw = row["length"].strip()

        # Skip rows with invalid length (e.g. NA)
        if not length_raw.isdigit():
            continue

        length = int(length_raw)

        words[word] = length
        word_set.add(word)

results = []
seen_pairs = set()

for word, length in words.items():
    if length < 2:
        continue

    # Rotate last letter to front
    rotated = word[-1] + word[:-1]

    # Check if rotated word exists
    if rotated in word_set:
        # Prevent duplicate pairs (apt->tap & tap->apt)
        pair_key = tuple(sorted([word, rotated]))

        if pair_key not in seen_pairs:
            seen_pairs.add(pair_key)
            results.append({
                "word": word,
                "rotated_word": rotated,
                "length": length
            })

# Write output CSV
with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
    fieldnames = ["word", "rotated_word", "length"]
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(results)

print(f"Done! {len(results)} valid pairs written to {OUTPUT_CSV}")
