import sys
sys.path.insert(0, '')

import cv2
import numpy as np
import base64
import requests
import mediapipe as mp
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # 全てのアロケーションを許可

mp_face_mesh = mp.solutions.face_mesh

def base64_to_cv2(b64_str):
    """Base64文字列をOpenCVの画像形式(BGR)に変換する関数"""
    if "," in b64_str:
        b64_str = b64_str.split(",")[1]
    img_data = base64.b64decode(b64_str)
    np_arr = np.frombuffer(img_data, np.uint8)
    return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

def get_face_landmarks(image):
    """画像から顔の特徴点（主要な20点など）の相対座標リストを抽出する"""
    h, w, _ = image.shape
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    with mp_face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=True) as face_mesh:
        results = face_mesh.process(rgb_image)
        if not results.multi_face_landmarks:
            return None
        
        landmarks = results.multi_face_landmarks[0].landmark
        # 顔全体のバランスを測るための代表的な特徴点の相対座標を取得
        points = []
        for lm in landmarks:
            points.append([lm.x, lm.y, lm.z])
        return np.array(points)

@app.route('/api/verify', methods=['POST'])
def verify_face():
    data = request.json
    email = data.get('email')
    current_face_b64 = data.get('currentFace')
    gas_url = data.get('gasUrl')

    if not email or not current_face_b64 or not gas_url:
        return jsonify({"status": "failed", "message": "データが不足しています"})

    # 1. GAS経由でスプレッドシートから登録済みの顔データを取得
    try:
        gas_res = requests.post(gas_url, json={"mode": "get_face", "email": email})
        gas_data = gas_res.json()
        
        # 💡 修正点: GASのcreateRes関数の返却仕様に合わせて gas_data.get("message") をチェックするように変更
        if gas_data.get("status") != "success" or not gas_data.get("message"):
            return jsonify({"status": "failed", "message": "登録された顔データがスプレッドシートにありません"})
        
        # 💡 修正点: 顔データの実体を取り出すキーを "faceData" から "message" へ修正
        registered_face_b64 = gas_data.get("message")
        
    except Exception as e:
        return jsonify({"status": "failed", "message": "スプレッドシートからのデータ取得に失敗しました"})

    # 2. 画像をOpenCV形式にデコード
    img_current = base64_to_cv2(current_face_b64)
    img_registered = base64_to_cv2(registered_face_b64)

    # 3. MediaPipeでそれぞれの顔の特徴点を抽出
    pts_current = get_face_landmarks(img_current)
    pts_registered = get_face_landmarks(img_registered)

    if pts_current is None:
        return jsonify({"status": "failed", "message": "現在の写真から顔を検出できませんでした"})
    if pts_registered is None:
        return jsonify({"status": "failed", "message": "登録された写真から顔を検出できませんでした"})

    # 4. 特徴点同士の平均距離（ユークリッド距離）を計算して似ているか判定
    # 座標のズレの平均値を算出し、しきい値(0.05以下など)で本人確認
    distance = np.mean(np.linalg.norm(pts_current - pts_registered, axis=1))
    print(f"【照合ログ】顔の距離差スコア: {distance:.4f} (数値が小さいほど本人)")

    if distance < 0.08:  # 判定の厳しさはここの数値で調整可能
        return jsonify({"status": "success"})
    else:
        return jsonify({"status": "failed", "message": "顔が一致しませんでした"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=True)