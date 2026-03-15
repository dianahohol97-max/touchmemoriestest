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
                accent: '#263A99',
                background: '#FFFFFF',
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
