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
        // Camera offset for panning
        this.cameraOffset = { x: 0, y: 0 };
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
    }

    preload() {}

    create() {
        this.setupLayout();
        this.setupUIHooks();
        
        // Create container for pannable content (grid + slots)
        this.pannableContainer = this.add.container(0, 0);
        this.pannableContainer.setDepth(-20);
        
        // Setup panning controls
        this.setupPanning();
        
        // Draw background for slot and bank areas
        this.drawAreaBackgrounds();
        this.renderSlots();
        this.renderWords();
        this.renderConnections();
    }
    drawAreaBackgrounds() {
        // Draw grid with panning support - only render visible portion
        this.redrawGrid();
        
        // Word bank area overlay as an island with padding and rounded corners (FIXED position)
        const slotAreaWidth = this.sys.game.canvas.width;
        const slotAreaHeight = this.slotAreaHeight;
        const overlayPad = 16;
        const overlayWidth = slotAreaWidth - overlayPad * 2;
        const overlayHeight = Math.floor(slotAreaHeight * 0.4) - overlayPad;
        const overlayX = slotAreaWidth / 2;
        const overlayY = slotAreaHeight - overlayHeight / 2 - overlayPad;
        const overlayRadius = 24;
        
        // Create overlay graphics (stays fixed on screen)
        this.overlayGraphics = this.add.graphics();
        this.overlayGraphics.setDepth(1000);
        // Fill rounded rect
        this.overlayGraphics.fillStyle(0xe8f5e9, 1); // light green soft
        this.overlayGraphics.fillRoundedRect(
            overlayX - overlayWidth / 2,
            overlayY - overlayHeight / 2,
            overlayWidth,
            overlayHeight,
            overlayRadius
        );
        // Stroke rounded rect
        this.overlayGraphics.lineStyle(3, 0x66bb6a, 1); // slightly darker green
        this.overlayGraphics.strokeRoundedRect(
            overlayX - overlayWidth / 2,
            overlayY - overlayHeight / 2,
            overlayWidth,
            overlayHeight,
            overlayRadius
        );
        // Store overlay rect info for use in renderWords
        this.wordBankOverlayRect = {
            x: overlayX,
            y: overlayY,
            width: overlayWidth,
            height: overlayHeight,
            radius: overlayRadius
        };
    }

    redrawGrid() {
        // Remove previous grid graphics
        if (this.gridGraphics) {
            this.gridGraphics.destroy();
        }
        if (this.backgroundRect) {
            this.backgroundRect.destroy();
        }
        
        const gridColor = 0xcfd8dc;
        const gridLineWidth = 1;
        const slotAreaWidth = this.sys.game.canvas.width;
        const slotAreaHeight = this.slotAreaHeight;
        const gridSize = CONFIG.GRID_SIZE;
        
        // Create graphics for grid (part of pannable container)
        this.gridGraphics = this.add.graphics();
        this.gridGraphics.setDepth(-11);
        
        // Draw background
        this.backgroundRect = this.add.rectangle(
            slotAreaWidth / 2,
            slotAreaHeight / 2,
            slotAreaWidth * 3, // Extend beyond visible area
            slotAreaHeight * 3,
            0xe3f2fd
        );
        this.backgroundRect.setDepth(-12);
        this.pannableContainer.add(this.backgroundRect);
        this.pannableContainer.add(this.gridGraphics);
        
        // Calculate visible grid range based on camera offset
        const offsetX = this.cameraOffset.x;
        const offsetY = this.cameraOffset.y;
        
        // Find first visible grid line (considering offset)
        const startX = Math.floor(-offsetX / gridSize) * gridSize;
        const endX = startX + slotAreaWidth + gridSize * 2;
        const startY = Math.floor(-offsetY / gridSize) * gridSize;
        const endY = startY + slotAreaHeight + gridSize * 2;
        
        this.gridGraphics.lineStyle(gridLineWidth, gridColor, 1);
        
        // Draw vertical grid lines
        for (let x = startX; x <= endX; x += gridSize) {
            const screenX = x + offsetX;
            this.gridGraphics.lineBetween(screenX, -offsetY - slotAreaHeight, screenX, -offsetY + slotAreaHeight * 2);
        }
        
        // Draw horizontal grid lines
        for (let y = startY; y <= endY; y += gridSize) {
            const screenY = y + offsetY;
            this.gridGraphics.lineBetween(-offsetX - slotAreaWidth, screenY, -offsetX + slotAreaWidth * 2, screenY);
        }
        
        // Debug: highlight cell (0,1) in green
        const i = 0, j = 1;
        const centerX = (i + 0.5) * gridSize + offsetX;
        const centerY = (j + 0.5) * gridSize + offsetY;
        if (this.debugCell) {
            this.debugCell.destroy();
        }
        this.debugCell = this.add.rectangle(centerX, centerY, CONFIG.SQUARE_WIDTH, CONFIG.SQUARE_WIDTH, 0x66bb6a);
        this.debugCell.setDepth(-10);
        this.pannableContainer.add(this.debugCell);
    }

    setupPanning() {
        // Handle panning with mouse drag
        this.input.on('pointerdown', (pointer) => {
            // Start panning only with middle button or right button, or left button when not over slots
            if (pointer.middleButtonDown() || pointer.rightButtonDown()) {
                this.isPanning = true;
                this.panStart.x = pointer.x;
                this.panStart.y = pointer.y;
                this.panStartOffset = { ...this.cameraOffset };
            }
        });
        
        this.input.on('pointerup', () => {
            this.isPanning = false;
        });
        
        this.input.on('pointermove', (pointer) => {
            if (this.isPanning) {
                const deltaX = pointer.x - this.panStart.x;
                const deltaY = pointer.y - this.panStart.y;
                
                this.cameraOffset.x = this.panStartOffset.x + deltaX;
                this.cameraOffset.y = this.panStartOffset.y + deltaY;
                
                // Update pannable container position
                this.pannableContainer.x = this.cameraOffset.x;
                this.pannableContainer.y = this.cameraOffset.y;
                
                // Redraw grid for new visible area
                this.redrawGrid();
                
                // Update slot positions
                this.updateSlotPositions();
            }
        });
    }

    setupLayout() {
    this.slotAreaHeight = this.sys.game.canvas.height; // Use full height
    this.bankAreaY = this.slotAreaHeight;
    this.bankAreaHeight = 0; // No separate bank area
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
    // Grid origin (0,0) is at top-left corner (intersection of grid lines)
    const gridSize = CONFIG.GRID_SIZE;
    
    // Spawn slot at grid cell: column 2, row increases with each slot
    const anchorCol = 2;
    const anchorRow = 2 + this.slots.length;
    console.log(`Adding slot: length=${length}, anchorCol=${anchorCol}, anchorRow=${anchorRow}`);

    // Store anchor cell for slot (i, j coordinates)
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
        const gridSize = CONFIG.GRID_SIZE;
        
        this.slots.forEach((slot, slotIdx) => {
            let slotContainer = this.add.container(0, 0);
            
            // Calculate anchor cell center using (i+0.5)*cellSize, (j+0.5)*cellSize
            // where origin (0,0) is at top-left corner (grid line intersection)
            let anchorX = (slot.anchorCol + 0.5) * gridSize;
            let anchorY = (slot.anchorRow + 0.5) * gridSize;

            // Place squares: first square at (0,0) of container, others offset by GRID_SIZE
            for (let i = 0; i < slot.length; i++) {
                let x = i * gridSize;
                let y = 0;
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
            
            // Add to pannable container
            this.pannableContainer.add(slotContainer);
            
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
                slotContainer.on('pointerdown', (pointer) => {
                    // Prevent panning when dragging slots
                    this.isPanning = false;
                    console.log(`Slot container clicked: slotIdx=${slotIdx}`);
                });
                slotContainer.on('drag', (pointer, dragX, dragY) => {
                    // Snap to nearest grid cell using new coordinate system
                    // Cell center is at (i+0.5)*gridSize, (j+0.5)*gridSize
                    // Account for camera offset
                    const worldX = dragX - this.cameraOffset.x;
                    const worldY = dragY - this.cameraOffset.y;
                    
                    let snappedCol = Math.round(worldX / gridSize - 0.5);
                    let snappedRow = Math.round(worldY / gridSize - 0.5);
                    let snappedX = (snappedCol + 0.5) * gridSize;
                    let snappedY = (snappedRow + 0.5) * gridSize;
                    
                    slotContainer.x = snappedX;
                    slotContainer.y = snappedY;
                    slot.anchorCol = snappedCol;
                    slot.anchorRow = snappedRow;
                });
            }
            this.slotSprites.push(slotContainer);
        });
    }

    updateSlotPositions() {
        // This is called during panning to keep slots in their world positions
        // Slots are already in the pannable container, so they move automatically
        // We just need to redraw connections if any
        if (this.connections.length > 0) {
            this.renderConnections();
        }
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
            // Remove previous selection from same slot, if any
            let prevIdx = this.selectedSquares.findIndex(s => s.slotIdx === slotIdx);
            if (prevIdx !== -1) {
                // Unhighlight previous square from this slot
                this.selectedSquares[prevIdx].square.setFillStyle(0xffffff);
                this.selectedSquares.splice(prevIdx, 1);
            }
            // If already two squares selected, remove the oldest
            if (this.selectedSquares.length === 2) {
                this.selectedSquares[0].square.setFillStyle(0xffffff);
                this.selectedSquares.shift();
            }
            // Add new selection and highlight
            this.selectedSquares.push({ slotIdx, squareIdx, square });
            square.setFillStyle(0xffe066);
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
            // Add connection lines to pannable container so they move with slots
            this.pannableContainer.add(line);
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
        const slots = this.slots.map(s => ({
            length: s.length,
            anchorCol: s.anchorCol,
            anchorRow: s.anchorRow
        }));
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
