import csv
import os
from nltk.corpus import wordnet as wn
import nltk

# Make sure WordNet is downloaded
nltk.download('wordnet')

# ===== Configuration =====
NUM_WORDS = 10000      # Number of words to process from the CSV
INPUT_FILE = "words.csv"
OUTPUT_FILE = "antonyms.csv"

# ===== Make paths relative to script folder =====
script_dir = os.path.dirname(os.path.abspath(__file__))
input_path = os.path.join(script_dir, INPUT_FILE)
output_path = os.path.join(script_dir, OUTPUT_FILE)

# ===== Function to get only same-length antonyms =====
def get_same_length_antonyms(word):
    antonyms_same_length = set()
    for syn in wn.synsets(word):
        for lemma in syn.lemmas():
            for ant in lemma.antonyms():
                if len(ant.name()) == len(word):
                    antonyms_same_length.add(ant.name())
    return antonyms_same_length

# ===== Read words.csv and collect first NUM_WORDS valid words =====
words_list = []
with open(input_path, newline='', encoding='utf-8') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        word = row.get('word', '').strip()
        length_str = row.get('length', '').strip()
        if not word:
            continue
        try:
            word_len = int(length_str)
        except ValueError:
            continue  # skip rows where length is 'NA' or invalid
        words_list.append((word, word_len))
        if len(words_list) >= NUM_WORDS:
            break

# ===== Generate antonyms and write to antonyms.csv =====
with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
    fieldnames = ['word', 'word_count', 'antonyms']
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
    writer.writeheader()
    
    for word, word_len in words_list:
        same_len_antonyms = get_same_length_antonyms(word)
        if not same_len_antonyms:
            continue  # skip words with no same-length antonyms
        antonyms_str = ",".join(sorted(same_len_antonyms))
        writer.writerow({
            'word': word,
            'word_count': word_len,
            'antonyms': antonyms_str
        })

print(f"Processed {len(words_list)} words. Antonyms saved to {output_path}.")
