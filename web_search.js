const urllib = require('urllib');
(async () => {
    const { data, res } = await urllib.request('https://api.github.com/search/code?q="openapi/device/list"+wyze', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        dataType: 'json'
    });
    if(data.items && data.items.length) {
        console.log(data.items[0].html_url);
    } else {
        console.log("No items", data);
    }
})();
