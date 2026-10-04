#!/usr/bin/env node
'use strict';

/**
 * ai-feel-checker — 中文文本 AI 痕迹的机械检查 MCP 服务。
 *
 * 只做"能算的"那一部分：标点频率、句长分布、高频词密度、台词提取。
 * 风格判断仍然交给模型，这里只负责给数。
 *
 * 零依赖，走 stdio，按行收发 JSON-RPC 2.0。
 */

const PUNCT = new Set([
  '，', '。', '！', '？', '；', '：', '、', '—', '…',
  '\u201C', '\u201D', '\u300C', '\u300D', '\u300E', '\u300F',
  '（', '）', '《', '》', '　', ' ',
  ',', '.', '!', '?', ';', ':', '"', "'", '(', ')', '-',
]);

const QUOTE_PAIRS = [
  ['\u201C', '\u201D'], // “ ”
  ['\u300C', '\u300D'], // 「 」
];

const WORD_LISTS = {
  f: [
    '此外', '至关重要', '深入探讨', '充满活力', '不断演变', '无缝', '赋能', '闭环',
    '抓手', '彰显', '诠释', '交织', '碰撞', '勾勒', '映照', '浸润', '氤氲', '蜕变',
    '救赎', '觉醒', '张力', '楔子',
  ],
  buffer: [
    '仿佛', '似乎', '某种', '一丝', '一抹', '静静', '轻轻', '缓缓', '微微',
    '这一刻', '那一刻', '不知为何', '莫名',
  ],
};

// ---------- 文本工具 ----------

function countChar(text, ch) {
  let n = 0;
  for (const c of text) if (c === ch) n++;
  return n;
}

function countInSet(text, set) {
  let n = 0;
  for (const c of text) if (set.has(c)) n++;
  return n;
}

/** 去掉引号里的台词，只留叙述。 */
function narrativeOnly(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    let consumed = false;
    for (const [open, close] of QUOTE_PAIRS) {
      if (text[i] === open) {
        const end = text.indexOf(close, i + 1);
        i = end === -1 ? i + 1 : end + 1;
        consumed = true;
        break;
      }
    }
    if (!consumed) {
      out += text[i];
      i++;
    }
  }
  return out;
}

function countEllipsis(text) {
  const m = text.match(/……|…|\.{3,}/g);
  return m ? m.length : 0;
}

function paragraphs(text) {
  return text.split(/\n\s*\n|\n/).map((s) => s.trim()).filter(Boolean);
}

function charLength(s) {
  let n = 0;
  for (const c of s) {
    if (PUNCT.has(c)) continue;
    if (/\s/.test(c)) continue;
    n++;
  }
  return n;
}

function splitSentences(text) {
  return text
    .split(/[。！？…]+/)
    .map((s) => s.trim())
    .filter((s) => charLength(s) > 0);
}

function ratioVerdict(r) {
  if (r === null) return '没有句号，无法判断';
  if (r < 1.0) return '碎句成灾：句号扎堆，逗号过少';
  if (r < 1.2) return '偏低：句号仍偏多';
  if (r <= 1.6) return '正常（1.2–1.6）';
  if (r <= 2.0) return '偏高：长句偏多';
  return '一逗到底的长流水句';
}

function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

// ---------- 工具实现 ----------

function checkPunctuation({ text }) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('需要 text 参数（非空字符串）');
  }
  const nar = narrativeOnly(text);

  const rows = [
    ['逗号（，）', countChar(text, '，'), countChar(nar, '，')],
    ['句号（。）', countChar(text, '。'), countChar(nar, '。')],
    ['顿号（、）', countChar(text, '、'), countChar(nar, '、')],
    ['分号（；）', countChar(text, '；'), countChar(nar, '；')],
    ['破折号（—）', countChar(text, '—'), countChar(nar, '—')],
    ['省略号（……）', countEllipsis(text), countEllipsis(nar)],
    ['感叹/问号（！？）', countChar(text, '！') + countChar(text, '？'), countChar(nar, '！') + countChar(nar, '？')],
  ];

  const commaAll = countChar(text, '，');
  const periodAll = countChar(text, '。');
  const commaNar = countChar(nar, '，');
  const periodNar = countChar(nar, '。');
  const rAll = periodAll === 0 ? null : commaAll / periodAll;
  const rNar = periodNar === 0 ? null : commaNar / periodNar;

  const lines = [];
  lines.push('## 标点频率');
  lines.push('');
  lines.push('| 项 | 全篇 | 仅叙述 |');
  lines.push('|---|---|---|');
  for (const [name, a, b] of rows) lines.push(`| ${name} | ${a} | ${b} |`);
  lines.push(`| **逗号÷句号** | **${rAll === null ? '—' : fmt(rAll)}** | **${rNar === null ? '—' : fmt(rNar)}** |`);
  lines.push('');
  lines.push(`判定：${ratioVerdict(rNar !== null ? rNar : rAll)}（以叙述层为准；DS13 的正常区间是 1.2–1.6）`);

  const dashNar = countChar(nar, '—');
  if (dashNar > 4) {
    lines.push('');
    lines.push(`提示：叙述层破折号 ${dashNar} 处，偏多，建议压到三四处以内。`);
  }

  const flagged = [];
  paragraphs(text).forEach((p, idx) => {
    const len = charLength(p);
    if (len < 40) return;
    const c = countChar(p, '，');
    const d = countChar(p, '。');
    if (d === 0) return;
    const r = c / d;
    if (r < 1.0) flagged.push(`第 ${idx + 1} 段：逗号÷句号 = ${fmt(r)}（${len} 字）→ 碎句`);
    else if (r > 2.0) flagged.push(`第 ${idx + 1} 段：逗号÷句号 = ${fmt(r)}（${len} 字）→ 长流水句`);
  });
  if (flagged.length) {
    lines.push('');
    lines.push('### 需要看的段落');
    for (const f of flagged) lines.push(`- ${f}`);
  }

  return lines.join('\n');
}

