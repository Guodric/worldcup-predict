// ============ CONFIG ============
// Supabase config - 换成你自己的
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';

// ============ DATA ============
// 赛程数据：每日比赛 (北京时间)
// 可以手动维护，也可以后续接API自动更新
const SCHEDULE = {
  '2026-06-12': [
    { id: 'M01', home: '墨西哥', away: '未定', time: '06:00', group: 'A组' },
  ],
  '2026-06-13': [
    { id: 'M02', home: '阿根廷', away: '未定', time: '03:00', group: 'B组' },
    { id: 'M03', home: '法国', away: '未定', time: '06:00', group: 'C组' },
  ],
  // TODO: 赛程确定后填入完整数据
  // 示例完整格式：
  // '2026-06-14': [
  //   { id: 'M04', home: '巴西', away: '塞尔维亚', time: '21:00', group: 'G组' },
  //   { id: 'M05', home: '英格兰', away: '伊朗', time: '00:00', group: 'B组' },
  // ],
};

// 比赛结果 (管理员手动更新或脚本自动更新)
const RESULTS = {
  // 'M01': { home: 2, away: 1 },
  // 'M02': { home: 0, away: 0 },
};

// ============ STATE ============
let currentDate = getTodayStr();
let historyDate = getTodayStr();

// ============ STORAGE (localStorage fallback if no Supabase) ============
const DB = {
  async savePrediction(nickname, date, predictions) {
    const key = `pred_${date}_${nickname}`;
    const data = { nickname, date, predictions, ts: Date.now() };
    if (SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
      return await supabaseSave('predictions', data);
    }
    localStorage.setItem(key, JSON.stringify(data));
  },

  async getPredictions(date) {
    if (SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
      return await supabaseQuery('predictions', { date });
    }
    const results = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(`pred_${date}_`)) {
        results.push(JSON.parse(localStorage.getItem(key)));
      }
    }
    return results;
  },

  async getAllPredictions() {
    if (SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
      return await supabaseQuery('predictions', {});
    }
    const results = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('pred_')) {
        results.push(JSON.parse(localStorage.getItem(key)));
      }
    }
    return results;
  }
};

// ============ SUPABASE HELPERS ============
async function supabaseSave(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(data)
  });
  return res.ok;
}

async function supabaseQuery(table, filters) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;
  for (const [key, val] of Object.entries(filters)) {
    url += `&${key}=eq.${val}`;
  }
  const res = await fetch(url, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  return res.ok ? await res.json() : [];
}

// ============ SCORING ============
function calcScore(predicted, actual) {
  if (!actual || actual.home === undefined) return null;
  const pH = predicted.home, pA = predicted.away;
  const aH = actual.home, aA = actual.away;

  // 胜负平判断
  const pResult = pH > pA ? 'W' : pH < pA ? 'L' : 'D';
  const aResult = aH > aA ? 'W' : aH < aA ? 'L' : 'D';

  if (pResult !== aResult) return 0; // 胜负平错 = 0分

  let score = 1; // 胜负平对 = 1分

  // 净胜球差
  if ((pH - pA) === (aH - aA)) {
    score = 2; // 净胜球对 = 2分
  }

  // 精确比分
  if (pH === aH && pA === aA) {
    score = 5; // 精确命中 = 5分
  }

  return score;
}

// ============ UI ============
function getTodayStr() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

function renderMatches() {
  const matches = SCHEDULE[currentDate] || [];
  const container = document.getElementById('matches-list');

  if (matches.length === 0) {
    container.innerHTML = '<div class="card"><p style="text-align:center;color:#888;">今天没有比赛</p></div>';
    document.getElementById('deadline-note').textContent = '';
    return;
  }

  const firstMatch = matches[0];
  document.getElementById('deadline-note').textContent = `⏰ 截止时间：${firstMatch.time} 开赛前`;

  container.innerHTML = matches.map(m => `
    <div class="card">
      <div class="match-header">${m.group} · ${m.time} 开球</div>
      <div class="match-teams">
        <div class="team"><div class="team-name">${m.home}</div></div>
        <div class="vs">VS</div>
        <div class="team"><div class="team-name">${m.away}</div></div>
      </div>
      <div class="score-input">
        <input type="number" min="0" max="20" id="h_${m.id}" placeholder="0" />
        <span>:</span>
        <input type="number" min="0" max="20" id="a_${m.id}" placeholder="0" />
      </div>
    </div>
  `).join('');
}

