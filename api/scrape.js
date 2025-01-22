const chromium = require("chrome-aws-lambda");
const axios = require("axios");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_URL = process.env.AIRTABLE_BASE_URL;

// Function to send data to Airtable
async function sendToAirtable(workflows) {
  try {
    for (const workflow of workflows) {
      const airtableRecord = {
        fields: {
          Title: workflow.title,
          Link: workflow.link,
          Apps: workflow.apps.join(", "),
          Categories: workflow.categories.join(", "),
        },
      };

      await axios.post(AIRTABLE_BASE_URL, airtableRecord, {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
      });
      console.log(`Added to Airtable: ${workflow.title}`);
    }
  } catch (error) {
    console.error(
      "Error adding to Airtable:",
      error.response?.data || error.message
    );
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let browser;

  try {
    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    console.log("Navigating to AI workflows page...");
    await page.goto("https://n8n.io/workflows/categories/ai/?sort=views:desc", {
      waitUntil: "networkidle2",
    });

    console.log("Scraping workflow parameters...");
    const workflows = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll(".title_pb8BH")
      ).map((titleElement) => {
        const title = titleElement.innerText.trim();
        const link = titleElement.closest("a")?.href || null;

        const appAltTexts = Array.from(
          titleElement
            .closest(".container_JKBah")
            .querySelectorAll("img[alt]")
        ).map((img) =>
          img.alt.trim().replace(/ node$/i, "")
        );

        return { title, link, apps: appAltTexts };
      });
    });

    for (const workflow of workflows) {
      if (workflow.link) {
        console.log(`Navigating to workflow page: ${workflow.link}`);
        await page.goto(workflow.link, { waitUntil: "networkidle2" });

        workflow.categories = await page.evaluate(() =>
          Array.from(
            document.querySelectorAll(".category-badge_G-I\\+G")
          ).map((tag) => tag.innerText.trim())
        );
      } else {
        workflow.categories = [];
      }
    }

    console.log("Scraped Workflows:", workflows);

    await sendToAirtable(workflows);

    res.status(200).json({ message: "Workflows scraped successfully." });
  } catch (error) {
    console.error("Error scraping workflows:", error);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

// Sanity test

// module.exports = async (req, res) => {
//   if (req.method !== "POST") {
//     res.status(405).json({ error: "Method not allowed" });
//     return;
//   }

//   try {
//     // Simple sanity response
//     res.status(200).json({ message: "Sanity test passed! The API is working." });
//   } catch (error) {
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// };