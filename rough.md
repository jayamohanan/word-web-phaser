Full Spec for Rule Objects
Rule Types
1. Cell → Cell rule (“letter rule”)

Used for same letter, increment, decrement, etc.

{
  "type": "cell",
  "a": "slotIndex:cellIndex",
  "b": "slotIndex:cellIndex",
  "op": "<operation>"
}


Supported operations:

"same" → must match letter

"+1" → target letter = source letter +1

"-1"

"+2"

"-2"

You can add more later (e.g., ROT13).

2. Slot-level transform (applies to the whole word)
{
  "type": "slot",
  "slot": 1,
  "op": "reverse"
}


Possible slot operations:

"reverse" (loop → pool)

"cipher:atbash"

"shift:+1" (every letter shifted)

"vowelsOnly"

"noRepeatLetters"

ANYTHING future.

3. Slot ↔ Slot “word relationship”
{
  "type": "slotPair",
  "a": 0,
  "b": 3,
  "op": "antonym"
}


Other possible "op":

"synonym"

"rhyme"

"sameWord"

"anagram"

Now you can draw a big rectangle around both slots, as intended.






1. Same-letter rule (classic)
{
  "type": "cell",
  "a": "0:2",
  "b": "1:0",
  "op": "same"
}

2. Letter +1 rule

“A → B, L → M”

{
  "type": "cell",
  "a": "0:2",
  "b": "1:0",
  "op": "+1"
}

3. Slot reversed rule

“FATE” placed becomes “ETAF”

{
  "type": "slot",
  "slot": 0,
  "op": "reverse"
}

4. Antonym slot pair

Slot 0 must contain antonym of slot 4.

{
  "type": "slotPair",
  "a": 0,
  "b": 4,
  "op": "antonym"
}

5. Combined (same letter + reverse)
{
  "rules": [
    { "type": "slot", "slot": 1, "op": "reverse" },
    { "type": "cell", "a": "0:3", "b": "1:0", "op": "same" }
  ]
}