async function submitPredictions() {
  const nickname = document.getElementById('nickname').value.trim();
  if (!nickname) { showToast('请输入昵称'); return; }

  const matches = SCHEDULE[currentDate] || [];
  if (matches.length === 0) { showToast('今天没有比赛'); return; }

  const predictions = {};
  for (const m of matches) {
    const h = document.getElementById(`h_${m.id}`).value;
    const a = document.getElementById(`a_${m.id}`).value;
    if (h === '' || a === '') { showToast(`请填写 ${m.home} vs ${m.away} 的比分`); return; }
    predictions[m.id] = { home: parseInt(h), away: parseInt(a) };
  }

  document.getElementById('submit-btn').disabled = true;
  await DB.savePrediction(nickname, currentDate, predictions);
  localStorage.setItem('nickname', nickname);
  showToast('✅ 提交成功！');
  setTimeout(() => { document.getElementById('submit-btn').disabled = false; }, 2000);
}

async function renderLeaderboard() {
  const allPreds = await DB.getAllPredictions();
  const scores = {};

  for (const pred of allPreds) {
    if (!scores[pred.nickname]) scores[pred.nickname] = 0;
    for (const [matchId, p] of Object.entries(pred.predictions)) {
      const actual = RESULTS[matchId];
      const s = calcScore(p, actual);
      if (s !== null) scores[pred.nickname] += s;
    }
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const container = document.getElementById('leaderboard-list');

  if (sorted.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#888;">暂无数据</p>';
    return;
  }

  container.innerHTML = sorted.map(([name, score], i) => `
    <div class="leaderboard-item">
      <div class="rank ${i < 3 ? 'rank-' + (i + 1) : ''}">${i + 1}</div>
      <div class="lb-name">${name}</div>
      <div class="lb-score">${score}</div>
    </div>
  `).join('');
}

async function renderHistory() {
  const dateSpan = document.getElementById('history-date');
  dateSpan.textContent = historyDate;

  const matches = SCHEDULE[historyDate] || [];
  const preds = await DB.getPredictions(historyDate);
  const container = document.getElementById('history-list');

  if (matches.length === 0) {
    container.innerHTML = '<div class="card"><p style="text-align:center;color:#888;">当天无比赛</p></div>';
    return;
  }

  container.innerHTML = matches.map(m => {
    const actual = RESULTS[m.id];
    const actualStr = actual ? `${actual.home} : ${actual.away}` : '待开赛';

    const predRows = preds.map(p => {
      const pred = p.predictions[m.id];
      if (!pred) return '';
      const score = calcScore(pred, actual);
      const badge = score === null ? '' :
        `<span class="result-badge badge-${score}">${score}分</span>`;
      return `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">
        <span>${p.nickname}</span>
        <span>${pred.home}:${pred.away} ${badge}</span>
      </div>`;
    }).join('');

    return `
      <div class="card">
        <div class="match-header">${m.group} · ${m.time}</div>
        <div class="match-teams">
          <div class="team"><div class="team-name">${m.home}</div></div>
          <div class="vs">VS</div>
          <div class="team"><div class="team-name">${m.away}</div></div>
        </div>
        <div class="actual-score">实际比分：${actualStr}</div>
        ${predRows ? '<div style="margin-top:8px;border-top:1px solid #0f3460;padding-top:8px;">' + predRows + '</div>' : ''}
      </div>
    `;
  }).join('');
}

function changeHistoryDate(delta) {
  const dates = Object.keys(SCHEDULE).sort();
  const idx = dates.indexOf(historyDate);
  const newIdx = idx + delta;
  if (newIdx >= 0 && newIdx < dates.length) {
    historyDate = dates[newIdx];
    renderHistory();
  }
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 2000);
}

// ============ TABS ============
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const panel = document.getElementById(tab.dataset.panel);
    panel.classList.add('active');

    if (tab.dataset.panel === 'leaderboard') renderLeaderboard();
    if (tab.dataset.panel === 'history') renderHistory();
  });
});

// ============ INIT ============
const savedNickname = localStorage.getItem('nickname');
if (savedNickname) document.getElementById('nickname').value = savedNickname;
renderMatches();
</script>
