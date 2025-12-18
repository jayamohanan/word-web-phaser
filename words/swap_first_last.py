import csv
from pathlib import Path

# Directory where this script lives (words/)
SCRIPT_DIR = Path(__file__).resolve().parent

INPUT_CSV = SCRIPT_DIR / "words.csv"
OUTPUT_CSV = SCRIPT_DIR / "swap_first_last.csv"

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

        if len(word) != length or length < 2:
            continue

        words[word] = length
        word_set.add(word)

results = []
seen_pairs = set()

for word, length in words.items():
    # Swap first and last letter
    swapped = word[-1] + word[1:-1] + word[0]

    if swapped in word_set:
        # Prevent duplicate pairs (tap->pat & pat->tap)
        pair_key = tuple(sorted([word, swapped]))

        if pair_key not in seen_pairs:
            seen_pairs.add(pair_key)
            results.append({
                "word": word,
                "swapped_word": swapped,
                "length": length,
                "same_first_last": "true" if word[0] == word[-1] else "false"
            })

# Write output CSV
with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
    fieldnames = ["word", "swapped_word", "length", "same_first_last"]
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(results)

print(f"Done! {len(results)} valid pairs written to {OUTPUT_CSV}")
