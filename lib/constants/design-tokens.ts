/**
 * Touch.Memories Design System Tokens
 * Strictly following brand guidelines: Primary #263A99, 4px grid, 3px radius.
 */

export const tokens = {
    colors: {
        primary: '#263A99',
        accent: '#263A99',
        background: '#FFFFFF',
        textPrimary: '#263A99',
        link: '#263A99',
        // Hover variation (slightly darker)
        primaryHover: '#1d2d7a',
    },
    typography: {
        fonts: {
            body: "'Open Sans', sans-serif",
            heading: "'Montserrat', sans-serif",
        },
        sizes: {
            h1: '16px', // Overline/Category label
            h2: '64px', // Hero/Primary headline
            body: '16px',
        },
    },
    spacing: {
        base: 4,
        grid: [4, 8, 12, 16, 24, 32, 48, 64],
    },
    radius: {
        global: '3px',
    },
};

export default tokens;
