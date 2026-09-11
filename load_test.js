import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '25s', target: 15 },  // 30秒かけて20人まで増やす
    { duration: '1m',  target: 15 },  // 20人で1分間維持
    { duration: '25s', target: 0 },  // 30秒で0人に減らす
  ],
  // 💡 リダイレクトを自動追従させる設定（最大10回まで追従）
  maxRedirects: 10,
};

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwgAQAPaBr-HNvqToDDrspDfL02s_YN89atcNrZfVGEESNnRLC_9vnqC0vz8hHyvUrS/exec';

export default function () {
  const payload = JSON.stringify({
    mode: 'getRecruitments',
    email: 'admin'
  });

  const params = {
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8', // GAS用エンコード指定
    },
    redirects: 5, // リダイレクト追従数を指定
  };

  const res = http.post(GAS_URL, payload, params);

  // 💡 リダイレクト成功後、ステータスが200かつレスポンス本文に"success"が含まれているかチェック
  check(res, {
    'status is 200': (r) => r.status === 200,
    'body includes success': (r) => r.body && r.body.includes('success'),
  });

  sleep(Math.random() * 2 + 1);
}