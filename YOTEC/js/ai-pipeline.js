// ============================================================
// YOTEC — AI Request Pipeline (Intent → Route → Prompt → Format)
// ============================================================

const MODE_PROMPTS = {
  tutor: `You are YOTEC Tutor Mode. Teach clearly, step-by-step, and adapt to learner level. Include a tiny quiz check when useful.`,
  developer: `You are YOTEC Developer Mode. Provide practical implementation guidance, clean architecture suggestions, and concise code when needed.`,
  strategy: `You are YOTEC Strategy Mode. Focus on business outcomes, trade-offs, prioritization, and measurable KPIs.`
};

export function analyzeIntent(input = '') {
  const text = input.toLowerCase();

  if (/quiz|test me|practice/.test(text)) return { intent: 'quiz', confidence: 0.8 };
  if (/build|code|api|bug|debug|refactor/.test(text)) return { intent: 'build', confidence: 0.8 };
  if (/plan|strategy|roadmap|market|growth/.test(text)) return { intent: 'strategy', confidence: 0.8 };
  if (/explain|teach|learn|understand/.test(text)) return { intent: 'teach', confidence: 0.8 };

  return { intent: 'general', confidence: 0.5 };
}

export function routeTask(intent, mode) {
  if (mode === 'tutor') return 'tutor-worker';
  if (mode === 'developer') return 'dev-worker';
  if (mode === 'strategy') return 'strategy-worker';

  if (intent === 'build') return 'dev-worker';
  if (intent === 'teach' || intent === 'quiz') return 'tutor-worker';
  return 'strategy-worker';
}

export function buildContextPayload(state, mode) {
  const recent = state.chatHistory.slice(-6).map(m => ({ from: m.fromName, text: m.content }));
  return {
    user_level: mode === 'tutor' ? 'student' : 'builder',
    goal: mode === 'tutor' ? 'learn fast' : 'ship quality output',
    history: recent,
    mode
  };
}

export function buildPrompt(mode, input, context, intent) {
  const modePrompt = MODE_PROMPTS[mode] || MODE_PROMPTS.strategy;
  return `${modePrompt}\n\n[CONTEXT]\n${JSON.stringify(context)}\n[/CONTEXT]\n\n[INTENT]\n${intent}\n[/INTENT]\n\n[USER INPUT]\n${input}`;
}

export function formatResponse(mode, worker, content) {
  const badge = mode === 'tutor' ? '🎓 Tutor' : mode === 'developer' ? '💻 Dev' : '📈 Strategy';
  return `${badge} · ${worker}\n\n${content}`;
}
