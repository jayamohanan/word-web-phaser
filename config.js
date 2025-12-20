// Shared config for dimensions and layout
var CONFIG = {
    SQUARE_WIDTH: 60,
    SQUARE_GAP: 5,
    get GRID_SIZE() { return this.SQUARE_WIDTH + this.SQUARE_GAP; },
    SLOT_AREA_BG: 0xe3f2fd,
    BANK_AREA_BG: 0xfce4ec,
    GRID_COLOR: 0xcfd8dc,
    GRID_LINE_WIDTH: 1,
    SLOT_AREA_HEIGHT_FACTOR: 0.7, // Fraction of canvas height for slot area (portrait mode)
    WORD_GAP: 16,
    ORIGIN_X_FACTOR: 0.5,  // 50% of canvas width (horizontal center)
    ORIGIN_Y_FACTOR: 0.50,  // 50% of canvas height (closer to words in portrait mode)
    
    // Stroke styles for slots and words
    SLOT_STROKE_WIDTH: 2,
    SLOT_STROKE_COLOR: 0x000000,  // Black
    WORD_STROKE_WIDTH: 2,
    WORD_STROKE_COLOR: 0x333333,   // Dark gray

    CELL_BG1_COLOR: 0xf7f7f7,  // White for normal cells
    CELL_BG2_COLOR: 0xededed,  // Light gray for special cells (e.g., starting letters)
    
    // Font sizes
    WORD_CELL_FONT_SIZE: '40px',   // Font size for letters in word cells
    SLOT_CELL_FONT_SIZE: '40px',    // Font size for hints in slot cells
    
    // Font family for letters in squares (both slots and words)
    // Use 'default' for Arial sans-serif, or 'Petita' for custom font
    LETTER_FONT_FAMILY: 'Poppins-Medium',
    LETTER_FONT_WEIGHT: '500', // Font weight for letters in squares (use '400', '500', or '700' as string)
    
    // Connection highlight color
    CONNECTION_HIGHLIGHT_COLOR: 0xC8E6C9,  // Light green for connected cells
    
    // Autopilot mode - automatically places obvious words based on hints
    AUTOPILOT_ENABLED: false,  // Set to true to enable autopilot helper
    
    // Placement animation mode
    PLACEMENT_ANIMATION_MODE: 'cell',  // 'letter' = letters only, 'cell' = letters + squares
    
    // Debug mode - show portrait boundary (720x1280 area) on desktop
    SHOW_PORTRAIT_BOUNDARY: true  // Set to false to hide portrait boundary in debug
};
