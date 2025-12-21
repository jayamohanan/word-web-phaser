import * as Utils from './utils.js';
import WinScene from './WinScene.js';
import TutorialManager from './TutorialManager.js';

// Main Phaser game logic for Word Web
// Loads level data, renders slots, words, and handles drag-drop

class WordWebGame extends Phaser.Scene {
    constructor() {
        super('WordWebGame');
    }
    init(data) {
        this.originX = this.sys.game.canvas.width * CONFIG.ORIGIN_X_FACTOR;
        this.originY = this.sys.game.canvas.height * CONFIG.ORIGIN_Y_FACTOR;
        this.currentLevelIndex = data.levelIndex !== undefined ? data.levelIndex : 0;

        // Cache CONFIG variables for performance
        this.squareWidth = CONFIG.SQUARE_WIDTH;
        this.squareGap = CONFIG.SQUARE_GAP;
        this.gridSize = CONFIG.GRID_SIZE;
        this.slotStrokeWidth = CONFIG.SLOT_STROKE_WIDTH;
        this.slotStrokeColor = CONFIG.SLOT_STROKE_COLOR;
        this.wordStrokeWidth = CONFIG.WORD_STROKE_WIDTH;
        this.wordStrokeColor = CONFIG.WORD_STROKE_COLOR;
        this.wordCellFontSize = CONFIG.WORD_CELL_FONT_SIZE;
        this.slotCellFontSize = CONFIG.SLOT_CELL_FONT_SIZE;
        this.letterFontFamily = CONFIG.LETTER_FONT_FAMILY === 'default' ? 'Arial, sans-serif' : CONFIG.LETTER_FONT_FAMILY;
        this.letterFontWeight = CONFIG.LETTER_FONT_WEIGHT;
        this.connectionHighlightColor = CONFIG.CONNECTION_HIGHLIGHT_COLOR;
        this.autopilotEnabled = CONFIG.AUTOPILOT_ENABLED;
        this.autopilotInProgress = false; // Track if autopilot is currently running
        this.placementAnimationMode = CONFIG.PLACEMENT_ANIMATION_MODE || 'cell';
    }

    preload() {
        this.load.json('levels', 'levels.json');
        this.load.audio('fillSound', 'sounds/fill_sound4.wav');
        this.load.audio('burstSound', 'sounds/burst.wav');
        this.load.image('handPointer', 'graphics/hand_pointer.webp');

        // Load WebFontLoader script
        this.load.script('webfont', 'fonts/webfontloader.js');

        // Create the promise immediately, but it will resolve after load completes
        this.fontsReady = new Promise((resolve) => {
            this.load.once('complete', () => {
                WebFont.load({
                    custom: {
                        families: ['Poppins-Regular', 'Poppins-Medium', 'DMSans-Medium', 'Roboto-Regular', 'Roboto-Medium', 'Roboto-Bold', 'Style', 'ClearSans-Regular', 'ClearSans-Medium', 'ClearSans-Bold'],
                    },
                    active: () => {
                        console.log('Fonts loaded successfully!');
                        resolve();
                    },
                    inactive: () => {
                        console.warn('Fonts failed to load');
                        resolve();
                    }
                });
            });
        });
    }

    async create() {
        await this.fontsReady;
        if (this.fontsReady) {
            await this.fontsReady;
        }

        const levels = this.cache.json.get('levels');
        if (!levels || !levels.levels) {
            console.error('Failed to load levels data. Check if levels.json is loaded correctly.');
            console.error('Available JSON cache keys:', this.cache.json.getKeys());
            return;
        }
        this.totalLevels = levels.levels.length;
        // Use modulo to loop levels
        this.level = levels.levels[this.currentLevelIndex % this.totalLevels];
        this.slotSprites = [];
        this.bankSprites = [];
        this.connectionLines = [];
        this.selectedWord = null;
        this.wordBankArea = [];
        this.wordSlotArea = [];

        // Normalize rules: convert negative increments to positive with reversed direction
        if (this.level.rules) {
            this.level.rules = this.level.rules.map(rule => {
                if (rule.type === 'cell' && rule.op && rule.op.startsWith('-')) {
                    // Extract the negative increment value
                    const increment = parseInt(rule.op);
                    if (increment < 0) {
                        // Convert to positive increment and swap a and b
                        return {
                            ...rule,
                            a: rule.b,  // Swap: b becomes a
                            b: rule.a,  // Swap: a becomes b
                            op: `+${Math.abs(increment)}`  // Convert -1 to +1, -2 to +2, etc.
                        };
                    }
                }
                return rule;
            });
        }

        // Parse word pairs for antonym support (e.g., "LOVE-HATE")
        // Make it bidirectional so both LOVE→HATE and HATE→LOVE work
        this.wordAntonymMap = new Map();
        if (this.level.words) {
            this.level.words = this.level.words.map(wordPair => {
                if (wordPair.includes('-')) {
                    const [original, antonym] = wordPair.split('-');
                    // Store both directions for bidirectional mapping
                    this.wordAntonymMap.set(original, antonym);
                    this.wordAntonymMap.set(antonym, original);
                    return original; // Use original word for rendering
                }
                return wordPair;
            });
        }

        this.createAreas();

        // Create dynamic textures for cell backgrounds
        this.createCellTextures();

        // Show portrait boundary for debugging (if enabled in config)
        if (CONFIG.SHOW_PORTRAIT_BOUNDARY) {
            this.createPortraitBoundary();
        }

        this.renderSlots();
        this.renderBank();
        this.renderConnections();
        this.renderSlotLabels();

        // Initialize tutorial manager and create tutorial elements if level has tutorial data
        this.tutorialManager = new TutorialManager(this);
        this.tutorialManager.createTutorial(this.level, this.slotSprites, this.bankSprites);

        // Removed debug red square at canvas center

        // Add right-click handler to remove words from slots
        this.input.on('pointerdown', (pointer) => {
            if (pointer.rightButtonDown()) {
                // Check if clicking on a filled slot to remove the word
                this.slotSprites.forEach((slotContainer, slotIdx) => {
                    if (slotContainer.getData('filled')) {
                        const bounds = slotContainer.getBounds();
                        if (bounds.contains(pointer.worldX, pointer.worldY)) {
                            console.log(`Removing word from slot ${slotIdx}`);
                            // Find the word container that was placed here
                            this.bankSprites.forEach(wordContainer => {
                                if (wordContainer.getData('placed') && wordContainer.getData('slotIdx') === slotIdx) {
                                    // Animate word back to its original position
                                    this.tweenBackToBottom(wordContainer);
                                    // Clear placement data immediately
                                    wordContainer.setData('placed', false);
                                    wordContainer.setData('slotIdx', null);
                                }
                            });
                            // Remove word from slot and update hints
                            this.removeWordFromSlot(slotIdx);
                        }
                    }
                });
            }
        });


        // Highlight slot squares when dragging over drop zone
        this.input.on('dragenter', (pointer, gameObject, dropZone) => {
            if (!dropZone || dropZone.getData('slotIdx') === undefined) return;
            if (!gameObject || !gameObject.getData('word')) return;

            const slotIdx = dropZone.getData('slotIdx');
            const word = gameObject.getData('word');
            const slotContainer = this.slotSprites[slotIdx];
            const slotSquares = slotContainer.list;

            // Check if word length matches and slot is not filled
            if (slotSquares.length !== word.length) return;
            const slotFilled = slotSquares.some(sq => sq.getData('filled'));
            if (slotFilled) return;

            // Get transformed word for constraint checking
            const transformedWord = this.getTransformedWord(word, slotIdx);

            // Check constraint violations using transformed word
            const violationResult = this.checkConstraintViolation(slotIdx, transformedWord);
            if (violationResult.violated) return;

            // Note: Square strokes are now baked into the texture
            // Highlighting is handled by connection highlights and tinting

            // Highlight connection lines connected to this slot
            this.connectionLines.forEach(line => {
                if (line.setStrokeStyle) { // Only for line objects, not text labels
                    const lineSlotIdx = line.getData('slotIdx');
                    const lineToSlotIdx = line.getData('toSlotIdx');
                    if (lineSlotIdx === slotIdx || lineToSlotIdx === slotIdx) {
                        line.setStrokeStyle(3, 0x2196F3); // Blue line
                    }
                }
            });
        });

        // Remove highlight when dragging out of drop zone
        this.input.on('dragleave', (pointer, gameObject, dropZone) => {
            if (!dropZone || dropZone.getData('slotIdx') === undefined) return;

            const slotIdx = dropZone.getData('slotIdx');
            const slotContainer = this.slotSprites[slotIdx];
            const slotSquares = slotContainer.list;

            // Note: Square strokes are now baked into the texture
            // No need to reset stroke colors

            // Reset connection lines connected to this slot
            this.connectionLines.forEach(line => {
                if (line.setStrokeStyle) { // Only for line objects, not text labels
                    const lineSlotIdx = line.getData('slotIdx');
                    const lineToSlotIdx = line.getData('toSlotIdx');
                    if (lineSlotIdx === slotIdx || lineToSlotIdx === slotIdx) {
                        const originalColor = line.getData('originalColor');
                        line.setStrokeStyle(3, originalColor); // Original color
                    }
                }
            });
        });

        // Global drop handler for slots
        this.input.on('drop', (pointer, gameObject, dropZone) => {
            // Only handle if dropZone is   a slot square
            if (!dropZone || dropZone.getData('slotIdx') === undefined) {
                console.assert.log('No drop zone or slotIdx');
                return;
            }
            const slotIdx = dropZone.getData('slotIdx');
            const slotContainer = this.slotSprites[slotIdx];
            console.log('slotContainer:', slotContainer);
            const slotSquares = slotContainer.list;
            console.log('slot squares:', slotSquares);
            // Only allow drop if slot is not filled and word length matches slot length
            if (!gameObject || !gameObject.getData('word')) {
                console.assert.log('No gameObject or word data');
                this.tweenBackToBottom(gameObject);
            }
            const word = gameObject.getData('word');
            if (slotSquares.length !== word.length) {
                console.log('length mismatch, going back');
                this.tweenBackToBottom(gameObject);
                return;
                // Animate back to original position
                this.tweens.add({
                    targets: gameObject,
                    x: 0,
                    y: 0,
                    duration: 300,
                    ease: 'Power2'
                });
                return;
            }
            // Check if slot is already filled
            let slotFilled = slotSquares.some(squareContainer => squareContainer.getData('filled'));
            if (slotFilled) {
                console.log('slot is already filled, going back');
                this.tweenBackToBottom(gameObject);
                return;
            }

            // Check if slot has opposite rule and get transformed word
            const transformedWord = this.getTransformedWord(word, slotIdx);

            // Check constraint violations using transformed word
            const violationResult = this.checkConstraintViolation(slotIdx, transformedWord);
            if (violationResult.violated) {
                console.log(`Constraint violation at square ${violationResult.squareIdx}: expected "${violationResult.expectedLetter}", got "${violationResult.actualLetter}"`);
                this.showConstraintViolationFeedback(slotIdx, violationResult.squareIdx);
                this.tweenBackToBottom(gameObject);
                return;
            }

            // If all checks pass, place the word over the slot
            const firstSquareContainer = slotSquares[0];
            const offset = 0;
            const snapDuration = 200;

            // Check if we need to apply transformation (opposite, reverse, or swap)
            const slotRule = this.getSlotRule(slotIdx);
            const willTransform = slotRule && (slotRule.op === 'opposite' || slotRule.op === 'reverse' || slotRule.op === 'swap') && transformedWord !== word;

            this.tweens.add({
                targets: gameObject,
                x: dropZone.x + offset,
                y: dropZone.y - offset,
                duration: snapDuration,
                ease: 'Power2',
                onComplete: () => {
                    if (willTransform) {
                        // First: Apply transformation animation
                        this.applyWordTransformation(gameObject, word, transformedWord, slotIdx, slotRule, () => {
                            // Second: Play placement animation with transformed word
                            this.playPlacementAnimation(gameObject, () => {
                                // Third: Update hints and show arrows ONCE
                                this.updateAllConstraintHints(true);
                                this.updateConnectionHighlights();
                                this.showConnectionValidationFeedback(slotIdx);

                                // Check if autopilot can place an obvious word
                                if (this.autopilotEnabled && !this.autopilotInProgress) {
                                    this.time.delayedCall(800, () => {
                                        this.tryAutopilotPlacement();
                                    });
                                }

                                // Check win condition
                                this.time.delayedCall(500, () => {
                                    this.checkWinCondition();
                                });
                            });
                        });
                    } else {
                        // No transformation: Play placement animation then show hints
                        this.playPlacementAnimation(gameObject, () => {
                            // After placement animation, update hints and show arrows
                            this.updateAllConstraintHints(true);
                            this.updateConnectionHighlights();
                            this.showConnectionValidationFeedback(slotIdx);

                            // Check if autopilot can place an obvious word
                            if (this.autopilotEnabled && !this.autopilotInProgress) {
                                this.time.delayedCall(800, () => {
                                    this.tryAutopilotPlacement();
                                });
                            }

                            // Check win condition
                            this.time.delayedCall(500, () => {
                                this.checkWinCondition();
                            });
                        });
                    }
                }
            });

            gameObject.setData('placed', true);
            gameObject.setData('slotIdx', slotIdx);

            // Mark slot as filled
            // If transformation will occur, store original word initially and transformation will update it
            // Otherwise, store the final word directly
            slotContainer.setData('filled', true);
            slotContainer.setData('word', willTransform ? word : transformedWord);
            slotContainer.setData('originalWord', word); // Store original for reference
            slotSquares.forEach((squareContainer, i) => {
                squareContainer.setData('filled', true);
                // Initially fill with original word - transformation will update if needed
                squareContainer.setData('letter', willTransform ? word[i] : transformedWord[i]);
                // Restore full opacity for placed words
                const letterText = squareContainer.getData('letterText');
                if (letterText) {
                    letterText.setAlpha(1.0);
                }
            });

            // Note: Square strokes are now baked into the texture
            // No need to reset stroke colors

            // Reset connection lines connected to this slot
            this.connectionLines.forEach(line => {
                if (line.setStrokeStyle) { // Only for line objects, not text labels
                    const lineSlotIdx = line.getData('slotIdx');
                    const lineToSlotIdx = line.getData('toSlotIdx');
                    if (lineSlotIdx === slotIdx || lineToSlotIdx === slotIdx) {
                        const originalColor = line.getData('originalColor');
                        line.setStrokeStyle(3, originalColor); // Original color
                    }
                }
            });

            // Play fill sound
            this.sound.play('fillSound');

            // Note: Hints, connection highlights, and arrows are now updated AFTER 
            // the sequential letter animation completes (see playPlacementAnimation callback)
        });
    }
    // Play sequential letter bounce animation when word is placed
    playPlacementAnimation(wordContainer, onComplete) {
        const letters = wordContainer.list.filter(child => child.type === 'Text');
        const squares = wordContainer.list.filter(child => child.type === 'Image');

        if (letters.length === 0) {
            if (onComplete) onComplete();
            return;
        }

        // Store animation tweens for potential cancellation
        const animationTweens = [];
        wordContainer.setData('placementAnimationTweens', animationTweens);

        // Determine animation targets based on mode
        const animateSquares = this.placementAnimationMode === 'cell';

        // Animate each letter sequentially with a delay
        letters.forEach((letter, i) => {
            const square = squares[i];
            const delay = i * 50; // 50ms delay between each letter for smoother cascade

            // Choose targets based on mode: letter-only or cell (letter + square with baked-in stroke)
            const targets = animateSquares ? [letter, square] : [letter];

            // Bounce animation: scale up then back to normal
            const tween = this.tweens.add({
                targets: targets,
                scaleX: 1.4,
                scaleY: 1.4,
                duration: 120,
                ease: 'Back.easeOut',
                delay: delay,
                yoyo: true,
                onComplete: () => {
                    // Reset scale to ensure it's back to normal
                    letter.setScale(1);
                    if (square) square.setScale(1);

                    // If this is the last letter, call onComplete
                    if (i === letters.length - 1) {
                        wordContainer.setData('placementAnimationTweens', null);
                        if (onComplete) onComplete();
                    }
                }
            });

            animationTweens.push(tween);
        });
    }