function checkSentenceLengths({ text }) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('需要 text 参数（非空字符串）');
  }
  const sentences = splitSentences(text);
  if (sentences.length === 0) return '没有识别到句子（检查是否缺少句号等句末标点）。';

  const lens = sentences.map(charLength);
  const n = lens.length;
  const mean = lens.reduce((a, b) => a + b, 0) / n;
  const variance = lens.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const stdev = Math.sqrt(variance);
  const sorted = [...lens].sort((a, b) => a - b);
  const median = sorted[Math.floor(n / 2)];

  const buckets = [
    ['1–10 字', 1, 10], ['11–20 字', 11, 20], ['21–30 字', 21, 30],
    ['31–40 字', 31, 40], ['41–60 字', 41, 60], ['60 字以上', 61, Infinity],
  ];
  const bucketCounts = buckets.map(([, lo, hi]) => lens.filter((l) => l >= lo && l <= hi).length);
  const maxIdx = bucketCounts.indexOf(Math.max(...bucketCounts));
  const maxShare = bucketCounts[maxIdx] / n;

  const lines = [];
  lines.push('## 句长分布');
  lines.push('');
  lines.push(`句数 ${n}　平均 ${mean.toFixed(1)} 字　中位 ${median} 字　标准差 ${stdev.toFixed(1)}　最短 ${sorted[0]}　最长 ${sorted[n - 1]}`);
  lines.push('');
  lines.push('| 区间 | 句数 | 占比 |');
  lines.push('|---|---|---|');
  buckets.forEach(([name], i) => {
    lines.push(`| ${name} | ${bucketCounts[i]} | ${Math.round((bucketCounts[i] / n) * 100)}% |`);
  });
  lines.push('');
  const MIN_N = 6;
  if (n < MIN_N) {
    lines.push(`判定：句数只有 ${n} 句，样本太少，不做分布结论。`);
    if (maxShare > 0.5) {
      lines.push(`提示：其中 ${Math.round(maxShare * 100)}% 的句子落在「${buckets[maxIdx][0]}」，短文本下同样可疑，建议连同 check_punctuation 的标点比例一起看。`);
    }
  } else if (maxShare > 0.5) {
    lines.push(`判定：句长偏均匀——${Math.round(maxShare * 100)}% 的句子落在「${buckets[maxIdx][0]}」。节奏被拉平了，主动制造落差。`);
  } else if (stdev < 6) {
    lines.push(`判定：标准差偏小（${stdev.toFixed(1)}），句长起伏不足。`);
  } else {
    lines.push('判定：句长有一定起伏。');
  }

  return lines.join('\n');
}

function scanWords({ text, list = 'both', words }) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('需要 text 参数（非空字符串）');
  }
  let targets = [];
  if (Array.isArray(words) && words.length) {
    targets = words.slice();
  } else if (list === 'f') {
    targets = WORD_LISTS.f;
  } else if (list === 'buffer') {
    targets = WORD_LISTS.buffer;
  } else {
    targets = [...WORD_LISTS.f, ...WORD_LISTS.buffer];
  }

  const paras = paragraphs(text);
  const hits = [];
  for (const w of targets) {
    let total = 0;
    const where = [];
    paras.forEach((p, idx) => {
      let c = 0;
      let pos = p.indexOf(w);
      while (pos !== -1) {
        c++;
        pos = p.indexOf(w, pos + w.length);
      }
      if (c > 0) {
        total += c;
        where.push(`第 ${idx + 1} 段×${c}`);
      }
    });
    if (total > 0) hits.push({ w, total, where });
  }

  hits.sort((a, b) => b.total - a.total);

  const lines = [];
  lines.push('## 高频词密度');
  lines.push('');
  if (hits.length === 0) {
    lines.push('没有命中词表里的词。');
    return lines.join('\n');
  }
  const grand = hits.reduce((a, b) => a + b.total, 0);
  lines.push(`命中 ${hits.length} 个词，共 ${grand} 次。单独出现不是罪，扎堆才是信号。`);
  lines.push('');
  lines.push('| 词 | 次数 | 位置 |');
  lines.push('|---|---|---|');
  for (const h of hits) lines.push(`| ${h.w} | ${h.total} | ${h.where.join('，')} |`);
  return lines.join('\n');
}

