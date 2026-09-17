import http from 'k6/http';	// 必要な機能を読み込む
import { check, sleep } from 'k6';	// 必要な機能を読み込む

export const options = {	// 必要な機能を読み込む
  stages: [	// 処理を続ける
    { duration: '25s', target: 15 },	// 処理を続ける
    { duration: '1m',  target: 15 },	// 処理を続ける
    { duration: '25s', target: 0 },	// 処理を続ける
  ],	// 処理を続ける
  maxRedirects: 10,	// 処理を続ける
};	// 処理のまとまりを閉じる

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyQgkizdGw9MiZjxtlxAHpfMXw5ehLfj9HkzDcR9YLRo1Cm11kfEp4cWYqnNBdDR96w/exec';	// GAS APIの接続先を設定

export default function () {	// 必要な機能を読み込む
  const payload = JSON.stringify({	// 定数を定義
    mode: 'getRecruitments',	// 処理を続ける
    email: 'admin'	// 処理を続ける
  });	// 処理を完了する

  const params = {	// 定数を定義
    headers: {	// 処理のまとまりを始める
      'Content-Type': 'text/plain;charset=UTF-8',	// 処理を続ける
    },	// 処理のまとまりを閉じる
    redirects: 5,	// 処理を続ける
  };	// 処理のまとまりを閉じる

  const res = http.post(GAS_URL, payload, params);	// 定数を定義

  check(res, {	// 処理のまとまりを始める
    'status is 200': (r) => r.status === 200,	// 処理を続ける
    'body includes success': (r) => r.body && r.body.includes('success'),	// 処理を続ける
  });	// 処理を完了する

  sleep(Math.random() * 2 + 1);	// 処理を完了する
}	// 処理のまとまりを閉じる
