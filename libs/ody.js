import dotenv from "dotenv";
dotenv.config({ path: "./.env" });
import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

const decryptKey = "KCQZBX";

const cookiesFilePath = path.resolve(
  import.meta.dirname,
  "../.tmp/cookies.json"
);
const scrapeApiUrl = `${process.env.SCRAPEAPI_BASE_URL}/?api_key=${process.env.SCRAPEAPI_KEY}&keep_headers=true&url=`;
const siteitemid = process.env.OD_SYSTEMID;
let cookies = null;

async function getService(url, method = "get", filters = [], decrypt = false) {
  await getCookies();
  const options = {
    method: method,
    headers: getHeaders(),
  };
  if (filters.length > 0) {
    options.body = JSON.stringify({
      filters: filters,
    });
  }
  try {
    // Always use ScraperAPI
    const fullUrl = `${scrapeApiUrl}${url}`;
    const response = await fetch(`${fullUrl}`, options);
    if (decrypt) {
      const text = await response.text();
      return JSON.parse(xor(text).replaceAll("\\\\", "/"));
    }
    const retval = await response.json();

    return retval.data;
  } catch (e) {
    if (e.code === 401) {
      await refreshCookies();
      await getService(url, filters);
    }
  }
}

function getHeaders() {
  return {
    accept: "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9,es;q=0.8",
    "cache-control": "no-cache",
    "Content-Type": "application/json",
    devicetype: "Desktop",
    languageid: "1",
    pragma: "no-cache",
    "sec-ch-ua":
      '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Linux"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    siteitemid: siteitemid,
    Uniquetid: getDesignData(),
    cookie: cookiesToString(),
    Referer: `${process.env.OD_BASE_URL}/swift/cruise`,
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
}

async function getCookies() {
  if (fs.existsSync(cookiesFilePath)) {
    cookies = JSON.parse(fs.readFileSync(cookiesFilePath));
    return;
  } else {
    await refreshCookies();

    // Ensure .tmp directory exists
    const cookiesDir = path.dirname(cookiesFilePath);
    if (!fs.existsSync(cookiesDir)) {
      fs.mkdirSync(cookiesDir, { recursive: true });
    }

    fs.writeFileSync(cookiesFilePath, JSON.stringify(cookies));
  }
}

async function refreshCookies() {
  const browser = await puppeteer.launch({
    headless: process.env.HIDE_PUPPETEER === "true",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });
  const pages = await browser.pages();
  const page = pages[0];

  // Set user agent to avoid detection
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  await page.goto(`${process.env.OD_BASE_URL}/swift/cruise`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  // Wait a bit for any dynamic content
  await new Promise(resolve => setTimeout(resolve, 2000));

  cookies = await page.cookies();
  browser.close();
}

function cookiesToString() {
  //delete cookies["Ody_Session_Token"];
  let retval = "";
  let separator = "";
  for (const cookie of cookies) {
    retval += `${separator}${cookie.name}=${cookie.value}`;
    separator = "; ";
  }
  return retval;
}

function generateRandomString(e) {
  for (
    var t = "",
      n = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
      o = n.length,
      r = 0;
    r < e;
    r++
  )
    t += n.charAt(Math.floor(Math.random() * o));
  return t;
}

function setTextContentData(e) {
  for (var t = e.toString(), n = "", o = 0; o < t.length; o++) {
    var s = parseInt(t[o]),
      r = null;
    o % 2 == 0 ? (r = s + 66) : o % 2 == 1 && (r = s + 67),
      (n += String.fromCharCode(r));
  }
  return n;
}

function getUTCTimeStamp(e) {
  var t = e || 0;
  return (
    (e = new Date()),
    new Date(
      Date.UTC(
        e.getUTCFullYear(),
        e.getUTCMonth(),
        e.getUTCDate(),
        e.getUTCHours(),
        e.getUTCMinutes(),
        e.getUTCSeconds()
      )
    ).getTime() +
      6e4 * t
  );
}

// function getDesignData() {
//   let t = getUTCTimeStamp(0);
//   let e;
//   t =
//     (e = generateRandomString(5)) +
//     (t = setTextContentData(t)).charAt(1) +
//     t +
//     e.charAt(2) +
//     t.charAt(4);
//   return t;
// }
function getDesignData() {
  var e = getUTCTimeStamp(0),
    t =
      (t = generateRandomString(5)) +
      (e = setTextContentData(e)).charAt(1) +
      e +
      t.charAt(2) +
      e.charAt(4);
  return t;
}

function xor(e) {
  const n = [];
  const o = decryptKey;
  for (let r = 0; r < e.length; r++) {
    const s = e.charCodeAt(r) ^ o[r % o.length].charCodeAt(0);
    n.push(String.fromCharCode(s));
  }
  return n.join("");
}

export { getService };