    // Cancel placement animation and reset letter scales
    cancelPlacementAnimation(wordContainer) {
        const animationTweens = wordContainer.getData('placementAnimationTweens');
        if (animationTweens) {
            // Stop all tweens
            animationTweens.forEach(tween => {
                if (tween && tween.isPlaying()) {
                    tween.stop();
                }
            });

            // Reset all letter and square scales
            const letters = wordContainer.list.filter(child => child.type === 'Text');
            const squares = wordContainer.list.filter(child => child.type === 'Image');
            letters.forEach(letter => letter.setScale(1));
            squares.forEach(square => square.setScale(1));

            wordContainer.setData('placementAnimationTweens', null);
        }
    }

    // Apply word transformation with appropriate animation
    applyWordTransformation(wordContainer, originalWord, transformedWord, slotIdx, slotRule, onComplete) {
        const letters = wordContainer.list.filter(child => child.type === 'Text');

        // Update word container's data so when dragged again it uses the new word
        wordContainer.setData('word', transformedWord);

        // Determine which animation to use
        if (slotRule.op === 'opposite') {
            // Use flip animation for opposite
            this.applyFlipAnimation(wordContainer, letters, transformedWord, slotIdx, onComplete);
        } else if (slotRule.op === 'reverse' || slotRule.op === 'swap') {
            // Use swap animation for reverse and swap (letters only, not cells)
            this.applySwapAnimation(wordContainer, letters, originalWord, transformedWord, slotIdx, slotRule, onComplete);
        } else {
            // Fallback: just update text
            this.updateSlotWithTransformedWord(slotIdx, transformedWord);
            if (onComplete) onComplete();
        }
    }

    // Flip animation for opposite transformation
    applyFlipAnimation(wordContainer, letters, transformedWord, slotIdx, onComplete) {
        letters.forEach((letterText, i) => {
            // Scale down to 0.1 vertically
            this.tweens.add({
                targets: letterText,
                scaleY: 0.1,
                duration: 150,
                ease: 'Quad.easeIn',
                onComplete: () => {
                    // Change letter halfway through animation
                    letterText.setText(transformedWord[i]);

                    // Scale back up
                    this.tweens.add({
                        targets: letterText,
                        scaleY: 1,
                        duration: 150,
                        ease: 'Quad.easeOut',
                        onComplete: () => {
                            // Pop animation to indicate new letter
                            this.tweens.add({
                                targets: letterText,
                                scaleX: 1.3,
                                scaleY: 1.3,
                                duration: 100,
                                ease: 'Back.easeOut',
                                yoyo: true,
                                onComplete: () => {
                                    // Update slot squares with new letters
                                    this.updateSlotWithTransformedWord(slotIdx, transformedWord);

                                    // Call completion callback after last letter
                                    if (i === letters.length - 1 && onComplete) {
                                        onComplete();
                                    }
                                }
                            });
                        }
                    });
                }
            });
        });
    }

    // Swap animation for reverse and swap transformations (letters only, cells stay in place)
    applySwapAnimation(wordContainer, letters, originalWord, transformedWord, slotIdx, slotRule, onComplete) {
        // Determine swap pairs
        let swapPairs = [];
        if (slotRule.op === 'reverse') {
            // Generate pairs for reverse: 1-n, 2-(n-1), etc., skipping middle if odd
            const len = originalWord.length;
            for (let i = 0; i < Math.floor(len / 2); i++) {
                swapPairs.push([i, len - 1 - i]);
            }
        } else if (slotRule.op === 'swap' && slotRule.pairs) {
            // Convert 1-based pairs to 0-based
            swapPairs = slotRule.pairs.map(pair => [pair[0] - 1, pair[1] - 1]);
        }

        if (swapPairs.length === 0) {
            this.updateSlotWithTransformedWord(slotIdx, transformedWord);
            if (onComplete) onComplete();
            return;
        }

        // Animate swaps simultaneously (letters only, not the bg cells)
        let completedSwaps = 0;
        const totalSwaps = swapPairs.length;

        swapPairs.forEach(([idx1, idx2]) => {
            if (idx1 >= letters.length || idx2 >= letters.length) return;

            const letter1 = letters[idx1];
            const letter2 = letters[idx2];

            // Store original positions
            const pos1 = { x: letter1.x, y: letter1.y };
            const pos2 = { x: letter2.x, y: letter2.y };

            // Bring letters to front during animation so they stay visible above tiles
            letter1.setDepth(1000);
            letter2.setDepth(1000);

            // Animate only letters swapping positions (not the cells/squares)
            const duration = 900;
            const curve = 'Back.easeInOut';

            // Move letter1 to position 2
            this.tweens.add({
                targets: letter1,
                x: pos2.x,
                y: pos2.y,
                duration: duration,
                ease: curve
            });

            // Move letter2 to position 1
            this.tweens.add({
                targets: letter2,
                x: pos1.x,
                y: pos1.y,
                duration: duration,
                ease: curve,
                onComplete: () => {
                    completedSwaps++;
                    if (completedSwaps === totalSwaps) {
                        // All swaps complete - now reset positions and update text values
                        letters.forEach((letter, i) => {
                            letter.setText(transformedWord[i]);
                            // Reset depth after animation
                            letter.setDepth(0);
                        });
                        
                        // Reset all letters to their original container positions
                        letters.forEach((letter, i) => {
                            const originalX = i * this.gridSize;
                            letter.x = originalX;
                            letter.y = 0;
                        });

                        // Update slot with transformed word
                        this.updateSlotWithTransformedWord(slotIdx, transformedWord);

                        if (onComplete) onComplete();
                    }
                }
            });
        });
    }

