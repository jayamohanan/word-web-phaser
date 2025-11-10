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
            this.isPanning = false;
            this.panStart = { x: 0, y: 0 };
            this.cameraStart = { x: 0, y: 0 };
            // Pan lock state (locked by default)
            this.panLocked = true;
        }

        preload() {}

        create() {
            this.setupLayout();
            this.setupUIHooks();
            
            // Camera starts at (0,0) - grid origin will be at top-left of camera view
            // Explicitly set camera scroll to (0,0)
            // this.cameras.main.scrollX = 0;
            // this.cameras.main.scrollY = 0;
            console.log(`Camera initialized at scrollX=${this.cameras.main.scrollX}, scrollY=${this.cameras.main.scrollY}`);
            
            // Setup panning controls
            this.setupPanning();
            
            // Draw background for slot and bank areas
            
            this.drawAreaBackgrounds();
            
            // Create pan lock/unlock button
            this.createPanLockButton();
            
            // Create recenter button
            this.createRecenterButton();
            
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
            this.overlayGraphics.setScrollFactor(0); // Fixed to camera
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
            console.log('Redrawing grid for current camera view');
            // Remove previous grid graphics and background only
            if (this.gridGraphics) {
                this.gridGraphics.destroy();
            }
            if (this.backgroundRect) {
                this.backgroundRect.destroy();
            }
            if (this.originMarker) {
                this.originMarker.destroy();
            }
            
            const gridColor = 0xcfd8dc;
            const gridLineWidth = 1;
            const slotAreaWidth = this.sys.game.canvas.width;
            const slotAreaHeight = this.slotAreaHeight;
            const gridSize = CONFIG.GRID_SIZE;
            
            // Draw background - centered at (0,0), extends in all directions
            const bgSize = 50000; // Very large background to simulate infinite
            this.backgroundRect = this.add.rectangle(
                0,
                0,
                bgSize,
                bgSize,
                0xe3f2fd
            );
            this.backgroundRect.setOrigin(0.5); // Centered at (0,0)
            this.backgroundRect.setDepth(-12);
            
            // Create graphics for grid
            this.gridGraphics = this.add.graphics();
            this.gridGraphics.setDepth(-11);
            
            // Calculate visible range in world coordinates using camera view
            const cam = this.cameras.main;
            // const j = cam.worldView;
            // const worldMinX = cam.worldView.x;
            // const worldMaxX = worldMinX + cam.worldView.width;
            // const worldMinY = cam.worldView.y;
            // const worldMaxY = worldMinY + cam.worldView.height;

            const worldMinX = cam.scrollX;
            const worldMaxX = worldMinX + cam.width;
            const worldMinY = cam.scrollY;
            const worldMaxY = worldMinY + cam.height;



           
            // Add large padding to ensure grid is drawn beyond visible area for smooth panning
            const padding = gridSize * 10;
            
            // Find first grid line before visible area
            const startX = Math.floor((worldMinX - padding) / gridSize) * gridSize;
            const endX = Math.ceil((worldMaxX + padding) / gridSize) * gridSize;
            const startY = Math.floor((worldMinY - padding) / gridSize) * gridSize;
            const endY = Math.ceil((worldMaxY + padding) / gridSize) * gridSize;
            
            console.log(`Drawing grid from (${startX}, ${startY}) to (${endX}, ${endY})`);
            cam.worl        
            this.gridGraphics.lineStyle(gridLineWidth, gridColor, 1);
            
            // Draw vertical grid lines
            for (let x = startX; x <= endX; x += gridSize) {
                this.gridGraphics.lineBetween(x, startY, x, endY);
            }
            
            // Draw horizontal grid lines
            for (let y = startY; y <= endY; y += gridSize) {
                this.gridGraphics.lineBetween(startX, y, endX, y);
            }
            
            // Mark origin with a small yellow circle
            this.originMarker = this.add.circle(0, 0, 4, 0xffff00); // Yellow circle at origin
            this.originMarker.setStrokeStyle(1, 0xff8800);
            this.originMarker.setDepth(100); // Above grid, below slots
        }

        setupPanning() {
            // Handle panning with mouse drag (only when unlocked)
            this.input.on('pointerdown', (pointer) => {
                // Only allow panning if pan is unlocked AND not dragging a slot
                if (!this.panLocked && !this.isDraggingSlot) {
                    // Check if we're clicking on a slot container
                    let clickedOnSlot = false;
                    if (this.slotSprites) {
                        for (let slot of this.slotSprites) {
                            if (slot.getBounds().contains(pointer.worldX, pointer.worldY)) {
                                clickedOnSlot = true;
                                break;
                            }
                        }
                    }
                    
                    if (!clickedOnSlot) {
                        this.isPanning = true;
                        this.panStart.x = pointer.x;
                        this.panStart.y = pointer.y;
                        this.cameraStart.x = this.cameras.main.scrollX;
                        this.cameraStart.y = this.cameras.main.scrollY;
                    }
                }
            });
            
            this.input.on('pointerup', () => {
                this.isPanning = false;
                this.isDraggingSlot = false;
            });
            
            this.input.on('pointermove', (pointer) => {
                if (this.isPanning && !this.isDraggingSlot && !this.panLocked) {
                    const deltaX = pointer.x - this.panStart.x;
                    const deltaY = pointer.y - this.panStart.y;
                    
                    // Move camera in opposite direction of drag
                    this.cameras.main.scrollX = this.cameraStart.x - deltaX;
                    this.cameras.main.scrollY = this.cameraStart.y - deltaY;
                    
                    // Redraw grid for new visible area
                    this.redrawGrid();
                }
            });
        }

        createPanLockButton() {
            // Create lock/unlock button in top-right corner
            const buttonSize = 20;
            const buttonMargin = 16;
            const slotAreaWidth = this.sys.game.canvas.width;
            const buttonX = slotAreaWidth - buttonMargin - buttonSize / 2;
            const buttonY = buttonMargin + buttonSize / 2;
            
            // Create button background
            this.panLockButton = this.add.rectangle(
                buttonX,
                buttonY,
                buttonSize,
                buttonSize,
                this.panLocked ? 0xff4444 : 0x44ff44 // Red if locked, green if unlocked
            );
            this.panLockButton.setStrokeStyle(2, 0x333333);
            this.panLockButton.setDepth(2000); // Above everything
            this.panLockButton.setInteractive();
            this.panLockButton.setScrollFactor(0); // Fixed to camera
            
            // Create lock icon (simple text for now)
            this.panLockIcon = this.add.text(
                buttonX,
                buttonY,
                this.panLocked ? '🔒' : '🔓',
                { fontSize: '12px', color: '#ffffff' }
            );
            this.panLockIcon.setOrigin(0.5);
            this.panLockIcon.setDepth(2001);
            this.panLockIcon.setScrollFactor(0); // Fixed to camera
            
            // Handle button click
            this.panLockButton.on('pointerdown', () => {
                this.togglePanLock();
            });
            
            // Add hover effect
            this.panLockButton.on('pointerover', () => {
                this.panLockButton.setScale(1.1);
            });
            
            this.panLockButton.on('pointerout', () => {
                this.panLockButton.setScale(1.0);
            });
        }

        createRecenterButton() {
            // Create recenter button to the left of lock button
            const buttonSize = 20;
            const buttonMargin = 16;
            const buttonGap = 8;
            const slotAreaWidth = this.sys.game.canvas.width;
            const buttonX = slotAreaWidth - buttonMargin - buttonSize / 2 - buttonSize - buttonGap;
            const buttonY = buttonMargin + buttonSize / 2;
            
            // Create button background
            this.recenterButton = this.add.rectangle(
                buttonX,
                buttonY,
                buttonSize,
                buttonSize,
                0x4488ff // Blue color
            );
            this.recenterButton.setStrokeStyle(2, 0x333333);
            this.recenterButton.setDepth(2000);
            this.recenterButton.setInteractive();
            this.recenterButton.setScrollFactor(0); // Fixed to camera
            
            // Create icon (target/crosshair symbol)
            this.recenterIcon = this.add.text(
                buttonX,
                buttonY,
                '⌖', // Crosshair/target symbol
                { fontSize: '14px', color: '#ffffff' }
            );
            this.recenterIcon.setOrigin(0.5);
            this.recenterIcon.setDepth(2001);
            this.recenterIcon.setScrollFactor(0); // Fixed to camera
            
            // Handle button click
            this.recenterButton.on('pointerdown', () => {
                this.recenterCamera();
            });
            
            // Add hover effect
            this.recenterButton.on('pointerover', () => {
                this.recenterButton.setScale(1.1);
            });
            
            this.recenterButton.on('pointerout', () => {
                this.recenterButton.setScale(1.0);
            });
        }

        recenterCamera() {
            // Reset camera so grid origin (0,0) is at top-left of camera view
            this.cameras.main.scrollX = 0;
            this.cameras.main.scrollY = 0;
            
            // Redraw grid
            this.redrawGrid();
            
            console.log('Camera reset - grid origin at top-left');
        }

        togglePanLock() {
            this.panLocked = !this.panLocked;
            
            // Update button appearance
            this.panLockButton.setFillStyle(this.panLocked ? 0xff4444 : 0x44ff44);
            this.panLockIcon.setText(this.panLocked ? '🔒' : '🔓');
            
            // Stop panning if locking
            if (this.panLocked) {
                this.isPanning = false;
            }
            
            console.log(`Pan ${this.panLocked ? 'LOCKED' : 'UNLOCKED'}`);
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
    // Place anchor cell 2 rows above and 2 columns left of camera center
    const gridSize = CONFIG.GRID_SIZE;
    const cam = this.cameras.main;
    // Get camera center in world coordinates
    const centerX = cam.worldView.centerX;
    const centerY = cam.worldView.centerY;
    // Convert to grid coordinates
    let anchorCol = Math.floor(centerX / gridSize) - 2;
    let anchorRow = Math.floor(centerY / gridSize) - 2;
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
            // Don't destroy existing slots, just update if needed
            // Only create new slots for newly added ones
            if (!this.slotSprites) {
                this.slotSprites = [];
            }
            
            const gridSize = CONFIG.GRID_SIZE;
            
            // Remove slots that no longer exist
            while (this.slotSprites.length > this.slots.length) {
                const removedSlot = this.slotSprites.pop();
                removedSlot.destroy();
            }
            
            // Update existing slots and create new ones
            this.slots.forEach((slot, slotIdx) => {
                let slotContainer = this.slotSprites[slotIdx];
                
                // Create new slot container if it doesn't exist
                if (!slotContainer) {
                    slotContainer = this.add.container(0, 0);
                    
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
                    
                    // Set interactive and draggable
                    if (!this.connectMode) {
                        slotContainer.setInteractive(
                            new Phaser.Geom.Rectangle(
                                0,
                                0,
                                slot.length * gridSize,
                                CONFIG.SQUARE_WIDTH
                            ),
                            Phaser.Geom.Rectangle.Contains
                        );

                        this.input.setDraggable(slotContainer);
                        
                        slotContainer.on('pointerdown', (pointer) => {
                            // Prevent panning when dragging slots - slot has priority
                            this.isPanning = false;
                            this.isDraggingSlot = true;
                            console.log(`Slot container clicked: slotIdx=${slotIdx}`);
                        });
                        
                        slotContainer.on('drag', (pointer, dragX, dragY) => {
                            // dragX and dragY are in world coordinates
                            // Snap to nearest grid cell
                            // Cell center is at (i+0.5)*gridSize, (j+0.5)*gridSize
                            let snappedCol = Math.round(dragX / gridSize - 0.5);
                            let snappedRow = Math.round(dragY / gridSize - 0.5);
                            let snappedX = (snappedCol + 0.5) * gridSize;
                            let snappedY = (snappedRow + 0.5) * gridSize;
                            slotContainer.x = snappedX;
                            slotContainer.y = snappedY;
                            slot.anchorCol = snappedCol;
                            slot.anchorRow = snappedRow;
                            console.log(`Dragging slot to grid cell (${snappedCol}, ${snappedRow})`);
                        });
                        
                        slotContainer.on('dragend', () => {
                            this.isDraggingSlot = false;
                        });
                    }
                    
                    this.slotSprites.push(slotContainer);
                }
                
                // Calculate anchor cell center using (i+0.5)*cellSize, (j+0.5)*cellSize
                // Grid origin (0,0) is at world (0,0)
                let anchorX = (slot.anchorCol + 0.5) * gridSize;
                let anchorY = (slot.anchorRow + 0.5) * gridSize;
                
                // Update position
                slotContainer.x = anchorX;
                slotContainer.y = anchorY;
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
                wordContainer.setScrollFactor(0); // Fixed to camera
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
