import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  site: "https://www.pipathacademy.com",
  output: "static",
  trailingSlash: "never",
  build: {
    format: "directory",
  },
  integrations: [react()],
});
