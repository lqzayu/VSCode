import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '20s', target: 5 },
    { duration: '40s', target: 10 },
    { duration: '20s', target: 0 },
  ],
  maxRedirects: 10,
};

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyQgkizdGw9MiZjxtlxAHpfMXw5ehLfj9HkzDcR9YLRo1Cm11kfEp4cWYqnNBdDR96w/exec';

export default function () {
  const payload = JSON.stringify({
    mode: 'sendMessage',
    from: 'test_user_A',
    to: 'test_user_B',
    text: `負荷テストメッセージ [VU: ${__VU}, Iter: ${__ITER}]`
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
    'body includes success': (r) => r.body && (r.body.includes('SENT') || r.body.includes('success')),
  });

  sleep(Math.random() * 2 + 1);
}
