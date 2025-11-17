import * as Utils from './utils.js';

// Main Phaser game logic for Word Web
// Loads level data, renders slots, words, and handles drag-drop

class WordWebGame extends Phaser.Scene {
    constructor() {
        super('WordWebGame');
    }
    init(){
        this.originX = this.sys.game.canvas.width * CONFIG.ORIGIN_X_FACTOR;
        this.originY = this.sys.game.canvas.height * CONFIG.ORIGIN_Y_FACTOR;
    }

    preload() {
        this.load.json('levels', 'levels.json');
    }

    create() {
        const levels = this.cache.json.get('levels');
        this.level = levels.levels[0];
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
            const targetX = firstSquareContainer.x;
            const targetY = firstSquareContainer.y;
            console.log(`Placing word "${word}" at slot ${slotIdx} position (${targetX}, ${targetY})`);
            this.tweens.add({
                targets: gameObject,
                x: dropZone.x,
                y: dropZone.y,
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
            
            // Update constraint hints for all connected slots
            this.updateAllConstraintHints();
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
        const slotSize = CONFIG.SQUARE_WIDTH;

        const gap = CONFIG.SQUARE_GAP;
        this.slotSprites = [];
        const slotAreaWidth = this.sys.game.canvas.width;
        const slotAreaHeight = this.slotAreaHeight;
        const gridSize = CONFIG.GRID_SIZE;

        this.level.slots.forEach((slot, slotIdx) => {
            let slotContainer = this.add.container();
            slotContainer.setDepth(10); // Slots at depth 10
            
            for (let i = 0; i < slot.length; i++) {
                let x = i * gridSize;
                let y = 0;
                
                // Create a sub-container for each square to hold both rectangle and text
                let squareContainer = this.add.container(x, y);
                
                // Create the rectangle (square) centered at (0, 0) within the squareContainer
                let square = this.add.rectangle(0, 0, slotSize, slotSize, 0xffffff).setStrokeStyle(2, 0x000000);
                
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
            const anchorCellPoints = Utils.getGridCellPoints(slot.anchorCol, slot.anchorRow, this.originX, this.originY, gridSize);
            slotContainer.setPosition(anchorCellPoints.center.x, anchorCellPoints.center.y);
            
            // Make the entire slot container a dropzone
            slotContainer.setInteractive(new Phaser.Geom.Rectangle(
                -gridSize/2, -gridSize/2, slot.length * gridSize, gridSize
            ), Phaser.Geom.Rectangle.Contains);
            slotContainer.input.dropZone = true;

            slotContainer.setData('slotIdx', slotIdx);
            this.slotSprites.push(slotContainer);
        });
    }

    renderBank() {
        const slotSize = CONFIG.SQUARE_WIDTH;
        const gap = CONFIG.SQUARE_GAP;
        const startY = this.bankAreaY + 40;
        const verticalGap = slotSize + 24;
        this.level.words.forEach((word, wordIdx) => {
            // let startX = this.sys.game.canvas.width / 2 - (word.length * (slotSize + gap)) / 2;
            let startX = this.sys.game.canvas.width / 2 - Utils.getFrameWidth(word.length) / 2;
            let baseY = startY + wordIdx * verticalGap;
            let wordContainer = this.add.container(0, 0);
            for (let i = 0; i < word.length; i++) {
                let x = i * CONFIG.GRID_SIZE;
                let y = 0;
                let square = this.add.rectangle(x, y, slotSize, slotSize, 0xeeeeee).setStrokeStyle(2, 0x333333);
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
            // wordContainer.setSize(word.length * (slotSize + gap), slotSize);
            wordContainer.setInteractive(
                new Phaser.Geom.Rectangle(
                    -CONFIG.GRID_SIZE/2,
                    -CONFIG.GRID_SIZE/2,
                     CONFIG.GRID_SIZE * word.length,
                     CONFIG.GRID_SIZE
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
                }
            });
        });

        // Now update hints based on connections
        if (!this.level.connections) return;
        
        this.level.connections.forEach(connStr => {
            const [from, to] = connStr.split('-');
            const fromInfo = this.decodeConn(from);
            const toInfo = this.decodeConn(to);
            
            const fromSlot = this.slotSprites[fromInfo.slotIdx];
            const toSlot = this.slotSprites[toInfo.slotIdx];
            
            // Check if fromSlot has a word placed
            if (fromSlot.getData('filled')) {
                const fromSquares = fromSlot.list;
                const fromSquareContainer = fromSquares[fromInfo.squareIdx];
                const letter = fromSquareContainer.getData('letter');
                
                // Set hint in the connected square of toSlot
                const toSquares = toSlot.list;
                const toSquareContainer = toSquares[toInfo.squareIdx];
                const toLetterText = toSquareContainer.getData('letterText');
                if (toLetterText && letter) {
                    toLetterText.setText(letter);
                }
            }
            
            // Check if toSlot has a word placed (connection works both ways)
            if (toSlot.getData('filled')) {
                const toSquares = toSlot.list;
                const toSquareContainer = toSquares[toInfo.squareIdx];
                const letter = toSquareContainer.getData('letter');
                
                // Set hint in the connected square of fromSlot
                const fromSquares = fromSlot.list;
                const fromSquareContainer = fromSquares[fromInfo.squareIdx];
                const fromLetterText = fromSquareContainer.getData('letterText');
                if (fromLetterText && letter) {
                    fromLetterText.setText(letter);
                }
            }
        });
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
    scene: [WordWebGame],
    
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
