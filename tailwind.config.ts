import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors
        gold: {
          DEFAULT: '#826D3C',
          light: '#A89060',
        },
        cream: '#F0EDE6',
        ivory: '#F7F6F3',
        // Neutral colors
        gray: {
          light: '#FAFAF8',
          med: '#F0EEEB',
          dark: '#8A8A8A',
        },
      },
      fontFamily: {
        heading: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        body: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
