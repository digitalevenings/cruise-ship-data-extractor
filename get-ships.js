/**
 * ========================================
 * CRUISE SHIPS DATA EXTRACTOR
 * ========================================
 *
 * Scrapes comprehensive cruise ship data from the Ody cruise booking platform.
 * Extracts detailed information for ~1,155 ships across all major cruise lines.
 *
 * Features:
 * - Fetches master list of all ships
 * - Retrieves detailed ship information in parallel
 * - Outputs data in JSONL (JSON Lines) format
 * - Uses ScraperAPI for reliable data extraction
 *
 * @requires dotenv - Environment variable management
 * @requires ./libs/ody.js - Ody API service module
 */

import dotenv from "dotenv";
dotenv.config({ path: "./.env" });
import { getService } from "./libs/ody.js";
import fs from "fs";
import path from "path";

// ========================================
// CONSTANTS & CONFIGURATION
// ========================================

const DATA_SOURCE = "ody"; // Data source identifier
const DEFAULT_MAX_THREADS = 5; // Default concurrency if not configured
const OUTPUT_DIR_NAME = "output";
const MASTER_FILE_NAME = "master.jsonl";
const SHIPS_FILE_NAME = "ships.jsonl";

// API endpoints
const MASTER_API_PATH = "/nitroapi/v2/master/allswift?requestSource=1";
const SHIP_DETAILS_API_PATH = "/nitroapi/v2/ship/GetDetails";

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Validates that all required environment variables are present.
 * @throws {Error} If any required environment variable is missing
 */
function validateEnvironment() {
  const required = ["OD_BASE_URL", "SCRAPEAPI_KEY"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
      `Please check your .env file and ensure all required variables are set.`
    );
  }
}

/**
 * Ensures the output directory exists, creating it if necessary.
 * @param {string} dirPath - Path to the output directory
 */
function ensureOutputDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created output directory: ${dirPath}`);
  }
}

/**
 * Creates a timestamped JSONL record for a ship.
 * @param {string} type - Record type (e.g., "master", "ship")
 * @param {object} data - Ship data object
 * @param {number} [shipId] - Optional ship ID for individual ship records
 * @returns {string} JSONL formatted string
 */
function createJsonlRecord(type, data, shipId = null) {
  const record = {
    timestamp: new Date().toISOString(),
    source: DATA_SOURCE,
    type,
    ...(shipId && { shipId }),
    data,
  };
  return JSON.stringify(record) + "\n";
}

/**
 * Formats elapsed time in a human-readable format.
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
// CORE SCRAPING FUNCTIONS
// ========================================

/**
 * Fetches the master list of all ships from the Ody API.
 * @param {string} baseUrl - Base URL for the Ody API
 * @returns {Promise<object>} Master data containing all ships
 * @throws {Error} If master data fetch fails or no ships found
 */
async function fetchMasterData(baseUrl) {
  console.log("🌐 Fetching master data from Ody API...");

  const masterUrl = `${baseUrl}${MASTER_API_PATH}`;
  const masterResult = await getService(masterUrl);

  if (!masterResult || !masterResult.ship || masterResult.ship.length === 0) {
    throw new Error(
      "No ships found in master data. The API response may be invalid or empty."
    );
  }

  console.log(`✓ Received master data with ${masterResult.ship.length} ships`);
  return masterResult;
}

/**
 * Saves the master data to a JSONL file.
 * @param {string} filePath - Path to save the master file
 * @param {object} masterData - Master data to save
 */
function saveMasterData(filePath, masterData) {
  const jsonLine = createJsonlRecord("master", masterData);
  fs.writeFileSync(filePath, jsonLine);
  console.log(`✓ Master data saved to: ${filePath}`);
}

/**
 * Fetches detailed information for a single ship.
 * @param {string} baseUrl - Base URL for the Ody API
 * @param {number} shipId - ID of the ship to fetch
 * @returns {Promise<object>} Ship details data
 */
async function fetchShipDetails(baseUrl, shipId) {
  const url = `${baseUrl}${SHIP_DETAILS_API_PATH}/${shipId}?requestSource=1`;
  return await getService(url, "get", [], true); // true = decrypt response
}

/**
 * Processes a single ship: fetches details and saves to file.
 * @param {object} ship - Ship object from master list
 * @param {string} baseUrl - Base URL for the Ody API
 * @param {string} shipsFile - Path to the ships output file
 * @param {number} totalShips - Total number of ships for progress tracking
 * @param {object} counters - Object containing processed/failed counters
 * @returns {Promise<object>} Result object with success status
 */
async function processShip(ship, baseUrl, shipsFile, totalShips, counters) {
  try {
    // Fetch ship details from API
    const result = await fetchShipDetails(baseUrl, ship.id);

    // Create JSONL record and append to file
    const jsonLine = createJsonlRecord("ship", result, ship.id);
    fs.appendFileSync(shipsFile, jsonLine);

    // Update counters and log progress
    counters.processed++;
    console.log(
      `✓ Ship ${ship.id} (${counters.processed}/${totalShips})`
    );

    return { success: true, shipId: ship.id };
  } catch (error) {
    // Log error and update failed counter
    counters.failed++;
    console.error(
      `✗ Failed to fetch ship ${ship.id}: ${error.message}`
    );

    return {
      success: false,
      shipId: ship.id,
      error: error.message,
    };
  }
}

/**
 * Processes all ships in parallel batches.
 * @param {Array<object>} ships - Array of ship objects to process
 * @param {string} baseUrl - Base URL for the Ody API
 * @param {string} shipsFile - Path to the ships output file
 * @param {number} maxThreads - Maximum concurrent requests
 * @returns {Promise<object>} Object with processed and failed counts
 */
async function processShipsInBatches(ships, baseUrl, shipsFile, maxThreads) {
  const counters = { processed: 0, failed: 0 };
  const startTime = Date.now();

  logSection(`Processing ${ships.length} ships with ${maxThreads} parallel threads...`);

  // Process ships in batches for controlled concurrency
  for (let i = 0; i < ships.length; i += maxThreads) {
    const batch = ships.slice(i, i + maxThreads);

    // Create promises for all ships in this batch
    const promises = batch.map((ship) =>
      processShip(ship, baseUrl, shipsFile, ships.length, counters)
    );

    // Wait for all ships in batch to complete before moving to next batch
    await Promise.all(promises);
  }

  const elapsedTime = Date.now() - startTime;

  return {
    processed: counters.processed,
    failed: counters.failed,
    elapsedTime,
  };
}

/**
 * Displays the final summary report.
 * @param {object} results - Results object with statistics
 * @param {number} totalShips - Total number of ships
 * @param {string} shipsFile - Path to the ships output file
 */
function displaySummary(results, totalShips, shipsFile) {
  const completionRate = ((results.processed / totalShips) * 100).toFixed(1);

  logHeader("SCRAPING COMPLETED");
  console.log(`Total ships:            ${totalShips}`);
  console.log(`Successfully processed: ${results.processed} (${completionRate}%)`);
  console.log(`Failed:                 ${results.failed}`);
  console.log(`Time elapsed:           ${formatElapsedTime(results.elapsedTime)}`);
  console.log(`Output file:            ${shipsFile}`);
  console.log("=".repeat(60) + "\n");

  // Warn if there were failures
  if (results.failed > 0) {
    console.warn(
      `⚠️  ${results.failed} ship(s) failed to process. ` +
      `Check the logs above for details.`
    );
  }
}

// ========================================
// MAIN EXECUTION
// ========================================

/**
 * Main scraping workflow.
 * Orchestrates the entire ship data extraction process.
 */
async function main() {
  // Validate environment before starting
  validateEnvironment();

  // Setup file paths
  const outputDir = path.resolve(process.cwd(), OUTPUT_DIR_NAME);
  const masterFile = path.join(outputDir, MASTER_FILE_NAME);
  const shipsFile = path.join(outputDir, SHIPS_FILE_NAME);

  // Ensure output directory exists
  ensureOutputDirectory(outputDir);

  // Get configuration
  const baseUrl = process.env.OD_BASE_URL;
  const maxThreads = parseInt(process.env.SCRAPERAPI_MAX_THREADS) || DEFAULT_MAX_THREADS;

  logHeader("CRUISE SHIPS DATA EXTRACTOR");
  console.log(`Configuration:`);
  console.log(`  Base URL:       ${baseUrl}`);
  console.log(`  Max Threads:    ${maxThreads}`);
  console.log(`  Output Dir:     ${outputDir}`);

  // Step 1: Fetch and save master data
  logSection("Step 1: Fetching Master Data");
  const masterData = await fetchMasterData(baseUrl);
  saveMasterData(masterFile, masterData);

  // Step 2: Clear existing ships file for fresh run
  if (fs.existsSync(shipsFile)) {
    fs.unlinkSync(shipsFile);
    console.log(`🗑️  Cleared existing ships file`);
  }

  // Step 3: Process all ships
  logSection("Step 2: Fetching Ship Details");
  const results = await processShipsInBatches(
    masterData.ship,
    baseUrl,
    shipsFile,
    maxThreads
  );

  // Step 4: Display final summary
  displaySummary(results, masterData.ship.length, shipsFile);
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