    // Helper method to update slot squares with transformed word
    updateSlotWithTransformedWord(slotIdx, transformedWord) {
        const slotContainer = this.slotSprites[slotIdx];
        const slotSquares = slotContainer.list;

        // Update slot container's word data to transformed word
        slotContainer.setData('word', transformedWord);

        slotSquares.forEach((squareContainer, idx) => {
            const slotLetterText = squareContainer.getData('letterText');
            if (slotLetterText && idx < transformedWord.length) {
                slotLetterText.setText(transformedWord[idx]);
                slotLetterText.setAlpha(1.0);
            }
            if (idx < transformedWord.length) {
                squareContainer.setData('letter', transformedWord[idx]);
            }
        });
    }

    // Apply antonym transformation with flip animation (kept for backwards compatibility)
    applyAntonymTransformation(wordContainer, originalWord, antonymWord, slotIdx, onComplete) {
        const letters = wordContainer.list.filter(child => child.type === 'Text');
        wordContainer.setData('word', antonymWord);
        const slotRule = { op: 'opposite' };
        this.applyWordTransformation(wordContainer, originalWord, antonymWord, slotIdx, slotRule, onComplete);
    }

    tweenBackToBottom(gameObject) {
        this.tweens.add({
            targets: gameObject,
            x: gameObject.getData('initPosition').x,
            y: gameObject.getData('initPosition').y,
            duration: 200,
            ease: 'Power2'
        });
    }

    createAreas() {
        const { width, height } = this.sys.game.canvas;
        this.slotAreaY = 0;
        this.slotAreaHeight = height * 0.6;
        this.bankAreaY = this.slotAreaHeight;
        this.bankAreaHeight = height * 0.4;
    }

    createCellTextures() {
        const size = this.squareWidth;
        const color1 = CONFIG.CELL_BG1_COLOR;
        const color2 = CONFIG.CELL_BG2_COLOR;

        // Remove existing textures if they exist (for hot reload)
        if (this.textures.exists('wordCellTexture')) {
            this.textures.remove('wordCellTexture');
        }
        if (this.textures.exists('slotCellTexture')) {
            this.textures.remove('slotCellTexture');
        }

        // Create word cell texture with diagonal split (top-right to bottom-left)
        const wordTexture = this.textures.createCanvas('wordCellTexture', size, size);
        const wordCtx = wordTexture.getSourceImage().getContext('2d');

        // Draw top-left triangle (color1)
        wordCtx.fillStyle = '#' + color1.toString(16).padStart(6, '0');
        wordCtx.beginPath();
        wordCtx.moveTo(0, 0);        // top-left
        wordCtx.lineTo(size, 0);    // top-right
        wordCtx.lineTo(0, size);    // bottom-left
        wordCtx.closePath();
        wordCtx.fill();

        // Draw bottom-right triangle (color2)
        wordCtx.fillStyle = '#' + color2.toString(16).padStart(6, '0');
        wordCtx.beginPath();
        wordCtx.moveTo(size, size); // bottom-right
        wordCtx.lineTo(size, 0);    // top-right
        wordCtx.lineTo(0, size);    // bottom-left
        wordCtx.closePath();
        wordCtx.fill();

        // Add stroke to the texture
        wordCtx.strokeStyle = '#' + this.wordStrokeColor.toString(16).padStart(6, '0');
        wordCtx.lineWidth = this.wordStrokeWidth;
        wordCtx.strokeRect(this.wordStrokeWidth / 2, this.wordStrokeWidth / 2, size - this.wordStrokeWidth, size - this.wordStrokeWidth);

        wordTexture.refresh();

        // Create slot cell texture with uniform color1
        const slotTexture = this.textures.createCanvas('slotCellTexture', size, size);
        const slotCtx = slotTexture.getSourceImage().getContext('2d');
        slotCtx.fillStyle = '#' + color1.toString(16).padStart(6, '0');
        slotCtx.fillRect(0, 0, size, size);
        
        // Add stroke to the texture
        slotCtx.strokeStyle = '#' + this.slotStrokeColor.toString(16).padStart(6, '0');
        slotCtx.lineWidth = this.slotStrokeWidth;
        slotCtx.strokeRect(this.slotStrokeWidth / 2, this.slotStrokeWidth / 2, size - this.slotStrokeWidth, size - this.slotStrokeWidth);
        
        slotTexture.refresh();
    }

    createPortraitBoundary() {
        const { width, height } = this.sys.game.canvas;

        // Draw a darker background outside the portrait area
        // Portrait area is 720x1280 centered in the canvas
        const portraitWidth = 720;
        const portraitHeight = 1280;

        // Calculate offsets if canvas is larger than portrait area
        const leftOffset = (width - portraitWidth) / 2;
        const topOffset = (height - portraitHeight) / 2;

        if (leftOffset > 0 || topOffset > 0) {
            // Draw darker background panels on sides
            const darkerBg = 0xd0e0f0; // Slightly darker blue-gray

            // Left panel
            if (leftOffset > 0) {
                const leftPanel = this.add.rectangle(0, 0, leftOffset, height, darkerBg);
                leftPanel.setOrigin(0, 0);
                leftPanel.setDepth(-1000);

                // Right panel
                const rightPanel = this.add.rectangle(width - leftOffset, 0, leftOffset, height, darkerBg);
                rightPanel.setOrigin(0, 0);
                rightPanel.setDepth(-1000);
            }

            // Top panel (only in the portrait area width)
            if (topOffset > 0) {
                const topPanel = this.add.rectangle(leftOffset, 0, portraitWidth, topOffset, darkerBg);
                topPanel.setOrigin(0, 0);
                topPanel.setDepth(-1000);

                // Bottom panel
                const bottomPanel = this.add.rectangle(leftOffset, height - topOffset, portraitWidth, topOffset, darkerBg);
                bottomPanel.setOrigin(0, 0);
                bottomPanel.setDepth(-1000);
            }
        }

        // Draw portrait boundary outline
        const portraitX = width / 2;
        const portraitY = height / 2;

        const boundaryGraphics = this.add.graphics();
        boundaryGraphics.lineStyle(3, 0xff6600, 0.8); // Orange border, semi-transparent
        boundaryGraphics.strokeRect(
            portraitX - portraitWidth / 2,
            portraitY - portraitHeight / 2,
            portraitWidth,
            portraitHeight
        );
        boundaryGraphics.setDepth(10000); // Above everything

        // Add label
        const labelText = this.add.text(
            portraitX,
            portraitY - portraitHeight / 2 - 20,
            'Portrait Area (720x1280)',
            {
                fontFamily: 'Arial, sans-serif',
                fontSize: '16px',
                color: '#ff6600',
                fontStyle: 'bold',
                backgroundColor: '#ffffff',
                padding: { x: 8, y: 4 }
            }
        );
        labelText.setOrigin(0.5, 1);
        labelText.setDepth(10001);
    }

