import http from 'k6/http';
import {check, sleep} from 'k6';

const endpoint = `${__ENV.PUBLIC_IP}/getTranscript`;
const payload = JSON.stringify({
        videoUrl: 'https://www.youtube.com/watch?v=eupwD-6NeB8&list=RDeupwD-6NeB8&start_radio=1',
        language: 'en' 
})
const params = {
    headers: {
        'Content-Type': 'application/json'
    }
}
export const options = {
    vus: 3,
    duration: '1m'
}


export default () => {
const res = http.post(endpoint!, payload, params);
check(res, {'status returned 200': (r) => r.status === 200})
sleep(1)
}