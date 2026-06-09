#!/usr/bin/env python3
"""
世界杯竞猜系统
- 生成每日竞猜模板（复制到微信群）
- 解析群友回复（支持各种格式）
- 计算得分和排行榜
"""

import json
import re
from datetime import datetime, timedelta
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

# ============ 赛程数据 ============
# 国旗emoji映射
FLAGS = {
    '墨西哥': '🇲🇽', '美国': '🇺🇸', '加拿大': '🇨🇦',
    '巴西': '🇧🇷', '阿根廷': '🇦🇷', '乌拉圭': '🇺🇾',
    '德国': '🇩🇪', '法国': '🇫🇷', '西班牙': '🇪🇸', '葡萄牙': '🇵🇹',
    '英格兰': '🏴‍☠️', '荷兰': '🇳🇱', '比利时': '🇧🇪', '克罗地亚': '🇭🇷',
    '日本': '🇯🇵', '韩国': '🇰🇷', '澳大利亚': '🇦🇺', '沙特': '🇸🇦', '伊朗': '🇮🇷',
    '喀麦隆': '🇨🇲', '塞尔维亚': '🇷🇸', '加纳': '🇬🇭', '瑞士': '🇨🇭',
    '丹麦': '🇩🇰', '波兰': '🇵🇱', '摩洛哥': '🇲🇦', '塞内加尔': '🇸🇳',
    '厄瓜多尔': '🇪🇨', '哥斯达黎加': '🇨🇷', '突尼斯': '🇹🇳', '威尔士': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
    '卡塔尔': '🇶🇦', '哥伦比亚': '🇨🇴', '智利': '🇨🇱', '尼日利亚': '🇳🇬',
    '埃及': '🇪🇬', '意大利': '🇮🇹', '中国': '🇨🇳',
}

# 国旗到国家名映射（反向）
FLAG_TO_COUNTRY = {v: k for k, v in FLAGS.items()}

# 赛程 (日期 -> 比赛列表)
SCHEDULE = {
    # 示例数据 - 世界杯正式赛程确定后替换
    '2026-06-11': [
        {'id': 'M01', 'home': '墨西哥', 'away': '未定', 'time': '06:00', 'group': 'A组'},
    ],
    # 用你群里的范例数据做demo
    '2026-06-08': [
        {'id': 'D01', 'home': '喀麦隆', 'away': '塞尔维亚', 'time': '18:00', 'group': 'G组'},
        {'id': 'D02', 'home': '韩国', 'away': '加纳', 'time': '21:00', 'group': 'H组'},
        {'id': 'D03', 'home': '巴西', 'away': '瑞士', 'time': '00:00', 'group': 'G组'},
        {'id': 'D04', 'home': '葡萄牙', 'away': '乌拉圭', 'time': '03:00', 'group': 'H组'},
    ],
}

# 比赛结果
RESULTS = {
    # 'D01': {'home': 3, 'away': 3},
    # 'D02': {'home': 2, 'away': 3},
    # 'D03': {'home': 1, 'away': 0},
    # 'D04': {'home': 2, 'away': 0},
}


# ============ 模板生成 ============
def generate_template(date=None):
    """生成当日竞猜模板，可直接复制到微信群"""
    if date is None:
        date = datetime.now().strftime('%Y-%m-%d')

    matches = SCHEDULE.get(date, [])
    if not matches:
        return f"📅 {date} 没有比赛"

    lines = [f"⚽ 世界杯竞猜 {date}"]
    lines.append("=" * 20)
    lines.append("")

    # 比赛列表
    for m in matches:
        hf = FLAGS.get(m['home'], '')
        af = FLAGS.get(m['away'], '')
        lines.append(f"{m['group']} {m['time']}")
        lines.append(f"{hf}{m['home']} vs {m['away']}{af}")
        lines.append("")

    lines.append("—" * 20)
    lines.append("📝 回复格式（任选一种）：")
    lines.append("")

    # 生成示例格式
    flags_str = "，".join(
        f"{FLAGS.get(m['home'], '')}{FLAGS.get(m['away'], '')}X:X"
        for m in matches
    )
    lines.append(f"格式1: 昵称 {flags_str}")
    lines.append("")

    names_str = "，".join(f"{m['home']}X:{m['away']}X" for m in matches)
    lines.append(f"格式2: 昵称 {names_str}")
    lines.append("")
    lines.append("⏰ 截止：当天第一场开赛前")
    lines.append("")
    lines.append("🏆 计分：胜负对1分 | +净胜球对2分 | 精确比分5分")

    return "\n".join(lines)


