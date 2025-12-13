import csv
import os

# Get the folder where the script is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

INPUT_FILE = os.path.join(BASE_DIR, 'words.csv')
OUTPUT_FILE = os.path.join(BASE_DIR, 'mirror.csv')

# Read all words from CSV into a set for fast lookup
words_set = set()
with open(INPUT_FILE, newline='', encoding='utf-8') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        word = row['word'].strip().lower()
        words_set.add(word)

# To avoid duplicates like god->dog and dog->god
seen_pairs = set()

# Open output CSV
with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as csvfile:
    writer = csv.writer(csvfile)
    writer.writerow(['original', 'mirrored'])

    for word in words_set:
        mirrored = word[::-1]
        # Check if mirrored word is in the list and avoid duplicates
        if mirrored in words_set and (mirrored, word) not in seen_pairs:
            writer.writerow([word, mirrored])
            seen_pairs.add((word, mirrored))
