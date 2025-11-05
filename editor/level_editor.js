// Phaser Level Editor Scene for Word Web
class LevelEditorScene extends Phaser.Scene {
    constructor() {
        super('LevelEditorScene');
    }

    init() {
        this.slots = [];
        this.words = [];
        this.connections = [];
        this.selectedSquares = [];
        this.connectMode = false;
    }

    preload() {}

    create() {
        this.setupLayout();
        this.setupUIHooks();
        // Draw background for slot and bank areas
        this.drawAreaBackgrounds();
        this.renderSlots();
        this.renderWords();
        this.renderConnections();
    }
    drawAreaBackgrounds() {
        // Draw grid for slot area with origin at bottom midpoint
        const gridColor = 0xcfd8dc;
        const gridLineWidth = 1;
        const slotAreaWidth = this.sys.game.canvas.width;
        const slotAreaHeight = this.slotAreaHeight;
        const gridSize = 50;
        const originX = slotAreaWidth / 2;
        const originY = slotAreaHeight;
        // Draw slot area background first (for contrast)
        this.add.rectangle(
            slotAreaWidth / 2,
            slotAreaHeight / 2,
            slotAreaWidth,
            slotAreaHeight,
            0xe3f2fd
        ).setDepth(-12);
        // Vertical grid lines
        for (let x = originX; x <= slotAreaWidth; x += gridSize) {
            this.add.line(0, 0, x, originY, x, 0, gridColor)
                .setOrigin(0)
                .setLineWidth(gridLineWidth)
                .setDepth(-11);
        }
        for (let x = originX - gridSize; x >= 0; x -= gridSize) {
            this.add.line(0, 0, x, originY, x, 0, gridColor)
                .setOrigin(0)
                .setLineWidth(gridLineWidth)
                .setDepth(-11);
        }
        // Horizontal grid lines
        for (let y = originY; y >= 0; y -= gridSize) {
            this.add.line(0, 0, 0, y, slotAreaWidth, y, gridColor)
                .setOrigin(0)
                .setLineWidth(gridLineWidth)
                .setDepth(-11);
        }
        // Bottom word bank area
        this.add.rectangle(
            this.sys.game.canvas.width / 2,
            this.bankAreaY + this.bankAreaHeight / 2,
            this.sys.game.canvas.width,
            this.bankAreaHeight,
            0xfce4ec
        ).setDepth(-10);
    }

    setupLayout() {
        this.slotAreaHeight = this.sys.game.canvas.height * 0.6;
        this.bankAreaY = this.slotAreaHeight;
        this.bankAreaHeight = this.sys.game.canvas.height * 0.4;
    }

    setupUIHooks() {
        // UI hooks for sidebar
        document.getElementById('add-slot').onclick = () => {
            const len = parseInt(document.getElementById('slot-length').value);
            this.addSlot(len);
        };
        document.getElementById('add-words').onclick = () => {
            const val = document.getElementById('word-input').value;
            this.addWords(val);
        };
        document.getElementById('shuffle-words').onclick = () => {
            this.shuffleWords();
        };
        document.getElementById('connect-mode').onchange = (e) => {
            this.connectMode = e.target.checked;
            this.selectedSquares = [];
            // Re-render slots to update interactivity
            this.renderSlots();
        };
        document.getElementById('connect-btn').onclick = () => {
            this.tryConnect();
        };
        document.getElementById('json-btn').onclick = () => {
            this.generateJSON();
        };
    }

    addSlot(length) {
    // Center slot in slot area and align to grid
    const slotAreaWidth = this.sys.game.canvas.width;
    const slotAreaHeight = this.slotAreaHeight;
    const gridSize = 50;
    // Snap to grid origin (bottom center)
    const originX = slotAreaWidth / 2;
    const originY = slotAreaHeight;
    // Place slot a few grid cells above origin, centered
    const gridY = Math.floor((originY - (100 + this.slots.length * gridSize)) / gridSize) * gridSize;
    const gridX = originX;
    // Convert to percent
    const x = (gridX / slotAreaWidth) * 100;
    const y = (gridY / slotAreaHeight) * 100;
    this.slots.push({ length, x, y });
    this.renderSlots();
    this.renderConnections();
    }

    addWords(val) {
        if (!val) return;
        const newWords = val.split(',').map(w => w.trim().toUpperCase()).filter(w => w.length > 0);
        this.words = this.words.concat(newWords);
        this.renderWords();
    }

