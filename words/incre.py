import csv
import os

# Get the folder where the script is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

INPUT_FILE = os.path.join(BASE_DIR, 'words.csv')
OUTPUT_FILE = os.path.join(BASE_DIR, 'incre.csv')

# Read all words from CSV into a set
words_set = set()
with open(INPUT_FILE, newline='', encoding='utf-8') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        word = row['word'].strip().lower()
        words_set.add(word)

def increment_letter(c):
    if 'a' <= c <= 'z':
        return chr((ord(c) - ord('a') + 1) % 26 + ord('a'))
    return c

def increment_word(word):
    return ''.join(increment_letter(c) for c in word.lower())

# Write output CSV
with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as csvfile:
    writer = csv.writer(csvfile)
    writer.writerow(['original', 'incremented'])

    for word in words_set:
        inc_word = increment_word(word)
        if inc_word in words_set:
            writer.writerow([word, inc_word])
