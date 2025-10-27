import dotenv from "dotenv";
dotenv.config({ path: "./.env" });
import { getService } from "./libs/ody.js";
import fs from "fs";
import path from "path";

async function work() {
  const outputDir = path.resolve(process.cwd(), "output");
  const masterFile = path.join(outputDir, "master.jsonl");
  const shipsFile = path.join(outputDir, "ships.jsonl");

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Fetch master data
  console.log("Fetching master data from Odysseus API...");
  const mastersUrl = `${process.env.OD_BASE_URL}/nitroapi/v2/master/allswift?requestSource=1`;
  const masterResult = await getService(mastersUrl);

  // Save master data as JSONL
  const masterJsonLine = JSON.stringify({
    timestamp: new Date().toISOString(),
    source: "ody",
    type: "master",
    data: masterResult
  }) + "\n";

  fs.writeFileSync(masterFile, masterJsonLine);
  console.log(`Master data saved to ${masterFile}`);
  console.log(`Total ships in master list: ${masterResult?.ship?.length || 0}`);

  const master = masterResult;

  if (!master.ship || master.ship.length === 0) {
    console.error("No ships found in master data.");
    process.exit(1);
  }

  // Clear existing ships file
  if (fs.existsSync(shipsFile)) {
    fs.unlinkSync(shipsFile);
  }

  console.log(`\nFetching details for ${master.ship.length} ships...`);

  const maxThreads = parseInt(process.env.SCRAPERAPI_MAX_THREADS) || 5;
  console.log(`Using ${maxThreads} parallel threads\n`);

  // Process ships in parallel batches
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < master.ship.length; i += maxThreads) {
    const batch = master.ship.slice(i, i + maxThreads);

    const promises = batch.map(async (ship) => {
      try {
        const url = `${process.env.OD_BASE_URL}/nitroapi/v2/ship/GetDetails/${ship.id}?requestSource=1`;
        const result = await getService(url, "get", [], true);

        // Append ship data to JSONL file
        const jsonLine = JSON.stringify({
          timestamp: new Date().toISOString(),
          source: "ody",
          type: "ship",
          shipId: ship.id,
          data: result
        }) + "\n";

        fs.appendFileSync(shipsFile, jsonLine);
        processed++;
        console.log(`✓ Ship ${ship.id} (${processed}/${master.ship.length})`);
        return { success: true, shipId: ship.id };
      } catch (error) {
        failed++;
        console.error(`✗ Failed to fetch ship ${ship.id}: ${error.message}`);
        return { success: false, shipId: ship.id, error: error.message };
      }
    });

    await Promise.all(promises);
  }

  console.log(`\n========================================`);
  console.log(`Completed!`);
  console.log(`Total ships: ${master.ship.length}`);
  console.log(`Successfully processed: ${processed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Ship data saved to ${shipsFile}`);
  console.log(`========================================`);
}

(async () => {
  try {
    await work();
    process.exit(0);
  } catch (e) {
    console.error("Error:", e);
    process.exit(1);
  }
})();
