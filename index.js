const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const url = require("url");

const baseURL = "https://docs.buildship.com";
const matchPattern = new RegExp("^https://docs.buildship.com(/[^#?]*)?$");
const selector = "article.nextra-content";
const maxPagesToCrawl = 1000;
const outputFileName = "output.json";

let crawledPages = 0;
let results = [];
let visitedUrls = new Set();

async function fetchAndParse(pageUrl) {
  try {
    console.log(`Fetching ${pageUrl}`);
    const response = await axios.get(pageUrl);
    return cheerio.load(response.data);
  } catch (error) {
    console.error(`Error fetching ${pageUrl}:`, error.message);
    return null;
  }
}

async function crawl(pageUrl) {
  if (crawledPages >= maxPagesToCrawl || visitedUrls.has(pageUrl)) return;
  if (!matchPattern.test(pageUrl)) return;

  visitedUrls.add(pageUrl);

  const $ = await fetchAndParse(pageUrl);
  if (!$) return;

  // Temporarily remove script tags to avoid extracting JavaScript
  $("script").remove();

  const title = $("title").first().text();
  const text = $(selector).text();
  results.push({ title, url: pageUrl, html: text });
  crawledPages++;

  const crawlPromises = [];
  $("a").each((i, element) => {
    const relativeLink = $(element).attr("href");
    if (relativeLink) {
      const absoluteLink = url.resolve(pageUrl, relativeLink);
      if (
        matchPattern.test(absoluteLink) &&
        crawledPages < maxPagesToCrawl &&
        !visitedUrls.has(absoluteLink)
      ) {
        crawlPromises.push(crawl(absoluteLink));
      }
    }
  });

  await Promise.all(crawlPromises);
}

async function start() {
  await crawl(baseURL);
  fs.writeFileSync(outputFileName, JSON.stringify(results, null, 2));
  console.log("Crawl completed.");
}

start();
