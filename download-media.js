/**
 * ========================================
 * CRUISE SHIPS MEDIA DOWNLOADER
 * ========================================
 *
 * Downloads ship gallery images from scraped ship data.
 * Reads ships.jsonl and downloads all gallery images for each ship.
 *
 * Features:
 * - Parallel downloads with configurable concurrency
 * - Resume capability (skips already downloaded files)
 * - Direct downloads (does NOT use ScraperAPI)
 * - Organized output by ship ID
 * - Progress tracking and error reporting
 *
 * @requires dotenv - Environment variable management
 * @requires fs - File system operations
 * @requires path - Path manipulation
 * @requires stream/promises - Stream pipeline for downloads
 */

import dotenv from "dotenv";
dotenv.config({ path: "./.env" });
import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

// ========================================
// CONSTANTS & CONFIGURATION
// ========================================

const DEFAULT_MAX_DOWNLOADS = 10; // Default concurrent downloads if not configured
const OUTPUT_DIR_NAME = "output";
const SHIPS_FILE_NAME = "ships.jsonl";
const MEDIA_DIR_NAME = "media";
const GALLERY_IMAGE_TYPE = "Gallery"; // Filter for gallery images only

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Validates that all required environment variables are present.
 * @throws {Error} If any required environment variable is missing
 */
function validateEnvironment() {
  const required = ["OD_BASE_URL"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
      `Please check your .env file and ensure all required variables are set.`
    );
  }
}

/**
 * Ensures a directory exists, creating it if necessary.
 * @param {string} dirPath - Path to the directory
 */
function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Formats file size in human-readable format.
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Formats elapsed time in human-readable format.
 * @param {number} milliseconds - Time in milliseconds
 * @returns {string} Formatted time string
 */
function formatElapsedTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Logs a formatted header message.
 * @param {string} message - Header message to display
 */
function logHeader(message) {
  console.log("\n" + "=".repeat(60));
  console.log(message);
  console.log("=".repeat(60));
}

/**
 * Logs a formatted section message.
 * @param {string} message - Section message to display
 */
function logSection(message) {
  console.log("\n" + message);
  console.log("-".repeat(60));
}

// ========================================
// CORE DOWNLOAD FUNCTIONS
// ========================================

/**
 * Downloads a single image from URL to local file.
 * Uses streaming to handle large files efficiently.
 *
 * @param {string} url - URL of the image to download
 * @param {string} filepath - Local file path to save the image
 * @returns {Promise<object>} Result object with success status
 */
async function downloadImage(url, filepath) {
  try {
    // Fetch the image
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Ensure parent directory exists
    const dir = path.dirname(filepath);
    ensureDirectory(dir);

    // Download and save the file using streaming for efficiency
    await pipeline(
      Readable.fromWeb(response.body),
      fs.createWriteStream(filepath)
    );

    return { success: true, url, filepath };
  } catch (error) {
    return {
      success: false,
      url,
      filepath,
      error: error.message,
    };
  }
}

/**
 * Reads and parses the ships.jsonl file.
 * @param {string} shipsFile - Path to ships.jsonl file
 * @returns {Array<object>} Array of ship objects
 * @throws {Error} If file doesn't exist or parsing fails
 */
function loadShipsData(shipsFile) {
  if (!fs.existsSync(shipsFile)) {
    throw new Error(
      `ships.jsonl not found at: ${shipsFile}\n` +
      `Please run 'npm run get-ships' first to scrape ship data.`
    );
  }

  const fileContent = fs.readFileSync(shipsFile, "utf-8");

  // Parse JSONL (one JSON object per line)
  const ships = fileContent
    .trim()
    .split("\n")
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        console.warn(`Warning: Failed to parse line ${index + 1}, skipping...`);
        return null;
      }
    })
    .filter((ship) => ship !== null);

  return ships;
}

/**
 * Collects all image download tasks from ship data.
 * Filters for gallery images and skips already downloaded files.
 *
 * @param {Array<object>} ships - Array of ship objects
 * @param {string} baseUrl - Base URL for constructing image URLs
 * @param {string} mediaDir - Directory to save media files
 * @returns {Array<object>} Array of download task objects
 */
function collectDownloadTasks(ships, baseUrl, mediaDir) {
  const downloadTasks = [];
  let totalImages = 0;
  let alreadyDownloaded = 0;

  for (const ship of ships) {
    const shipId = ship.shipId;
    const shipName = ship.data?.data?.name || `Ship ${shipId}`;
    const images = ship.data?.data?.images || [];

    // Filter for gallery images only
    const galleryImages = images.filter(
      (img) => img.path && img.imageType === GALLERY_IMAGE_TYPE
    );

    totalImages += galleryImages.length;

    for (const image of galleryImages) {
      const imageUrl = `${baseUrl}${image.path}`;
      const filename = path.basename(image.path);
      const filepath = path.join(mediaDir, `${shipId}`, filename);

      // Skip if already downloaded (resume capability)
      if (fs.existsSync(filepath)) {
        alreadyDownloaded++;
        continue;
      }

      downloadTasks.push({
        url: imageUrl,
        filepath,
        shipId,
        shipName,
        filename,
      });
    }
  }

  console.log(`Total gallery images found: ${totalImages}`);
  console.log(`Already downloaded: ${alreadyDownloaded}`);
  console.log(`New images to download: ${downloadTasks.length}`);

  return downloadTasks;
}

