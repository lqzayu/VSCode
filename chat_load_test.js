import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '20s', target: 5 },   // 20秒で5人まで増やす
    { duration: '40s', target: 10 },  // 40秒かけて10人に増やす
    { duration: '20s', target: 0 },   // 20秒で0人に減らす
  ],
  maxRedirects: 10,
};

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwgAQAPaBr-HNvqToDDrspDfL02s_YN89atcNrZfVGEESNnRLC_9vnqC0vz8hHyvUrS/exec';

export default function () {
  // 送信テスト用データ
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

  // 💡 送信成功（200 OK かつ レスポンスが "SENT" または "success" であるか）
  check(res, {
    'status is 200': (r) => r.status === 200,
    'body includes success': (r) => r.body && (r.body.includes('SENT') || r.body.includes('success')),
  });

  // 人間がチャットを打つ間隔（1秒〜3秒待つ）
  sleep(Math.random() * 2 + 1);
}