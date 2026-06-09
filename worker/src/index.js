// Cloudflare Worker - 世界杯竞猜 API + 静态文件
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';
const assetManifest = JSON.parse(manifestJSON);

const ALLOWED_NICKNAMES = ['球王', '喂狗', '林彪', '佩雷兹', '方烁', '航班', '泳佳'];

// 每天第一场开球时间（北京时间），用于服务端锁定
const FIRST_MATCH_TIME = {
  '2026-06-12': '03:00', '2026-06-13': '03:00', '2026-06-14': '03:00',
  '2026-06-15': '01:00', '2026-06-16': '00:00', '2026-06-17': '03:00',
  '2026-06-18': '01:00', '2026-06-19': '00:00', '2026-06-20': '03:00',
  '2026-06-21': '01:00', '2026-06-22': '00:00', '2026-06-23': '01:00',
  '2026-06-24': '01:00', '2026-06-25': '03:00', '2026-06-26': '04:00',
  '2026-06-27': '03:00', '2026-06-28': '05:00',
};

// API英文队名 → 我们的中文队名
const TEAM_MAP = {
  'Mexico': '墨西哥', 'South Africa': '南非', 'South Korea': '韩国', 'Czechia': '捷克',
  'Canada': '加拿大', 'Bosnia-Herzegovina': '波黑', 'Qatar': '卡塔尔', 'Switzerland': '瑞士',
  'United States': '美国', 'Paraguay': '巴拉圭', 'Brazil': '巴西', 'Morocco': '摩洛哥',
  'Haiti': '海地', 'Scotland': '苏格兰', 'Australia': '澳大利亚', 'Turkey': '土耳其',
  'Germany': '德国', 'Curaçao': '库拉索', 'Netherlands': '荷兰', 'Japan': '日本',
  'Ivory Coast': '科特迪瓦', 'Ecuador': '厄瓜多尔', 'Sweden': '瑞典', 'Tunisia': '突尼斯',
  'Spain': '西班牙', 'Cape Verde Islands': '佛得角', 'Belgium': '比利时', 'Egypt': '埃及',
  'Saudi Arabia': '沙特', 'Uruguay': '乌拉圭', 'Iran': '伊朗', 'New Zealand': '新西兰',
  'France': '法国', 'Senegal': '塞内加尔', 'Iraq': '伊拉克', 'Norway': '挪威',
  'Argentina': '阿根廷', 'Algeria': '阿尔及利亚', 'Austria': '奥地利', 'Jordan': '约旦',
  'Portugal': '葡萄牙', 'DR Congo': '刚果(金)', 'Uzbekistan': '乌兹别克斯坦', 'Colombia': '哥伦比亚',
  'England': '英格兰', 'Croatia': '克罗地亚', 'Ghana': '加纳', 'Panama': '巴拿马',
  'Cape Verde': '佛得角',
};

