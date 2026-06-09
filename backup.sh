#!/bin/bash
# 每日数据库备份脚本
# 用法: ./backup.sh

export PATH="$HOME/.local/share/mise/installs/node/22.22.3/bin:$PATH"
BACKUP_DIR="$HOME/worldcup-predict/backups"
DATE=$(date +%Y-%m-%d)

mkdir -p "$BACKUP_DIR"

cd ~/worldcup-predict/worker

echo "📦 备份 $DATE ..."

# 导出 predictions
wrangler d1 execute worldcup --remote --command="SELECT * FROM predictions" --json 2>/dev/null | python3 -c "
import json,sys
data=json.load(sys.stdin)
results=data[0]['results'] if data else []
with open('$BACKUP_DIR/predictions_$DATE.json','w') as f:
    json.dump(results,f,ensure_ascii=False,indent=2)
print(f'  predictions: {len(results)} 条')
"

# 导出 results
wrangler d1 execute worldcup --remote --command="SELECT * FROM results" --json 2>/dev/null | python3 -c "
import json,sys
data=json.load(sys.stdin)
results=data[0]['results'] if data else []
with open('$BACKUP_DIR/results_$DATE.json','w') as f:
    json.dump(results,f,ensure_ascii=False,indent=2)
print(f'  results: {len(results)} 条')
"

# 导出 odds
wrangler d1 execute worldcup --remote --command="SELECT * FROM odds" --json 2>/dev/null | python3 -c "
import json,sys
data=json.load(sys.stdin)
results=data[0]['results'] if data else []
with open('$BACKUP_DIR/odds_$DATE.json','w') as f:
    json.dump(results,f,ensure_ascii=False,indent=2)
print(f'  odds: {len(results)} 条')
"

# 导出 summaries
wrangler d1 execute worldcup --remote --command="SELECT * FROM summaries" --json 2>/dev/null | python3 -c "
import json,sys
data=json.load(sys.stdin)
results=data[0]['results'] if data else []
with open('$BACKUP_DIR/summaries_$DATE.json','w') as f:
    json.dump(results,f,ensure_ascii=False,indent=2)
print(f'  summaries: {len(results)} 条')
"

echo "✅ 备份完成 → $BACKUP_DIR/*_$DATE.json"