# ============ 消息解析 ============
def parse_predictions(raw_text, date=None):
    """
    解析微信群消息，支持多种格式：
    - 球王🇨🇲🇷🇸01，🇰🇷🇬🇭11，🇧🇷🇨🇭20，🇵🇹🇺🇾01
    - 林彪🇨🇲🇷🇸1:0，🇰🇷🇬🇭0:1
    - 航班🇨🇲00🇷🇸，🇰🇷11🇬🇭
    """
    if date is None:
        date = datetime.now().strftime('%Y-%m-%d')

    matches = SCHEDULE.get(date, [])
    if not matches:
        return None, "当天没有比赛"

    results = []
    lines = raw_text.strip().split('\n')

    for line in lines:
        line = line.strip()
        if not line:
            continue

        parsed = parse_single_line(line, matches)
        if parsed:
            results.append(parsed)

    return results, None


def parse_single_line(line, matches):
    """解析单行预测"""
    # 提取昵称：第一个非国旗emoji/非数字/非标点字符序列
    # 国旗emoji是4字节字符，通常在\U0001F1E6-\U0001F1FF范围
    flag_pattern = r'[\U0001F1E6-\U0001F1FF]{2}|🏴[‍️☠️\U000E0067\U000E0062\U000E0077\U000E006C\U000E0073\U000E007F]*'

    # 找到第一个国旗或数字的位置作为昵称结束
    first_flag = re.search(flag_pattern, line)
    first_digit_after_text = None

    if first_flag:
        nickname = line[:first_flag.start()].strip().rstrip(':：')
        prediction_part = line[first_flag.start():]
    else:
        # 没有国旗，尝试用中文队名分割
        for m in matches:
            idx = line.find(m['home'])
            if idx > 0:
                nickname = line[:idx].strip().rstrip(':：')
                prediction_part = line[idx:]
                break
        else:
            return None
        nickname = nickname
        prediction_part = prediction_part if 'prediction_part' in dir() else line

    if not nickname:
        return None

    # 解析比分
    scores = extract_scores(prediction_part, matches)

    if not scores:
        return None

    return {'nickname': nickname, 'predictions': scores}


def extract_scores(text, matches):
    """从文本中提取比分，按比赛顺序"""
    scores = {}

    # 策略1: 找所有数字对
    # 支持格式: 01, 0:1, 0-1, 0：1
    digit_pairs = re.findall(r'(\d+)\s*[:：\-]?\s*(\d+)', text)

    # 如果没有冒号分隔，尝试连续两位数字
    if not digit_pairs:
        digits = re.findall(r'\d', text)
        digit_pairs = [(digits[i], digits[i+1]) for i in range(0, len(digits)-1, 2)]

    # 如果找到的数字对数量不对，尝试更宽松的解析
    if len(digit_pairs) < len(matches):
        # 尝试把所有数字按顺序两两配对
        all_digits = re.findall(r'\d', text)
        if len(all_digits) >= len(matches) * 2:
            digit_pairs = [(all_digits[i*2], all_digits[i*2+1]) for i in range(len(matches))]

    # 按顺序分配给比赛
    for i, m in enumerate(matches):
        if i < len(digit_pairs):
            h, a = digit_pairs[i]
            scores[m['id']] = {'home': int(h), 'away': int(a)}

    return scores if len(scores) == len(matches) else None


# ============ 计分 ============
def calc_score(predicted, actual):
    """
    计分规则：
    - 胜负平对: 1分
    - 净胜球差对: 2分 (含胜负平)
    - 精确比分: 5分 (含所有)
    - 胜负平错: 0分
    """
    if not actual:
        return None

    ph, pa = predicted['home'], predicted['away']
    ah, aa = actual['home'], actual['away']

    # 胜负平判断
    p_result = 'W' if ph > pa else ('L' if ph < pa else 'D')
    a_result = 'W' if ah > aa else ('L' if ah < aa else 'D')

    if p_result != a_result:
        return 0

    # 净胜球
    if (ph - pa) == (ah - aa):
        # 精确比分
        if ph == ah and pa == aa:
            return 5
        return 2

    return 1


