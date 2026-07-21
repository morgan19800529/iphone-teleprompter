/* 直播/口播稿 AI 生成层
 *
 * 设计要点：对外只暴露 LiveScript.generate(opts)，内部怎么拿到 AI 结果是可替换的。
 * 现在是浏览器直连 Anthropic API（密钥存本机，仅供自用）。
 * 将来对外发布时，把 callModel() 换成请求自己的服务端代理即可，上层无需改动。
 */
window.LiveScript = (function () {
  const KEY_STORE = 'teleprompter-ai';

  const defaults = { apiKey: '', model: 'claude-sonnet-5', endpoint: '' };

  function config() {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY_STORE) || '{}') }; }
    catch { return { ...defaults }; }
  }

  function setConfig(patch) {
    localStorage.setItem(KEY_STORE, JSON.stringify({ ...config(), ...patch }));
  }

  const KIND_LABEL = { live: '直播', video: '口播视频' };

  function buildPrompt({ topic, kind, duration }) {
    const label = KIND_LABEL[kind] || '直播';
    const words = Math.round(duration * 220);   // 中文口播每分钟约 220 字

    return `你是一位帮中文创作者做内容的直播策划，服务的对象是普通人，不是专业主播。

用户要做一场关于「${topic}」的${label}，时长约 ${duration} 分钟，正文大约 ${words} 字。

写一份可以直接照着念的稿子。硬性要求：

1. 口语化。这是要被念出来的，不是写文章。用短句。不要书面语，不要长定语，不要"综上所述""值得注意的是"这类词。
2. 开场 30 秒内必须抛出一个具体钩子——一个反常识的事实、一个真实数字、或一个让人想知道答案的问题。禁止用"大家好我是某某""今天跟大家聊聊"这种开场。
3. 每隔 3 到 5 分钟设置一个留人节点，预告后面要讲的具体内容。必须说清楚是什么，不能只说"等下有干货""后面更精彩"。
4. 安排 2 到 3 个互动点，抛出观众能用一句话回答的问题。
5. 全程第一人称，语气像跟朋友聊天，可以有停顿、口头禅、自嘲。
6. 内容要有具体的细节、数字、亲身经历。空泛的道理没人听。
7. 结尾给一个明确的行动引导，自然，不要硬推销。

只输出 JSON，不要有任何其他文字、不要用代码块包裹：
{
  "title": "能让人点进来的标题，20字以内",
  "outline": ["提纲，5到8条，每条一句话"],
  "hooks": [{"at": "第几分钟", "line": "具体那句留人的话"}],
  "interactions": ["互动问题"],
  "script": "完整稿子全文，用两个换行分段，可以直接照着念"
}`;
  }

  /* ---- 可替换层：换成后端代理时只改这个函数 ---- */
  async function callModel(prompt, maxTokens) {
    const cfg = config();

    // 如果配置了自己的服务端代理，优先走代理（未来正式版路径）
    if (cfg.endpoint) {
      const r = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, maxTokens })
      });
      if (!r.ok) throw new Error('服务端返回 ' + r.status);
      const data = await r.json();
      return data.text || '';
    }

    // 自用路径：浏览器直连 Anthropic
    if (!cfg.apiKey) {
      const e = new Error('还没有设置 API Key');
      e.code = 'NO_KEY';
      throw e;
    }

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: cfg.model || defaults.model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!r.ok) {
      let detail = '';
      try { detail = (await r.json()).error?.message || ''; } catch {}
      const e = new Error(errorText(r.status, detail));
      e.code = 'API_' + r.status;
      throw e;
    }

    const data = await r.json();
    return (data.content || []).map(c => c.text || '').join('').trim();
  }

  function errorText(status, detail) {
    if (status === 401) return 'API Key 无效，检查一下是不是复制错了';
    if (status === 429) return '请求太频繁或额度用完了，等一会再试';
    if (status === 400) return '请求被拒绝：' + (detail || '参数有问题');
    if (status >= 500) return 'Anthropic 服务端出错，稍后重试';
    return '生成失败（' + status + '）' + (detail ? '：' + detail : '');
  }

  /* ---- JSON 解析，容忍模型偶尔加代码块或前后废话 ---- */
  function parseResult(raw) {
    let text = String(raw || '').trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

    let obj = null;
    try {
      obj = JSON.parse(text);
    } catch {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end > start) {
        try { obj = JSON.parse(text.slice(start, end + 1)); } catch {}
      }
    }

    // 实在解析不出来，就把原文当稿子用，总比报错强
    if (!obj || typeof obj !== 'object' || !obj.script) {
      return { title: '', outline: [], hooks: [], interactions: [], script: text, degraded: true };
    }

    return {
      title: String(obj.title || '').slice(0, 40),
      outline: Array.isArray(obj.outline) ? obj.outline.map(String) : [],
      hooks: Array.isArray(obj.hooks)
        ? obj.hooks.map(h => (typeof h === 'string' ? { at: '', line: h } : { at: String(h.at || ''), line: String(h.line || '') }))
        : [],
      interactions: Array.isArray(obj.interactions) ? obj.interactions.map(String) : [],
      script: String(obj.script || '').trim(),
      degraded: false
    };
  }

  async function generate({ topic, kind = 'live', duration = 30 }) {
    if (!topic || !topic.trim()) {
      const e = new Error('先写个主题');
      e.code = 'NO_TOPIC';
      throw e;
    }
    const prompt = buildPrompt({ topic: topic.trim(), kind, duration: Number(duration) });
    const maxTokens = Math.min(32000, Math.max(4000, Number(duration) * 400));
    const raw = await callModel(prompt, maxTokens);
    const result = parseResult(raw);
    result.meta = { topic: topic.trim(), kind, duration: Number(duration), generatedAt: Date.now() };
    return result;
  }

  return { generate, config, setConfig, parseResult, buildPrompt, KIND_LABEL };
})();
