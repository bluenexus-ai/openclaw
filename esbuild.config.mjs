import { build } from "esbuild"

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outdir: "dist",
  define: {
    "process.env": "__nodeEnv",
  },
  banner: {
    js: "var __nodeEnv=process['env'];",
  },
})