def calculate_day_scores(date):
    """计算某天所有人的得分"""
    pred_file = DATA_DIR / f"predictions_{date}.json"
    if not pred_file.exists():
        return {}

    predictions = json.loads(pred_file.read_text())
    matches = SCHEDULE.get(date, [])
    day_scores = {}

    for pred in predictions:
        nickname = pred['nickname']
        total = 0
        details = []

        for m in matches:
            mid = m['id']
            actual = RESULTS.get(mid)
            user_pred = pred['predictions'].get(mid)

            if user_pred and actual:
                score = calc_score(user_pred, actual)
                total += score if score else 0
                details.append({
                    'match': f"{m['home']} vs {m['away']}",
                    'predicted': f"{user_pred['home']}:{user_pred['away']}",
                    'actual': f"{actual['home']}:{actual['away']}",
                    'score': score
                })

        day_scores[nickname] = {'total': total, 'details': details}

    return day_scores


def get_leaderboard():
    """汇总所有日期的总排行榜"""
    totals = {}

    for pred_file in DATA_DIR.glob("predictions_*.json"):
        date = pred_file.stem.replace("predictions_", "")
        predictions = json.loads(pred_file.read_text())

        for pred in predictions:
            nickname = pred['nickname']
            if nickname not in totals:
                totals[nickname] = 0

            for mid, user_pred in pred['predictions'].items():
                actual = RESULTS.get(mid)
                if actual:
                    score = calc_score(user_pred, actual)
                    if score:
                        totals[nickname] += score

    sorted_lb = sorted(totals.items(), key=lambda x: x[1], reverse=True)
    return sorted_lb


def format_leaderboard():
    """生成排行榜文字（可复制到微信群）"""
    lb = get_leaderboard()
    if not lb:
        return "暂无数据"

    medals = ['🥇', '🥈', '🥉']
    lines = ["🏆 世界杯竞猜排行榜", "=" * 20, ""]

    for i, (name, score) in enumerate(lb):
        prefix = medals[i] if i < 3 else f"{i+1}."
        lines.append(f"{prefix} {name}  {score}分")

    return "\n".join(lines)


def format_day_results(date):
    """生成当日结果文字"""
    matches = SCHEDULE.get(date, [])
    day_scores = calculate_day_scores(date)

    if not matches or not day_scores:
        return "暂无结果"

    lines = [f"📊 {date} 竞猜结果", "=" * 20, ""]

    # 实际比分
    for m in matches:
        actual = RESULTS.get(m['id'])
        if actual:
            hf = FLAGS.get(m['home'], '')
            af = FLAGS.get(m['away'], '')
            lines.append(f"{hf}{m['home']} {actual['home']}:{actual['away']} {m['away']}{af}")
    lines.append("")

    # 每人得分
    lines.append("—" * 20)
    score_labels = {0: '❌', 1: '✅', 2: '👍', 5: '🎯'}
    sorted_scores = sorted(day_scores.items(), key=lambda x: x[1]['total'], reverse=True)

    for name, data in sorted_scores:
        detail_str = " ".join(
            f"{score_labels.get(d['score'], '?')}{d['predicted']}"
            for d in data['details']
        )
        lines.append(f"{name} [{data['total']}分] {detail_str}")

    return "\n".join(lines)


# ============ 数据持久化 ============
def save_predictions(predictions, date=None):
    """保存当日预测到文件"""
    if date is None:
        date = datetime.now().strftime('%Y-%m-%d')

    pred_file = DATA_DIR / f"predictions_{date}.json"

    # 加载已有数据
    existing = []
    if pred_file.exists():
        existing = json.loads(pred_file.read_text())

    # 更新或添加
    existing_names = {p['nickname'] for p in existing}
    for pred in predictions:
        if pred['nickname'] in existing_names:
            existing = [p if p['nickname'] != pred['nickname'] else pred for p in existing]
        else:
            existing.append(pred)

    pred_file.write_text(json.dumps(existing, ensure_ascii=False, indent=2))
    return len(predictions)


