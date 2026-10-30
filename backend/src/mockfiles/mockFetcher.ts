const headers = { 
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...", 
  "Accept-Language": "en-US,en;q=0.9" 
};

try {
  const response = await globalThis.fetch('http://httpbin.org', { headers });
  const data = await response.text(); // Automatically stitches the data
  console.log(data);
} catch (error) {
  console.error('Error:', error);
}
