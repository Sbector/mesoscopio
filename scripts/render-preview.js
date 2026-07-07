#!/usr/bin/env node
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import { chromium } from "playwright";
import matter from "gray-matter";

const BASE_URL = process.env.BASE_URL || "http://localhost:4321";
const FORCE = process.argv.includes("--force");
const FRAMES = 24;
const FPS = 24;
const WIDTH = 480;
const HEIGHT = 480;

async function calculateSHA256(filePath) {
  const buffer = await fs.promises.readFile(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function renderModel(modelPath, outDir) {
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--use-gl=swiftshader"],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: WIDTH, height: HEIGHT },
    });
    const page = await context.newPage();

    const renderUrl = `${BASE_URL}/render?model=${encodeURIComponent(modelPath)}`;
    console.log(`  Loading: ${renderUrl}`);

    await page.goto(renderUrl, { waitUntil: "networkidle", timeout: 60000 });

    // Wait for model to load
    await page.waitForFunction(
      () => window.__MODEL_RENDER_READY === true,
      { timeout: 30000 }
    );

    console.log("  Model ready, capturing frames...");

    // Ensure output directory exists
    await fs.promises.mkdir(outDir, { recursive: true });

    // Capture frames
    for (let i = 0; i < FRAMES; i++) {
      const angle = (i / FRAMES) * Math.PI * 2;

      await page.evaluate((a) => {
        if (window.setRotation) window.setRotation(a);
      }, angle);

      // Small wait to let render update
      await page.waitForTimeout(50);

      const filename = path.join(outDir, `frame_${String(i).padStart(4, "0")}.png`);
      await page.screenshot({ path: filename });

      process.stdout.write(`\r  Frame ${i + 1}/${FRAMES}`);
    }

    console.log(" ✓");

    await context.close();
  } finally {
    await browser.close();
  }
}

function spawnSync(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: "inherit" });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
    proc.on("error", reject);
  });
}

async function generateWebM(framesDir, outFile) {
  console.log("  Running ffmpeg...");

  const ffmpegArgs = [
    "-y",
    "-framerate",
    String(FPS),
    "-i",
    path.join(framesDir, "frame_%04d.png"),
    "-c:v",
    "libvpx-vp9",
    "-b:v",
    "0",
    "-crf",
    "35",
    "-pix_fmt",
    "yuv420p",
    "-vf",
    `scale=${WIDTH}:${HEIGHT}`,
    outFile,
  ];

  await spawnSync("ffmpeg", ffmpegArgs);
  console.log(`  WebM created: ${outFile}`);
}

async function updateFrontmatter(mdFile, videoUrl, hash) {
  const { data, content } = matter.read(mdFile);

  data.video = videoUrl;
  data.model_hash = hash;

  const newContent = matter.stringify(content, data);
  await fs.promises.writeFile(mdFile, newContent, "utf8");
}

async function processModels() {
  const modelosDir = "./src/data/modelos";
  const previewsDir = "./public/previews";

  await fs.promises.mkdir(previewsDir, { recursive: true });

  const files = await fs.promises.readdir(modelosDir);
  const mdFiles = files.filter((f) => f.endsWith(".md"));

  if (mdFiles.length === 0) {
    console.log("No model files found.");
    return;
  }

  let processed = 0;

  for (const mdFile of mdFiles) {
    const mdPath = path.join(modelosDir, mdFile);
    const { data } = matter.read(mdPath);

    const modelPath = data.model;
    if (!modelPath) {
      console.log(`Skipping ${mdFile}: no model path`);
      continue;
    }

    const modelFullPath = path.join("./public", modelPath.replace(/^\//, ""));

    if (!fs.existsSync(modelFullPath)) {
      console.log(`Skipping ${mdFile}: model not found at ${modelFullPath}`);
      continue;
    }

    const slug = mdFile.replace(/\.md$/, "");
    const videoUrl = `/previews/${slug}.webm`;
    const videoPath = path.join(previewsDir, `${slug}.webm`);

    // Calculate current hash
    const currentHash = await calculateSHA256(modelFullPath);
    const savedHash = data.model_hash;

    // Check if we need to regenerate
    const videoExists = fs.existsSync(videoPath);
    const needsRender =
      FORCE || !savedHash || savedHash !== currentHash || !videoExists;

    if (!needsRender) {
      console.log(`✓ ${mdFile} (skipped, hash matches)`);
      continue;
    }

    console.log(`Rendering ${mdFile}...`);

    const tempDir = path.join(previewsDir, `.temp-${slug}`);

    try {
      // Render frames
      await renderModel(modelPath, tempDir);

      // Generate WebM
      await generateWebM(tempDir, videoPath);

      // Update frontmatter
      await updateFrontmatter(mdPath, videoUrl, currentHash);

      console.log(`✓ ${mdFile} (generated)\n`);
      processed++;
    } catch (err) {
      console.error(`✗ ${mdFile} failed: ${err.message}\n`);
    } finally {
      // Clean up temp directory
      if (fs.existsSync(tempDir)) {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    }
  }

  console.log(`\nDone: ${processed} model(s) processed.`);
}

processModels().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
