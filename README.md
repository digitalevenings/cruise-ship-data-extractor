# Cruise Ships Data Extractor

A Node.js scraper that extracts comprehensive cruise ship data from the Ody cruise booking platform. Scrapes detailed ship information for ~1,155 ships across all major cruise lines, including images, amenities, and specifications.

> 💡 **New to web scraping?** This project uses [ScraperAPI](https://www.scraperapi.com/?fp_ref=scrapeall) to handle proxy rotation, CAPTCHAs, and rate limiting. Get **5,000 free API calls** to get started! (Referral link - supports this project 🙏)

## ⚠️ Legal Disclaimer

**This tool is provided for educational and research purposes only.** By using this scraper, you acknowledge and agree to:

- ✅ Comply with target website's Terms of Service and robots.txt
- ✅ Use reasonable rate limiting to avoid impacting servers
- ✅ Not use scraped data for commercial purposes without explicit permission from the content owner
- ✅ Take full responsibility for your use of this tool and any consequences

**Important:** Web scraping may violate website terms of service and applicable laws depending on your jurisdiction and use case. Users are **solely responsible** for ensuring their use complies with all applicable laws, regulations, and website policies. The authors of this tool assume **no liability** for any misuse, legal issues, or damages arising from the use of this software.

**For responsible use:** Always respect website owners' rights, use appropriate rate limiting, and consider reaching out to websites for official API access when available.

## Features

- ✅ Scrapes master list of all ships from Ody API
- ✅ Retrieves detailed information for each ship (images, amenities, descriptions)
- ✅ Downloads ship gallery images automatically
- ✅ Outputs data in **JSONL** (JSON Lines) format
- ✅ Parallel processing with configurable concurrency
- ✅ Automatic cookie management using Puppeteer
- ✅ Resume capability - skips already downloaded media
- ✅ Uses ScraperAPI for reliable data extraction
- ✅ Comprehensive error handling and progress tracking
- ✅ Rate limiting protection with configurable threads

## Prerequisites

- Node.js (v18 or higher recommended)
- A [ScraperAPI](https://www.scraperapi.com/?fp_ref=scrapeall) account (free tier works - 5,000 API calls/month)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd cruise-ships-data-extractor
```

2. Install dependencies:
```bash
npm install
```

3. Configure your environment:
```bash
cp .env.example .env
```

4. Edit `.env` and add your ScraperAPI key:
```bash
# Required: Your ScraperAPI key
SCRAPEAPI_KEY=your_api_key_here

# API Configuration
SCRAPEAPI_BASE_URL=http://api.scraperapi.com
OD_BASE_URL=https://book.cruisedirect.com
OD_SYSTEMID=41152

# Concurrency Settings
SCRAPERAPI_MAX_THREADS=5      # Concurrent ship data requests (1-10 recommended)
MEDIA_MAX_THREADS=10           # Concurrent image downloads (5-20 recommended)

# Puppeteer Settings
HIDE_PUPPETEER=true            # Run browser in headless mode
```

**Note:** ScraperAPI is **required** for ship data scraping. Sign up at [scraperapi.com](https://www.scraperapi.com/?fp_ref=scrapeall) to get your free API key.

## Usage

### Basic Commands

**Scrape ship data:**
```bash
npm start
# or
npm run get-ships
```

This will:
1. Fetch the master list of all ships → `output/master.jsonl`
2. Fetch detailed information for each ship → `output/ships.jsonl`

**Download ship images:**
```bash
npm run download-media
```

This will:
1. Read all ships from `output/ships.jsonl`
2. Extract image URLs from each ship
3. Download images to `output/media/{shipId}/`
4. Skip images that have already been downloaded

### Recommended Workflow

```bash
# 1. Scrape all ship data
npm run get-ships

# 2. Download all ship images (optional)
npm run download-media
```

### Responsible Scraping

Please use this tool ethically and responsibly:

**✅ DO:**
- Use for personal research and educational purposes
- Respect rate limits (configure `SCRAPERAPI_MAX_THREADS`)
- Start with conservative settings (5 threads or less)
- Monitor your ScraperAPI usage to avoid exceeding quotas
- Consider the impact on target servers

**❌ DON'T:**
- Use for commercial purposes without explicit permission
- Overload servers with aggressive scraping
- Ignore rate limit errors (429 responses)
- Republish or sell scraped content
- Bypass access controls or authentication

**Best Practices:**
- Keep concurrent workers moderate (`SCRAPERAPI_MAX_THREADS=5`)
- Run during off-peak hours when scraping large datasets
- If you need large-scale access, contact the website owner for official API access or permission

## Output

### Files Generated

```
output/
├── master.jsonl              # Master list of all ships
├── ships.jsonl               # Detailed ship data (one ship per line)
└── media/                    # Downloaded images (if downloaded)
    ├── 1/                    # Ship ID 1 images
    │   ├── image1.jpg
    │   └── image2.jpg
    ├── 2/                    # Ship ID 2 images
    └── ...
```

### Output Format

**master.jsonl** (one JSON object):
```json
{"timestamp":"2025-10-26T23:17:41.131Z","source":"ody","type":"master","data":{"cruiseline":[...],"ship":[...]}}
```

**ships.jsonl** (one JSON object per line):
```json
{"timestamp":"2025-10-26T23:27:22.677Z","source":"ody","type":"ship","shipId":1,"data":{"id":1,"name":"Carnival Conquest","images":[...],"contentInfo":{...}}}
{"timestamp":"2025-10-26T23:27:25.123Z","source":"ody","type":"ship","shipId":2,"data":{...}}
```

### Data Structure

Each ship record in `ships.jsonl` contains:

- `timestamp` - ISO timestamp of when data was scraped
- `source` - Data source identifier ("ody")
- `type` - Record type ("ship")
- `shipId` - Unique ship identifier
- `data` - Complete ship data including:
  - `id` - Ship ID
  - `name` - Ship name
  - `contentInfo` - Ship descriptions (short and long)
  - `images[]` - Array of image objects with paths and metadata
  - Additional ship specifications and amenities

## Configuration

### Concurrency Settings

**Ship Data Scraping:**
- Adjust `SCRAPERAPI_MAX_THREADS` to control parallel requests (1-10 recommended)
- Higher threads = faster scraping but more API usage
- Lower threads = slower but more stable, less likely to hit rate limits
- Default: 5 threads

**Media Downloads:**
- Adjust `MEDIA_MAX_THREADS` to control concurrent downloads (5-20 recommended)
- Default: 10 threads - balances speed and stability
- Does NOT use ScraperAPI (direct downloads from source)

**Recommended Settings:**

Conservative (avoid rate limits):
```bash
SCRAPERAPI_MAX_THREADS=3
MEDIA_MAX_THREADS=5
```

Balanced (default):
```bash
SCRAPERAPI_MAX_THREADS=5
MEDIA_MAX_THREADS=10
```

Aggressive (faster, uses more API calls):
```bash
SCRAPERAPI_MAX_THREADS=10
MEDIA_MAX_THREADS=20
```

## Architecture

```
cruise-ships-data-extractor/
├── libs/
│   └── ody.js                # Ody API service module
├── output/                   # Output directory (auto-created)
│   ├── master.jsonl          # Master ship list
│   ├── ships.jsonl           # Detailed ship data
│   └── media/                # Downloaded images
├── .tmp/                     # Temporary files (auto-created)
│   └── cookies.json          # Cached session cookies
├── get-ships.js              # Main scraper script
├── download-media.js         # Media downloader script
├── package.json              # Dependencies and scripts
├── .env                      # Your configuration (create from .env.example)
└── .env.example              # Configuration template
```

## How It Works

1. **Cookie Management** - Uses Puppeteer to automatically retrieve and cache session cookies from the Ody website
2. **ScraperAPI Integration** - All API requests are routed through ScraperAPI for reliability and to avoid rate limiting
3. **Data Fetching** - Makes authenticated requests to the Ody API to fetch ship data
4. **Data Decryption** - Some API responses are XOR-encrypted and are automatically decrypted
5. **Parallel Processing** - Processes multiple ships concurrently based on `SCRAPERAPI_MAX_THREADS` setting
6. **Image Downloads** - Downloads ship gallery images directly (without ScraperAPI) and organizes by ship ID

## Troubleshooting

**Scraper hanging or slow?**
- Check your ScraperAPI quota at https://dashboard.scraperapi.com
- Reduce `SCRAPERAPI_MAX_THREADS` if you're on a free plan
- Ensure `.tmp` directory can be created (script creates it automatically)

**Getting errors?**
- Verify your ScraperAPI key is valid in `.env`
- Check that all required environment variables are set
- Failed ships are logged but don't stop the entire process

## License

ISC

## Support This Project

If you find this scraper useful and are using it responsibly, please consider:

- ⭐ **Star this repository** to help others discover it
- 🔗 **Use our [ScraperAPI referral link](https://www.scraperapi.com/?fp_ref=scrapeall)** when signing up (helps maintain this project)
- 🐛 **Report issues** or contribute improvements via pull requests
- 📖 **Share knowledge** about ethical web scraping practices

**Note:** This tool is intended for educational purposes. Please use it responsibly and respect website owners' rights.

## Credits

Built with [ScraperAPI](https://www.scraperapi.com/?fp_ref=scrapeall) for reliable web scraping with automatic proxy rotation and CAPTCHA handling.
