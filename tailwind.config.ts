import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          in: '#10b981',
          out: '#ef4444',
          net: '#0ea5e9',
          hutang: '#7c3aed',
          hp: '#0d9488',
          hpOut: '#ea580c',
        },
      },
    },
  },
  plugins: [],
};

export default config;