    renderSlots() {
        this.slotSprites = [];
        const slotAreaWidth = this.sys.game.canvas.width;
        const slotAreaHeight = this.slotAreaHeight;

        this.level.slots.forEach((slot, slotIdx) => {
            let slotContainer = this.add.container();
            slotContainer.setDepth(10); // Slots at depth 10

            for (let i = 0; i < slot.length; i++) {
                let x = i * this.gridSize;
                let y = 0;

                // Create a sub-container for each square to hold both graphics and text
                let squareContainer = this.add.container(x, y);

                // Create shadow layers for depth effect - inset appearance (keep as rectangles)
                // Bottom-right inner shadow (dark) - creates depth
                let shadowDark = this.add.rectangle(5, 5, this.squareWidth, this.squareWidth, 0x000000, 0.35);
                // Secondary softer shadow for more depth
                let shadowMid = this.add.rectangle(15, 15, this.squareWidth, this.squareWidth, 0x666666, 0.2);
                // Top-left edge highlight for beveled look
                let highlightEdge = this.add.rectangle(-2, -2, this.squareWidth - 4, this.squareWidth - 4, 0xffffff, 0.6);

                // Create the image (square) centered at (0, 0) within the squareContainer using slot texture (includes stroke)
                let square = this.add.image(0, 0, 'slotCellTexture');
                square.setDisplaySize(this.squareWidth, this.squareWidth);

                // Create the text centered at (0, 0) within the squareContainer
                let letterText = this.add.text(0, 0, '', {
                    fontFamily: this.letterFontFamily,
                    fontWeight: this.letterFontWeight,
                    fontSize: this.slotCellFontSize,
                    color: '#222',
                    resolution: window.devicePixelRatio || 2 // High resolution for crisp text
                }).setOrigin(0.5);

                // Add all elements to the squareContainer (shadows first for layering)
                squareContainer.add(shadowDark);
                squareContainer.add(shadowMid);
                squareContainer.add(square);
                squareContainer.add(highlightEdge);
                squareContainer.add(letterText);

                // Store data on the squareContainer (not the rectangle)
                squareContainer.setData({ slotIdx, squareIdx: i, filled: false, letter: null });

                // Store references to the children for easy access
                squareContainer.setData('square', square);
                squareContainer.setData('letterText', letterText);

                // Add squareContainer to the slotContainer
                slotContainer.add(squareContainer);
            }

            // Add swap pair dots if this slot has a swap rule
            const slotRule = this.getSlotRule(slotIdx);
            if (slotRule && slotRule.op === 'swap' && slotRule.pairs) {
                // Dot positions: top-right, bottom-left, top-center, bottom-center
                const dotPositions = [
                    { x: this.squareWidth / 2 - 6, y: -this.squareWidth / 2 + 6 }, // top-right
                    { x: -this.squareWidth / 2 + 6, y: this.squareWidth / 2 - 6 }, // bottom-left
                    { x: 0, y: -this.squareWidth / 2 + 6 }, // top-center
                    { x: 0, y: this.squareWidth / 2 - 6 }  // bottom-center
                ];

                slotRule.pairs.forEach((pair, pairIdx) => {
                    if (pairIdx >= dotPositions.length) return; // Max 4 pairs
                    
                    const dotPos = dotPositions[pairIdx];
                    const dotRadius = 3;
                    const dotColor = this.slotStrokeColor;

                    // Add dot to first position in pair
                    const idx1 = pair[0] - 1; // Convert to 0-based
                    if (idx1 >= 0 && idx1 < slot.length) {
                        const squareContainer1 = slotContainer.list[idx1];
                        const dot1 = this.add.circle(dotPos.x, dotPos.y, dotRadius, dotColor);
                        squareContainer1.add(dot1);
                    }

                    // Add dot to second position in pair
                    const idx2 = pair[1] - 1; // Convert to 0-based
                    if (idx2 >= 0 && idx2 < slot.length) {
                        const squareContainer2 = slotContainer.list[idx2];
                        const dot2 = this.add.circle(dotPos.x, dotPos.y, dotRadius, dotColor);
                        squareContainer2.add(dot2);
                    }
                });
            }

            // Position slot at anchor cell center, relative to grid origin
            const anchorCellPoints = Utils.getGridCellPoints(slot.anchorCol, slot.anchorRow, this.originX, this.originY, this.gridSize);
            slotContainer.setPosition(anchorCellPoints.center.x, anchorCellPoints.center.y);

            let extra = this.gridSize;
            // Make the entire slot container a dropzone
            slotContainer.setInteractive(new Phaser.Geom.Rectangle(
                -this.gridSize / 2 - extra / 2, -this.gridSize / 2 - extra / 2, slot.length * this.gridSize + extra, this.gridSize + extra
            ), Phaser.Geom.Rectangle.Contains);
            slotContainer.input.dropZone = true;

            slotContainer.setData('slotIdx', slotIdx);
            this.slotSprites.push(slotContainer);
        });
    }

    // Check if a slot has a word-level rule (like opposite)
    getSlotRule(slotIdx) {
        const rules = this.level.rules || [];
        return rules.find(rule => rule.type === 'word' && rule.slot === slotIdx);
    }

    // Get the transformed word for a slot (apply opposite, reverse, or swap if rule exists)
    getTransformedWord(word, slotIdx) {
        const slotRule = this.getSlotRule(slotIdx);
        if (slotRule && slotRule.op === 'opposite') {
            const antonym = this.wordAntonymMap.get(word);
            return antonym || word;
        } else if (slotRule && slotRule.op === 'reverse') {
            // Reverse the word: LOOP becomes POOL
            return word.split('').reverse().join('');
        } else if (slotRule && slotRule.op === 'swap' && slotRule.pairs) {
            // Swap letters according to pairs: [[1,2],[3,4]] swaps positions 1-2 and 3-4
            const letters = word.split('');
            slotRule.pairs.forEach(pair => {
                const idx1 = pair[0] - 1; // Convert to 0-based index
                const idx2 = pair[1] - 1;
                if (idx1 >= 0 && idx1 < letters.length && idx2 >= 0 && idx2 < letters.length) {
                    // Swap
                    const temp = letters[idx1];
                    letters[idx1] = letters[idx2];
                    letters[idx2] = temp;
                }
            });
            return letters.join('');
        }
        return word;
    }

    renderBank() {
        const startY = this.bankAreaY + 40;
        const verticalGap = this.squareWidth + 24;
        this.level.words.forEach((word, wordIdx) => {
            let startX = this.sys.game.canvas.width / 2 - Utils.getFrameWidth(word.length) / 2;
            let baseY = startY + wordIdx * verticalGap;
            let wordContainer = this.add.container(0, 0);
            for (let i = 0; i < word.length; i++) {
                let x = i * this.gridSize;
                let y = 0;
                // Create image object for word cell at position x,y using word texture (includes stroke)
                let square = this.add.image(x, y, 'wordCellTexture');
                square.setDisplaySize(this.squareWidth, this.squareWidth);

                let letter = this.add.text(x, y, word[i], {
                    fontFamily: this.letterFontFamily,
                    fontWeight: this.letterFontWeight,
                    fontSize: this.wordCellFontSize,
                    color: '#222',
                    resolution: window.devicePixelRatio || 2 // High resolution for crisp text
                }).setOrigin(0.5);
                square.setData({ wordIdx, letterIdx: i });
                wordContainer.add(square);
                wordContainer.add(letter);
            }
            wordContainer.setPosition(startX, baseY);
            wordContainer.setDepth(100);
            wordContainer.setData('initPosition', { x: startX, y: baseY });
            wordContainer.setData({ word, wordIdx, placed: false, origY: baseY, startX });
            wordContainer.setInteractive(
                new Phaser.Geom.Rectangle(
                    -this.gridSize / 2,
                    -this.gridSize / 2,
                    this.gridSize * word.length,
                    this.gridSize
                ),
                Phaser.Geom.Rectangle.Contains);
            this.input.setDraggable(wordContainer);
            let dragOffset = { x: 0, y: 0 };
            wordContainer.on('dragstart', (pointer) => {
                // Ignore if autopilot is in progress
                if (this.autopilotInProgress) return;

                // Hide tutorial when user starts interacting
                if (this.tutorialManager) {
                    this.tutorialManager.cleanup();
                }

                dragOffset.x = pointer.x - wordContainer.x;
                dragOffset.y = pointer.y - wordContainer.y;

                // Bring to front while dragging
                wordContainer.setDepth(2000);

                // If this word was placed on a slot, remove it from that slot temporarily
                if (wordContainer.getData('placed')) {
                    const slotIdx = wordContainer.getData('slotIdx');
                    console.log(`Dragging word from slot ${slotIdx}, removing temporarily`);

                    // Cancel any ongoing placement animation
                    this.cancelPlacementAnimation(wordContainer);

                    this.removeWordFromSlot(slotIdx);
                    // Clear placement data immediately to prevent phantom connections
                    wordContainer.setData('placed', false);
                    wordContainer.setData('slotIdx', null);
                }
            });
            wordContainer.on('drag', (pointer, dragX, dragY) => {
                wordContainer.x = pointer.x - dragOffset.x;
                wordContainer.y = pointer.y - dragOffset.y;
            });
            wordContainer.on('dragend', (pointer, dragX, dragY, dropped) => {
                // Restore normal depth
                wordContainer.setDepth(100);

                if (!dropped) {
                    // Not dropped on a valid slot, animate back to original position
                    // Make sure placement flags are cleared
                    wordContainer.setData('placed', false);
                    wordContainer.setData('slotIdx', null);
                    this.tweens.add({
                        targets: wordContainer,
                        x: startX,
                        y: baseY,
                        duration: 300,
                        ease: 'Power2'
                    });
                }
            });
            this.bankSprites.push(wordContainer);
        });
    }

    makeDraggable(wordGroup) {
        wordGroup.getChildren().forEach(child => {
            child.setInteractive();
        });
        this.input.setDraggable(wordGroup);
        wordGroup.on('dragstart', (pointer) => {
            this.selectedWord = wordGroup;
        });
        wordGroup.on('drag', (pointer, dragX, dragY) => {
            wordGroup.getChildren().forEach(child => {
                child.x += dragX - child.x;
                child.y += dragY - child.y;
            });
        });
        wordGroup.on('dragend', (pointer, dragX, dragY, dropped) => {
            // Reset all slot highlights when drag ends
            this.slotSprites.forEach(slotContainer => {
                slotContainer.list.forEach(squareContainer => {
                    const square = squareContainer.getData('square');
                    if (square && !squareContainer.getData('filled')) {
                        square.setStrokeStyle(this.slotStrokeWidth, this.slotStrokeColor); // Original stroke
                    }
                });
            });

            // Reset all connection lines
            this.connectionLines.forEach(line => {
                if (line.setStrokeStyle) { // Only for line objects, not text labels
                    const originalColor = line.getData('originalColor');
                    if (originalColor !== undefined) {
                        line.setStrokeStyle(3, originalColor); // Original color
                    }
                }
            });

            if (!dropped) {
                // Animate back to original position
                wordGroup.getChildren().forEach(child => {
                    this.tweens.add({
                        targets: child,
                        x: child.x,
                        y: wordGroup.getData('origY'),
                        duration: 300,
                        ease: 'Power2'
                    });
                });
            }
        });
    }

