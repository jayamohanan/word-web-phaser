# Sublevel System - Testing Guide

## Quick Start
1. Open `index.html` in a web browser (or run a local server)
2. Play Level 1 to see the sublevel system in action

## Level 1 Test Configuration
Level 1 now has **5 word sets** but only uses **3 sublevels** (via `subLevelCount: 3`):
- Sublevel 1: PEW, PIE
- Sublevel 2: ARM, AIR
- Sublevel 3: TEN, THE
- (BIG, BAG - not used)
- (CAT, COT - not used)

## What to Look For

### Visual Elements
✓ **Step Progress Bar**: Should appear 30px below "Level 1" text
  - 3 grey circles connected by a grey line
  - Circles spaced 90px apart
  - Centered horizontally

### Gameplay Flow
1. **Start**: Drag PEW and PIE into slots
2. **First Complete**: 
   - "Great!" text appears briefly (green, centered)
   - First circle gets a green check mark
   - Slots clear automatically (no green tint remains)
   - New words appear: ARM, AIR
3. **Second Complete**:
   - "Great!" text appears again
   - Second circle gets a green check mark
   - Slots clear completely
   - New words appear: TEN, THE
4. **Third Complete**:
   - Third circle gets a green check mark
   - Full win screen appears
   - "Next Level" button appears

### Bug Fixes Verified
- ✓ Slots fully reset between sublevels (no lingering green tints)
- ✓ Words can be placed after sublevel completion
- ✓ All cell colors and states properly cleared
- ✓ Progress bar properly spaced from level text

## Customizing Sublevels

### Basic Usage
To add sublevels to any level, edit `levels.json`:

```json
"words": [
  ["WORD1", "WORD2"],  // Sublevel 1
  ["WORD3", "WORD4"],  // Sublevel 2
  ["WORD5", "WORD6"]   // Sublevel 3
]
```

### Using subLevelCount
Limit how many sublevels to use from the words array:

```json
"words": [
  ["PEW", "PIE"],
  ["ARM", "AIR"],
  ["TEN", "THE"],
  ["BIG", "BAG"],
  ["CAT", "COT"]
],
"subLevelCount": 3  // Only use first 3, ignore the rest
```

This is useful for:
- Creating word pools without using all words
- Testing different sublevel counts
- Reusing word sets across levels

## Troubleshooting

### Progress bar not showing
- Check if level has multiple word arrays in `words`
- Verify green_check.png exists in graphics folder

### Progress bar too close to level text
- Should be 30px gap - verify createStepProgressBar Y position

### Circles too close together
- Gap should be 90px between circles

### Slots not clearing properly
- Check browser console for errors
- Verify no green tints remain on slot cells
- Try placing words - should work immediately

### Words not updating
- Check that word arrays are properly nested
- Verify `loadNextSublevel()` is processing words correctly

### subLevelCount not working
- Verify it's a number in the JSON
- Check it's less than or equal to words array length

## Performance Notes
- Each sublevel completion includes a 0.6-second feedback animation
- Input is disabled during transitions to prevent issues
- Progress bar only renders when needed (>1 sublevel)
- Slots are fully reset between sublevels (all tints/colors cleared)
