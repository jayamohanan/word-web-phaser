# Animated Hint System

## Overview
The animated hint system provides visual feedback when hints are created after placing a word in a slot. Instead of hints appearing instantly, a particle travels along the connection line from the filled slot to the empty slot, followed by a bouncing animation when the hint appears.

## Visual Flow

```
Step 1: Word Placed
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│  F  │ │  A  │ │  S  │ │  T  │  ← Word placed in Slot 0
└─────┘ └─────┘ └─────┘ └─────┘
         │
         │ Connection line
         ↓
Step 2: Particle Travels
         ●  ← Green particle with glow
         │
         ↓
Step 3: Burst Effect
        ***  ← 8 particles burst outward
         ↓
Step 4: Hint Bounces In
┌─────┐
│  A  │  ← Hint appears with bounce
└─────┘
Slot 1, square 0
```

## Animation Components

### 1. Particle Travel Animation

**Particle Properties:**
- **Shape**: Circle, 8px radius
- **Color**: Green (`0x4CAF50`)
- **Border**: 2px white stroke
- **Depth**: 1000 (above all game elements)

**Glow Effect:**
- **Shape**: Circle, 12px radius
- **Color**: Green (`0x4CAF50`) with 30% opacity
- **Depth**: 999 (just behind particle)

**Movement:**
```javascript
// Travels from source to target
From: sourceSquare side midpoint
To:   targetSquare side midpoint
Duration: 300-600ms (based on distance)
Easing: Cubic.easeInOut (smooth acceleration/deceleration)
```

**Pulse Effect:**
```javascript
// Particle pulses 4 times during travel
scale = 1 + sin(progress * π * 4) * 0.3
// Creates rhythmic pulsing: 1.0 → 1.3 → 1.0 → 1.3 (repeat)
```

### 2. Burst Effect

**When**: Triggered when particle reaches destination

**Properties:**
- **Particle Count**: 8 particles
- **Shape**: Small circles, 3px radius
- **Color**: Green (`0x4CAF50`)
- **Pattern**: Radial burst (360° evenly spaced)
- **Burst Radius**: 20px from center

**Animation:**
```javascript
// Each particle moves outward and fades
targetX = x + cos(angle) * 20px
targetY = y + sin(angle) * 20px
alpha: 1 → 0
scale: 1 → 0.5
duration: 300ms
easing: Quad.easeOut
```

**Visual Pattern:**
```
    *
  *   *
*   ●   *  ← 8 particles burst outward from center
  *   *
    *
```

### 3. Hint Bounce Animation

**When**: After burst effect completes

**Phase 1: Bounce In (200ms)**
```javascript
scale: 0 → 1.5
easing: Back.easeOut (overshoots for bounce effect)
```

**Phase 2: Settle (150ms)**
```javascript
scale: 1.5 → 1.0
easing: Quad.easeInOut (smooth settling)
```

**Timeline:**
```
0ms:   scale = 0 (invisible)
200ms: scale = 1.5 (bounced overshoot)
350ms: scale = 1.0 (settled at normal size)
```

## Implementation Details

### `animateHintCreation()`

**Parameters:**
- `sourceSquareContainer`: The square where the word letter is
- `targetSquareContainer`: The square where the hint should appear
- `letter`: The letter to show as hint
- `sourceSideIdx`: Which side of source square (0=top, 1=right, 2=bottom, 3=left)
- `targetSideIdx`: Which side of target square

**Process:**
1. Get world positions of source and target sides
2. Create particle and glow at source position
3. Calculate duration based on distance (closer = faster)
4. Animate particle traveling to target
5. Pulse particle during travel
6. On completion:
   - Create burst effect
   - Destroy particle and glow
   - Show hint with bounce animation

### `createBurstEffect()`

**Parameters:**
- `x`: World X coordinate of burst center
- `y`: World Y coordinate of burst center

**Process:**
1. Calculate 8 evenly spaced angles (45° apart)
2. For each angle:
   - Create small particle at center
   - Calculate target position (20px away)
   - Animate outward with fade
3. Clean up particles after animation

### `updateAllConstraintHints()`

**Modified Logic:**
- Only animates hints when target slot is **empty**
- Prevents animation if both slots are filled
- Checks both directions (bidirectional connections)

**Before:**
```javascript
if (fromSlot.getData('filled')) {
    // Set hint immediately
    toLetterText.setText(letter);
}
```

**After:**
```javascript
if (fromSlot.getData('filled') && !toSlot.getData('filled')) {
    // Animate hint creation
    this.animateHintCreation(fromSquare, toSquare, letter, ...);
}
```

## Performance Considerations

### Dynamic Duration
```javascript
const distance = Phaser.Math.Distance.Between(x1, y1, x2, y2);
const duration = Math.max(300, Math.min(600, distance * 0.5));
```

**Why:**
- Short connections: 300ms minimum (prevents too fast)
- Long connections: 600ms maximum (prevents too slow)
- Medium connections: Scales with distance (feels natural)

**Examples:**
- 100px distance → 300ms (min)
- 400px distance → 400ms (scaled)
- 1000px distance → 600ms (max)

### Particle Cleanup
```javascript
onComplete: () => {
    particle.destroy();
    glow.destroy();
    burstParticle.destroy();
}
```

**Why:**
- Prevents memory leaks
- Removes completed animations from scene
- Keeps render list clean

## Visual Design Choices

### Green Color (`0x4CAF50`)
- **Reason**: Represents "success" and "new information"
- **Contrast**: Stands out against black connection lines
- **Consistency**: Material Design green (familiar to users)

