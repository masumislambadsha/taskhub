/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#004030",
        secondary: "#4A9782",
        accent: "#DCD0A8",
        background: "#FFF9E5",
        "on-background": "#00281D",
      },
      fontFamily: {
        headline: ["Manrope"],
        body: ["Inter"],
      },
    },
  },
  plugins: [],
};
