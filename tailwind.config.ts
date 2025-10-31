import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          sky: "#60CEF4",
          blue: "#008bf4",
          ink: "#05024E"
        }
      }
    }
  },
  plugins: [],
} satisfies Config;
