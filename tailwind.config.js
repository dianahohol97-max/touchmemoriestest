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
          hover: '#1A2870',
          dark: '#1A2870',
          light: '#3D56C4',
          container: '#1E2F85',
        },
        brand: {
          DEFAULT: '#263A99',
          dark: '#1A2870',
          light: '#ECEEF6',
          50: 'rgba(38,58,153,0.05)',
        },
        accent: '#263A99',
        surface: {
          DEFAULT: '#F8F9FF',
          low: '#F1F3FB',
          mid: '#ECEEF6',
          high: '#E6E8F0',
          highest: '#E0E2EA',
          white: '#FFFFFF',
        },
        background: {
          DEFAULT: '#F8F9FF',
          white: '#FFFFFF',
        },
        'on-surface': '#181C21',
        'on-primary': '#FFFFFF',
        secondary: '#585C7D',
        textPrimary: '#181C21',
        'outline-variant': '#C6C5D3',
        border: '#E0E2EA',
      },
      fontFamily: {
        heading: ['var(--font-montserrat)', 'Montserrat', 'sans-serif'],
        body: ['var(--font-open-sans)', 'Open Sans', 'sans-serif'],
        label: ['var(--font-open-sans)', 'Open Sans', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '3px',
        brand: '3px',
        sm: '3px',
        md: '6px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '24px',
        full: '9999px',
      },
      boxShadow: {
        card: '0 10px 30px rgba(38,58,153,0.06)',
        'card-hover': '0 20px 50px rgba(38,58,153,0.12)',
        btn: '0 4px 16px rgba(38,58,153,0.25)',
        'btn-hover': '0 8px 24px rgba(38,58,153,0.35)',
      },
      spacing: {
        base: '4px',
      },
    },
  },
  plugins: [],
}
