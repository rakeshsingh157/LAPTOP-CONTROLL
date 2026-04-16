/** @type {import('tailwindcss').config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "surface-dim": "#131313",
        "surface": "#131313",
        "surface-container-low": "#1C1B1B",
        "surface-container": "#201f1f",
        "surface-container-high": "#2a2a2a",
        "surface-container-highest": "#353433",
        "on-surface": "#E5E2E1",
        "primary": "#c3f5ff",
        "on-primary": "#00363d",
        "primary-container": "#004f58",
        "on-primary-container": "#9cf0ff",
        "secondary": "#69ff87",
        "on-secondary": "#003912",
        "secondary-container": "#02c953",
        "on-secondary-container": "#b6f2c4",
        "tertiary": "#ffebc3",
        "on-tertiary": "#412d00",
        "tertiary-container": "#f7be00",
        "on-tertiary-container": "#4a3500",
        "outline": "#849396",
        "outline-variant": "#3f484a"
      }
    }
  },
  plugins: [],
}