    shuffleWords() {
        for (let i = this.words.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.words[i], this.words[j]] = [this.words[j], this.words[i]];
        }
        this.renderWords();
    }

    renderSlots() {
        if (this.slotSprites) {
            this.slotSprites.forEach(g => g.destroy());
        }
        this.slotSprites = [];
        const slotAreaWidth = this.sys.game.canvas.width;
        const slotAreaHeight = this.slotAreaHeight;
        this.slots.forEach((slot, slotIdx) => {
            let slotContainer = this.add.container(0, 0);
            // Snap slot to grid
            let baseX = Math.round((slot.x / 100) * slotAreaWidth / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE;
            let baseY = Math.round((slot.y / 100) * slotAreaHeight / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE;
            // Place squares so each is centered in a grid cell
            for (let i = 0; i < slot.length; i++) {
                let x = i * CONFIG.GRID_SIZE - ((slot.length - 1) * CONFIG.GRID_SIZE) / 2;
                let y = 0;
                let square = this.add.rectangle(x, y, CONFIG.SQUARE_WIDTH, CONFIG.SQUARE_WIDTH, 0xffffff).setStrokeStyle(2, 0x000000);
                square.setData({ slotIdx, squareIdx: i });
                if (this.connectMode) {
                    square.setInteractive();
                    square.on('pointerdown', () => this.squareClicked(slotIdx, i, square));
                }
                slotContainer.add(square);
            }
            slotContainer.x = baseX;
            slotContainer.y = baseY;
            if (!this.connectMode) {
                slotContainer.setSize(slot.length * CONFIG.GRID_SIZE, CONFIG.SQUARE_WIDTH);
                slotContainer.setInteractive(new Phaser.Geom.Rectangle(-slot.length * CONFIG.GRID_SIZE / 2, -CONFIG.SQUARE_WIDTH / 2, slot.length * CONFIG.GRID_SIZE, CONFIG.SQUARE_WIDTH), Phaser.Geom.Rectangle.Contains);
                this.input.setDraggable(slotContainer);
                slotContainer.on('pointerdown', () => {
                    console.log(`Slot container clicked: slotIdx=${slotIdx}`);
                });
                slotContainer.on('drag', (pointer, dragX, dragY) => {
                    let snappedX = Math.round(dragX / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE;
                    let snappedY = Math.round(dragY / CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE;
                    slotContainer.x = snappedX;
                    slotContainer.y = snappedY;
                    slot.x = (snappedX / slotAreaWidth) * 100;
                    slot.y = (snappedY / slotAreaHeight) * 100;
                    slotContainer.input.hitArea.x = -slot.length * CONFIG.GRID_SIZE / 2;
                    slotContainer.input.hitArea.y = -CONFIG.SQUARE_WIDTH / 2;
                });
            }
            this.slotSprites.push(slotContainer);
        });
    }

    renderWords() {
        if (this.wordSprites) {
            this.wordSprites.forEach(c => c.destroy());
        }
        this.wordSprites = [];
        const slotSize = 50;
        const gap = 8;
        const startY = this.bankAreaY + 40;
        const verticalGap = slotSize + 24;
        this.words.forEach((word, wordIdx) => {
            let startX = this.sys.game.canvas.width / 2 - (word.length * (slotSize + gap)) / 2;
            let baseY = startY + wordIdx * verticalGap;
            let wordContainer = this.add.container(0, 0);
            for (let i = 0; i < word.length; i++) {
                let x = startX + i * (slotSize + gap);
                let y = baseY;
                let square = this.add.rectangle(x, y, slotSize, slotSize, 0xeeeeee).setStrokeStyle(2, 0x333333);
                let letter = this.add.text(x, y, word[i], { font: '32px Arial', color: '#222' }).setOrigin(0.5);
                wordContainer.add(square);
                wordContainer.add(letter);
            }
            this.wordSprites.push(wordContainer);
        });
    }

    squareClicked(slotIdx, squareIdx, square) {
        // Only allow selection in connect mode, never draggable
        if (this.connectMode) {
            // Connect mode: select squares
            if (this.selectedSquares.length < 2) {
                this.selectedSquares.push({ slotIdx, squareIdx, square });
                square.setFillStyle(0xffe066);
            }
            if (this.selectedSquares.length > 2) {
                this.selectedSquares.forEach(s => s.square.setFillStyle(0xffffff));
                this.selectedSquares = [{ slotIdx, squareIdx, square }];
                square.setFillStyle(0xffe066);
            }
        }
    }

    tryConnect() {
        if (this.selectedSquares.length === 2) {
            const [a, b] = this.selectedSquares;
            // Find closest side midpoints
            const squareA = a.square;
            const squareB = b.square;
            let minDist = Infinity;
            let bestA = 0, bestB = 0;
            for (let i = 0; i < 4; i++) {
                const ptA = this.getSquareSideMidpoint(squareA, i);
                for (let j = 0; j < 4; j++) {
                    const ptB = this.getSquareSideMidpoint(squareB, j);
                    const dist = Phaser.Math.Distance.Between(ptA.x, ptA.y, ptB.x, ptB.y);
                    if (dist < minDist) {
                        minDist = dist;
                        bestA = i;
                        bestB = j;
                    }
                }
            }
            // Connection string
            const connStr = `${a.slotIdx}${a.squareIdx}${bestA}-${b.slotIdx}${b.squareIdx}${bestB}`;
            this.connections.push(connStr);
            // Reset selection
            this.selectedSquares.forEach(s => s.square.setFillStyle(0xffffff));
            this.selectedSquares = [];
            this.renderConnections();
        }
    }

    renderConnections() {
        if (this.connectionLines) {
            this.connectionLines.forEach(l => l.destroy());
        }
        this.connectionLines = [];
        const connectionColor = 0x000000;
        this.connections.forEach(connStr => {
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
        const { x, y, width, height } = square;
        switch (sideIdx) {
            case 0: return { x: x, y: y - height / 2 };
            case 1: return { x: x + width / 2, y: y };
            case 2: return { x: x, y: y + height / 2 };
            case 3: return { x: x - width / 2, y: y };
            default: return { x, y };
        }
    }

    generateJSON() {
        const slots = this.slots.map(s => ({ length: s.length, x: s.x, y: s.y }));
        const words = this.words.slice();
        const connections = this.connections.slice();
        const json = JSON.stringify({ slots, words, connections }, null, 2);
        document.getElementById('json-output').value = json;
    }
}

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth - 320,
    height: window.innerHeight,
    backgroundColor: '#f0f8ff',
    parent: 'editor-game',
    scene: [LevelEditorScene]
};

const game = new Phaser.Game(config);
window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth - 320, window.innerHeight);
});
