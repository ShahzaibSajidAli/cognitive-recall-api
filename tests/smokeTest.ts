import http from 'k6/http';
import {check, sleep} from 'k6';

// Load testing may hit the server's global 100 requests/minute limit; raise RATE_LIMIT_MAX in config.
const endpoint = `${__ENV.PUBLIC_IP}/trpc/getTranscript`;
const loginEndpoint = `${__ENV.PUBLIC_IP}/trpc/login`;
const payload = JSON.stringify({
    videoUrl: 'https://www.youtube.com/watch?v=eupwD-6NeB8&list=RDeupwD-6NeB8&start_radio=1',
    language: 'en'
});

export const options = {
    vus: 3,
    duration: '1m'
}

export function setup() {
    const loginResponse = http.post(
        loginEndpoint,
        JSON.stringify({
            email: __ENV.TEST_EMAIL,
            password: __ENV.TEST_PASSWORD
        }),
        {
            headers: {
                'Content-Type': 'application/json'
            }
        }
    );

    check(loginResponse, {
        'login returned 200': (response) => response.status === 200
    });

    const result = loginResponse.json<{
        result: { data: { accessToken: string } }
    }>();
    const accessToken = result.result?.data?.accessToken;
    check(accessToken, {
        'login returned a non-empty access token': (token) => typeof token === 'string' && token.length > 0
    });
    if (typeof accessToken !== 'string' || accessToken.length === 0) {
        throw new Error('Login response did not include a non-empty accessToken');
    }
    return { accessToken };
}

export default (data: { accessToken: string }) => {
    const res = http.post(endpoint, payload, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.accessToken}`
        }
    });
    check(res, {'status returned 200': (r) => r.status === 200});
    sleep(1);
}