// 我们的赛程：中文队名 → match_id + date
const MATCH_LOOKUP = {
  '墨西哥-南非-2026-06-12': 'A01', '韩国-捷克-2026-06-12': 'A02',
  '加拿大-波黑-2026-06-13': 'B01', '美国-巴拉圭-2026-06-13': 'D01',
  '卡塔尔-瑞士-2026-06-14': 'B02', '巴西-摩洛哥-2026-06-14': 'C01',
  '海地-苏格兰-2026-06-14': 'C02', '澳大利亚-土耳其-2026-06-14': 'D02',
  '德国-库拉索-2026-06-15': 'E01', '荷兰-日本-2026-06-15': 'F01',
  '科特迪瓦-厄瓜多尔-2026-06-15': 'E02', '瑞典-突尼斯-2026-06-15': 'F02',
  '西班牙-佛得角-2026-06-16': 'H01', '比利时-埃及-2026-06-16': 'G01',
  '沙特-乌拉圭-2026-06-16': 'H02', '伊朗-新西兰-2026-06-16': 'G02',
  '法国-塞内加尔-2026-06-17': 'I01', '伊拉克-挪威-2026-06-17': 'I02',
  '阿根廷-阿尔及利亚-2026-06-17': 'J01', '奥地利-约旦-2026-06-17': 'J02',
  '葡萄牙-刚果(金)-2026-06-18': 'K01', '英格兰-克罗地亚-2026-06-18': 'L01',
  '加纳-巴拿马-2026-06-18': 'L02', '乌兹别克斯坦-哥伦比亚-2026-06-18': 'K02',
  '捷克-南非-2026-06-19': 'A03', '瑞士-波黑-2026-06-19': 'B03',
  '加拿大-卡塔尔-2026-06-19': 'B04', '墨西哥-韩国-2026-06-19': 'A04',
  '美国-澳大利亚-2026-06-20': 'D03', '苏格兰-摩洛哥-2026-06-20': 'C03',
  '巴西-海地-2026-06-20': 'C04', '土耳其-巴拉圭-2026-06-20': 'D04',
  '荷兰-瑞典-2026-06-21': 'F03', '德国-科特迪瓦-2026-06-21': 'E03',
  '厄瓜多尔-库拉索-2026-06-21': 'E04', '突尼斯-日本-2026-06-21': 'F04',
  '西班牙-沙特-2026-06-22': 'H03', '比利时-伊朗-2026-06-22': 'G03',
  '乌拉圭-佛得角-2026-06-22': 'H04', '新西兰-埃及-2026-06-22': 'G04',
  '阿根廷-奥地利-2026-06-23': 'J03', '法国-伊拉克-2026-06-23': 'I03',
  '挪威-塞内加尔-2026-06-23': 'I04', '约旦-阿尔及利亚-2026-06-23': 'J04',
  '葡萄牙-乌兹别克斯坦-2026-06-24': 'K03', '英格兰-加纳-2026-06-24': 'L03',
  '巴拿马-克罗地亚-2026-06-24': 'L04', '哥伦比亚-刚果(金)-2026-06-24': 'K04',
  '瑞士-加拿大-2026-06-25': 'B05', '波黑-卡塔尔-2026-06-25': 'B06',
  '苏格兰-巴西-2026-06-25': 'C05', '摩洛哥-海地-2026-06-25': 'C06',
  '捷克-墨西哥-2026-06-25': 'A05', '南非-韩国-2026-06-25': 'A06',
  '库拉索-科特迪瓦-2026-06-26': 'E05', '厄瓜多尔-德国-2026-06-26': 'E06',
  '日本-瑞典-2026-06-26': 'F05', '突尼斯-荷兰-2026-06-26': 'F06',
  '土耳其-美国-2026-06-26': 'D05', '巴拉圭-澳大利亚-2026-06-26': 'D06',
  '挪威-法国-2026-06-27': 'I05', '塞内加尔-伊拉克-2026-06-27': 'I06',
  '巴拿马-英格兰-2026-06-27': 'L05', '克罗地亚-加纳-2026-06-27': 'L06',
  '佛得角-沙特-2026-06-27': 'H05', '乌拉圭-西班牙-2026-06-27': 'H06',
  '埃及-伊朗-2026-06-27': 'G05', '新西兰-比利时-2026-06-27': 'G06',
  '哥伦比亚-葡萄牙-2026-06-28': 'K05', '刚果(金)-乌兹别克斯坦-2026-06-28': 'K06',
  '阿尔及利亚-奥地利-2026-06-28': 'J05', '约旦-阿根廷-2026-06-28': 'J06',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return handleAPI(url, request, env);
    }

    try {
      return await getAssetFromKV(
        { request, waitUntil: ctx.waitUntil.bind(ctx) },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: assetManifest,
        }
      );
    } catch (e) {
      return new Response('Not Found', { status: 404 });
    }
  },

  // Cron Trigger: 每小时自动拉取比赛结果
  async scheduled(event, env, ctx) {
    await fetchAndStoreResults(env);
  }
};

