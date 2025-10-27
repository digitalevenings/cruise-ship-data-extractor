# Cruise Ships Data Extractor

A Node.js scraper for extracting ship data from the Odysseus cruise website API.

## Features

- Fetches master list of all ships from Odysseus API
- Retrieves detailed information for each ship
- Outputs data in JSONL (JSON Lines) format
- Supports ScraperAPI integration for proxy usage
- Automatic cookie management using Puppeteer

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

## Installation

1. Clone the repository and navigate to the project directory:
```bash
cd cruise-ships-data-extractor
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

4. Edit the `.env` file with your configuration:
```
OD_BASE_URL=https://your-odysseus-url.com
OD_SYSTEMID=your-system-id
SCRAPEAPI_BASE_URL=http://api.scraperapi.com
SCRAPEAPI_KEY=your-scraper-api-key
SCRAPERAPI_MAX_THREADS=5
MEDIA_MAX_THREADS=10
HIDE_PUPPETEER=true
```

**Note:** ScraperAPI is required for ship data scraping. Get your API key at [scraperapi.com](https://www.scraperapi.com/)

## Usage

### Step 1: Scrape Ship Data

Run the scraper to fetch both master list and ship details:

```bash
npm start
```

Or:

```bash
npm run get-ships
```

This will:
1. Fetch the master list of all ships and save to `output/master.jsonl`
2. Fetch detailed information for each ship and save to `output/ships.jsonl`

### Step 2: Download Media (Optional)

After scraping ship data, download all images:

```bash
npm run download-media
```

This will:
1. Read all ships from `output/ships.jsonl`
2. Extract image URLs from each ship
3. Download images to `output/media/{shipId}/`
4. Skip images that have already been downloaded

## Output Format

All data is saved in JSONL (JSON Lines) format in the `output/` directory.

### master.jsonl
```json
{"timestamp":"2025-01-26T10:00:00.000Z","source":"ody","type":"master","data":{...}}
```

### ships.jsonl
```json
{"timestamp":"2025-01-26T10:01:00.000Z","source":"ody","type":"ship","shipId":123,"data":{...}}
{"timestamp":"2025-01-26T10:02:00.000Z","source":"ody","type":"ship","shipId":124,"data":{...}}
```

## Project Structure

```
cruise-ships-data-extractor/
├── libs/
│   └── ody.js           # Odysseus API service module
├── output/              # Output directory for JSONL files and media
│   ├── master.jsonl     # Master ship list
│   ├── ships.jsonl      # Detailed ship data
│   └── media/           # Downloaded images organized by ship ID
├── .tmp/                # Temporary files (cookies, etc.)
├── get-ships.js         # Main scraper script (fetches master + ship details)
├── download-media.js    # Media downloader script
├── package.json         # Project dependencies and scripts
├── .env                 # Environment configuration (not in git)
├── .env.example         # Environment configuration template
└── README.md            # This file
```

## How It Works

1. **Cookie Management**: The scraper uses Puppeteer to automatically retrieve and manage session cookies from the Odysseus website
2. **ScraperAPI Integration**: All API requests are routed through ScraperAPI for reliability and to avoid rate limiting
3. **API Calls**: Uses the `getService` function to make authenticated requests to the Odysseus API
4. **Data Decryption**: Some API responses are XOR-encrypted and are automatically decrypted
5. **Parallel Processing**: Processes multiple ships concurrently based on `SCRAPERAPI_MAX_THREADS` setting (default: 5)

## Performance & Configuration

### Ship Data Scraping
- **Parallel Processing**: Adjust `SCRAPERAPI_MAX_THREADS` to control concurrency (1-10 recommended)
- **Higher threads** = faster scraping but more resource usage
- **Lower threads** = slower but more stable, less likely to hit rate limits

### Media Downloads
- **Parallel Downloads**: Adjust `MEDIA_MAX_THREADS` to control concurrent downloads (1-20 recommended)
- **Default: 10 threads** - balances speed and stability
- **Does NOT use ScraperAPI** - direct downloads from the source

## Notes

- **ScraperAPI is required** for the ship data scraping script (get-ships.js)
- Media downloads do NOT use ScraperAPI (direct downloads)
- Failed requests for individual ships are logged but don't stop the entire process
- Cookie files are cached in `.tmp/cookies.json` to avoid unnecessary browser launches
- Each run clears the previous ships.jsonl file
- Progress is shown in real-time with ✓/✗ indicators

## License

ISC
