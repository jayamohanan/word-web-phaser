import csv
from pathlib import Path

# Directory where this script lives (words/)
SCRIPT_DIR = Path(__file__).resolve().parent

INPUT_CSV = SCRIPT_DIR / "words.csv"
OUTPUT_CSV = SCRIPT_DIR / "swap_two_three.csv"

words = {}
word_set = set()

with open(INPUT_CSV, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        word = row["word"].strip().lower()
        length_raw = row["length"].strip()

        # Skip invalid lengths (e.g. NA)
        if not length_raw.isdigit():
            continue

        length = int(length_raw)

        # Need at least 3 letters
        if len(word) != length or length < 3:
            continue

        words[word] = length
        word_set.add(word)

results = []
seen_pairs = set()

for word, length in words.items():
    # Swap 2nd and 3rd letters
    swapped = word[0] + word[2] + word[1] + word[3:]

    if swapped in word_set:
        # Prevent duplicate pairs
        pair_key = tuple(sorted([word, swapped]))

        if pair_key not in seen_pairs:
            seen_pairs.add(pair_key)
            results.append({
                "word": word,
                "swapped_word": swapped,
                "length": length,
                "same": "true" if word[1] == word[2] else "false"
            })

# Write output CSV
with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
    fieldnames = ["word", "swapped_word", "length", "same"]
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(results)

print(f"Done! {len(results)} valid pairs written to {OUTPUT_CSV}")
