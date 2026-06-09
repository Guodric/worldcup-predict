# 世界杯竞猜 - 部署指南

## 架构
- **前端**: 静态 HTML（Cloudflare Pages 托管）
- **后端**: Cloudflare Worker + D1 (SQLite)
- **大陆访问**: Cloudflare 全球 CDN，无需翻墙

## 快速部署

### 1. 安装 Wrangler CLI
```bash
npm install -g wrangler
wrangler login
```

### 2. 创建 D1 数据库
```bash
cd worker
wrangler d1 create worldcup
# 记录输出的 database_id，填入 wrangler.toml
```

### 3. 初始化数据库
```bash
wrangler d1 execute worldcup --file=./schema.sql
```

### 4. 更新 wrangler.toml
把 `YOUR_D1_DATABASE_ID` 换成实际 ID

### 5. 部署
```bash
wrangler deploy
```

部署完成后会得到 `https://worldcup-predict.<你的子域>.workers.dev`

### 6. (可选) 绑定自定义域名
在 Cloudflare dashboard 中绑定你的域名

## 每日操作

### 更新赛程
编辑 `worker/public/index.html` 中的 `SCHEDULE` 对象，添加当天比赛

### 录入比赛结果
```bash
# 用 curl 录入（或写个脚本自动拉取）
curl -X POST https://your-domain/api/result \
  -H 'Content-Type: application/json' \
  -d '{"password":"worldcup2026","match_id":"D01","date":"2026-06-08","home_score":0,"away_score":1}'
```

### 生成微信群模板（用 Python 脚本）
```bash
python3 worldcup.py template 2026-06-12
```

## 管理员密码
默认密码: `worldcup2026`
可在 wrangler.toml 中添加环境变量覆盖:
```toml
[vars]
ADMIN_PASSWORD = "你的密码"
```

## 离线模式
如果不想部署后端，网页也能以 localStorage 模式运行（单设备）。
直接用浏览器打开 `worker/public/index.html` 即可体验。
