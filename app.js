const express = require('express');
const path = require('path');
const cors = require('cors');
const puppeteer = require('puppeteer');
const {writeFile} = require("fs");


/**
 * cheerio did not worked  not sure why ?
 */


/**
 * for analyzing sentiment
 */
const positiveWords = ['good', 'happy', 'great', 'positive', 'excellent', 'radiant', 'vibrant', 'joyful'];
const negativeWords = ['bad', 'sad', 'negative', 'poor', 'terrible'];
let positiveCount = 0;
let negativeCount = 0;



const app = express();
/**
 * for cors error
 */
app.use(cors());

/**
 * serve static files
 */
app.use(express.static(path.join(__dirname, 'public'))); //http://localhost:3001/index.html

/**
 * for parsing json
 */
app.use(express.json());



function analyzeSentiment(text) {
    /**
     * lowercase and split by space
     * @type {string[]} regex
     */
    const words = text.toLowerCase().split(/\s+/);

    words.forEach((word) => {
        if (positiveWords.includes(word)) positiveCount++;
        if (negativeWords.includes(word)) negativeCount++;
    });

    if (positiveCount > negativeCount) return 'Positive';
    if (negativeCount > positiveCount) return 'Negative';
    return 'Neutral';
}



app.post('/scrape', async (req, res) => {
    /**
     * @type {string} url
     */
    const url = req.body.url;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        /**
         * @type {Browser}
         */
        const browser = await puppeteer.launch({
            headless: "new"
        });
        const page = await browser.newPage();
        await page.goto(url);
        const content = await page.content();

        const articles = await page.$$eval('#__next > main> div > div > div ', (elements) => {
            return elements.map((element, index) => {
                /**
                 * why is divs first time not working ??
                 */
                // const divs = element.querySelectorAll('#__next > main > div > div > div.ws3e0139.ws995ed2.wsff4a00.wsfcb598.ws3e246b.wsee0cc0.wsb442ce.ws52d3f9.ws4225c9.wse569e7 > div ');
                const divs = element.querySelectorAll('#__next > main > div > div > div > div ');
                const links = document.querySelectorAll('#__next > main > div > div > div > div > a');
                const allTimeElements = document.querySelectorAll('#__next > main > div > div > div > div > div > div > time');
                // FIXME aduce mai mult
                const allCategories = document.querySelectorAll('#__next > main > div > div > div > div > div > div > div');
                const allAuthors = document.querySelectorAll('#__next > main > div > div > div > div > div > div > div > div');

                let times = [];
                let hrefs = [];
                let categories = [];
                let authors = [];
                links.forEach(link => {
                    hrefs.push(link.href);
                });
                allTimeElements.forEach((el) => {
                    times.push(el.textContent);
                });

                allCategories.forEach((el) => {
                    categories.push(el.textContent);
                });

                 allAuthors.forEach((el) => {
                    authors.push(el.textContent);
                });


                const contents = Array.from(divs).map(div => div.textContent.trim());

                return {
                    contents, hrefs, times, categories, authors
                };
            });
        });

        /**
         *
         * @type {Date}
         */
        const currentDateAndTime = new Date();
        const formattedTime = currentDateAndTime.toLocaleTimeString();


        const sentiment = analyzeSentiment(`${articles.map(article =>{
            return article.contents
        }).join(' ')}`);

        const articlesWithTime = articles.map(article => {
            /**
             * .. spread operator - copy all properties from article and the rest
             */
            return {
                ...article,
                timestamp: formattedTime,
                positiveCount,
                negativeCount
            };
        });


        writeFile('articles.json', JSON.stringify(articlesWithTime), (err) => {
            if (err) throw err;
            console.log('File saved');
        });

        /**
         * why close() error ??
         */
        // await browser.close();
        return res.json({data: articles ,sentiment, positiveCount, negativeCount });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: 'Failed to scrape', details: error.message });
    }
});

// initial
// #__next > main > div > div > div.ws3e0139.ws995ed2.wsff4a00.wsfcb598.ws3e246b.wsee0cc0.wsb442ce.ws52d3f9.ws4225c9.wse569e7 > div:nth-child(2) > a

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
