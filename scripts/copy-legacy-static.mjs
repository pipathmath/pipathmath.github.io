import { copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(projectRoot, "dist");

// Preserve the existing non-Astro pages exactly until each page is redesigned and
// migrated. Remove an entry from this list only when Astro owns that route.
const legacyFiles = [
  "resume.html",
  "resume.pdf",
  "Orlando.png",
  "Duke_img.jpeg",
  "sat_math_bootcamp_page.html",
];

await Promise.all(
  legacyFiles.map((fileName) =>
    copyFile(path.join(projectRoot, fileName), path.join(outputDirectory, fileName)),
  ),
);

console.log(`Preserved ${legacyFiles.length} unchanged legacy pages/assets in dist.`);
