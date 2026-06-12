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

  // Cron Trigger: 每小时自动拉取比赛结果、赔率，并生成AI点评
  async scheduled(event, env, ctx) {
    await fetchAndStoreResults(env);
    await fetchAndStoreOdds(env);
    await generateDaySummary(env);
    await generateMatchPrompt(env);
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

// the-odds-api 队名 → 中文队名映射
const ODDS_TEAM_MAP = {
  'Mexico': '墨西哥', 'South Africa': '南非', 'South Korea': '韩国',
  'Czech Republic': '捷克', 'Canada': '加拿大', 'Bosnia & Herzegovina': '波黑',
  'Bosnia and Herzegovina': '波黑', 'Qatar': '卡塔尔', 'Switzerland': '瑞士',
  'United States': '美国', 'USA': '美国', 'Paraguay': '巴拉圭',
  'Brazil': '巴西', 'Morocco': '摩洛哥', 'Haiti': '海地', 'Scotland': '苏格兰',
  'Australia': '澳大利亚', 'Turkey': '土耳其', 'Germany': '德国', 'Curaçao': '库拉索',
  'Curacao': '库拉索', 'Netherlands': '荷兰', 'Japan': '日本',
  'Ivory Coast': '科特迪瓦', "Côte d'Ivoire": '科特迪瓦', 'Ecuador': '厄瓜多尔',
  'Sweden': '瑞典', 'Tunisia': '突尼斯', 'Spain': '西班牙',
  'Cape Verde': '佛得角', 'Cape Verde Islands': '佛得角',
  'Belgium': '比利时', 'Egypt': '埃及', 'Saudi Arabia': '沙特',
  'Uruguay': '乌拉圭', 'Iran': '伊朗', 'New Zealand': '新西兰',
  'France': '法国', 'Senegal': '塞内加尔', 'Iraq': '伊拉克', 'Norway': '挪威',
  'Argentina': '阿根廷', 'Algeria': '阿尔及利亚', 'Austria': '奥地利', 'Jordan': '约旦',
  'Portugal': '葡萄牙', 'DR Congo': '刚果(金)', 'Congo DR': '刚果(金)',
  'Uzbekistan': '乌兹别克斯坦', 'Colombia': '哥伦比亚',
  'England': '英格兰', 'Croatia': '克罗地亚', 'Ghana': '加纳', 'Panama': '巴拿马',
};

async function fetchAndStoreOdds(env) {
  const ODDS_KEY = env.ODDS_API_TOKEN || '47f7681ac41ca38a2c024c1928ca9343';
  const res = await fetch(
    `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds?apiKey=${ODDS_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`
  );
  if (!res.ok) return;
  const data = await res.json();
  if (!Array.isArray(data)) return;

  for (const match of data) {
    const homeName = ODDS_TEAM_MAP[match.home_team] || match.home_team;
    const awayName = ODDS_TEAM_MAP[match.away_team] || match.away_team;

    // 从 commence_time 获取北京日期
    const utcDate = new Date(match.commence_time);
    const bjDate = new Date(utcDate.getTime() + 8 * 3600000);
    const dateStr = bjDate.toISOString().split('T')[0];

    const lookupKey = `${homeName}-${awayName}-${dateStr}`;
    const matchId = MATCH_LOOKUP[lookupKey];
    if (!matchId) continue;

    // 取第一个 bookmaker 的赔率
    const bm = match.bookmakers?.[0];
    if (!bm) continue;
    const h2h = bm.markets?.find(m => m.key === 'h2h');
    if (!h2h) continue;

    const outcomes = {};
    for (const o of h2h.outcomes) outcomes[o.name] = o.price;

    const homeOdds = outcomes[match.home_team] || null;
    const drawOdds = outcomes['Draw'] || null;
    const awayOdds = outcomes[match.away_team] || null;

    if (!homeOdds || !drawOdds || !awayOdds) continue;

    await env.DB.prepare(
      `INSERT INTO odds (match_id, home_odds, draw_odds, away_odds)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(match_id) DO UPDATE SET home_odds=excluded.home_odds, draw_odds=excluded.draw_odds, away_odds=excluded.away_odds, updated_at=datetime('now')`
    ).bind(matchId, homeOdds, drawOdds, awayOdds).run();
  }
}

async function generateDaySummary(env) {
  // 检查所有有预测的比赛日（不只是今天）
  const { results: predDates } = await env.DB.prepare(
    'SELECT DISTINCT match_date FROM predictions ORDER BY match_date'
  ).all();

  for (const row of (predDates || [])) {
    await generateSummaryForDate(env, row.match_date);
  }
}

async function generateSummaryForDate(env, today) {
  if (!FIRST_MATCH_TIME[today]) return;

  // 检查是否已有最终总结（锁定的不再更新）
  const existing = await env.DB.prepare(
    'SELECT is_final FROM summaries WHERE match_date = ?'
  ).bind(today).first();
  if (existing?.is_final) return;

  // 获取今天的预测
  const { results: todayPreds } = await env.DB.prepare(
    'SELECT * FROM predictions WHERE match_date = ?'
  ).bind(today).all();
  if (!todayPreds || todayPreds.length === 0) return;

  // 获取今天的比赛结果（可能还没有）
  const { results: todayResults } = await env.DB.prepare(
    'SELECT * FROM results WHERE match_date = ?'
  ).bind(today).all();

  // 获取赔率
  const { results: oddsRows } = await env.DB.prepare('SELECT * FROM odds').all();
  const oddsMap = {};
  for (const r of oddsRows) oddsMap[r.match_id] = { home: r.home_odds, draw: r.draw_odds, away: r.away_odds };

  const userPreds = {};
  for (const p of todayPreds) {
    if (!userPreds[p.nickname]) userPreds[p.nickname] = [];
    userPreds[p.nickname].push(p);
  }

  const hasResults = todayResults && todayResults.length > 0;
  const resultMap = {};
  if (hasResults) {
    for (const r of todayResults) resultMap[r.match_id] = r;
  }

  // 判断是否开赛
  const now = new Date();
  const [kickH, kickM] = FIRST_MATCH_TIME[today].split(':').map(Number);
  const kickoff = new Date(today + 'T00:00:00Z');
  kickoff.setUTCHours(kickH - 8, kickM, 0, 0);
  const isPreMatch = now < kickoff;

  // 计算当天应有多少场比赛（通过 MATCH_LOOKUP 查找）
  let expectedMatches = 0;
  for (const [key] of Object.entries(MATCH_LOOKUP)) {
    if (key.endsWith(today)) expectedMatches++;
  }
  const allResultsIn = hasResults && todayResults.length >= expectedMatches;

  let prompt, isFinal;

  if (allResultsIn) {
    // ===== 阶段3：赛后最终总结（所有比赛结果都录入后）=====
    let statsText = `今日比赛结果:\n`;
    for (const r of todayResults) {
      statsText += `${r.match_id}: ${r.home_score}:${r.away_score}\n`;
    }
    statsText += `\n各选手表现:\n`;
    for (const [name, preds] of Object.entries(userPreds)) {
      let correct = 0, exactHits = 0;
      const predDetails = [];
      for (const p of preds) {
        const actual = resultMap[p.match_id];
        if (!actual) continue;
        const pR = p.home_score > p.away_score ? 'W' : p.home_score < p.away_score ? 'L' : 'D';
        const aR = actual.home_score > actual.away_score ? 'W' : actual.home_score < actual.away_score ? 'L' : 'D';
        const isCorrect = pR === aR;
        if (isCorrect) correct++;
        if (p.home_score === actual.home_score && p.away_score === actual.away_score) exactHits++;
        predDetails.push(`预测${p.home_score}:${p.away_score} 实际${actual.home_score}:${actual.away_score} ${isCorrect ? '✅' : '❌'}`);
      }
      statsText += `${name}: ${correct}/${preds.length}场对 ${exactHits}次精确命中 [${predDetails.join(', ')}]\n`;
    }

    prompt = `你是世界杯竞猜群的解说员。比赛已结束，根据数据写最终总结（50字以内），幽默、点名、有梗。不要markdown。严格只提到数据中出现的人名，不要编造。

例子：球王今日双杀精确命中封神，林彪连续三天垫底建议改名林摆。

${statsText}`;
    isFinal = 1;

  } else if (isPreMatch) {
    // ===== 阶段1：赛前滚动总结 =====
    const participants = Object.keys(userPreds);
    let statsText = `已提交预测的人: ${participants.join('、')} (共${participants.length}人)\n\n`;

    // 用 MATCH_LOOKUP 反查队名
    const matchNames = {};
    for (const [key, mid] of Object.entries(MATCH_LOOKUP)) {
      if (!key.endsWith(today)) continue;
      const parts = key.replace(`-${today}`, '');
      const idx = parts.indexOf('-');
      matchNames[mid] = { home: parts.substring(0, idx), away: parts.substring(idx + 1) };
    }

    // 统计大家的预测倾向
    const matchPreds = {};
    for (const [name, preds] of Object.entries(userPreds)) {
      for (const p of preds) {
        if (!matchPreds[p.match_id]) matchPreds[p.match_id] = [];
        const result = p.home_score > p.away_score ? '主胜' : p.home_score < p.away_score ? '客胜' : '平局';
        matchPreds[p.match_id].push({ name, pred: `${p.home_score}:${p.away_score}`, result });
      }
    }

    for (const [matchId, preds] of Object.entries(matchPreds)) {
      const mn = matchNames[matchId] || { home: '主队', away: '客队' };
      const odds = oddsMap[matchId];
      const oddsStr = odds ? `(赔率 主${odds.home} 平${odds.draw} 客${odds.away})` : '';
      statsText += `${mn.home} vs ${mn.away} ${oddsStr}:\n`;
      for (const p of preds) {
        statsText += `  ${p.name}: ${p.pred} (${p.result})\n`;
      }
    }

    prompt = `你是世界杯竞猜群的解说员。根据下面的预测数据写一句话点评（50字以内）。要求：只能提到数据中出现的人名，绝对不能编造或提到没出现在数据中的人。轻松有趣。不要markdown。

例子1（2人已猜）：林彪和球王都看好主胜，但比分分歧大，林彪激进猜3:1，球王保守2:1。
例子2（5人已猜）：五人全部押主胜，喂狗独树一帜猜大比分4:0，是自信还是莽撞？
例子3（3人已猜）：球王、林彪、佩雷兹三人交卷，两人看好主胜一人赌平局，分歧不大。

${statsText}`;
    isFinal = 0;

  } else {
    // ===== 阶段2：比赛中，不生成 =====
    return;
  }

  // 调用 AI
  try {
    const aiRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
    });

    const summary = aiRes.response || '';
    if (summary.length > 10) {
      // Upsert: 赛前总结可覆盖，赛后锁定
      await env.DB.prepare(
        `INSERT INTO summaries (match_date, content, is_final)
         VALUES (?, ?, ?)
         ON CONFLICT(match_date) DO UPDATE SET content=excluded.content, is_final=excluded.is_final, created_at=datetime('now')`
      ).bind(today, summary, isFinal).run();
    }
  } catch (e) {
    // AI 调用失败，静默忽略
  }
}

