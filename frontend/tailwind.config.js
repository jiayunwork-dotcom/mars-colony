/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        mars: {
          50: '#fdf4ef',
          100: '#fbe6d9',
          200: '#f5c9b0',
          300: '#eea47e',
          400: '#e57749',
          500: '#de5626',
          600: '#cf3f1c',
          700: '#ab2f19',
          800: '#88281c',
          900: '#6e241a',
          950: '#3b0f0b',
        },
      },
    },
  },
  plugins: [],
};