### Pulse During Travel
- **Reason**: Shows the particle is "alive" and moving
- **Frequency**: 4 pulses = rhythm without being distracting
- **Amplitude**: 30% scale change = noticeable but subtle

### Burst Pattern
- **Reason**: Indicates "arrival" and "impact"
- **Radial**: Natural explosion pattern
- **8 particles**: Balance between impact and performance

### Bounce Animation
- **Reason**: Makes hint appearance feel "weighty" and satisfying
- **Back.easeOut**: Creates natural overshoot/settle motion
- **1.5x overshoot**: Large enough to notice, not overwhelming

## User Experience Benefits

### 1. **Clear Causality**
```
Word placed → Particle travels → Hint appears
```
User sees **why** and **how** the hint was created.

### 2. **Visual Guidance**
- Particle draws attention to the connection
- Shows which slots are connected
- Helps users understand the puzzle mechanics

### 3. **Satisfying Feedback**
- Smooth animations feel polished
- Burst effect provides tactile feedback
- Bounce makes hint appearance feel earned

### 4. **Non-Intrusive**
- Fast enough not to slow gameplay (300-600ms)
- Can be seen peripherally
- Doesn't block interaction

## Scenarios

### Single Connection
```
Place word "FAST" in Slot 0
→ 1 particle travels to Slot 1
→ 1 hint appears

Timeline:
0ms:    Word placed
50ms:   Particle starts traveling
350ms:  Particle arrives
350ms:  Burst effect
350ms:  Hint bounces in
500ms:  Animation complete
```

### Multiple Connections
```
Place word "FAST" in Slot 0 (connected to Slots 1 and 2)
→ 2 particles travel simultaneously
→ 2 hints appear with staggered timing

Timeline:
0ms:    Word placed
50ms:   Particle 1 starts (to Slot 1, 300px away)
50ms:   Particle 2 starts (to Slot 2, 500px away)
350ms:  Particle 1 arrives → Burst → Hint 1 bounces in
450ms:  Particle 2 arrives → Burst → Hint 2 bounces in
600ms:  All animations complete
```

### Bidirectional Connection
```
Slot 0 ↔ Slot 1 (bidirectional)

Case 1: Slot 0 filled, Slot 1 empty
→ Particle travels 0 → 1
→ Hint appears in Slot 1

Case 2: Slot 1 filled, Slot 0 empty
→ Particle travels 1 → 0
→ Hint appears in Slot 0

Case 3: Both filled
→ No animation (both already constrained)
```

## Edge Cases Handled

### 1. **No Target Slot**
```javascript
if (toLetterText && letter) {
    this.animateHintCreation(...);
}
```
Prevents errors if target doesn't exist.

### 2. **Both Slots Filled**
```javascript
if (fromSlot.getData('filled') && !toSlot.getData('filled')) {
    // Only animate if target is empty
}
```
Avoids unnecessary animations.

### 3. **Rapid Word Removal/Placement**
- Particles are independent objects
- Each animation completes or is destroyed
- No conflicts between animations

### 4. **Scale Reset**
```javascript
letterText.setScale(1); // Reset scale before animation
```
Ensures clean state if hint was previously shown.

## Customization Options

### Slower Animation
```javascript
const duration = Math.max(500, Math.min(1000, distance * 0.8));
```

### Different Color
```javascript
const particle = this.add.circle(x, y, 8, 0xFF5722, 1); // Orange
```

### More Dramatic Burst
```javascript
const particleCount = 12; // More particles
const burstRadius = 30;   // Larger radius
```

### Bigger Bounce
```javascript
scale: 2.0,  // Larger overshoot
duration: 300, // Slower bounce
```

### No Burst Effect
```javascript
// Comment out in animateHintCreation:
// this.createBurstEffect(targetPos.x, targetPos.y);
```

## Code Example

### Complete Flow
```javascript
// 1. Word placed in slot
gameObject.setData('placed', true);
slotContainer.setData('filled', true);

// 2. Update hints (triggers animations)
this.updateAllConstraintHints();

// 3. For each connection:
//    a. Create particle at source
const particle = this.add.circle(sourceX, sourceY, 8, 0x4CAF50, 1);

//    b. Animate to target
this.tweens.add({
    targets: particle,
    x: targetX,
    y: targetY,
    duration: 400,
    onComplete: () => {
        // c. Burst effect
        this.createBurstEffect(targetX, targetY);
        
        // d. Show hint with bounce
        letterText.setText(letter);
        this.tweens.add({
            targets: letterText,
            scale: { from: 0, to: 1.5 },
            duration: 200,
            ease: 'Back.easeOut'
        });
    }
});
```

## Comparison: Before vs After

### Before (Instant)
```
Word placed → Hints appear instantly ✓
```
**Pros**: Fast, simple
**Cons**: No feedback, unclear connection

### After (Animated)
```
Word placed → Particles travel → Burst → Hints bounce in ✓
```
**Pros**: Clear feedback, shows connections, satisfying
**Cons**: 300-600ms delay (acceptable for UX benefit)

## Summary

The animated hint system provides:
- ✅ **Visual Feedback**: Clear indication of hint creation
- ✅ **Connection Visualization**: Shows which slots are connected
- ✅ **Satisfying Interaction**: Polished, game-like feel
- ✅ **User Understanding**: Helps players learn puzzle mechanics
- ✅ **Non-Intrusive**: Fast enough not to interrupt gameplay

This transforms a simple text update into an engaging, informative animation that enhances the overall player experience! 🎮✨
