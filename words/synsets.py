import nltk
from nltk.corpus import wordnet as wn

# Ensure WordNet is downloaded
nltk.download('wordnet')

def list_synsets(word):
    synsets = wn.synsets(word)
    if not synsets:
        print(f"No synsets found for '{word}'.")
        return
    
    print(f"'{word}' has {len(synsets)} synsets:\n")
    
    for i, syn in enumerate(synsets, 1):
        print(f"{i}. Synset ID: {syn.name()}")
        print(f"   POS: {syn.pos()}")
        print(f"   Definition: {syn.definition()}")
        if syn.examples():
            print(f"   Examples: {', '.join(syn.examples())}")
        print(f"   Lemmas: {', '.join([lemma.name() for lemma in syn.lemmas()])}")
        # List antonyms if any
        antonyms = [ant.name() for lemma in syn.lemmas() for ant in lemma.antonyms()]
        if antonyms:
            print(f"   Antonyms: {', '.join(antonyms)}")
        print()

if __name__ == "__main__":
    word = input("Enter a word: ").strip()
    list_synsets(word)