async function generateMatchPrompt(env) {
  // 为即将到来的比赛日生成引导性AI文案
  const { results: oddsRows } = await env.DB.prepare('SELECT * FROM odds').all();
  const oddsMap = {};
  for (const r of oddsRows) oddsMap[r.match_id] = { home: r.home_odds, draw: r.draw_odds, away: r.away_odds };

  // 找到下一个有比赛但还没开赛的日期
  const now = new Date();
  const allDates = Object.keys(FIRST_MATCH_TIME).sort();

  for (const date of allDates) {
    const [kickH, kickM] = FIRST_MATCH_TIME[date].split(':').map(Number);
    const kickoff = new Date(date + 'T00:00:00Z');
    kickoff.setUTCHours(kickH - 8, kickM, 0, 0);
    if (now >= kickoff) continue; // 已开赛，跳过

    // 检查是否已有今天的prompt
    const existing = await env.DB.prepare(
      'SELECT 1 FROM match_prompts WHERE match_date = ?'
    ).bind(date).first();
    if (existing) return; // 已有，不重复生成

    // 构建比赛信息
    const { results: preds } = await env.DB.prepare(
      'SELECT DISTINCT match_id FROM predictions WHERE match_date = ?'
    ).bind(date).all();
    const matchIds = preds.map(p => p.match_id);

    // 用 MATCH_LOOKUP 反查比赛信息
    const matchInfo = [];
    for (const [key, mid] of Object.entries(MATCH_LOOKUP)) {
      if (!key.endsWith(date)) continue;
      const parts = key.replace(`-${date}`, '').split('-');
      const home = parts[0];
      const away = parts.slice(1).join('-');
      const odds = oddsMap[mid];
      const oddsStr = odds ? `赔率 主${odds.home} 平${odds.draw} 客${odds.away}` : '';
      matchInfo.push(`${home} vs ${away} ${oddsStr}`);
    }

    if (matchInfo.length === 0) return;

    const prompt = `你是世界杯竞猜群的主持人。根据今天的比赛和赔率，写一段引导性文案（50字以内），激发大家来竞猜。提到具体比赛、赔率亮点或看点。语气兴奋有煽动性。不要markdown。

例子：墨西哥1.42碾压级赔率遇上非洲黑马，韩国捷克五五开谁敢猜平局？快来下注！

今日比赛:
${matchInfo.join('\n')}`;

    try {
      const aiRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
      });

      const content = aiRes.response || '';
      if (content.length > 10) {
        await env.DB.prepare(
          'INSERT INTO match_prompts (match_date, content) VALUES (?, ?)'
        ).bind(date, content).run();
      }
    } catch (e) {}

    return; // 只生成最近一天的
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

      // 审计日志
      const ip = request.headers.get('cf-connecting-ip') || '';
      const ua = request.headers.get('user-agent') || '';
      const detail = JSON.stringify(predictions);
      await env.DB.prepare(
        'INSERT INTO audit_log (nickname, match_date, action, detail, ip, ua) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(nickname, date, 'predict', detail, ip, ua).run();

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

      // Get dates where ALL matches have results (not partial)
      const datesWithSomeResults = [...new Set(actuals.map(r => r.match_date))];
      const datesWithResults = datesWithSomeResults.filter(date => {
        let expected = 0;
        for (const [key] of Object.entries(MATCH_LOOKUP)) {
          if (key.endsWith(date)) expected++;
        }
        const actual = actuals.filter(r => r.match_date === date).length;
        return actual >= expected;
      });

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
        const prizeRates = [0.6, 0.3, 0.1]; // 第1/2/3名的分配比例

        // 分配排名
        let rank = 1;
        const ranks = [1];
        for (let i = 1; i < dayUsers.length; i++) {
          const prev = dayUsers[i-1], cur = dayUsers[i];
          if (cur.correct !== prev.correct || cur.gdTotal !== prev.gdTotal || cur.goalTotal !== prev.goalTotal) {
            rank = i + 1;
          }
          ranks.push(rank);
        }

        // 并列平分：合并并列位置对应的奖金比例，平均分给并列的人
        for (let i = 0; i < dayUsers.length; i++) {
          const name = dayUsers[i].nickname;
          if (!earnings[name]) earnings[name] = 0;
          if (!dayCount[name]) dayCount[name] = 0;
          if (!winCount[name]) winCount[name] = 0;
          if (!totalCost[name]) totalCost[name] = 0;
          dayCount[name]++;
          totalCost[name] += 5 * numMatches;

          // 找出所有同排名的人数
          const myRank = ranks[i];
          const tiedCount = ranks.filter(r => r === myRank).length;
          // 合并该排名占据的所有位置对应的奖金比例
          let totalRate = 0;
          for (let pos = myRank; pos < myRank + tiedCount && pos <= 3; pos++) {
            totalRate += prizeRates[pos - 1] || 0;
          }
          const prize = Math.round((pool * totalRate) / tiedCount);
          earnings[name] += prize;
          if (myRank === 1) winCount[name]++;
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

    // POST /api/sync - 手动触发数据同步
    if (url.pathname === '/api/sync' && request.method === 'POST') {
      const body = await request.json();
      if (body.password !== (env.ADMIN_PASSWORD || 'worldcup2026')) {
        return json({ error: '密码错误' }, 403, headers);
      }
      await fetchAndStoreResults(env);
      await fetchAndStoreOdds(env);
      await generateDaySummary(env);
      await generateMatchPrompt(env);
      return json({ ok: true, msg: '同步完成' }, 200, headers);
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

    // GET /api/match-prompt?date=2026-06-12
    if (url.pathname === '/api/match-prompt' && request.method === 'GET') {
      const date = url.searchParams.get('date');
      if (!date) return json({ error: '需要date参数' }, 400, headers);
      const row = await env.DB.prepare('SELECT content FROM match_prompts WHERE match_date = ?').bind(date).first();
      return json({ prompt: row?.content || null }, 200, headers);
    }

    // GET /api/summary?date=2026-06-12
    if (url.pathname === '/api/summary' && request.method === 'GET') {
      const date = url.searchParams.get('date');
      if (!date) return json({ error: '需要date参数' }, 400, headers);
      const row = await env.DB.prepare('SELECT content, is_final FROM summaries WHERE match_date = ?').bind(date).first();
      return json({ summary: row?.content || null, is_final: row?.is_final || 0 }, 200, headers);
    }

    // GET /api/odds?date=2026-06-12
    if (url.pathname === '/api/odds' && request.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM odds').all();
      const oddsMap = {};
      for (const r of results) {
        oddsMap[r.match_id] = { home: r.home_odds, draw: r.draw_odds, away: r.away_odds };
      }
      return json(oddsMap, 200, headers);
    }

    return json({ error: 'Not found' }, 404, headers);
  } catch (e) {
    return json({ error: e.message }, 500, headers);
  }
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers });
}
