import * as Utils from './utils.js';

// Main Phaser game logic for Word Web
// Loads level data, renders slots, words, and handles drag-drop

class WordWebGame extends Phaser.Scene {
    constructor() {
        super('WordWebGame');
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
        // Global drop handler for slots
        this.input.on('drop', (pointer, gameObject, dropZone) => {
            console.log('Drop event:', { gameObject, dropZone });
            // Only handle if dropZone is a slot square
            if (!dropZone || !dropZone.getData('slotIdx')) return;
            const slotIdx = dropZone.getData('slotIdx');
            const slotGroup = this.slotSprites[slotIdx];
            const slotSquares = slotGroup.getChildren();
            // Only allow drop if slot is not filled and word length matches slot length
            if (!gameObject || !gameObject.getData('word')) return;
            const word = gameObject.getData('word');
            if (slotSquares.length !== word.length) {
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
            let slotFilled = slotSquares.some(sq => sq.getData('filled'));
            if (slotFilled) {
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
            // TODO: Add constraint violation check here if needed
            // If all checks pass, place the word over the slot
            const firstSquare = slotSquares[0];
            const targetX = firstSquare.x - gameObject.width / 2 + firstSquare.width / 2;
            const targetY = firstSquare.y - gameObject.height / 2 + firstSquare.height / 2;
            this.tweens.add({
                targets: gameObject,
                x: targetX,
                y: targetY,
                duration: 200,
                ease: 'Power2'
            });
            gameObject.setData('placed', true);
            gameObject.setData('slotIdx', slotIdx);
            // Mark slot squares as filled
            slotSquares.forEach((sq, i) => {
                sq.setData('filled', true);
                sq.setData('letter', word[i]);
            });
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
        const originX = slotAreaWidth / 2;
        const originY = slotAreaHeight;

        this.level.slots.forEach((slot, slotIdx) => {
            let slotGroup = this.add.group();
            // Calculate anchor cell top-left (same as editor)
            let anchorX = originX + ((slot.anchorCol - 0.5) * gridSize);
            let anchorY = originY + ((slot.anchorRow + Math.sign(slot.anchorRow) * 1) * gridSize);
            for (let i = 0; i < slot.length; i++) {
                let x = anchorX + i * gridSize + gridSize / 2;
                let y = anchorY + gridSize / 2;
                let square = this.add.rectangle(x, y, slotSize, slotSize, 0xffffff).setStrokeStyle(2, 0x000000);
                square.setData({ slotIdx, squareIdx: i, filled: false, letter: null });
                square.setInteractive({ dropZone: true });
                slotGroup.add(square);
            }
            this.slotSprites.push(slotGroup);
        });
    }

    renderBank() {
        const slotSize = 50;
        const gap = 8;
        const startY = this.bankAreaY + 40;
        const verticalGap = slotSize + 24;
        this.level.words.forEach((word, wordIdx) => {
            let startX = this.sys.game.canvas.width / 2 - (word.length * (slotSize + gap)) / 2;
            let baseY = startY + wordIdx * verticalGap;
            let wordContainer = this.add.container(0, 0);
            for (let i = 0; i < word.length; i++) {
                let x = startX + i * (slotSize + gap);
                let y = baseY;
                let square = this.add.rectangle(x, y, slotSize, slotSize, 0xeeeeee).setStrokeStyle(2, 0x333333);
                let letter = this.add.text(x, y, word[i], { font: '32px Arial', color: '#222' }).setOrigin(0.5);
                square.setData({ wordIdx, letterIdx: i });
                wordContainer.add(square);
                wordContainer.add(letter);
            }
            wordContainer.setData({ word, wordIdx, placed: false, origY: baseY, startX });
            wordContainer.setSize(word.length * (slotSize + gap), slotSize);
            wordContainer.setInteractive(new Phaser.Geom.Rectangle(startX, baseY, word.length * (slotSize + gap), slotSize), Phaser.Geom.Rectangle.Contains);
            this.input.setDraggable(wordContainer);
            let dragOffset = { x: 0, y: 0 };
            wordContainer.on('dragstart', (pointer) => {
                dragOffset.x = pointer.x - wordContainer.x;
                dragOffset.y = pointer.y - wordContainer.y;
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
                        x: 0,
                        y: 0,
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
            const fromSquare = this.slotSprites[fromInfo.slotIdx].getChildren()[fromInfo.squareIdx];
            const toSquare = this.slotSprites[toInfo.slotIdx].getChildren()[toInfo.squareIdx];
            const fromPt = this.getSquareSideMidpoint(fromSquare, fromInfo.sideIdx);
            const toPt = this.getSquareSideMidpoint(toSquare, toInfo.sideIdx);
            let line = this.add.line(0, 0, fromPt.x, fromPt.y, toPt.x, toPt.y, connectionColor).setOrigin(0, 0).setLineWidth(3);
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

    getSquareSideMidpoint(square, sideIdx) {
        // Squares are rendered at absolute positions, so use square.x/y directly
        const { x, y, width, height } = square;
        switch (sideIdx) {
            case 0: // top
                return { x: x, y: y - height / 2 };
            case 1: // right
                return { x: x + width / 2, y: y };
            case 2: // bottom
                return { x: x, y: y + height / 2 };
            case 3: // left
                return { x: x - width / 2, y: y };
            default:
                return { x, y };
        }
    }
}


function resizeGame() {
    if (game && game.scale) {
        game.scale.resize(window.innerWidth, window.innerHeight);
    }
}

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#f0f8ff',
    parent: 'game-container',
    scene: [WordWebGame]
};

const game = new Phaser.Game(config);
window.addEventListener('resize', resizeGame);
