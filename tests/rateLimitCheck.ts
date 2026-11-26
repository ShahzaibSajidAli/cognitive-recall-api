const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';

async function checkRoute(label: string, url: string, requestCount = 6) {
    console.log(label);
    for (let requestNumber = 1; requestNumber <= requestCount; requestNumber++) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'load-test@example.com', password: 'invalid-password' })
        });
        console.log(`request ${requestNumber}: ${response.status}`);
    }
}

await checkRoute('Direct login:', `${baseUrl}/trpc/login`);
await checkRoute(
    'Batched refresh/logout (crosses 30/min limit):',
    `${baseUrl}/trpc/refresh,logout?batch=1`,
    31
);
