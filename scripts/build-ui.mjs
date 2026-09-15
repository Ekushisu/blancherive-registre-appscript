import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const uiDir = path.join(rootDir, "ui");
const outputPath = path.join(rootDir, "src", "Index.html");
const buildDir = path.join(uiDir, ".build");

const result = await build({
  entryPoints: [path.join(uiDir, "src", "main.jsx")],
  bundle: true,
  write: false,
  outdir: buildDir,
  format: "iife",
  target: ["es2018"],
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
  legalComments: "none",
  loader: {
    ".jsx": "jsx",
    ".css": "css",
    ".jpg": "dataurl",
    // Les décors détourés ont besoin de la transparence, donc du PNG.
    ".png": "dataurl"
  }
});

const javascript = result.outputFiles.find(file => file.path.endsWith(".js"));
const css = result.outputFiles.find(file => file.path.endsWith(".css"));

if (!javascript || !css) {
  throw new Error("Le build UI n'a pas produit les fichiers JavaScript et CSS attendus.");
}

const template = await readFile(
  path.join(uiDir, "index.template.html"),
  "utf8"
);

const html = template
  .replace("/*__UI_CSS__*/", css.text.trim())
  .replace(
    "/*__UI_JS__*/",
    javascript.text.trim()
  );

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, html);
