import csv
import string
import os

# === CONFIG ===
TARGET_LENGTH = 3  # change to 4 for 4-letter words

# File path: assumes this .py is in the same folder as words.csv
CSV_FILE = os.path.join(os.path.dirname(__file__), 'words.csv')

# === HELPER FUNCTION ===
def shift_word(word, shift):
    """Shift each letter of the word by 'shift' positions in the alphabet (A-Z)."""
    shifted = []
    for ch in word.upper():
        if ch in string.ascii_uppercase:
            idx = ord(ch) - ord('A')
            new_idx = (idx + shift) % 26
            shifted.append(chr(new_idx + ord('A')))
        else:
            # keep non-alphabet characters unchanged
            shifted.append(ch)
    return ''.join(shifted)

# === LOAD WORDS ===
words_set = set()
words_list = []

with open(CSV_FILE, 'r', newline='', encoding='utf-8') as f:
    reader = csv.reader(f)
    header = next(reader)  # skip header

    for row in reader:
        word = row[1].strip().upper()  # column 1 = word
        length = row[3].strip()        # column 3 = length

        # ignore if length is NA or empty
        if length.upper() == 'NA' or not length:
            continue

        try:
            length = int(length)
        except ValueError:
            continue

        if length == TARGET_LENGTH:
            words_set.add(word)
            words_list.append(word)

# === FIND PAIRS ===
pairs = set()

for word in words_list:
    inc_word = shift_word(word, 1)
    dec_word = shift_word(word, -1)

    for transformed in [inc_word, dec_word]:
        if transformed in words_set:
            pair = tuple(sorted([word, transformed]))
            pairs.add(pair)

# === PRINT RESULTS ===
print(f"Pairs of words of length {TARGET_LENGTH}:\n")
for pair in sorted(pairs):
    print(f"{pair[0]} - {pair[1]}")
