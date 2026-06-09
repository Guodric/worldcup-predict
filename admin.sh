#!/bin/bash
# 管理员快捷脚本 - 录入比赛结果

BASE_URL="${WC_URL:-https://worldcup-predict.YOUR_SUBDOMAIN.workers.dev}"
PASSWORD="${WC_PASS:-worldcup2026}"

if [ "$1" = "result" ]; then
  # 用法: ./admin.sh result D01 2026-06-08 0 1
  # 参数: match_id date home_score away_score
  curl -s -X POST "$BASE_URL/api/result" \
    -H 'Content-Type: application/json' \
    -d "{\"password\":\"$PASSWORD\",\"match_id\":\"$2\",\"date\":\"$3\",\"home_score\":$4,\"away_score\":$5}" | python3 -m json.tool
  echo ""

elif [ "$1" = "leaderboard" ]; then
  curl -s "$BASE_URL/api/leaderboard" | python3 -m json.tool

elif [ "$1" = "predictions" ]; then
  # 用法: ./admin.sh predictions 2026-06-08
  curl -s "$BASE_URL/api/predictions?date=$2" | python3 -m json.tool

else
  echo "世界杯竞猜管理脚本"
  echo ""
  echo "用法:"
  echo "  ./admin.sh result <match_id> <date> <home_score> <away_score>"
  echo "  ./admin.sh leaderboard"
  echo "  ./admin.sh predictions <date>"
  echo ""
  echo "例子:"
  echo "  ./admin.sh result D01 2026-06-08 0 1    # 录入喀麦隆0:1塞尔维亚"
  echo "  ./admin.sh result D02 2026-06-08 1 1    # 录入韩国1:1加纳"
  echo ""
  echo "环境变量:"
  echo "  WC_URL  - API地址 (默认: $BASE_URL)"
  echo "  WC_PASS - 管理员密码 (默认: worldcup2026)"
fi
