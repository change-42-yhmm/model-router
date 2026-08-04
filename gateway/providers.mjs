function keyFor(model) { const key = process.env[model.apiKeyEnv]; if (!key) throw new Error(`Missing API key environment variable: ${model.apiKeyEnv}`); return key; }
async function request(url, options) { const response = await fetch(url, options); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(`Provider request failed (${response.status}): ${body.error?.message || JSON.stringify(body)}`); return body; }

export async function runModel(model, step) {
  const key = keyFor(model), started = performance.now(), base = model.baseUrl.replace(/\/$/, ''); let body;
  if (model.type === 'openai-responses') {
    body = await request(`${base}/responses`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: model.model, input: step.input || step.title, reasoning: model.reasoningEffort ? { effort: model.reasoningEffort } : undefined }) });
    return { output: body.output_text || '', usage: body.usage || {}, raw: body, latencyMs: Math.round(performance.now() - started) };
  }
  if (model.type === 'anthropic-messages') {
    body = await request(`${base}/v1/messages`, { method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, body: JSON.stringify({ model: model.model, max_tokens: 4096, messages: [{ role: 'user', content: step.input || step.title }] }) });
    return { output: body.content?.map(part => part.text || '').join('') || '', usage: body.usage || {}, raw: body, latencyMs: Math.round(performance.now() - started) };
  }
  if (model.type === 'google-generate-content') {
    body = await request(`${base}/v1beta/models/${model.model}:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: step.input || step.title }] }] }) });
    return { output: body.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '', usage: body.usageMetadata || {}, raw: body, latencyMs: Math.round(performance.now() - started) };
  }
  if (model.type === 'openai-compatible') {
    const payload = { model: model.model, messages: [{ role: 'user', content: step.input || step.title }] };
    if (model.thinkingMode) payload.thinking = { type: model.thinkingMode };
    if (model.reasoningEffort) payload.reasoning_effort = model.reasoningEffort;
    body = await request(`${base}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return { output: body.choices?.[0]?.message?.content || '', usage: body.usage || {}, raw: body, latencyMs: Math.round(performance.now() - started) };
  }
  throw new Error(`Unsupported provider type: ${model.type}`);
}
