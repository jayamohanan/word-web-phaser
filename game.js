import * as Utils from './utils.js';
import WinScene from './WinScene.js';

// Main Phaser game logic for Word Web
// Loads level data, renders slots, words, and handles drag-drop

class WordWebGame extends Phaser.Scene {
    constructor() {
        super('WordWebGame');
    }
    init(data){
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
    }

    preload() {
        this.load.json('levels', 'levels.json');
    }

    create() {
        const levels = this.cache.json.get('levels');
        this.totalLevels = levels.levels.length;
        // Use modulo to loop levels
        this.level = levels.levels[this.currentLevelIndex % this.totalLevels];
        this.slotSprites = [];
        this.bankSprites = [];
        this.connectionLines = [];
        this.selectedWord = null;
        this.wordBankArea = [];
        this.wordSlotArea = [];
        this.createAreas();
        this.renderSlots();
        this.renderBank();
        this.renderConnections();

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
            
            // Check constraint violations
            const violationResult = this.checkConstraintViolation(slotIdx, word);
            if (violationResult.violated) {
                console.log(`Constraint violation at square ${violationResult.squareIdx}: expected "${violationResult.expectedLetter}", got "${violationResult.actualLetter}"`);
                this.showConstraintViolationFeedback(slotIdx, violationResult.squareIdx);
                this.tweenBackToBottom(gameObject);
                return;
            }
            
            // If all checks pass, place the word over the slot
            const firstSquareContainer = slotSquares[0];
            const offset = 0;
            this.tweens.add({
                targets: gameObject,
                x: dropZone.x + offset,
                y: dropZone.y - offset,
                duration: 200,
                ease: 'Power2'
            });
            
            gameObject.setData('placed', true);
            gameObject.setData('slotIdx', slotIdx);
            
            // Mark slot as filled (store the word on the slot)
            slotContainer.setData('filled', true);
            slotContainer.setData('word', word);
            slotSquares.forEach((squareContainer, i) => {
                squareContainer.setData('filled', true);
                squareContainer.setData('letter', word[i]);
            });
            
            // Show satisfaction feedback for hints that were just satisfied
            this.showHintSatisfactionFeedback(slotIdx, word);
            
            // Update constraint hints for all connected slots
            this.updateAllConstraintHints();
            
            // Show connection validation feedback for satisfied connections
            this.showConnectionValidationFeedback(slotIdx);
            
            // Check for win condition
            this.checkWinCondition();
        });
    }
    tweenBackToBottom(gameObject){
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
                
                // Create a sub-container for each square to hold both rectangle and text
                let squareContainer = this.add.container(x, y);
                
                // Create the rectangle (square) centered at (0, 0) within the squareContainer
                let square = this.add.rectangle(0, 0, this.squareWidth, this.squareWidth, 0xffffff).setStrokeStyle(this.slotStrokeWidth, this.slotStrokeColor);
                
                // Create the text centered at (0, 0) within the squareContainer
                let letterText = this.add.text(0, 0, '', { 
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '32px',
                    color: '#222',
                    resolution: window.devicePixelRatio || 2 // High resolution for crisp text
                }).setOrigin(0.5);
                
                // Add both to the squareContainer
                squareContainer.add(square);
                squareContainer.add(letterText);
                
                // Store data on the squareContainer (not the rectangle)
                squareContainer.setData({ slotIdx, squareIdx: i, filled: false, letter: null });
                
                // Store references to the children for easy access
                squareContainer.setData('square', square);
                squareContainer.setData('letterText', letterText);
                
                // Add squareContainer to the slotContainer
                slotContainer.add(squareContainer);
            }
            
            // Position slot at anchor cell center, relative to grid origin
            const anchorCellPoints = Utils.getGridCellPoints(slot.anchorCol, slot.anchorRow, this.originX, this.originY, this.gridSize);
            slotContainer.setPosition(anchorCellPoints.center.x, anchorCellPoints.center.y);
            
            // Make the entire slot container a dropzone
            slotContainer.setInteractive(new Phaser.Geom.Rectangle(
                -this.gridSize/2, -this.gridSize/2, slot.length * this.gridSize, this.gridSize
            ), Phaser.Geom.Rectangle.Contains);
            slotContainer.input.dropZone = true;

            slotContainer.setData('slotIdx', slotIdx);
            this.slotSprites.push(slotContainer);
        });
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
                let square = this.add.rectangle(x, y, this.squareWidth, this.squareWidth, 0xeeeeee).setStrokeStyle(this.wordStrokeWidth, this.wordStrokeColor);
                let letter = this.add.text(x, y, word[i], { 
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '32px',
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
                    -this.gridSize/2,
                    -this.gridSize/2,
                     this.gridSize * word.length,
                     this.gridSize
                    ),
                    Phaser.Geom.Rectangle.Contains);
            this.input.setDraggable(wordContainer);
            let dragOffset = { x: 0, y: 0 };
            wordContainer.on('dragstart', (pointer) => {
                dragOffset.x = pointer.x - wordContainer.x;
                dragOffset.y = pointer.y - wordContainer.y;
                
                // If this word was placed on a slot, remove it from that slot temporarily
                if (wordContainer.getData('placed')) {
                    const slotIdx = wordContainer.getData('slotIdx');
                    console.log(`Dragging word from slot ${slotIdx}, removing temporarily`);
                    this.removeWordFromSlot(slotIdx);
                }
            });
            wordContainer.on('drag', (pointer, dragX, dragY) => {
                wordContainer.x = pointer.x - dragOffset.x;
                wordContainer.y = pointer.y - dragOffset.y;
            });
            wordContainer.on('dragend', (pointer, dragX, dragY, dropped) => {
                if (!dropped) {
                    // Animate back to original position
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

    renderConnections() {
        // Use the same color as slot square outline: black (0x000000)
        const connectionColor = 0x000000;
        this.level.connections.forEach(connStr => {
            const [from, to] = connStr.split('-');
            const fromInfo = this.decodeConn(from);
            const toInfo = this.decodeConn(to);
            // Get the squareContainer from the slot
            const fromSquareContainer = this.slotSprites[fromInfo.slotIdx].list[fromInfo.squareIdx];
            const toSquareContainer = this.slotSprites[toInfo.slotIdx].list[toInfo.squareIdx];
            const fromPt = this.getSquareSideMidpoint(fromSquareContainer, fromInfo.sideIdx);
            const toPt = this.getSquareSideMidpoint(toSquareContainer, toInfo.sideIdx);
            let line = this.add.line(0, 0, fromPt.x, fromPt.y, toPt.x, toPt.y, connectionColor).setOrigin(0, 0).setLineWidth(3);
            line.setDepth(-100);
            this.connectionLines.push(line);
        });
    }

    decodeConn(str) {
        return {
            slotIdx: parseInt(str[0]),
            squareIdx: parseInt(str[1]),
            sideIdx: parseInt(str[2])
        };
    }

    getSquareSideMidpoint(squareContainer, sideIdx) {
        // Get the actual square rectangle from the container
        const square = squareContainer.getData('square');
        const { width, height } = square;
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
        const originalColor = square.fillColor;
        square.setFillStyle(0xff6b6b); // Red color
        
        this.time.delayedCall(500, () => {
            square.setFillStyle(0xffffff); // Back to white
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

    // Update constraint hints for all slots based on connections
    updateAllConstraintHints() {
        // First, clear all hint texts
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

        // Now update hints based on connections with animation
        if (!this.level.connections) return;
        
        this.level.connections.forEach(connStr => {
            const [from, to] = connStr.split('-');
            const fromInfo = this.decodeConn(from);
            const toInfo = this.decodeConn(to);
            
            const fromSlot = this.slotSprites[fromInfo.slotIdx];
            const toSlot = this.slotSprites[toInfo.slotIdx];
            
            // Check if fromSlot has a word placed
            if (fromSlot.getData('filled') && !toSlot.getData('filled')) {
                const fromSquares = fromSlot.list;
                const fromSquareContainer = fromSquares[fromInfo.squareIdx];
                const letter = fromSquareContainer.getData('letter');
                
                // Get positions for animation
                const toSquares = toSlot.list;
                const toSquareContainer = toSquares[toInfo.squareIdx];
                const toLetterText = toSquareContainer.getData('letterText');
                
                if (toLetterText && letter) {
                    // Animate hint creation
                    this.animateHintCreation(fromSquareContainer, toSquareContainer, letter, fromInfo.sideIdx, toInfo.sideIdx);
                }
            }
            
            // Check if toSlot has a word placed (connection works both ways)
            if (toSlot.getData('filled') && !fromSlot.getData('filled')) {
                const toSquares = toSlot.list;
                const toSquareContainer = toSquares[toInfo.squareIdx];
                const letter = toSquareContainer.getData('letter');
                
                // Get positions for animation
                const fromSquares = fromSlot.list;
                const fromSquareContainer = fromSquares[fromInfo.squareIdx];
                const fromLetterText = fromSquareContainer.getData('letterText');
                
                if (fromLetterText && letter) {
                    // Animate hint creation (reversed direction)
                    this.animateHintCreation(toSquareContainer, fromSquareContainer, letter, toInfo.sideIdx, fromInfo.sideIdx);
                }
            }
        });
    }

    // Animate hint creation: particle travels along connection, then hint bounces in
    animateHintCreation(sourceSquareContainer, targetSquareContainer, letter, sourceSideIdx, targetSideIdx) {
        // Get world positions
        const sourcePos = this.getSquareSideMidpoint(sourceSquareContainer, sourceSideIdx);
        const targetPos = this.getSquareSideMidpoint(targetSquareContainer, targetSideIdx);
        
        // Create a particle (small circle) that travels along the connection
        const particle = this.add.circle(sourcePos.x, sourcePos.y, 8, 0x4CAF50, 1); // Green particle
        particle.setStrokeStyle(2, 0xffffff);
        particle.setDepth(1000); // Above everything
        
        // Create a glow effect
        const glow = this.add.circle(sourcePos.x, sourcePos.y, 12, 0x4CAF50, 0.3);
        glow.setDepth(999);
        
        // Calculate travel duration based on distance
        const distance = Phaser.Math.Distance.Between(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y);
        const duration = Math.max(300, Math.min(600, distance * 0.5)); // Between 300-600ms
        
        // Animate particle traveling along the connection line
        this.tweens.add({
            targets: [particle, glow],
            x: targetPos.x,
            y: targetPos.y,
            duration: duration,
            ease: 'Cubic.easeInOut',
            onUpdate: () => {
                // Pulse the particle while traveling
                const progress = this.tweens.getTweensOf(particle)[0]?.progress || 0;
                const scale = 1 + Math.sin(progress * Math.PI * 4) * 0.3; // Pulse 4 times during travel
                particle.setScale(scale);
                glow.setScale(scale * 1.2);
            },
            onComplete: () => {
                // Particle reached destination - create burst effect
                this.createBurstEffect(targetPos.x, targetPos.y);
                
                // Remove particle and glow
                particle.destroy();
                glow.destroy();
                
                // Now show the hint with bounce animation
                const targetLetterText = targetSquareContainer.getData('letterText');
                if (targetLetterText) {
                    targetLetterText.setText(letter);
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
        const particleCount = 8;
        const burstRadius = 20;
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const burstParticle = this.add.circle(x, y, 3, 0x4CAF50, 1);
            burstParticle.setDepth(1000);
            
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
                onComplete: () => {
                    burstParticle.destroy();
                }
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
        
        const slotSquares = slotContainer.list;
        slotSquares.forEach(squareContainer => {
            squareContainer.setData('filled', false);
            squareContainer.setData('letter', null);
        });
        
        // Recalculate all constraint hints
        this.updateAllConstraintHints();
    }

    // Show feedback when hints are satisfied by placing a word
    showHintSatisfactionFeedback(slotIdx, word) {
        const slotContainer = this.slotSprites[slotIdx];
        const slotSquares = slotContainer.list;
        
        // Check which squares had hints before this word was placed
        // We need to find hints that match the placed word letters
        if (!this.level.connections) return;
        
        // Track which squares in this slot had hints
        const squaresWithSatisfiedHints = [];
        
        this.level.connections.forEach(connStr => {
            const [from, to] = connStr.split('-');
            const fromInfo = this.decodeConn(from);
            const toInfo = this.decodeConn(to);
            
            // Check if this connection involves the slot we just filled
            if (toInfo.slotIdx === slotIdx) {
                // Check if the "from" slot is filled (meaning it created a hint in our slot)
                const fromSlot = this.slotSprites[fromInfo.slotIdx];
                if (fromSlot.getData('filled')) {
                    // This square had a hint that is now satisfied
                    squaresWithSatisfiedHints.push(toInfo.squareIdx);
                }
            } else if (fromInfo.slotIdx === slotIdx) {
                // Check if the "to" slot is filled
                const toSlot = this.slotSprites[toInfo.slotIdx];
                if (toSlot.getData('filled')) {
                    squaresWithSatisfiedHints.push(fromInfo.squareIdx);
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
                const originalColor = square.fillColor;
                square.setFillStyle(0xC8E6C9); // Light green
                
                this.time.delayedCall(400, () => {
                    square.setFillStyle(originalColor); // Back to original
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
        if (!this.level.connections) return;
        
        this.level.connections.forEach((connStr, connIndex) => {
            const [from, to] = connStr.split('-');
            const fromInfo = this.decodeConn(from);
            const toInfo = this.decodeConn(to);
            
            // Check if this connection involves the slot we just filled
            if (fromInfo.slotIdx === slotIdx || toInfo.slotIdx === slotIdx) {
                const fromSlot = this.slotSprites[fromInfo.slotIdx];
                const toSlot = this.slotSprites[toInfo.slotIdx];
                
                // Only show feedback if BOTH slots are now filled
                if (fromSlot.getData('filled') && toSlot.getData('filled')) {
                    // Verify the letters actually match (connection is valid)
                    const fromSquare = fromSlot.list[fromInfo.squareIdx];
                    const toSquare = toSlot.list[toInfo.squareIdx];
                    const fromLetter = fromSquare.getData('letter');
                    const toLetter = toSquare.getData('letter');
                    
                    if (fromLetter && toLetter && fromLetter === toLetter) {
                        // Connection is valid! Show feedback on the line
                        const connectionLine = this.connectionLines[connIndex];
                        if (connectionLine) {
                            // Add a slight delay for better timing
                            this.time.delayedCall(300, () => {
                                this.animateConnectionValidation(connectionLine, fromInfo, toInfo);
                            });
                        }
                    }
                }
            }
        });
    }

    // Animate a connection line to show it's validated
    animateConnectionValidation(connectionLine, fromInfo, toInfo) {
        // Get the original line properties
        const fromSquare = this.slotSprites[fromInfo.slotIdx].list[fromInfo.squareIdx];
        const toSquare = this.slotSprites[toInfo.slotIdx].list[toInfo.squareIdx];
        const fromPos = this.getSquareSideMidpoint(fromSquare, fromInfo.sideIdx);
        const toPos = this.getSquareSideMidpoint(toSquare, toInfo.sideIdx);
        
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

    // Check if all slots are filled (win condition)
    checkWinCondition() {
        const allSlotsFilled = this.slotSprites.every(slotContainer => {
            return slotContainer.getData('filled') === true;
        });
        
        if (allSlotsFilled) {
            console.log('🎉 All slots filled! You win!');
            // Add delay to let connection validation animations complete
            // Connection animations: 300ms delay + ~1000ms animation = ~1300ms total
            // Add extra buffer for hint satisfaction animations
            this.time.delayedCall(1800, () => {
                this.scene.launch('WinScene', {
                    currentLevelIndex: this.currentLevelIndex,
                    totalLevels: this.totalLevels
                });
                // Pause the game scene
                this.scene.pause();
            });
        }
    }
}


function resizeGame() {
    if (game && game.scale) {
        game.scale.resize(window.innerWidth, window.innerHeight);
    }
}

const config = {
    type: Phaser.WEBGL, // Use WebGL for better rendering quality
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#f0f8ff',
    parent: 'game-container',
    scene: [WordWebGame, WinScene],
    
    // Crisp rendering settings
    roundPixels: true, // Round positions to whole pixels for crisp rendering
    antialias: true, // Enable anti-aliasing for smooth edges
    
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        resolution: window.devicePixelRatio || 1, // Handle high DPI screens (Retina, 4K)
    },
    
    render: {
        antialiasGL: true, // WebGL anti-aliasing
        pixelArt: false, // Set to true only for retro pixel art games
    }
};

const game = new Phaser.Game(config);
window.addEventListener('resize', resizeGame);
