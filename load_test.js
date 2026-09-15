import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '25s', target: 15 },
    { duration: '1m',  target: 15 },
    { duration: '25s', target: 0 },
  ],
  maxRedirects: 10,
};

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyQgkizdGw9MiZjxtlxAHpfMXw5ehLfj9HkzDcR9YLRo1Cm11kfEp4cWYqnNBdDR96w/exec';

export default function () {
  const payload = JSON.stringify({
    mode: 'getRecruitments',
    email: 'admin'
  });

  const params = {
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
    },
    redirects: 5,
  };

  const res = http.post(GAS_URL, payload, params);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'body includes success': (r) => r.body && r.body.includes('success'),
  });

  sleep(Math.random() * 2 + 1);
}
