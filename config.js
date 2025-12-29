// Shared config for dimensions and layout
var CONFIG = {
    SIZE: {
        LARGE: {
            SQUARE_WIDTH: 60,
            SQUARE_GAP: 4,
            SQUARE_RADIUS: 5,
            GRID_LINE_WIDTH: 1,
            SLOT_STROKE_WIDTH: 2,
            WORD_STROKE_WIDTH: 2,
            // Font sizes
            WORD_CELL_FONT_SIZE: '40px',   // Font size for letters in word cells
            SLOT_CELL_FONT_SIZE: '40px',    // Font size for hints in slot cells
            WORD_GAP: 12,
        },
        SMALL: {
            SQUARE_WIDTH: 40,
            SQUARE_GAP: 2,
            SQUARE_RADIUS: 3,
            GRID_LINE_WIDTH: 1,
            SLOT_STROKE_WIDTH: 2,
            WORD_STROKE_WIDTH: 2,
            // Font sizes
            WORD_CELL_FONT_SIZE: '30px',   // Font size for letters in word cells
            SLOT_CELL_FONT_SIZE: '30px',    // Font size for hints in slot cells
            WORD_GAP: 8,
        }
    },
    SQUARE_WIDTH: 60,
    SQUARE_GAP: 4,
    SQUARE_RADIUS: 5,
    GRID_LINE_WIDTH: 1,
    SLOT_STROKE_WIDTH: 2,
    WORD_STROKE_WIDTH: 2,
    // Font sizes
    WORD_CELL_FONT_SIZE: '40px',   // Font size for letters in word cells
    SLOT_CELL_FONT_SIZE: '40px',    // Font size for hints in slot cells
    WORD_GAP: 12,


    get GRID_SIZE() { return this.SQUARE_WIDTH + this.SQUARE_GAP; },
    SLOT_AREA_BG: 0xe3f2fd,
    BANK_AREA_BG: 0xfce4ec,
    GRID_COLOR: 0xcfd8dc,

    SLOT_AREA_HEIGHT_FACTOR: 0.7, // Fraction of canvas height for slot area (portrait mode)

    ORIGIN_X_FACTOR: 0.5,  // 50% of canvas width (horizontal center)
    ORIGIN_Y_FACTOR: 0.50,  // 50% of canvas height (closer to words in portrait mode)

    // Stroke styles for slots and words

    SLOT_STROKE_COLOR: 0x000000,  // Black

    WORD_STROKE_COLOR: 0x333333,   // Dark gray

    CELL_BG1_COLOR: 0xf7f7f7,  // White for normal cells
    CELL_BG2_COLOR: 0xededed,  // Light gray for special cells (e.g., starting letters)


    // Font family for letters in squares (both slots and words)
    // Use 'default' for Arial sans-serif, or 'Petita' for custom font
    LETTER_FONT_FAMILY: 'Poppins-Medium',
    LETTER_FONT_WEIGHT: '500', // Font weight for letters in squares (use '400', '500', or '700' as string)

    SLOT_MARKER_FONT_FAMILY: 'Poppins-LightItalic',
    SLOT_MARKER_FONT_WEIGHT: '300', // Font weight for slot markers (use '300', '400', '500', or '700' as string)

    // Background gradients (Poki gaming style)
    // Outer background gradient (full canvas)
    OUTER_BG_GRADIENT_TOP: '#ABE0F0',    // Deep purple (top)
    OUTER_BG_GRADIENT_BOTTOM: '#FFEE91', // Pink (bottom)

    // Portrait area gradient (720x1280 game area)
    // PORTRAIT_BG_GRADIENT_TOP: '#5390D9',    // Blue (top)
    // PORTRAIT_BG_GRADIENT_BOTTOM: '#48BFE3', // Cyan (bottom)

    PORTRAIT_BG_GRADIENT_TOP: '#d3e8eeff',    // Blue (top)
    PORTRAIT_BG_GRADIENT_BOTTOM: '#ABE0F0', // Cyan (bottom)


    // Connection highlight color
    CONNECTION_HIGHLIGHT_COLOR: 0xC8E6C9,  // Light green for connected cells

    // Autopilot mode - automatically places obvious words based on hints
    AUTOPILOT_ENABLED: false,  // Set to true to enable autopilot helper

    // Placement animation mode
    PLACEMENT_ANIMATION_MODE: 'cell',  // 'letter' = letters only, 'cell' = letters + squares

    // Debug mode - show portrait boundary (720x1280 area) on desktop
    SHOW_PORTRAIT_BOUNDARY: true,  // Set to false to hide portrait boundary in debug

    //Game Scores
    HINT_SCORE_1: '5',
    HINT_SCORE_2: '10'

};
