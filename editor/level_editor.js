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
        const gridSize = CONFIG.GRID_SIZE;
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
        // Vertical grid lines (offset so column 0 center is at origin)
        for (let x = originX - gridSize / 2; x <= slotAreaWidth; x += gridSize) {
            this.add.line(0, 0, x, originY, x, 0, gridColor)
                .setOrigin(0)
                .setLineWidth(gridLineWidth)
                .setDepth(-11);
        }
        for (let x = originX - gridSize / 2; x >= 0; x -= gridSize) {
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
    // Spawn slot so first square is at center of a grid cell
    // Grid origin is at bottom midpoint of slot area
    const slotAreaWidth = this.sys.game.canvas.width;
    const slotAreaHeight = this.slotAreaHeight;
    const gridSize = CONFIG.GRID_SIZE;
    const originX = slotAreaWidth / 2;
    const originY = slotAreaHeight;
    
    // Spawn slot at grid cell: column 0 (center), a few rows up from bottom
    const anchorCol = 0; // Center column
    const rowFromBottom = 2 + this.slots.length;
    const anchorRow = -rowFromBottom; // Negative row = above origin
    
    // Store anchor cell for slot (relative to grid origin)
    this.slots.push({ length, anchorCol, anchorRow });
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
        const originX = slotAreaWidth / 2;
        const originY = slotAreaHeight;
        
        this.slots.forEach((slot, slotIdx) => {
            let slotContainer = this.add.container(0, 0);
            
            // Calculate anchor cell center relative to grid origin (bottom midpoint)
            // anchorCol = 0 means center column, negative anchorRow means above origin
            let anchorX = originX + ((slot.anchorCol-0.5) * CONFIG.GRID_SIZE);
            let anchorY = originY + ((slot.anchorRow + Math.sign(slot.anchorRow)*1) * CONFIG.GRID_SIZE);
            // let square = this.add.rectangle(anchorX, anchorY, 2, 2, 0xff0000).setStrokeStyle(2, 0x000000);

            // Place squares: first square at (0,0) of container, others offset by GRID_SIZE
            for (let i = 0; i < slot.length; i++) {
                let x = i * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE/2;
                let y = 0+ CONFIG.GRID_SIZE/2;
                let square = this.add.rectangle(x, y, CONFIG.SQUARE_WIDTH, CONFIG.SQUARE_WIDTH, 0xffffff).setStrokeStyle(2, 0x000000);
                square.setData({ slotIdx, squareIdx: i });
                if (this.connectMode) {
                    square.setInteractive();
                    square.on('pointerdown', () => this.squareClicked(slotIdx, i, square));
                }
                slotContainer.add(square);
            }
            
            // Place container so first square is centered at anchor grid cell
            slotContainer.x = anchorX;
            slotContainer.y = anchorY;
            if (!this.connectMode) {
                slotContainer.setInteractive(
                    new Phaser.Geom.Rectangle(
                        0,
                        0,
                        slot.length * CONFIG.GRID_SIZE,
                        CONFIG.SQUARE_WIDTH
                    ),
                    Phaser.Geom.Rectangle.Contains
                );

                this.input.setDraggable(slotContainer);
                slotContainer.on('pointerdown', () => {
                    console.log(`Slot container clicked: slotIdx=${slotIdx}`);
                });
                slotContainer.on('drag', (pointer, dragX, dragY) => {
                    // Snap slot's top-left to nearest grid cell corner
                    let offsetFromOriginX = dragX - originX;
                    let offsetFromOriginY = dragY - originY;
                    let snappedCol = Math.round(offsetFromOriginX / CONFIG.GRID_SIZE);
                    let snappedRow = Math.round(offsetFromOriginY / CONFIG.GRID_SIZE);
                    let snappedX = originX + (snappedCol * CONFIG.GRID_SIZE) - (CONFIG.GRID_SIZE / 2);
                    let snappedY = originY + (snappedRow * CONFIG.GRID_SIZE) - CONFIG.GRID_SIZE;
                    
                    slotContainer.x = snappedX;
                    slotContainer.y = snappedY;
                    slot.anchorCol = snappedCol;
                    slot.anchorRow = snappedRow;
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
            const squareA = a.square;
            const squareB = b.square;
            let minDist = Infinity;
            let bestA = 0, bestB = 0;

            // Helper to get allowed side indices for a square in a slot
            function allowedSides(slotLength, squareIdx) {
                if (slotLength === 1) {
                    return [0, 1, 2, 3]; // single square, all sides
                }
                if (squareIdx === 0) {
                    return [0, 2, 3]; // first: ignore right (1)
                }
                if (squareIdx === slotLength - 1) {
                    return [0, 1, 2]; // last: ignore left (3)
                }
                return [0, 2]; // middle: only top/bottom
            }

            const slotA = this.slots[a.slotIdx];
            const slotB = this.slots[b.slotIdx];
            const allowedA = allowedSides(slotA.length, a.squareIdx);
            const allowedB = allowedSides(slotB.length, b.squareIdx);

            let allDistances = [];
            for (let i of allowedA) {
                const ptA = this.getSquareSideMidpoint(squareA, i);
                for (let j of allowedB) {
                    const ptB = this.getSquareSideMidpoint(squareB, j);
                    const dist = Phaser.Math.Distance.Between(ptA.x, ptA.y, ptB.x, ptB.y);
                    allDistances.push({ i, j, ptA, ptB, dist });
                    console.log(`A side ${i} (${ptA.x},${ptA.y}) to B side ${j} (${ptB.x},${ptB.y}): distance = ${dist}`);
                    if (dist < minDist) {
                        minDist = dist;
                        bestA = i;
                        bestB = j;
                    }
                }
            }
            // Show which combination is selected
            const selected = allDistances.find(d => d.i === bestA && d.j === bestB);
            if (selected) {
                console.log(`Selected: A side ${selected.i} (${selected.ptA.x},${selected.ptA.y}) to B side ${selected.j} (${selected.ptB.x},${selected.ptB.y}) with shortest distance = ${selected.dist}`);
                let ptA, ptB;
                const slotAContainer = this.slotSprites[a.slotIdx];
                const slotBContainer = this.slotSprites[b.slotIdx];
                if (slotAContainer && typeof slotAContainer.getChildren === 'function' && slotBContainer && typeof slotBContainer.getChildren === 'function') {
                    const squareAObj = slotAContainer.getChildren()[a.squareIdx];
                    const squareBObj = slotBContainer.getChildren()[b.squareIdx];
                    if (squareAObj && squareBObj) {
                        ptA = this.getSquareSideMidpoint(squareAObj, bestA);
                        ptB = this.getSquareSideMidpoint(squareBObj, bestB);
                    }
                }
                // Fallback to selected.ptA/ptB if not found
                if (!ptA || !ptB) {
                    ptA = selected.ptA;
                    ptB = selected.ptB;
                }
                // Draw line using absolute coordinates, origin at (0,0)
                // Use the stroke color of the first selected square for the line
                let lineColor = 0x000000;
                let squareAObj = null;
                if (slotAContainer && typeof slotAContainer.getChildren === 'function') {
                    squareAObj = slotAContainer.getChildren()[a.squareIdx];
                }
                if (squareAObj && squareAObj.strokeColor !== undefined) {
                    lineColor = squareAObj.strokeColor;
                } else if (a.square && a.square.strokeColor !== undefined) {
                    lineColor = a.square.strokeColor;
                }
                let tempLine = this.add.line(0, 0, ptA.x, ptA.y, ptB.x, ptB.y, lineColor)
                    .setOrigin(0, 0)
                    .setLineWidth(2)
                    .setDepth(1000);
                // Optionally, remove this temp line after a short delay (uncomment if desired)
                // this.time.delayedCall(1000, () => tempLine.destroy());
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
            const fromSlot = this.slotSprites[fromInfo.slotIdx];
            const toSlot = this.slotSprites[toInfo.slotIdx];
            if (!fromSlot || typeof fromSlot.getChildren !== 'function' || !toSlot || typeof toSlot.getChildren !== 'function') {
                console.warn('Connection skipped: slotSprites entry missing or not a Container', { fromInfo, toInfo });
                return;
            }
            const fromSquare = fromSlot.getChildren()[fromInfo.squareIdx];
            const toSquare = toSlot.getChildren()[toInfo.squareIdx];
            if (!fromSquare || !toSquare) {
                console.warn('Connection skipped: square missing in slot', { fromInfo, toInfo });
                return;
            }
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
        // Get global position: container.x/y + square.x/y
        let parent = square.parentContainer;
        let gx = square.x;
        let gy = square.y;
        if (parent) {
            gx += parent.x;
            gy += parent.y;
        }
        const { width, height } = square;
        switch (sideIdx) {
            case 0: return { x: gx, y: gy - height / 2 };
            case 1: return { x: gx + width / 2, y: gy };
            case 2: return { x: gx, y: gy + height / 2 };
            case 3: return { x: gx - width / 2, y: gy };
            default: return { x: gx, y: gy };
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