    renderSlotLabels() {
        // Render labels for word-level rules (like 'opposite', 'reverse', etc.)
        const rules = this.level.rules || [];

        rules.forEach(rule => {
            if (rule.type === 'word' && rule.slot !== undefined) {
                const slotIdx = rule.slot;
                const slotContainer = this.slotSprites[slotIdx];
                if (!slotContainer) return;

                // Get the label text based on operation
                let labelText = '';
                if (rule.op === 'opposite') {
                    labelText = 'Opposite';
                } else if (rule.op === 'reverse') {
                    labelText = 'Reverse';
                } else if (rule.op === 'swap') {
                    labelText = 'Swap';
                } else {
                    labelText = rule.op; // fallback to operation name
                }

                // Get slot bounds for positioning
                const bounds = slotContainer.getBounds();
                const labelPos = rule.labelPos !== undefined ? parseInt(rule.labelPos) : 0;

                let labelX, labelY;
                const sideGap = 11; // Gap for left/right positions
                const topBottomGap = 6; // Reduced gap for top/bottom positions

                // Calculate position based on labelPos
                switch (labelPos) {
                    case 1: // Right of slot
                        labelX = bounds.right + sideGap;
                        labelY = bounds.centerY;
                        break;
                    case 2: // Bottom of slot
                        labelX = bounds.centerX;
                        labelY = bounds.bottom + topBottomGap;
                        break;
                    case 3: // Left of slot
                        labelX = bounds.left - sideGap;
                        labelY = bounds.centerY;
                        break;
                    case 0: // Top of slot (default)
                    default:
                        labelX = bounds.centerX;
                        labelY = bounds.top - topBottomGap;
                        break;
                }

                // Create the label text
                const label = this.add.text(labelX, labelY, labelText, {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '22px',
                    color: '#888888', // Grey color
                    resolution: window.devicePixelRatio || 2
                }).setDepth(15);

                // Set origin based on position for proper alignment
                if (labelPos === 3) {
                    // Left of slot - align right
                    label.setOrigin(1, 0.5);
                } else if (labelPos === 1) {
                    // Right of slot - align left
                    label.setOrigin(0, 0.5);
                } else if (labelPos === 2) {
                    // Bottom of slot - center horizontally, top align
                    label.setOrigin(0.5, 0);
                } else {
                    // Top of slot (default) - center horizontally, bottom align
                    label.setOrigin(0.5, 1);
                }
            }
        });
    }

