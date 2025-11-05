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
        // Top word slots area
        this.add.rectangle(
            this.sys.game.canvas.width / 2,
            this.slotAreaHeight / 2,
            this.sys.game.canvas.width,
            this.slotAreaHeight,
            0xe3f2fd
        ).setDepth(-10);
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
        // Center slot in slot area
        const slotAreaWidth = this.sys.game.canvas.width;
        const slotAreaHeight = this.slotAreaHeight;
        const x = 50; // percent
        const y = 10 + this.slots.length * 15; // percent, staggered
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
        const slotSize = 50;
        const gap = 8;
        const slotAreaWidth = this.sys.game.canvas.width;
        const slotAreaHeight = this.slotAreaHeight;
        this.slots.forEach((slot, slotIdx) => {
            // Create a container for the slot
            let slotContainer = this.add.container(0, 0);
            let baseX = (slot.x / 100) * slotAreaWidth;
            let baseY = (slot.y / 100) * slotAreaHeight;
            let slotTotalWidth = slot.length * slotSize + (slot.length - 1) * gap;
            // Place squares inside the container at relative positions
            for (let i = 0; i < slot.length; i++) {
                let x = i * (slotSize + gap) - slotTotalWidth / 2 + slotSize / 2;
                let y = 0;
                let square = this.add.rectangle(x, y, slotSize, slotSize, 0xffffff).setStrokeStyle(2, 0x000000);
                square.setData({ slotIdx, squareIdx: i });
                // Only set interactive and pointerdown in connect mode
                if (this.connectMode) {
                    square.setInteractive();
                    square.on('pointerdown', () => this.squareClicked(slotIdx, i, square));
                }
                slotContainer.add(square);
            }
            // Set container position to baseX, baseY
            slotContainer.x = baseX;
            slotContainer.y = baseY;
            // Make the whole slot draggable when not in connect mode
            if (!this.connectMode) {
                slotContainer.setSize(slotTotalWidth, slotSize);
                slotContainer.setInteractive(new Phaser.Geom.Rectangle(-slotTotalWidth/2, -slotSize/2, slotTotalWidth, slotSize), Phaser.Geom.Rectangle.Contains);
                this.input.setDraggable(slotContainer);
                slotContainer.on('pointerdown', () => {
                    console.log(`Slot container clicked: slotIdx=${slotIdx}`);
                });
                slotContainer.on('drag', (pointer, dragX, dragY) => {
                    slotContainer.x = dragX;
                    slotContainer.y = dragY;
                    // Update slot position in percent
                    slot.x = (dragX / slotAreaWidth) * 100;
                    slot.y = (dragY / slotAreaHeight) * 100;
                    // Update interactive area to match new position
                    slotContainer.input.hitArea.x = -slotTotalWidth/2;
                    slotContainer.input.hitArea.y = -slotSize/2;
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
