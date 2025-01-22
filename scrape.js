const puppeteer = require('puppeteer');

// Manual delay function
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


const axios = require('axios');

// Airtable Configuration - hard-coded
// const AIRTABLE_API_KEY = 'pat1bIvxnXGC6lAPc.106a1e7792fd4c5d734b7f4e85eee19520ea1761b369d8c9c3851f06b97fac4a'; // Replace with your Airtable API key
// const AIRTABLE_BASE_URL = 'https://api.airtable.com/v0/appgwx5uo7S18ZdUP/Workflows%20Table%2001'; // Replace with your API URL

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY; // Access from Vercel environment variables
const AIRTABLE_BASE_URL = process.env.AIRTABLE_BASE_URL; // Access from Vercel environment variables

// Function to Send Data to Airtable
async function sendToAirtable(workflows) {
  try {
    for (const workflow of workflows) {
      const airtableRecord = {
        fields: {
          Title: workflow.title,
          Link: workflow.link,
          Apps: workflow.apps.join(', '), // Join apps into a single string
          Categories: workflow.categories.join(', ') // Join categories into a single string
        },
      };

      const response = await axios.post(AIRTABLE_BASE_URL, airtableRecord, {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      console.log(`Added to Airtable: ${workflow.title}`);
    }
  } catch (error) {
    console.error('Error adding to Airtable:', error.response?.data || error.message);
  }
}


(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        // Navigate to the AI workflows page
        console.log("Navigating to AI workflows page...");
        await page.goto('https://n8n.io/workflows/categories/ai/?sort=views:desc', { waitUntil: 'networkidle2' });

        // Load all workflows by clicking the "Load More" button
        // let loadMoreButton = await page.$('.load-more-link');
        // while (loadMoreButton) {
        //   console.log("Clicking 'Load More'...");
        //   await Promise.all([
        //     page.click('.load-more-link'), // Click the button
        //     delay(1000), // Wait for 1 second
        //   ]);

        //   // Check if the button still exists
        //   loadMoreButton = await page.$('.load-more-link');
        // }


        // Click "Load More" Button Once
        // let loadMoreButton = await page.$('.load-more-link');
        // if (loadMoreButton) {
        //     console.log("Clicking 'Load More' once...");
        //     await Promise.all([
        //         page.click('.load-more-link'),
        //         delay(1000), // Wait for 1 second
        //     ]);
        // }

        // Scrape all workflow titles
        console.log("Scraping workflow parameters...");
        const workflows = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.title_pb8BH')).map((titleElement) => {
                const title = titleElement.innerText.trim(); // Extract title
                const link = titleElement.closest('a')?.href || null; // Extract link from parent <a> tag

                // Extract app alt text (from <img> tags)
                const appAltTexts = Array.from(
                    titleElement.closest('.container_JKBah').querySelectorAll('img[alt]')
                ).map((img) => img.alt.trim().replace(/ node$/i, '')); // Remove "node" from the end (case-insensitive)

                return { title, link, apps: appAltTexts };
            });
        });

        // Iterate through each workflow to scrape category tags
        for (const workflow of workflows) {
            if (workflow.link) {
                console.log(`Navigating to workflow page: ${workflow.link}`);
                await page.goto(workflow.link, { waitUntil: 'networkidle2' });

                // Scrape category tags
                workflow.categories = await page.evaluate(() => {
                    return Array.from(document.querySelectorAll('.category-badge_G-I\\+G')).map((tag) => tag.innerText.trim());
                });

                console.log(`Scraped categories for "${workflow.title}":`, workflow.categories);
            } else {
                workflow.categories = []; // If no link, set categories to an empty array
            }
        }

        // Log the titles
        console.log("Scraped Workflows:", workflows);

        // Send to Airtable
        await sendToAirtable(workflows);

        await browser.close();
    } catch (error) {
        console.error("Error scraping workflows:", error);
    }
})();