function extractDialogue({ text }) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('需要 text 参数（非空字符串）');
  }
  const lines = [];
  let order = 0;
  paragraphs(text).forEach((p, idx) => {
    for (const [open, close] of QUOTE_PAIRS) {
      let from = 0;
      for (;;) {
        const s = p.indexOf(open, from);
        if (s === -1) break;
        const e = p.indexOf(close, s + 1);
        if (e === -1) break;
        const line = p.slice(s + 1, e).trim();
        if (line) {
          order++;
          lines.push(`${order}. （第 ${idx + 1} 段）${line}`);
        }
        from = e + 1;
      }
    }
  });

  const out = [];
  out.push('## 台词提取');
  out.push('');
  if (lines.length === 0) {
    out.push('没有识别到引号台词（支持 “ ” 与 「 」）。');
    return out.join('\n');
  }
  out.push(`共 ${lines.length} 句。遮住说话人看一遍：分不出谁在说，就是对话同腔（D6 / DS9）。`);
  out.push('');
  out.push(...lines);
  return out.join('\n');
}

// ---------- MCP 协议 ----------

const TOOLS = [
  {
    name: 'check_punctuation',
    description:
      '统计标点频率：逗号、句号、顿号、破折号、省略号等，并给出"逗号÷句号"。同时输出全篇与去掉台词后的叙述层两个数。汉语叙事正常落在 1.2–1.6，低于 1.0 是碎句成灾，高于 2.0 是一逗到底。',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', description: '要检查的正文' } },
      required: ['text'],
    },
    handler: checkPunctuation,
  },
  {
    name: 'check_sentence_lengths',
    description: '统计句长分布：句数、平均、中位、标准差、区间分布，并判断句长是否被拉平。',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', description: '要检查的正文' } },
      required: ['text'],
    },
    handler: checkSentenceLengths,
  },
  {
    name: 'scan_words',
    description: '扫描中文 AI 高频词与缓冲词的密度，按段给出位置。词表：f（此外、赋能、闭环、氤氲……）、buffer（仿佛、似乎、某种、静静、缓缓……）。',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要检查的正文' },
        list: { type: 'string', enum: ['f', 'buffer', 'both'], description: '用哪张词表，默认 both' },
        words: { type: 'array', items: { type: 'string' }, description: '可选，自定义词表，给了就覆盖 list' },
      },
      required: ['text'],
    },
    handler: scanWords,
  },
  {
    name: 'extract_dialogue',
    description: '按顺序抽出所有引号台词（“ ”与「 」），用于"遮住说话人看分不分得出是谁"的对话同腔检查。',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', description: '要检查的正文' } },
      required: ['text'],
    },
    handler: extractDialogue,
  },
];

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function ok(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function fail(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

function handle(msg) {
  const { id, method, params } = msg;
  const isNotification = id === undefined || id === null;

  switch (method) {
    case 'initialize':
      ok(id, {
        protocolVersion: (params && params.protocolVersion) || '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'ai-feel-checker', version: '0.1.0' },
      });
      return;
    case 'notifications/initialized':
    case 'initialized':
      return;
    case 'ping':
      ok(id, {});
      return;
    case 'tools/list':
      ok(id, {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      });
      return;
    case 'tools/call': {
      const name = params && params.name;
      const args = (params && params.arguments) || {};
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) {
        ok(id, {
          content: [{ type: 'text', text: `未知工具：${name}` }],
          isError: true,
        });
        return;
      }
      try {
        const text = tool.handler(args);
        ok(id, { content: [{ type: 'text', text }] });
      } catch (err) {
        ok(id, {
          content: [{ type: 'text', text: `执行失败：${err && err.message ? err.message : String(err)}` }],
          isError: true,
        });
      }
      return;
    }
    default:
      if (!isNotification) fail(id, -32601, `未实现的方法：${method}`);
  }
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch (err) {
      continue;
    }
    try {
      handle(msg);
    } catch (err) {
      if (msg && msg.id !== undefined && msg.id !== null) fail(msg.id, -32603, String(err));
    }
  }
});

process.stdin.on('end', () => process.exit(0));
