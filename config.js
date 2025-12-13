// Shared config for dimensions and layout
var CONFIG = {
    SQUARE_WIDTH: 40,
    SQUARE_GAP: 5,
    get GRID_SIZE() { return this.SQUARE_WIDTH + this.SQUARE_GAP; },
    SLOT_AREA_BG: 0xe3f2fd,
    BANK_AREA_BG: 0xfce4ec,
    GRID_COLOR: 0xcfd8dc,
    GRID_LINE_WIDTH: 1,
    SLOT_AREA_HEIGHT_FACTOR: 0.6, // Fraction of canvas height for slot area
    WORD_GAP: 16,
    ORIGIN_X_FACTOR: 0.5,  // 50% of canvas width (horizontal center)
    ORIGIN_Y_FACTOR: 0.55,  // 55% of canvas height (55% above word bank area at 60%)
    
    // Stroke styles for slots and words
    SLOT_STROKE_WIDTH: 2,
    SLOT_STROKE_COLOR: 0x000000,  // Black
    WORD_STROKE_WIDTH: 2,
    WORD_STROKE_COLOR: 0x333333,   // Dark gray
    
    // Font sizes
    WORD_CELL_FONT_SIZE: '24px',   // Font size for letters in word cells
    SLOT_CELL_FONT_SIZE: '24px',    // Font size for hints in slot cells
    
    // Connection highlight color
    CONNECTION_HIGHLIGHT_COLOR: 0xC8E6C9  // Light green for connected cells
};
