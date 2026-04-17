const urllib = require('urllib');
const cheerio = require('cheerio');
(async () => {
    const { data } = await urllib.request('https://html.duckduckgo.com/html/?q=site:github.com+"oauth2/api" OR "api.wyze.com" OR "api.wyzecam.com"', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const $ = cheerio.load(data.toString());
    $('.result__snippet').each((i, el) => console.log($(el).text()));
})();
