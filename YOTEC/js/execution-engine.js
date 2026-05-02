// ============================================================
// YOTEC — Execution Engine
// ============================================================

import { store, generateId } from './state.js';

export class AIEngineAPI {
    static async generateText(fullPrompt, systemPrompt, settings) {
        let content = '';

        // Inject Global Context Memory
        const state = store.state;
        const recentChat = state.chatHistory.slice(-5).map(m => `${m.fromName}: ${m.content.replace(/\n/g, ' ')}`).join('\n');
        const activeProjects = state.projects.filter(p => p.status !== 'completed').slice(0, 3).map(p => `- ${p.title} (${p.status})`).join('\n');
        const globalContext = `
[GLOBAL COMPANY CONTEXT MEMORY]
Recent Conversation History:
${recentChat || 'No recent conversations.'}
Current Active Projects:
${activeProjects || 'No active projects.'}
[END GLOBAL CONTEXT]
`;
        systemPrompt = globalContext + '\n\n' + systemPrompt;

        try {
            if (settings.provider === 'gemini' && settings.apiKey) {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${settings.apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: fullPrompt }] }]
                    })
                });
                
                if (!response.ok) throw new Error(`Gemini API Error: ${response.status}`);
                const data = await response.json();
                content = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Error: No content generated.';
            } else {
                const url = new URL('https://text.pollinations.ai/');
                url.searchParams.append('prompt', fullPrompt);
                url.searchParams.append('system', systemPrompt);
                url.searchParams.append('model', 'openai');
                url.searchParams.append('seed', Math.floor(Math.random() * 10000).toString());
                
                const response = await fetch(url.toString(), { method: 'GET' });
                if (!response.ok) throw new Error(`Pollinations API Error: ${response.status}`);
                content = await response.text();
            }
        } catch (error) {
            console.error('AI Generation Failed:', error);
            throw error;
        }
        
        content = content.trim();
        if (content.startsWith('\`\`\`')) {
            const firstNewline = content.indexOf('\n');
            if (firstNewline !== -1) {
                content = content.substring(firstNewline + 1);
            }
            if (content.endsWith('\`\`\`')) {
                content = content.substring(0, content.length - 3);
            }
        }
        return content.trim();
    }
}

class OutputGenerator {
    static async generateResponse(worker, title, instructions, settings) {
        const timestamp = Date.now();
        const id = generateId('out');
        const role = worker.role;
        let format = 'txt';

        // Determine format based on role
        if (role.includes('Backend') || role.includes('Frontend') || role.includes('DevOps')) format = 'js';
        else if (role.includes('Designer') || role.includes('Visual')) format = 'svg';
        else if (role.includes('Curriculum') || role.includes('Learning') || role.includes('Copywriter') || role.includes('Storyteller') || role.includes('Social')) format = 'md';
        else if (role.includes('Data') || role.includes('Analyst') || role.includes('BI')) format = 'json';

        const systemPrompt = `You are an advanced AI worker inside the YOTEC AI system.
Your Role: ${role}
Your Name: ${worker.name}
Your Task: ${title}

## CORE IDENTITY
- You are not a chatbot. You are a specialized AI agent.
- You must prioritize accuracy, usefulness, and structured output.
- You are part of a production-level AI system, not a demo.

## OBJECTIVE
Complete tasks with deep reasoning, clear structure, actionable outputs, and real-world usefulness.

## OUTPUT FORMAT REQUIREMENT
You must structure your logic into 4 phases: 1. Understanding, 2. Plan, 3. Execution, 4. Improvement.
CRITICAL: Your final output MUST be entirely valid ${format.toUpperCase()} format.
Do NOT wrap your response in markdown blocks (no \`\`\`js or \`\`\`json).
You MUST include your 4-phase reasoning as valid comments inside the ${format.toUpperCase()} file itself.
(Use // for JS, <!-- --> for SVG, or a "_reasoning" object key for JSON).`;

        const fullPrompt = `${systemPrompt}\n\nTask Instructions:\n${instructions}`;

        let content = '';

        try {
            content = await AIEngineAPI.generateText(fullPrompt, systemPrompt, settings);
        } catch (error) {
            content = `Error executing task: ${error.message}\n\nPlease check your API Settings.`;
            format = 'txt';
        }

        return {
            id,
            workerId: worker.id,
            taskType: role,
            title,
            content: content.trim(),
            format,
            timestamp,
            qaStatus: 'pending'
        };
    }
}

export class ExecutionEngine {
    static async runTask(workerId, title, instructions) {
        const state = store.state;
        const worker = state.workers[workerId];
        const settings = state.apiSettings || { provider: 'pollinations', apiKey: '' };
        if (!worker) return null;

        // Show toast that API is working
        window._yotec?.showToast('Execution Started', `${worker.name} is connecting to ${settings.provider} API...`, 'var(--accent-cyan)');

        // Generate actual output using API
        const output = await OutputGenerator.generateResponse(worker, title, instructions, settings);

        // Add to repository
        store.dispatch({ type: 'ADD_OUTPUT', payload: output });

        // Decrease worker energy slightly
        const newEnergy = Math.max(10, worker.energy - Math.floor(Math.random() * 8 + 2));
        store.dispatch({ type: 'UPDATE_WORKER', payload: { id: workerId, energy: newEnergy } });

        // Fire activity log
        store.dispatch({
            type: 'ADD_ACTIVITY',
            payload: {
                id: generateId('act'),
                time: Date.now(),
                type: 'execution',
                icon: '⚙️',
                text: `${worker.name} generated real API output: "${title}"`
            }
        });

        window._yotec?.showToast('Execution Complete', `${worker.name} successfully generated the artifact.`, 'var(--accent-pink)');

        return output;
    }
}