    renderConnections() {
        // Use the same color as slot square outline: black (0x000000)
        const connectionColor = 0x000000;

        // Support both 'rules' (new) and 'connections' (legacy)
        const rules = this.level.rules || this.level.connections || [];

        rules.forEach(rule => {
            const ruleInfo = this.parseRule(rule);
            if (!ruleInfo) return; // Skip invalid rules

            // Get the squareContainer from the slot
            const fromSquareContainer = this.slotSprites[ruleInfo.slotIdx].list[ruleInfo.squareIdx];
            const toSquareContainer = this.slotSprites[ruleInfo.toSlotIdx].list[ruleInfo.toSquareIdx];
            const fromPt = this.getSquareSideMidpoint(fromSquareContainer, ruleInfo.sideIdx);
            const toPt = this.getSquareSideMidpoint(toSquareContainer, ruleInfo.toSideIdx);
            let line = this.add.line(0, 0, fromPt.x, fromPt.y, toPt.x, toPt.y, connectionColor).setOrigin(0, 0).setLineWidth(3);
            line.setDepth(-100);
            // Store slot indices on the line for later reference
            line.setData('slotIdx', ruleInfo.slotIdx);
            line.setData('toSlotIdx', ruleInfo.toSlotIdx);
            line.setData('originalColor', connectionColor);
            this.connectionLines.push(line);

            // Draw directional arrows for incremental rules only (type 1)
            if (ruleInfo.type === 1 && ruleInfo.increment !== 0) {
                const isBidirectional = ruleInfo.direction === 'bi';
                this.drawConnectionArrow(fromPt, toPt, connectionColor, isBidirectional);
            }

            // If type 1 connection, add increment label
            if (ruleInfo.type === 1 && ruleInfo.increment !== 0) {
                const midX = (fromPt.x + toPt.x) / 2;
                const midY = (fromPt.y + toPt.y) / 2;

                // Calculate line angle and perpendicular offset
                const angle = Math.atan2(toPt.y - fromPt.y, toPt.x - fromPt.x);
                const isHorizontal = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle));

                // Offset distance from the line
                const offset = 20;

                // Position label perpendicular to the line
                let labelX, labelY;
                if (isHorizontal) {
                    // For horizontal lines, place label above or below
                    labelX = midX;
                    labelY = midY - offset; // Place above the line
                } else {
                    // For vertical or diagonal lines, place label to the side
                    labelX = midX + offset; // Place to the right of the line
                    labelY = midY;
                }

                // Format increment as +1, -2, etc.
                const incrementText = ruleInfo.increment > 0 ? `+${ruleInfo.increment}` : `${ruleInfo.increment}`;

                // Create label with black text, no background
                const label = this.add.text(labelX, labelY, incrementText, {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '20px',
                    color: '#000000', // Black text
                    resolution: window.devicePixelRatio || 2
                }).setOrigin(0.5);
                label.setDepth(-50); // Above line, below words
                this.connectionLines.push(label); // Store for cleanup
            }
        });
    }

    parseRule(rule) {
        // Parse rule - can be either old string format or new object format
        if (typeof rule === 'string') {
            // Legacy format: "022-100" or "022-100-1-plus2"
            return this.decodeConn(rule);
        }

        // New object format
        if (rule.type === 'cell') {
            const result = {
                slotIdx: rule.a.slot,
                squareIdx: rule.a.cell,
                sideIdx: rule.a.side,
                toSlotIdx: rule.b.slot,
                toSquareIdx: rule.b.cell,
                toSideIdx: rule.b.side,
                type: 0,
                increment: 0,
                direction: rule.direction || 'uni' // Default to unidirectional
            };

            // Parse operation
            if (rule.op === 'same' || rule.op === '=') {
                result.type = 0;
                result.increment = 0;
            } else if (rule.op.startsWith('+')) {
                result.type = 1;
                result.increment = parseInt(rule.op.substring(1));
            } else if (rule.op.startsWith('-')) {
                result.type = 1;
                result.increment = parseInt(rule.op);
            }

            return result;
        }

        // Word-level rules (like 'opposite') are handled separately by getSlotRule
        if (rule.type === 'word') {
            return null; // Not an error - these rules don't define cell connections
        }

        // Fallback for unknown format
        console.error('Unknown rule format:', rule);
        return null;
    }

    decodeConn(str) {
        // Parse connection string: "022-100" (type 0) or "022-100-1-plus2" (type 1 with +2)
        // This is kept for backward compatibility
        const parts = str.split('-');

        const result = {
            slotIdx: parseInt(parts[0][0]),
            squareIdx: parseInt(parts[0][1]),
            sideIdx: parseInt(parts[0][2]),
            toSlotIdx: parseInt(parts[1][0]),
            toSquareIdx: parseInt(parts[1][1]),
            toSideIdx: parseInt(parts[1][2]),
            type: 0, // Default type 0 (same letter)
            increment: 0 // For type 1 connections
        };

        // Check if there are additional parts for type 1
        if (parts.length > 2) {
            result.type = parseInt(parts[2]);

            // Parse increment value (e.g., "plus2", "minus1")
            if (parts.length > 3 && result.type === 1) {
                const incrementStr = parts[3];
                if (incrementStr.startsWith('plus')) {
                    result.increment = parseInt(incrementStr.substring(4));
                } else if (incrementStr.startsWith('minus')) {
                    result.increment = -parseInt(incrementStr.substring(5));
                }
            }
        }

        return result;
    }

    // Calculate the expected letter based on connection type
    calculateHintLetter(sourceLetter, increment) {
        if (increment === 0) return sourceLetter;

        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const sourceIndex = alphabet.indexOf(sourceLetter.toUpperCase());

        if (sourceIndex === -1) return sourceLetter; // Not a letter

        // Apply increment with wrapping
        let targetIndex = sourceIndex + increment;

        // Wrap around the alphabet
        while (targetIndex < 0) targetIndex += 26;
        while (targetIndex >= 26) targetIndex -= 26;

        return alphabet[targetIndex];
    }

    drawConnectionArrow(fromPt, toPt, color, isBidirectional) {
        // Don't draw any arrows for bidirectional connections
        if (isBidirectional) {
            return;
        }

        // Calculate angle from fromPt to toPt
        const angle = Math.atan2(toPt.y - fromPt.y, toPt.x - fromPt.x);
        const arrowSize = 15; // Increased by 50% from 10 to 15

        // Calculate midpoint of the line
        const midX = (fromPt.x + toPt.x) / 2;
        const midY = (fromPt.y + toPt.y) / 2;

        // Unidirectional: single arrow at midpoint pointing towards B
        this.drawArrowhead(midX, midY, angle, arrowSize, color);
    }

    drawArrowhead(x, y, angle, size, color) {
        // Draw a filled triangle arrowhead
        const arrow = this.add.graphics();
        arrow.fillStyle(color, 1);

        // Define triangle vertices (pointing right)
        const points = [
            { x: size, y: 0 },           // Tip
            { x: -size / 2, y: -size / 2 },  // Top corner
            { x: -size / 2, y: size / 2 }    // Bottom corner
        ];

        // Rotate and translate points
        const rotatedPoints = points.map(pt => ({
            x: x + pt.x * Math.cos(angle) - pt.y * Math.sin(angle),
            y: y + pt.x * Math.sin(angle) + pt.y * Math.cos(angle)
        }));

        // Draw the triangle
        arrow.beginPath();
        arrow.moveTo(rotatedPoints[0].x, rotatedPoints[0].y);
        arrow.lineTo(rotatedPoints[1].x, rotatedPoints[1].y);
        arrow.lineTo(rotatedPoints[2].x, rotatedPoints[2].y);
        arrow.closePath();
        arrow.fillPath();

        arrow.setDepth(-99); // Just above the line
        this.connectionLines.push(arrow);
    }

    getSquareSideMidpoint(squareContainer, sideIdx) {
        // Get the actual square graphics from the container
        const square = squareContainer.getData('square');
        // Use fixed square dimensions
        const width = this.squareWidth;
        const height = this.squareWidth;
        let localX = 0, localY = 0;
        switch (sideIdx) {
            case 0: // top
                localX = 0;
                localY = -height / 2;
                break;
            case 1: // right
                localX = width / 2;
                localY = 0;
                break;
            case 2: // bottom
                localX = 0;
                localY = height / 2;
                break;
            case 3: // left
                localX = -width / 2;
                localY = 0;
                break;
            default:
                localX = 0;
                localY = 0;
        }
        // Use the squareContainer's transform matrix to get world coordinates
        const matrix = squareContainer.getWorldTransformMatrix();
        const worldPoint = matrix.transformPoint(localX, localY);
        return { x: worldPoint.x, y: worldPoint.y };
    }

    // Check if placing a word would violate any constraint hints
    checkConstraintViolation(slotIdx, word) {
        const slotContainer = this.slotSprites[slotIdx];
        const slotSquares = slotContainer.list;

        // Check each square for hint violations
        for (let i = 0; i < slotSquares.length; i++) {
            const squareContainer = slotSquares[i];
            const letterText = squareContainer.getData('letterText');

            if (letterText) {
                const hintLetter = letterText.text.trim().toUpperCase();
                const wordLetter = word[i].toUpperCase();

                // If there's a hint and it doesn't match the word letter, it's a violation
                if (hintLetter && hintLetter !== wordLetter) {
                    return {
                        violated: true,
                        squareIdx: i,
                        expectedLetter: hintLetter,
                        actualLetter: wordLetter
                    };
                }
            }
        }

        // No violations found
        return { violated: false };
    }

    // Show visual feedback when a constraint is violated
    showConstraintViolationFeedback(slotIdx, squareIdx) {
        const slotContainer = this.slotSprites[slotIdx];
        const squareContainer = slotContainer.list[squareIdx];
        const square = squareContainer.getData('square');
        const letterText = squareContainer.getData('letterText');

        // Get the world position of the square container
        const matrix = squareContainer.getWorldTransformMatrix();
        const worldPos = matrix.transformPoint(0, 0);

        // Shake animation: move up and down quickly
        this.tweens.add({
            targets: squareContainer,
            y: squareContainer.y - 8, // Move up
            duration: 80,
            ease: 'Quad.easeOut',
            yoyo: true,
            repeat: 2, // Shake 3 times total (up-down-up-down-up-down)
            onComplete: () => {
                // Reset to original position
                squareContainer.y = squareIdx * 0; // Should be 0 for all squares in horizontal slots
            }
        });

        // Flash the square red briefly
        square.setTint(0xff6b6b);

        this.time.delayedCall(500, () => {
            square.clearTint();
        });

        // Make the hint text pulse/scale up briefly
        const originalScale = letterText.scale;
        this.tweens.add({
            targets: letterText,
            scale: 1.5,
            duration: 100,
            ease: 'Quad.easeOut',
            yoyo: true,
            repeat: 1
        });
    }

    // Update connection highlights for connected cells
    updateConnectionHighlights() {
        // First, clear all connection highlights (but preserve hint backgrounds)
        this.slotSprites.forEach(slotContainer => {
            slotContainer.list.forEach(squareContainer => {
                const square = squareContainer.getData('square');
                const letterText = squareContainer.getData('letterText');
                const hasHint = letterText && letterText.text && letterText.text.trim() !== '';

                if (square && !squareContainer.getData('filled')) {
                    // If cell has a hint, keep it green, otherwise reset to white
                    if (hasHint) {
                        square.setTint(this.connectionHighlightColor);
                    } else {
                        square.clearTint();
                    }
                }
            });
        });

        // Clear highlights from word containers
        this.bankSprites.forEach(wordContainer => {
            if (wordContainer.getData('placed')) {
                const word = wordContainer.getData('word');
                wordContainer.list.forEach((child, idx) => {
                    if (child.type === 'Image') {
                        // Clear tint to reset to default color
                        child.clearTint();
                    }
                });
            }
        });

        // Apply highlights for active connections
        const rules = this.level.rules || this.level.connections || [];
        if (!rules || rules.length === 0) return;

        rules.forEach(rule => {
            const ruleInfo = this.parseRule(rule);
            if (!ruleInfo || ruleInfo.type === undefined) return; // Skip word-level or invalid rules

            const fromSlot = this.slotSprites[ruleInfo.slotIdx];
            const toSlot = this.slotSprites[ruleInfo.toSlotIdx];

            // Only highlight if at least one slot is filled
            if (fromSlot.getData('filled') || toSlot.getData('filled')) {
                // Highlight from slot cell (but only if it's already filled, otherwise wait for animation)
                const fromSquare = fromSlot.list[ruleInfo.squareIdx];
                const fromRect = fromSquare.getData('square');
                if (fromRect && fromSlot.getData('filled')) {
                    fromRect.setTint(this.connectionHighlightColor);
                }

                // Highlight to slot cell (but only if it's already filled, otherwise wait for animation)
                const toSquare = toSlot.list[ruleInfo.toSquareIdx];
                const toRect = toSquare.getData('square');
                if (toRect && toSlot.getData('filled')) {
                    toRect.setTint(this.connectionHighlightColor);
                }

                // Highlight word cell if placed on fromSlot
                if (fromSlot.getData('filled')) {
                    const wordContainer = this.bankSprites.find(wc =>
                        wc.getData('placed') && wc.getData('slotIdx') === ruleInfo.slotIdx
                    );
                    if (wordContainer) {
                        const wordSquares = wordContainer.list.filter(c => c.type === 'Image');
                        if (wordSquares[ruleInfo.squareIdx]) {
                            const square = wordSquares[ruleInfo.squareIdx];
                            square.setTint(this.connectionHighlightColor);
                        }
                    }
                }

                // Highlight word cell if placed on toSlot
                if (toSlot.getData('filled')) {
                    const wordContainer = this.bankSprites.find(wc =>
                        wc.getData('placed') && wc.getData('slotIdx') === ruleInfo.toSlotIdx
                    );
                    if (wordContainer) {
                        const wordSquares = wordContainer.list.filter(c => c.type === 'Image');
                        if (wordSquares[ruleInfo.toSquareIdx]) {
                            const square = wordSquares[ruleInfo.toSquareIdx];
                            square.setTint(this.connectionHighlightColor);
                        }
                    }
                }
            }
        });
    }

    // Update constraint hints for all slots based on connections
    updateAllConstraintHints(animate = true) {
        // Store current hints before clearing
        const previousHints = new Map();
        this.slotSprites.forEach((slotContainer, slotIdx) => {
            const slotSquares = slotContainer.list;
            slotSquares.forEach((squareContainer, squareIdx) => {
                const letterText = squareContainer.getData('letterText');
                if (letterText && letterText.text) {
                    previousHints.set(`${slotIdx}-${squareIdx}`, letterText.text);
                }
            });
        });

        // Clear all hint texts
        this.slotSprites.forEach(slotContainer => {
            const slotSquares = slotContainer.list;
            slotSquares.forEach(squareContainer => {
                const letterText = squareContainer.getData('letterText');
                if (letterText) {
                    letterText.setText('');
                    letterText.setScale(1); // Reset scale
                }
            });
        });

        // Now update hints based on rules with animation
        const rules = this.level.rules || this.level.connections || [];
        if (!rules || rules.length === 0) return;

        rules.forEach(rule => {
            const ruleInfo = this.parseRule(rule);
            if (!ruleInfo) return; // Skip invalid rules

            const fromSlot = this.slotSprites[ruleInfo.slotIdx];
            const toSlot = this.slotSprites[ruleInfo.toSlotIdx];

            // Check if fromSlot has a word placed
            if (fromSlot.getData('filled') && !toSlot.getData('filled')) {
                const fromSquares = fromSlot.list;
                const fromSquareContainer = fromSquares[ruleInfo.squareIdx];
                const sourceLetter = fromSquareContainer.getData('letter');

                // Calculate the hint letter based on connection type
                const hintLetter = this.calculateHintLetter(sourceLetter, ruleInfo.increment);

                // Get positions for animation
                const toSquares = toSlot.list;
                const toSquareContainer = toSquares[ruleInfo.toSquareIdx];
                const toLetterText = toSquareContainer.getData('letterText');

                if (toLetterText && hintLetter) {
                    // Check if this hint already existed
                    const hintKey = `${ruleInfo.toSlotIdx}-${ruleInfo.toSquareIdx}`;
                    const wasAlreadyVisible = previousHints.get(hintKey) === hintLetter;

                    if (wasAlreadyVisible) {
                        // Hint already existed, just set it without animation
                        toLetterText.setText(hintLetter);
                        toLetterText.setAlpha(0.5); // Half transparent for hints
                        // Reapply green background color
                        const hintRect = toSquareContainer.getData('square');
                        if (hintRect && !toSquareContainer.getData('filled')) {
                            hintRect.setTint(this.connectionHighlightColor);
                        }
                    } else {
                        // New hint - animate it only if animate is true
                        if (animate) {
                            this.animateHintCreation(fromSquareContainer, toSquareContainer, hintLetter, ruleInfo.sideIdx, ruleInfo.toSideIdx, toSquares[ruleInfo.toSquareIdx]);
                        } else {
                            // Just show instantly without animation
                            toLetterText.setText(hintLetter);
                            toLetterText.setAlpha(0.5); // Half transparent for hints
                            // Apply green background color
                            const hintRect = toSquareContainer.getData('square');
                            if (hintRect && !toSquareContainer.getData('filled')) {
                                hintRect.setTint(this.connectionHighlightColor);
                            }
                        }
                    }
                }
            }

            // Check if toSlot has a word placed - apply reverse hints
            // Arrow shows direction of increment, reverse direction always decrements
            if (toSlot.getData('filled') && !fromSlot.getData('filled')) {
                const toSquares = toSlot.list;
                const toSquareContainer = toSquares[ruleInfo.toSquareIdx];
                const sourceLetter = toSquareContainer.getData('letter');

                // Calculate hint for reverse direction
                let hintLetter;
                if (ruleInfo.direction === 'bi' && ruleInfo.type === 1) {
                    // Bidirectional incremental: both directions use same increment
                    hintLetter = this.calculateHintLetter(sourceLetter, ruleInfo.increment);
                } else {
                    // Unidirectional or same-letter: reverse direction uses negated increment
                    // If arrow shows +1 from A to B, then B to A uses -1
                    hintLetter = this.calculateHintLetter(sourceLetter, -ruleInfo.increment);
                }

                // Get positions for animation
                const fromSquares = fromSlot.list;
                const fromSquareContainer = fromSquares[ruleInfo.squareIdx];
                const fromLetterText = fromSquareContainer.getData('letterText');

                if (fromLetterText && hintLetter) {
                    // Check if this hint already existed
                    const hintKey = `${ruleInfo.slotIdx}-${ruleInfo.squareIdx}`;
                    const wasAlreadyVisible = previousHints.get(hintKey) === hintLetter;

                    if (wasAlreadyVisible) {
                        // Hint already existed, just set it without animation
                        fromLetterText.setText(hintLetter);
                        fromLetterText.setAlpha(0.5); // Half transparent for hints
                        // Reapply green background color
                        const hintRect = fromSquareContainer.getData('square');
                        if (hintRect && !fromSquareContainer.getData('filled')) {
                            hintRect.setTint(this.connectionHighlightColor);
                        }
                    } else {
                        // New hint - animate it only if animate is true
                        if (animate) {
                            this.animateHintCreation(toSquareContainer, fromSquareContainer, hintLetter, ruleInfo.toSideIdx, ruleInfo.sideIdx, fromSquares[ruleInfo.squareIdx]);
                        } else {
                            // Just show instantly without animation
                            fromLetterText.setText(hintLetter);
                            fromLetterText.setAlpha(0.5); // Half transparent for hints
                            // Apply green background color
                            const hintRect = fromSquareContainer.getData('square');
                            if (hintRect && !fromSquareContainer.getData('filled')) {
                                hintRect.setTint(this.connectionHighlightColor);
                            }
                        }
                    }
                }
            }
        });
    }

    // Animate hint creation: particle travels along connection, then hint bounces in
    animateHintCreation(sourceSquareContainer, targetSquareContainer, letter, sourceSideIdx, targetSideIdx, hintSquareContainer = null) {
        // Get world positions
        const sourcePos = this.getSquareSideMidpoint(sourceSquareContainer, sourceSideIdx);
        const targetPos = this.getSquareSideMidpoint(targetSquareContainer, targetSideIdx);

        // Calculate angle for arrow direction
        const angle = Math.atan2(targetPos.y - sourcePos.y, targetPos.x - sourcePos.x);

        // Create an arrow (triangle) that travels along the connection
        const arrow = this.add.graphics();
        arrow.fillStyle(0x000000, 1);
        arrow.setDepth(1000); // Above everything

        // Draw triangle pointing in the direction of travel
        const arrowSize = 12;
        arrow.beginPath();
        arrow.moveTo(arrowSize, 0); // Point
        arrow.lineTo(-arrowSize / 2, -arrowSize / 2); // Top corner
        arrow.lineTo(-arrowSize / 2, arrowSize / 2); // Bottom corner
        arrow.closePath();
        arrow.fillPath();

        // Add white stroke
        arrow.lineStyle(2, 0xffffff, 1);
        arrow.strokePath();

        // Position and rotate arrow
        arrow.setPosition(sourcePos.x, sourcePos.y);
        arrow.setRotation(angle);

        // Calculate travel duration based on distance
        const distance = Phaser.Math.Distance.Between(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y);
        const duration = Math.max(300, Math.min(600, distance * 0.5)); // Between 300-600ms

        // Animate arrow traveling along the connection line
        this.tweens.add({
            targets: arrow,
            x: targetPos.x,
            y: targetPos.y,
            duration: duration,
            ease: 'Cubic.easeInOut',
            onUpdate: () => {
                // Pulse the arrow while traveling
                const progress = this.tweens.getTweensOf(arrow)[0]?.progress || 0;
                const scale = 1 + Math.sin(progress * Math.PI * 4) * 0.2; // Subtle pulse
                arrow.setScale(scale);
            },
            onComplete: () => {
                // Arrow reached destination - create burst effect at center of target cell
                const targetCellBounds = targetSquareContainer.getBounds();
                const targetCellCenter = {
                    x: targetCellBounds.centerX,
                    y: targetCellBounds.centerY
                };
                this.createBurstEffect(targetCellCenter.x, targetCellCenter.y);

                // Remove arrow
                arrow.destroy();

                // Apply green color to hint cell NOW (after arrow animation)
                if (hintSquareContainer) {
                    const hintRect = hintSquareContainer.getData('square');
                    if (hintRect && !hintSquareContainer.getData('filled')) {
                        hintRect.setTint(this.connectionHighlightColor);
                    }
                }

                // Now show the hint with bounce animation
                const targetLetterText = targetSquareContainer.getData('letterText');
                if (targetLetterText) {
                    targetLetterText.setText(letter);
                    targetLetterText.setAlpha(0.5); // Half transparent for hints
                    targetLetterText.setScale(0); // Start invisible

                    // Bounce in animation
                    this.tweens.add({
                        targets: targetLetterText,
                        scale: 1.5,
                        duration: 200,
                        ease: 'Back.easeOut',
                        onComplete: () => {
                            // Settle to normal size
                            this.tweens.add({
                                targets: targetLetterText,
                                scale: 1,
                                duration: 150,
                                ease: 'Quad.easeInOut'
                            });
                        }
                    });
                }
            }
        });
    }

    // Create a burst effect when particle reaches destination
    createBurstEffect(x, y) {
        // Play burst sound
        this.sound.play('burstSound', { volume: 0.5 });

        const particleCount = 8;
        const burstRadius = 40; // Doubled from 20

        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const burstParticle = this.add.circle(x, y, 6, 0x000000, 1); // Doubled from 3
            burstParticle.setDepth(1000); // Above everything

            const targetX = x + Math.cos(angle) * burstRadius;
            const targetY = y + Math.sin(angle) * burstRadius;

            this.tweens.add({
                targets: burstParticle,
                x: targetX,
                y: targetY,
                alpha: 0,
                scale: 0.5,
                duration: 300,
                ease: 'Quad.easeOut',
                onComplete: () => burstParticle.destroy()
            });
        }
    }

    // Remove a word from a slot
    removeWordFromSlot(slotIdx) {
        const slotContainer = this.slotSprites[slotIdx];
        if (!slotContainer) return;

        // Mark slot as empty
        slotContainer.setData('filled', false);
        slotContainer.setData('word', null);
        slotContainer.setData('originalWord', null);

        const slotSquares = slotContainer.list;
        slotSquares.forEach(squareContainer => {
            squareContainer.setData('filled', false);
            squareContainer.setData('letter', null);
        });

        // Recalculate all constraint hints without animation
        this.updateAllConstraintHints(false);

        // Update connection highlights
        this.updateConnectionHighlights();
    }

    // Show feedback when hints are satisfied by placing a word
    showHintSatisfactionFeedback(slotIdx, word) {
        return;
        const slotContainer = this.slotSprites[slotIdx];
        const slotSquares = slotContainer.list;

        // Check which squares had hints before this word was placed
        // We need to find hints that match the placed word letters
        const rules = this.level.rules || this.level.connections || [];
        if (!rules || rules.length === 0) return;
        console.log('passed');
        // Track which squares in this slot had hints
        const squaresWithSatisfiedHints = [];

        rules.forEach(rule => {
            const ruleInfo = this.parseRule(rule);
            if (!ruleInfo) return;
            console.log('ppassed');

            // Check if this connection involves the slot we just filled
            if (ruleInfo.toSlotIdx === slotIdx) {
                // Check if the "from" slot is filled (meaning it created a hint in our slot)
                const fromSlot = this.slotSprites[ruleInfo.slotIdx];
                if (fromSlot.getData('filled')) {
                    // This square had a hint that is now satisfied
                    squaresWithSatisfiedHints.push(ruleInfo.toSquareIdx);
                }
            } else if (ruleInfo.slotIdx === slotIdx) {
                // Check if the "to" slot is filled
                const toSlot = this.slotSprites[ruleInfo.toSlotIdx];
                if (toSlot.getData('filled')) {
                    squaresWithSatisfiedHints.push(ruleInfo.squareIdx);
                }
            }
        });

        // Show satisfaction animation for each square with satisfied hints
        squaresWithSatisfiedHints.forEach((squareIdx, index) => {
            const squareContainer = slotSquares[squareIdx];
            const square = squareContainer.getData('square');

            // Delay each animation slightly for staggered effect
            this.time.delayedCall(index * 80, () => {
                // Get world position
                const matrix = squareContainer.getWorldTransformMatrix();
                const worldPos = matrix.transformPoint(0, 0);

                // Green flash on the square
                square.setTint(0xC8E6C9);

                this.time.delayedCall(400, () => {
                    square.clearTint();
                });

                // Checkmark particle animation
                const checkmark = this.add.text(worldPos.x, worldPos.y, '✓', {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '24px',
                    color: '#4CAF50',
                    fontStyle: 'bold',
                    resolution: window.devicePixelRatio || 2
                }).setOrigin(0.5);
                checkmark.setDepth(2000);
                checkmark.setAlpha(0);

                // Animate checkmark: fade in, scale up, float up, fade out
                this.tweens.add({
                    targets: checkmark,
                    alpha: 1,
                    scale: { from: 0.5, to: 1.2 },
                    y: worldPos.y - 30,
                    duration: 600,
                    ease: 'Quad.easeOut',
                    onComplete: () => {
                        this.tweens.add({
                            targets: checkmark,
                            alpha: 0,
                            duration: 200,
                            onComplete: () => {
                                checkmark.destroy();
                            }
                        });
                    }
                });

                // Ring pulse effect
                const ring = this.add.circle(worldPos.x, worldPos.y, this.squareWidth / 2, 0x4CAF50, 0);
                ring.setStrokeStyle(3, 0x4CAF50, 0.8);
                ring.setDepth(1999);

                this.tweens.add({
                    targets: ring,
                    scale: { from: 0.8, to: 1.5 },
                    alpha: { from: 0.8, to: 0 },
                    duration: 500,
                    ease: 'Quad.easeOut',
                    onComplete: () => {
                        ring.destroy();
                    }
                });
            });
        });
    }

    // Show feedback on connection lines when both connected slots are filled
    showConnectionValidationFeedback(slotIdx) {
        return;
        const rules = this.level.rules || this.level.connections || [];
        if (!rules || rules.length === 0) return;

        rules.forEach((rule, ruleIndex) => {
            const ruleInfo = this.parseRule(rule);
            if (!ruleInfo) return;

            // Check if this connection involves the slot we just filled
            if (ruleInfo.slotIdx === slotIdx || ruleInfo.toSlotIdx === slotIdx) {
                const fromSlot = this.slotSprites[ruleInfo.slotIdx];
                const toSlot = this.slotSprites[ruleInfo.toSlotIdx];

                // Only show feedback if BOTH slots are now filled
                if (fromSlot.getData('filled') && toSlot.getData('filled')) {
                    // Verify the letters match according to connection type
                    const fromSquare = fromSlot.list[ruleInfo.squareIdx];
                    const toSquare = toSlot.list[ruleInfo.toSquareIdx];
                    const fromLetter = fromSquare.getData('letter');
                    const toLetter = toSquare.getData('letter');

                    // Calculate expected letter based on connection type
                    const expectedToLetter = this.calculateHintLetter(fromLetter, ruleInfo.increment);

                    if (fromLetter && toLetter && toLetter === expectedToLetter) {
                        // Connection is valid! Show feedback on the line
                        const connectionLine = this.connectionLines[ruleIndex];
                        if (connectionLine) {
                            // Add a slight delay for better timing
                            this.time.delayedCall(300, () => {
                                this.animateConnectionValidation(connectionLine, ruleInfo);
                            });
                        }
                    }
                }
            }
        });
    }

    // Animate a connection line to show it's validated
    animateConnectionValidation(connectionLine, connInfo) {
        // Get the original line properties
        const fromSquare = this.slotSprites[connInfo.slotIdx].list[connInfo.squareIdx];
        const toSquare = this.slotSprites[connInfo.toSlotIdx].list[connInfo.toSquareIdx];
        const fromPos = this.getSquareSideMidpoint(fromSquare, connInfo.sideIdx);
        const toPos = this.getSquareSideMidpoint(toSquare, connInfo.toSideIdx);

        // Create a green overlay line that pulses
        const validationLine = this.add.line(0, 0, fromPos.x, fromPos.y, toPos.x, toPos.y, 0x4CAF50)
            .setOrigin(0, 0)
            .setLineWidth(5)
            .setDepth(900)
            .setAlpha(0);

        // Pulse animation on the line
        this.tweens.add({
            targets: validationLine,
            alpha: 0.8,
            lineWidth: 6,
            duration: 300,
            ease: 'Quad.easeOut',
            yoyo: true,
            repeat: 1,
            onComplete: () => {
                validationLine.destroy();
            }
        });

        // Create particles that travel along the line
        const particleCount = 3;
        for (let i = 0; i < particleCount; i++) {
            this.time.delayedCall(i * 150, () => {
                const particle = this.add.circle(fromPos.x, fromPos.y, 6, 0x4CAF50, 1);
                particle.setStrokeStyle(2, 0xffffff);
                particle.setDepth(1000);

                // Animate particle along the line
                this.tweens.add({
                    targets: particle,
                    x: toPos.x,
                    y: toPos.y,
                    duration: 400,
                    ease: 'Cubic.easeInOut',
                    onUpdate: () => {
                        // Pulse the particle
                        const progress = this.tweens.getTweensOf(particle)[0]?.progress || 0;
                        const scale = 1 + Math.sin(progress * Math.PI * 3) * 0.4;
                        particle.setScale(scale);
                    },
                    onComplete: () => {
                        // Small burst at the end
                        for (let j = 0; j < 4; j++) {
                            const angle = (Math.PI * 2 * j) / 4;
                            const sparkle = this.add.circle(toPos.x, toPos.y, 3, 0x4CAF50, 1);
                            sparkle.setDepth(1000);

                            this.tweens.add({
                                targets: sparkle,
                                x: toPos.x + Math.cos(angle) * 15,
                                y: toPos.y + Math.sin(angle) * 15,
                                alpha: 0,
                                scale: 0.3,
                                duration: 300,
                                ease: 'Quad.easeOut',
                                onComplete: () => sparkle.destroy()
                            });
                        }
                        particle.destroy();
                    }
                });
            });
        }

        // Add a satisfying "ding" effect with text
        const midX = (fromPos.x + toPos.x) / 2;
        const midY = (fromPos.y + toPos.y) / 2;

        const validText = this.add.text(midX, midY, '✓', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '20px',
            color: '#4CAF50',
            fontStyle: 'bold',
            resolution: window.devicePixelRatio || 2
        }).setOrigin(0.5);
        validText.setDepth(2000);
        validText.setAlpha(0);
        validText.setScale(0.5);

        this.tweens.add({
            targets: validText,
            alpha: 1,
            scale: 1.3,
            duration: 300,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: validText,
                    alpha: 0,
                    y: midY - 20,
                    duration: 400,
                    ease: 'Quad.easeIn',
                    onComplete: () => validText.destroy()
                });
            }
        });
    }

    // Autopilot: Try to automatically place an obvious word
    tryAutopilotPlacement() {
        if (this.autopilotInProgress) return;

        // Find a slot with hints that has only one matching unplaced word
        const obviousPlacement = this.findObviousPlacement();

        if (obviousPlacement) {
            this.autopilotInProgress = true;
            this.performAutopilotPlacement(obviousPlacement.slotIdx, obviousPlacement.word, obviousPlacement.wordContainer);
        }
    }

    // Find a slot with hints where only one unplaced word matches
    findObviousPlacement() {
        // Get all unplaced words
        const unplacedWords = this.bankSprites.filter(wc => !wc.getData('placed'));
        if (unplacedWords.length === 0) return null;

        // Check each empty slot
        for (let slotIdx = 0; slotIdx < this.slotSprites.length; slotIdx++) {
            const slotContainer = this.slotSprites[slotIdx];
            if (slotContainer.getData('filled')) continue; // Skip filled slots

            const slotSquares = slotContainer.list;

            // Check if this slot has any hints
            let hasHints = false;
            for (let sq of slotSquares) {
                const letterText = sq.getData('letterText');
                if (letterText && letterText.text.trim()) {
                    hasHints = true;
                    break;
                }
            }

            if (!hasHints) continue; // Skip slots without hints

            // Find matching words for this slot
            const matchingWords = [];
            for (let wordContainer of unplacedWords) {
                const word = wordContainer.getData('word');
                if (word.length !== slotSquares.length) continue; // Length mismatch

                // Check if word matches hints (considering antonym transformation)
                const transformedWord = this.getTransformedWord(word, slotIdx);
                const violation = this.checkConstraintViolation(slotIdx, transformedWord);

                if (!violation.violated) {
                    matchingWords.push({ word, wordContainer });
                }
            }

            // If exactly one word matches, this is an obvious placement
            if (matchingWords.length === 1) {
                return {
                    slotIdx,
                    word: matchingWords[0].word,
                    wordContainer: matchingWords[0].wordContainer
                };
            }
        }

        return null; // No obvious placement found
    }

    // Perform autopilot placement with animation
    performAutopilotPlacement(slotIdx, word, wordContainer) {
        const slotContainer = this.slotSprites[slotIdx];
        const dropZone = slotContainer;

        // Disable user input
        this.input.enabled = false;

        // Animate word to slot
        const snapDuration = 400; // Slightly slower for autopilot visibility
        this.tweens.add({
            targets: wordContainer,
            x: dropZone.x,
            y: dropZone.y,
            duration: snapDuration,
            ease: 'Power2',
            onComplete: () => {
                // Mark word as placed
                wordContainer.setData('placed', true);
                wordContainer.setData('slotIdx', slotIdx);

                // Get transformed word if needed
                const transformedWord = this.getTransformedWord(word, slotIdx);

                // Mark slot as filled
                const slotSquares = slotContainer.list;
                slotContainer.setData('filled', true);
                slotContainer.setData('word', transformedWord);
                slotContainer.setData('originalWord', word);
                slotSquares.forEach((squareContainer, i) => {
                    squareContainer.setData('filled', true);
                    squareContainer.setData('letter', transformedWord[i]);
                    const letterText = squareContainer.getData('letterText');
                    if (letterText) {
                        letterText.setAlpha(1.0);
                    }
                });

                // Play fill sound
                this.sound.play('fillSound');

                // Play sequential letter bounce animation
                this.playPlacementAnimation(wordContainer, () => {
                    // Check if we need transformation
                    const slotRule = this.getSlotRule(slotIdx);
                    const willTransform = slotRule && (slotRule.op === 'opposite' || slotRule.op === 'reverse' || slotRule.op === 'swap') && transformedWord !== word;
                    
                    if (willTransform) {
                        // Apply transformation
                        this.applyWordTransformation(wordContainer, word, transformedWord, slotIdx, slotRule, () => {
                            this.completeAutopilotPlacement();
                        });
                    } else {
                        // Update hints and continue
                        this.updateAllConstraintHints(true);
                        this.updateConnectionHighlights();
                        this.completeAutopilotPlacement();
                    }
                });
            }
        });
    }

    // Complete autopilot placement and check for next obvious word
    completeAutopilotPlacement() {
        // Re-enable input
        this.input.enabled = true;
        this.autopilotInProgress = false;

        // Check win condition
        this.time.delayedCall(500, () => {
            this.checkWinCondition();

            // Try to place another obvious word if available
            if (this.autopilotEnabled && !this.checkAllSlotsFilled()) {
                this.time.delayedCall(600, () => {
                    this.tryAutopilotPlacement();
                });
            }
        });
    }

    // Helper to check if all slots are filled without triggering win
    checkAllSlotsFilled() {
        return this.slotSprites.every(slotContainer => slotContainer.getData('filled') === true);
    }

    // Check if all slots are filled (win condition)
    checkWinCondition() {
        const allSlotsFilled = this.slotSprites.every(slotContainer => {
            return slotContainer.getData('filled') === true;
        });

        if (allSlotsFilled) {
            console.log('🎉 All slots filled! You win!');
            // Launch win scene immediately (animations removed)
            this.scene.launch('WinScene', {
                currentLevelIndex: this.currentLevelIndex,
                totalLevels: this.totalLevels
            });
            // Pause the game scene
            this.scene.pause();
        }
    }
}

// Export for use in other scenes (like level viewer)
export default WordWebGame;

const config = {
    type: Phaser.WEBGL, // Use WebGL for better rendering quality
    parent: 'game-container',
    backgroundColor: '#f0f8ff',
    scene: [WordWebGame, WinScene],

    // Crisp rendering settings
    roundPixels: true, // Round positions to whole pixels for crisp rendering
    antialias: true, // Enable anti-aliasing for smooth edges

    scale: {
        mode: Phaser.Scale.FIT, // FIT mode works better in iframes
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 720, // Portrait mode - mobile first (9:16 aspect ratio)
        height: 1280,
        resolution: window.devicePixelRatio || 1, // Handle high DPI screens (Retina, 4K)
    },

    render: {
        antialiasGL: true, // WebGL anti-aliasing
        pixelArt: false, // Set to true only for retro pixel art games
    }
};

// Only create game instance if this is the main script (not imported)
if (typeof window !== 'undefined' && !window.__LEVEL_VIEWER__) {
    const game = new Phaser.Game(config);
}