async function fetchAndStoreResults(env) {
  const API_TOKEN = env.FOOTBALL_API_TOKEN || '6a4ad18e3d4e4403ac2461e0fe98e53e';
  const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED', {
    headers: { 'X-Auth-Token': API_TOKEN }
  });

  if (!res.ok) return;
  const data = await res.json();
  const matches = data.matches || [];

  for (const m of matches) {
    const homeScore = m.score?.fullTime?.home;
    const awayScore = m.score?.fullTime?.away;
    if (homeScore === null || awayScore === null) continue;

    const homeName = TEAM_MAP[m.homeTeam?.name] || m.homeTeam?.name;
    const awayName = TEAM_MAP[m.awayTeam?.name] || m.awayTeam?.name;

    // UTC日期转北京日期
    const utcDate = new Date(m.utcDate);
    const bjDate = new Date(utcDate.getTime() + 8 * 3600000);
    const dateStr = bjDate.toISOString().split('T')[0];

    const lookupKey = `${homeName}-${awayName}-${dateStr}`;
    const matchId = MATCH_LOOKUP[lookupKey];

    if (!matchId) continue;

    await env.DB.prepare(
      `INSERT INTO results (match_id, match_date, home_score, away_score)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(match_id) DO UPDATE SET home_score=excluded.home_score, away_score=excluded.away_score, updated_at=datetime('now')`
    ).bind(matchId, dateStr, homeScore, awayScore).run();
  }
}