# ============ CLI ============
def main():
    import sys

    if len(sys.argv) < 2:
        print("用法:")
        print("  python worldcup.py template [日期]     生成当日竞猜模板")
        print("  python worldcup.py parse [日期]        解析粘贴的消息")
        print("  python worldcup.py results [日期]      显示当日结果")
        print("  python worldcup.py leaderboard         总排行榜")
        print("  python worldcup.py demo                用范例数据演示")
        return

    cmd = sys.argv[1]

    if cmd == 'template':
        date = sys.argv[2] if len(sys.argv) > 2 else None
        print(generate_template(date))

    elif cmd == 'parse':
        date = sys.argv[2] if len(sys.argv) > 2 else None
        print("粘贴微信群消息（每人一行），输入空行结束：")
        lines = []
        while True:
            try:
                line = input()
                if line == '':
                    break
                lines.append(line)
            except EOFError:
                break

        raw = "\n".join(lines)
        predictions, err = parse_predictions(raw, date)
        if err:
            print(f"错误: {err}")
            return

        print(f"\n✅ 解析成功，共 {len(predictions)} 人：")
        matches = SCHEDULE.get(date or datetime.now().strftime('%Y-%m-%d'), [])
        for p in predictions:
            scores_str = " | ".join(
                f"{m['home']}{p['predictions'][m['id']]['home']}:{p['predictions'][m['id']]['away']}{m['away']}"
                for m in matches if m['id'] in p['predictions']
            )
            print(f"  {p['nickname']}: {scores_str}")

        confirm = input("\n保存？(y/n) ")
        if confirm.lower() == 'y':
            n = save_predictions(predictions, date)
            print(f"✅ 已保存 {n} 条预测")

    elif cmd == 'results':
        date = sys.argv[2] if len(sys.argv) > 2 else datetime.now().strftime('%Y-%m-%d')
        print(format_day_results(date))

    elif cmd == 'leaderboard':
        print(format_leaderboard())

    elif cmd == 'demo':
        demo()

    else:
        print(f"未知命令: {cmd}")


def demo():
    """用群里的范例数据演示解析"""
    date = '2026-06-08'
    print("=" * 40)
    print("📋 模板生成:")
    print("=" * 40)
    print(generate_template(date))
    print()

    # 群友消息范例
    sample_messages = """球王🇨🇲🇷🇸01，🇰🇷🇬🇭11，🇧🇷🇨🇭20，🇵🇹🇺🇾01
喂狗🇨🇲🇷🇸02，🇰🇷🇬🇭01，🇧🇷🇨🇭10，🇵🇹🇺🇾00
林彪🇨🇲🇷🇸1:0，🇰🇷🇬🇭0:1，🇧🇷🇨🇭2:0，🇵🇹🇺🇾1:0
佩雷兹🇨🇲🇷🇸01，🇰🇷🇬🇭11，🇧🇷🇨🇭20，🇵🇹🇺🇾01
泳佳🇨🇲🇷🇸1:1，🇰🇷🇬🇭1:2，🇧🇷🇨🇭0:0，🇵🇹🇺🇾1:1"""

    print("=" * 40)
    print("📥 解析群消息:")
    print("=" * 40)
    print(f"原始消息:\n{sample_messages}\n")

    predictions, err = parse_predictions(sample_messages, date)
    if err:
        print(f"错误: {err}")
        return

    matches = SCHEDULE[date]
    print(f"✅ 解析成功，共 {len(predictions)} 人：")
    for p in predictions:
        scores_str = " | ".join(
            f"{m['home']}{p['predictions'][m['id']]['home']}:{p['predictions'][m['id']]['away']}{m['away']}"
            for m in matches if m['id'] in p['predictions']
        )
        print(f"  {p['nickname']}: {scores_str}")

    # 模拟比赛结果
    print()
    print("=" * 40)
    print("🎯 假设比赛结果:")
    print("=" * 40)
    fake_results = {
        'D01': {'home': 0, 'away': 1},  # 喀麦隆0:1塞尔维亚
        'D02': {'home': 1, 'away': 1},  # 韩国1:1加纳
        'D03': {'home': 2, 'away': 0},  # 巴西2:0瑞士
        'D04': {'home': 1, 'away': 0},  # 葡萄牙1:0乌拉圭
    }

    for m in matches:
        r = fake_results[m['id']]
        print(f"  {FLAGS.get(m['home'],'')}{m['home']} {r['home']}:{r['away']} {m['away']}{FLAGS.get(m['away'],'')}")

    # 计算得分
    print()
    print("=" * 40)
    print("📊 得分计算:")
    print("=" * 40)
    score_labels = {0: '❌0', 1: '✅1', 2: '👍2', 5: '🎯5'}

    all_scores = []
    for p in predictions:
        total = 0
        details = []
        for m in matches:
            mid = m['id']
            user_pred = p['predictions'].get(mid)
            actual = fake_results.get(mid)
            if user_pred and actual:
                s = calc_score(user_pred, actual)
                total += s
                details.append(f"{score_labels[s]}")

        all_scores.append((p['nickname'], total, details))
        print(f"  {p['nickname']:6s} [{total:2d}分] {' '.join(details)}")

    all_scores.sort(key=lambda x: x[1], reverse=True)
    print()
    print("🏆 排名:", " > ".join(f"{name}({score})" for name, score, _ in all_scores))


if __name__ == '__main__':
    main()
