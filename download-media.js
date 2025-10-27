import dotenv from "dotenv";
dotenv.config({ path: "./.env" });
import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

const MAX_CONCURRENT_DOWNLOADS = parseInt(process.env.MEDIA_MAX_THREADS) || 10;
const BASE_URL = process.env.OD_BASE_URL;

async function downloadImage(url, filepath) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Ensure directory exists
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Download and save the file
    await pipeline(
      Readable.fromWeb(response.body),
      fs.createWriteStream(filepath)
    );

    return { success: true, url, filepath };
  } catch (error) {
    return { success: false, url, filepath, error: error.message };
  }
}

async function processShips() {
  const shipsFile = path.resolve(process.cwd(), "output/ships.jsonl");
  const mediaDir = path.resolve(process.cwd(), "output/media");

  // Check if ships.jsonl exists
  if (!fs.existsSync(shipsFile)) {
    console.error("ships.jsonl not found. Please run 'npm start' first.");
    process.exit(1);
  }

  // Create media directory
  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
  }

  // Read ships.jsonl line by line
  const fileContent = fs.readFileSync(shipsFile, "utf-8");
  const ships = fileContent.trim().split("\n").map(line => JSON.parse(line));

  console.log(`Found ${ships.length} ships in ships.jsonl`);
  console.log(`Using ${MAX_CONCURRENT_DOWNLOADS} concurrent downloads\n`);

  // Collect all images to download
  const downloadTasks = [];

  for (const ship of ships) {
    const shipId = ship.shipId;
    const shipName = ship.data?.data?.name || `ship_${shipId}`;
    const images = ship.data?.data?.images || [];

    for (const image of images) {
      if (image.path && image.imageType === "Gallery") {
        const imageUrl = `${BASE_URL}${image.path}`;
        const filename = path.basename(image.path);
        const filepath = path.join(mediaDir, `${shipId}`, filename);

        // Skip if already downloaded
        if (!fs.existsSync(filepath)) {
          downloadTasks.push({
            url: imageUrl,
            filepath,
            shipId,
            shipName
          });
        }
      }
    }
  }

  console.log(`Total images to download: ${downloadTasks.length}\n`);

  if (downloadTasks.length === 0) {
    console.log("No new images to download. All images already exist.");
    return;
  }

  // Download images in batches
  let completed = 0;
  let failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < downloadTasks.length; i += MAX_CONCURRENT_DOWNLOADS) {
    const batch = downloadTasks.slice(i, i + MAX_CONCURRENT_DOWNLOADS);

    const promises = batch.map(async (task) => {
      const result = await downloadImage(task.url, task.filepath);

      if (result.success) {
        completed++;
        console.log(`✓ [${completed}/${downloadTasks.length}] ${task.shipName} - ${path.basename(task.filepath)}`);
      } else {
        failed++;
        console.error(`✗ [${completed + failed}/${downloadTasks.length}] Failed: ${path.basename(task.filepath)} - ${result.error}`);
      }

      return result;
    });

    await Promise.all(promises);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n========================================`);
  console.log(`Download Complete!`);
  console.log(`Total images: ${downloadTasks.length}`);
  console.log(`Successfully downloaded: ${completed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Time taken: ${duration}s`);
  console.log(`Media saved to: ${mediaDir}`);
  console.log(`========================================`);
}

(async () => {
  try {
    await processShips();
    process.exit(0);
  } catch (e) {
    console.error("Error:", e);
    process.exit(1);
  }
})();