/**
 * Downloads all images in parallel batches.
 * @param {Array<object>} downloadTasks - Array of download task objects
 * @param {number} maxConcurrent - Maximum concurrent downloads
 * @returns {Promise<object>} Results object with statistics
 */
async function downloadInBatches(downloadTasks, maxConcurrent) {
  const counters = { completed: 0, failed: 0 };
  const startTime = Date.now();

  logSection(`Downloading ${downloadTasks.length} images with ${maxConcurrent} parallel downloads...`);

  // Process downloads in batches for controlled concurrency
  for (let i = 0; i < downloadTasks.length; i += maxConcurrent) {
    const batch = downloadTasks.slice(i, i + maxConcurrent);

    // Create promises for all downloads in this batch
    const promises = batch.map(async (task) => {
      const result = await downloadImage(task.url, task.filepath);

      if (result.success) {
        counters.completed++;
        console.log(
          `✓ [${counters.completed}/${downloadTasks.length}] ${task.shipName} - ${task.filename}`
        );
      } else {
        counters.failed++;
        console.error(
          `✗ [${counters.completed + counters.failed}/${downloadTasks.length}] ` +
          `Failed: ${task.filename} - ${result.error}`
        );
      }

      return result;
    });

    // Wait for all downloads in batch to complete before moving to next batch
    await Promise.all(promises);
  }

  const elapsedTime = Date.now() - startTime;

  return {
    completed: counters.completed,
    failed: counters.failed,
    elapsedTime,
  };
}

/**
 * Displays the final download summary report.
 * @param {object} results - Results object with statistics
 * @param {number} totalTasks - Total number of download tasks
 * @param {string} mediaDir - Path to media directory
 */
function displaySummary(results, totalTasks, mediaDir) {
  const completionRate = totalTasks > 0
    ? ((results.completed / totalTasks) * 100).toFixed(1)
    : "0.0";

  logHeader("DOWNLOAD COMPLETED");
  console.log(`Total images:          ${totalTasks}`);
  console.log(`Successfully downloaded: ${results.completed} (${completionRate}%)`);
  console.log(`Failed:                ${results.failed}`);
  console.log(`Time elapsed:          ${formatElapsedTime(results.elapsedTime)}`);
  console.log(`Media saved to:        ${mediaDir}`);
  console.log("=".repeat(60) + "\n");

  // Warn if there were failures
  if (results.failed > 0) {
    console.warn(
      `⚠️  ${results.failed} image(s) failed to download. ` +
      `Check the logs above for details.`
    );
  }
}

// ========================================
// MAIN EXECUTION
// ========================================

/**
 * Main download workflow.
 * Orchestrates the entire media download process.
 */
async function main() {
  // Validate environment before starting
  validateEnvironment();

  // Setup file paths
  const outputDir = path.resolve(process.cwd(), OUTPUT_DIR_NAME);
  const shipsFile = path.join(outputDir, SHIPS_FILE_NAME);
  const mediaDir = path.join(outputDir, MEDIA_DIR_NAME);

  // Ensure media directory exists
  ensureDirectory(mediaDir);

  // Get configuration
  const baseUrl = process.env.OD_BASE_URL;
  const maxConcurrent = parseInt(process.env.MEDIA_MAX_THREADS) || DEFAULT_MAX_DOWNLOADS;

  logHeader("CRUISE SHIPS MEDIA DOWNLOADER");
  console.log(`Configuration:`);
  console.log(`  Base URL:          ${baseUrl}`);
  console.log(`  Max Concurrent:    ${maxConcurrent}`);
  console.log(`  Ships File:        ${shipsFile}`);
  console.log(`  Media Directory:   ${mediaDir}`);

  // Step 1: Load ship data
  logSection("Step 1: Loading Ship Data");
  const ships = loadShipsData(shipsFile);
  console.log(`✓ Loaded ${ships.length} ships from ${SHIPS_FILE_NAME}`);

  // Step 2: Collect download tasks
  logSection("Step 2: Collecting Image URLs");
  const downloadTasks = collectDownloadTasks(ships, baseUrl, mediaDir);

  if (downloadTasks.length === 0) {
    console.log("\n✓ All images already downloaded. Nothing to do!");
    return;
  }

  // Step 3: Download images
  logSection("Step 3: Downloading Images");
  const results = await downloadInBatches(downloadTasks, maxConcurrent);

  // Step 4: Display final summary
  displaySummary(results, downloadTasks.length, mediaDir);
}

// ========================================
// ENTRY POINT
// ========================================

/**
 * Application entry point with error handling.
 * Catches and logs any unhandled errors, then exits with appropriate code.
 */
(async () => {
  try {
    await main();
    process.exit(0); // Success
  } catch (error) {
    // Log error with details
    console.error("\n" + "=".repeat(60));
    console.error("❌ FATAL ERROR");
    console.error("=".repeat(60));
    console.error(`Message: ${error.message}`);
    if (error.stack) {
      console.error(`\nStack trace:\n${error.stack}`);
    }
    console.error("=".repeat(60) + "\n");

    process.exit(1); // Failure
  }
})();