async function handleAPI(url, request, env) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    // POST /api/predict - 提交预测
    if (url.pathname === '/api/predict' && request.method === 'POST') {
      const body = await request.json();
      const { nickname, date, predictions } = body;

      if (!nickname || !date || !predictions) {
        return json({ error: '缺少必要字段' }, 400, headers);
      }

      if (!ALLOWED_NICKNAMES.includes(nickname)) {
        return json({ error: '无效昵称' }, 403, headers);
      }

      // 服务端锁定检查：第一场开赛后禁止提交
      const firstKickoff = FIRST_MATCH_TIME[date];
      if (firstKickoff) {
        const now = new Date();
        const utc = now.getTime() + now.getTimezoneOffset() * 60000;
        const beijing = new Date(utc + 8 * 3600000);
        const [h, m] = firstKickoff.split(':').map(Number);
        const kickoff = new Date(date + 'T00:00:00');
        kickoff.setHours(h, m, 0, 0);
        if (beijing >= kickoff) {
          return json({ error: '已开赛，预测已锁定' }, 403, headers);
        }
      }

      // Upsert 每条预测
      const stmt = env.DB.prepare(
        `INSERT INTO predictions (nickname, match_date, match_id, home_score, away_score)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(nickname, match_date, match_id)
         DO UPDATE SET home_score=excluded.home_score, away_score=excluded.away_score, created_at=datetime('now')`
      );

      const batch = Object.entries(predictions).map(([matchId, scores]) =>
        stmt.bind(nickname, date, matchId, scores.home, scores.away)
      );

      await env.DB.batch(batch);
      return json({ ok: true, count: batch.length }, 200, headers);
    }

    // GET /api/predictions?date=2026-06-12
    if (url.pathname === '/api/predictions' && request.method === 'GET') {
      const date = url.searchParams.get('date');
      if (!date) return json({ error: '需要date参数' }, 400, headers);

      const { results } = await env.DB.prepare(
        'SELECT nickname, match_id, home_score, away_score FROM predictions WHERE match_date = ?'
      ).bind(date).all();

      // 按人分组
      const grouped = {};
      for (const row of results) {
        if (!grouped[row.nickname]) grouped[row.nickname] = {};
        grouped[row.nickname][row.match_id] = { home: row.home_score, away: row.away_score };
      }

      return json(grouped, 200, headers);
    }

    // GET /api/leaderboard
    if (url.pathname === '/api/leaderboard' && request.method === 'GET') {
      const { results: preds } = await env.DB.prepare(
        'SELECT nickname, match_date, match_id, home_score, away_score FROM predictions'
      ).all();

      const { results: actuals } = await env.DB.prepare(
        'SELECT match_id, match_date, home_score, away_score FROM results'
      ).all();

      const resultMap = {};
      for (const r of actuals) {
        resultMap[r.match_id] = { home: r.home_score, away: r.away_score, date: r.match_date };
      }

      // Group predictions by date and nickname
      const byDateUser = {};
      for (const p of preds) {
        const key = `${p.match_date}|${p.nickname}`;
        if (!byDateUser[key]) byDateUser[key] = { date: p.match_date, nickname: p.nickname, preds: [] };
        byDateUser[key].preds.push(p);
      }

      // Get unique dates that have results
      const datesWithResults = [...new Set(actuals.map(r => r.match_date))];

      // For each date, rank all users
      const earnings = {};
      const dayCount = {};
      const winCount = {};
      const totalCost = {};

      for (const date of datesWithResults) {
        const dayUsers = [];
        for (const [key, data] of Object.entries(byDateUser)) {
          if (data.date !== date) continue;
          let correct = 0, gdTotal = 0, goalTotal = 0;
          for (const p of data.preds) {
            const actual = resultMap[p.match_id];
            if (!actual) continue;
            const pH = p.home_score, pA = p.away_score;
            const aH = actual.home, aA = actual.away;
            const pR = pH > pA ? 'W' : pH < pA ? 'L' : 'D';
            const aR = aH > aA ? 'W' : aH < aA ? 'L' : 'D';
            if (pR === aR) correct++;
            gdTotal += Math.abs((pH - pA) - (aH - aA));
            goalTotal += Math.abs(pH - aH) + Math.abs(pA - aA);
          }
          dayUsers.push({ nickname: data.nickname, correct, gdTotal, goalTotal });
        }

        // Sort: correct DESC, gdTotal ASC, goalTotal ASC
        dayUsers.sort((a, b) => {
          if (a.correct !== b.correct) return b.correct - a.correct;
          if (a.gdTotal !== b.gdTotal) return a.gdTotal - b.gdTotal;
          return a.goalTotal - b.goalTotal;
        });

        // 奖池 = 参与人数 × 5 × 当日场次
        const numMatches = actuals.filter(r => r.match_date === date).length;
        const pool = dayUsers.length * 5 * numMatches;
        const prizes = { 1: Math.round(pool * 0.6), 2: Math.round(pool * 0.3), 3: Math.round(pool * 0.1) };

        let rank = 1;
        for (let i = 0; i < dayUsers.length; i++) {
          if (i > 0) {
            const prev = dayUsers[i-1], cur = dayUsers[i];
            if (cur.correct !== prev.correct || cur.gdTotal !== prev.gdTotal || cur.goalTotal !== prev.goalTotal) {
              rank = i + 1;
            }
          }
          const name = dayUsers[i].nickname;
          if (!earnings[name]) earnings[name] = 0;
          if (!dayCount[name]) dayCount[name] = 0;
          if (!winCount[name]) winCount[name] = 0;
          if (!totalCost[name]) totalCost[name] = 0;
          dayCount[name]++;
          totalCost[name] += 5 * numMatches;
          earnings[name] += prizes[rank] || 0;
          if (rank === 1) winCount[name]++;
        }
      }

      const sorted = Object.entries(earnings)
        .sort((a, b) => b[1] - a[1])
        .map(([name, earn], i) => ({
          rank: i + 1,
          nickname: name,
          earnings: earn,
          cost: totalCost[name] || 0,
          days: dayCount[name] || 0,
          wins: winCount[name] || 0
        }));

      return json(sorted, 200, headers);
    }

    // POST /api/result - 管理员录入结果 (简单密码验证)
    if (url.pathname === '/api/result' && request.method === 'POST') {
      const body = await request.json();
      const { password, match_id, date, home_score, away_score } = body;

      if (password !== (env.ADMIN_PASSWORD || 'worldcup2026')) {
        return json({ error: '密码错误' }, 403, headers);
      }

      await env.DB.prepare(
        `INSERT INTO results (match_id, match_date, home_score, away_score)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(match_id) DO UPDATE SET home_score=excluded.home_score, away_score=excluded.away_score, updated_at=datetime('now')`
      ).bind(match_id, date, home_score, away_score).run();

      return json({ ok: true }, 200, headers);
    }

    // GET /api/results?date=2026-06-12
    if (url.pathname === '/api/results' && request.method === 'GET') {
      const date = url.searchParams.get('date');
      let query = 'SELECT * FROM results';
      let stmt;
      if (date) {
        stmt = env.DB.prepare(query + ' WHERE match_date = ?').bind(date);
      } else {
        stmt = env.DB.prepare(query);
      }
      const { results } = await stmt.all();
      return json(results, 200, headers);
    }

    return json({ error: 'Not found' }, 404, headers);
  } catch (e) {
    return json({ error: e.message }, 500, headers);
  }
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers });
}
