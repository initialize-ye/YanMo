import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#1f1f1f",
          soft: "#444746",
          mute: "#5e5e5e"
        },
        paper: {
          DEFAULT: "#ffffff",
          light: "#f8f9fa",
          deep: "#f1f3f4"
        },
        jade: {
          DEFAULT: "#1a73e8",
          deep: "#1765cc",
          light: "#e8f0fe"
        },
        cinnabar: {
          DEFAULT: "#d93025",
          light: "#fce8e6"
        },
        gold: "#b06000",
        line: "#dadce0"
      },
      fontFamily: {
        sans: ["var(--font-body)"],
        display: ["var(--font-display)"],
        serif: ["var(--font-serif)"],
        kai: ["var(--font-kai)"]
      },
      boxShadow: {
        paper: "0 1px 2px rgba(60,64,67,.06), 0 2px 6px 2px rgba(60,64,67,.04)",
        lift: "0 1px 2px rgba(60,64,67,.10), 0 8px 24px rgba(60,64,67,.12)",
        seal: "none"
      },
      borderRadius: {
        xs: "4px"
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        fade: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        spread: {
          "0%": { transform: "scale(.25)", opacity: ".7" },
          "80%": { opacity: "0" },
          "100%": { transform: "scale(1.9)", opacity: "0" }
        },
        drift: {
          "0%,100%": { transform: "translate3d(0,0,0)" },
          "50%": { transform: "translate3d(0,-5px,0)" }
        },
        stroke: {
          "0%": { strokeDashoffset: "620" },
          "100%": { strokeDashoffset: "0" }
        },
        blink: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: ".15" }
        }
      },
      animation: {
        rise: "rise .6s cubic-bezier(.2,0,0,1) both",
        fade: "fade .8s ease both",
        spread: "spread 2.8s ease-out infinite",
        drift: "drift 7s ease-in-out infinite",
        stroke: "stroke 2.4s cubic-bezier(.65,0,.35,1) infinite alternate",
        blink: "blink 1.4s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
