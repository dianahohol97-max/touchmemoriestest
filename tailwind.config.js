/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#263A99',
                    hover: '#1d2d7a',
                },
                brand: {
                    DEFAULT: '#263a99',
                    dark: '#1a2966',
                    light: '#eef0fb',
                    50: 'rgba(38,58,153,0.05)',
                },
                accent: '#263A99',
                background: {
                    DEFAULT: '#f8f9ff',
                    white: '#FFFFFF',
                },
                textPrimary: '#263A99',
            },
            fontFamily: {
                heading: ['var(--font-montserrat)', 'Montserrat', 'sans-serif'],
                body: ['var(--font-open-sans)', 'Open Sans', 'sans-serif'],
            },
            borderRadius: {
                DEFAULT: '3px',
                brand: '3px',
            },
            spacing: {
                'base': '4px',
            }
        },
    },
    plugins: [],
}
