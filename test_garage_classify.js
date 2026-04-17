// Test: Validate garage camera dual-listing classification logic
// Cameras with dongle_product_model === 'HL_CGDC' should appear in BOTH Camera and Garage categories.

const https = require('https');
const crypto = require('crypto');

const EMAIL = process.env.WYZE_EMAIL;
const PASSWORD = process.env.WYZE_PASSWORD;
const API_KEY = process.env.WYZE_API_KEY;
const KEY_ID = process.env.WYZE_KEY_ID;

function md5(s) { return crypto.createHash('md5').update(s).digest('hex'); }

function post(hostname, path, body, headers) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname, port: 443, path, method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }, headers || {})
    };
    const req = https.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const PRODUCT_TYPE_MAP = {
  'MeshLight': { index: 0, name: 'Light' },
  'Light':     { index: 0, name: 'Light' },
  'Plug':      { index: 1, name: 'Plug' },
  'OutdoorPlug': { index: 1, name: 'Plug' },
  'Switch':    { index: 2, name: 'Switch' },
  'Camera':    { index: 3, name: 'Camera' },
  'Lock':      { index: 4, name: 'Lock' },
  'GarageDoor': { index: 5, name: 'Garage' },
  'WyzeScale': { index: 6, name: 'Scale' }
};

(async () => {
  // Authenticate
  const authRes = await post('auth-prod.api.wyze.com', '/api/user/login', {
    email: EMAIL, password: md5(md5(md5(PASSWORD))), nonce: String(Date.now())
  }, {
    'x-api-key': 'RckMFKbsds5p6QY3COEXc2ABwNTYY0q18ziEiSEm',
    'apikey': API_KEY, 'keyid': KEY_ID, 'User-Agent': 'wyze_android_2.49.0'
  });
  const token = authRes.access_token || (authRes.data && authRes.data.access_token);
  if (!token) { console.error('Auth failed:', JSON.stringify(authRes).substring(0, 200)); process.exit(1); }
  console.log('Authenticated.\n');

  // Fetch devices
  const devRes = await post('api.wyzecam.com', '/app/v2/home_page/get_object_list', {
    access_token: token, app_name: 'com.hualai', app_ver: 'com.hualai___2.19.14',
    app_version: '2.19.14', phone_id: 'wyze_developer_api', phone_system_type: '2',
    sc: 'a626948714654991afd3c0dbd7cdb901', ts: Date.now(),
    sv: 'c417b62d72ee44bf933054bdca183e77'
  });
  const devices = (devRes.data && devRes.data.device_list) || [];
  console.log(`Found ${devices.length} devices.\n`);

  // Classify with proposed logic
  const classified = [];
  for (const dev of devices) {
    const pt = dev.product_type || '';
    const mapped = PRODUCT_TYPE_MAP[pt] || { index: 99, name: pt || 'Other' };
    const dp = dev.device_params || {};
    const hasGarage = (dp.dongle_product_model === 'HL_CGDC') ? 1 : 0;
    classified.push({
      name: dev.nickname || 'Wyze Device',
      mac: dev.mac,
      productType: pt,
      model: dev.product_model,
      typeIndex: mapped.index,
      typeName: mapped.name,
      hasGarage: hasGarage,
      dongleModel: dp.dongle_product_model || '(none)'
    });
  }

  // Print classification
  console.log('=== All Devices ===');
  for (const d of classified) {
    console.log(`  ${d.name} | type=${d.typeName}(${d.typeIndex}) | hasGarage=${d.hasGarage} | dongle=${d.dongleModel}`);
  }

  // Show category assignments
  const categories = {
    'Lights (0)': classified.filter(d => d.typeIndex === 0),
    'Plugs (1)': classified.filter(d => d.typeIndex === 1),
    'Switches (2)': classified.filter(d => d.typeIndex === 2),
    'Cameras (3)': classified.filter(d => d.typeIndex === 3),
    'Locks (4)': classified.filter(d => d.typeIndex === 4),
    'Garage Doors (5)': classified.filter(d => d.typeIndex === 5 || d.hasGarage === 1),
    'Scales (6)': classified.filter(d => d.typeIndex === 6),
    'Others (99)': classified.filter(d => d.typeIndex >= 99),
  };

  console.log('\n=== Category Listings ===');
  for (const [cat, devs] of Object.entries(categories)) {
    console.log(`\n${cat}: (${devs.length} devices)`);
    for (const d of devs) {
      const note = d.hasGarage ? ' *** DUAL-LISTED (Camera+Garage) ***' : '';
      console.log(`  - ${d.name} (${d.model})${note}`);
    }
  }

  // Validation
  console.log('\n=== Validation ===');
  const garageCams = classified.filter(d => d.hasGarage === 1);
  const cameraCat = classified.filter(d => d.typeIndex === 3);
  const garageCat = classified.filter(d => d.typeIndex === 5 || d.hasGarage === 1);

  // Check: garage cams must be in Camera category (typeIndex=3)
  const garageInCamera = garageCams.every(d => d.typeIndex === 3);
  console.log(`[${garageInCamera ? 'PASS' : 'FAIL'}] All garage cams in Camera category: ${garageCams.map(d=>d.name).join(', ') || '(none)'}`);

  // Check: garage cams must also appear in Garage category
  const garageInGarage = garageCams.every(d => garageCat.some(g => g.mac === d.mac));
  console.log(`[${garageInGarage ? 'PASS' : 'FAIL'}] All garage cams in Garage category too`);

  // Check: no false positives (non-garage cameras should NOT be in Garage)
  const falsePositives = cameraCat.filter(d => d.hasGarage === 0 && garageCat.some(g => g.mac === d.mac));
  console.log(`[${falsePositives.length === 0 ? 'PASS' : 'FAIL'}] No false positives in Garage category: ${falsePositives.length} found`);

  console.log(`\nSummary: ${garageCams.length} garage cam(s) detected, ${cameraCat.length} total cameras, ${garageCat.length} in garage category`);
})();
