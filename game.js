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
        
        this.level.slots.forEach((slot, slotIdx) => {
            let slotGroup = this.add.group();
            // Interpret x and y as percentages of slot area width/height
            let baseX = (slot.x / 100) * slotAreaWidth;
            let baseY = (slot.y / 100) * slotAreaHeight;
            // Center the slot horizontally at baseX
            let slotTotalWidth = slot.length * slotSize + (slot.length - 1) * gap;
            let startX = baseX - slotTotalWidth / 2;
            for (let i = 0; i < slot.length; i++) {
                let x = startX + i * (slotSize + gap);
                let y = baseY;
                let square = this.add.rectangle(x, y, slotSize, slotSize, 0xffffff).setStrokeStyle(2, 0x000000);
                square.setData({ slotIdx, squareIdx: i, filled: false, letter: null });
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
        if(this.level==null)
            console.log('level null');
        if(this.level.words == null)
            {
                console.log('words null');
            }
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
            let line = this.add.line(0, 0, fromPt.x, fromPt.y, toPt.x, toPt.y, connectionColor).setLineWidth(3);
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
        // Get global position of square center
        const world = square.getWorldTransformMatrix();
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
        // Transform local offset to global coordinates
        const global = world.transformPoint(localX, localY);
        return { x: global.x, y: global.y };
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
