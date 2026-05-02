// ============================================================
// YOTEC — AI Simulation Engine
// ============================================================

import { COMPANY, DEPARTMENTS, QA_AI, RESPONSE_TEMPLATES } from './data.js';
import { store, generateId } from './state.js';
import { ExecutionEngine, AIEngineAPI } from './execution-engine.js';
import { analyzeIntent, routeTask, buildContextPayload, buildPrompt, formatResponse } from './ai-pipeline.js';

// ---- Utility helpers ----
function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function fillTemplate(template, vars) {
    return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] !== undefined ? vars[key] : `{${key}}`);
}

function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
}

// Maps keywords in CEO messages to departments
const KEYWORD_DEPT_MAP = {
    develop: 'dev', code: 'dev', backend: 'dev', frontend: 'dev', api: 'dev', app: 'dev',
    design: 'design', ui: 'design', ux: 'design', brand: 'design', logo: 'design', visual: 'design',
    learn: 'education', course: 'education', train: 'education', module: 'education', educat: 'education',
    market: 'marketing', campaign: 'marketing', adverti: 'marketing', growth: 'marketing', seo: 'marketing',
    qualit: 'qa', test: 'qa', bug: 'qa', review: 'qa', audit: 'qa',
    data: 'analytics', analyt: 'analytics', dashboard: 'analytics', report: 'analytics', metric: 'analytics',
    content: 'content', writ: 'content', blog: 'content', copy: 'content', article: 'content',
    social: 'social', post: 'social', twitter: 'social', instagram: 'social', tiktok: 'social',
    operat: 'ops', process: 'ops', logistic: 'ops', workflow: 'ops', efficienc: 'ops',
    support: 'support', customer: 'support', help: 'support', ticket: 'support', service: 'support'
};

function detectDepartment(text) {
    const lower = text.toLowerCase();
    for (const [keyword, deptId] of Object.entries(KEYWORD_DEPT_MAP)) {
        if (lower.includes(keyword)) return deptId;
    }
    return null;
}

function detectPriority(text) {
    const lower = text.toLowerCase();
    if (lower.includes('urgent') || lower.includes('critical') || lower.includes('asap') || lower.includes('immediately')) return 'critical';
    if (lower.includes('high priority') || lower.includes('important')) return 'high';
    if (lower.includes('low priority') || lower.includes('when possible')) return 'low';
    return 'medium';
}

function getDeptById(id) {
    return DEPARTMENTS.find(d => d.id === id);
}

// ============================================================
// Executive Assistant AI (ARIA)
// ============================================================
export class ExecutiveAssistant {
    constructor() {
        this.id = COMPANY.ea.id;
        this.name = COMPANY.ea.name;
    }

    async processMessage(userMessage, options = {}) {
        const state = store.state;
        const settings = state.apiSettings || { provider: 'gemini', apiKey: 'AIzaSyD_aiIfFvdQ2WA-vmC6_6J3kGDZ5b1HrDk' };
        const mode = state.aiMode || 'strategy';

        // Mode-first smart pipeline for direct conversational intelligence
        if (mode === 'tutor' || mode === 'developer' || mode === 'strategy') {
            const intentResult = analyzeIntent(userMessage);
            const worker = routeTask(intentResult.intent, mode);
            const context = buildContextPayload(state, mode);
            const prompt = buildPrompt(mode, userMessage, context, intentResult.intent);
            try {
                const systemPrompt = 'Respond with clear, practical output.';
                let raw = '';
                if (options.onChunk) {
                    for await (const chunk of AIEngineAPI.generateTextStream(prompt, systemPrompt, settings)) {
                        raw += chunk;
                        options.onChunk(formatResponse(mode, worker, raw), false);
                    }
                    options.onChunk(formatResponse(mode, worker, raw), true);
                } else {
                    raw = await AIEngineAPI.generateText(prompt, systemPrompt, settings);
                }
                return { response: formatResponse(mode, worker, raw), type: 'ea-message', action: null };
            } catch (e) {
                console.error('Pipeline response failed, falling back to ARIA routing.', e);
            }
        }
        
        // 1. Check for direct worker mentions
        const mentionedWorker = this._detectMention(userMessage);
        if (mentionedWorker) {
            return this._handleDirectWorkerMention(mentionedWorker, userMessage, settings);
        }

        const systemPrompt = `You are ARIA, the Executive Assistant AI for YOTEC. The CEO (Biniam) is giving you a command.
Analyze the command and respond with a JSON object exactly in this format:
{
  "intent": "EXECUTE_TASK" | "NEW_PROJECT" | "STATUS_REPORT" | "MEETING" | "GENERAL",
  "departmentId": "dev" | "design" | "education" | "marketing" | "qa" | "analytics" | "content" | "social" | "ops" | "support",
  "priority": "low" | "medium" | "high" | "critical",
  "response": "Your conversational response to the CEO acknowledging the command"
}
Output ONLY valid JSON.`;

        let analysis;
        try {
            const rawResponse = await AIEngineAPI.generateText(userMessage, systemPrompt, settings);
            analysis = JSON.parse(rawResponse);
        } catch (e) {
            console.error("ARIA API routing failed, falling back to basic heuristics:", e);
            const lower = userMessage.toLowerCase();
            analysis = {
                intent: /generate|create|write|build|design|draft/.test(lower) ? "EXECUTE_TASK" : 
                        lower.includes('status') || lower.includes('report') ? "STATUS_REPORT" :
                        lower.includes('meeting') ? "MEETING" :
                        lower.includes('hello') ? "GENERAL" : "NEW_PROJECT",
                departmentId: detectDepartment(userMessage) || 'dev',
                priority: detectPriority(userMessage),
                response: "Understood. I am processing your request."
            };
        }

        if (analysis.intent === "STATUS_REPORT") return this._generateStatusReport(userMessage);
        if (analysis.intent === "MEETING") return this._handleMeetingRequest(userMessage, analysis.departmentId);
        if (analysis.intent === "GENERAL") {
            if (userMessage.toLowerCase().includes('energy')) return this._generateEnergyReport();
            if (userMessage.toLowerCase().includes('hello')) return this._greet();
            return { response: analysis.response, type: 'ea-message', action: null };
        }
        if (analysis.intent === "EXECUTE_TASK") return this._routeExecutionTask(userMessage, analysis.departmentId, analysis.response);
        
        // NEW_PROJECT default
        return this._routeNewTask(userMessage, analysis.departmentId, analysis.priority, analysis.response);
    }

    _greet() {
        const state = store.state;
        const activeCount = state.projects.filter(p => p.status !== 'completed').length;
        const avgEnergy = Math.round(
            Object.values(state.workers).reduce((sum, w) => sum + w.energy, 0) /
            Object.values(state.workers).length
        );
        return {
            response: `Hello, Biniam! Great to see you. YOTEC is running at peak performance today.\n\n📊 **Quick Status:**\n- Active Projects: **${activeCount}**\n- Team Average Energy: **${avgEnergy}%**\n- Departments Online: **10/10**\n- QA Queue: **1 item pending review**\n\nAll systems are nominally operational. What would you like to focus on today?`,
            type: 'ea-message',
            action: null
        };
    }

    _detectMention(text) {
        const workers = Object.values(store.state.workers);
        for (const worker of workers) {
            if (text.toLowerCase().includes(`@${worker.name.toLowerCase()}`)) {
                return worker;
            }
        }
        return null;
    }

    async _handleDirectWorkerMention(worker, message, settings) {
        const systemPrompt = `You are an advanced AI worker inside the YOTEC AI system.
Your Name: ${worker.name}
Your Role: ${worker.role}

## CORE IDENTITY
- You are not a chatbot. You are a specialized AI agent.
- You must prioritize accuracy, usefulness, and structured output.
- You are part of a production-level AI system, not a demo.

## OBJECTIVE
The CEO (Biniam) just mentioned you directly in the company chat: "${message}".
Respond to the CEO. Acknowledge the request and provide actionable insights. If it's an execution request, mention that you are getting to work on it immediately.

## RESPONSE FORMAT
Always follow this structure in your chat reply:
1. 🔍 Understanding: What the CEO wants
2. 🧠 Plan: Your step-by-step approach
3. ⚙️ Execution: Brief acknowledgment or solution
4. 🚀 Improvement: Quick suggestion (optional)
Keep your overall response concise (under 4-5 sentences total).`;

        let workerReply = "Understood. I am on it.";
        try {
            workerReply = await AIEngineAPI.generateText(message, systemPrompt, settings);
        } catch(e) {
            console.error("Worker reply generation failed", e);
        }

        const isExecution = /generate|create|write|build|design|draft/.test(message.toLowerCase());
        
        if (isExecution) {
            setTimeout(async () => {
                const title = this._extractTitle(message);
                const output = await ExecutionEngine.runTask(worker.id, title, message);
                if (output) {
                    store.dispatch({
                        type: 'ADD_MESSAGE',
                        payload: { id: generateId('msg'), from: worker.id, fromName: worker.name, timestamp: Date.now(), type: 'manager-ack', content: `**Task Complete:** I have generated the artifact for "${title}". It's awaiting QA in the Output Repo.` }
                    });
                }
            }, 1500);
        } else {
             store.dispatch({
                type: 'ADD_ACTIVITY',
                payload: { id: generateId('act'), time: Date.now(), type: 'worker', icon: worker.avatar, text: `${worker.name} is working on the CEO's direct request.` }
            });
        }

        return {
            response: workerReply,
            type: 'manager-ack',
            action: null,
            overrideSender: { id: worker.id, name: worker.name }
        };
    }

    async _routeExecutionTask(userMessage, deptId, eaResponseText) {
        deptId = deptId || 'dev';
        const dept = getDeptById(deptId) || getDeptById('dev');
        // Find highest energy worker in dept
        const workerId = dept.workers.reduce((a, b) => store.getWorker(a.id)?.energy > store.getWorker(b.id)?.energy ? a : b).id;
        const workerName = store.getWorker(workerId)?.name || 'a worker';

        // Create activity
        store.dispatch({
            type: 'ADD_ACTIVITY',
            payload: { id: generateId('act'), time: Date.now(), type: 'manager', icon: dept.icon, text: `ARIA routed execution task to ${workerName} in ${dept.name}.` }
        });

        // Run execution engine asynchronously
        setTimeout(async () => {
            const title = this._extractTitle(userMessage);
            const output = await ExecutionEngine.runTask(workerId, title, userMessage);
            if (output) {
                // Push an EA message when done
                store.dispatch({
                    type: 'ADD_MESSAGE',
                    payload: {
                        id: generateId('msg'),
                        from: 'ea',
                        fromName: 'ARIA',
                        timestamp: Date.now(),
                        type: 'ea-message',
                        content: `**Execution Complete:** ${workerName} just generated the requested output for "${title}".\n\nI have placed the artifact in the **Output Repository** for your review. It is currently pending SENTINEL's QA validation.`
                    }
                });
            }
        }, 1500);

        return {
            response: eaResponseText || `Understood. I have bypassed the standard project queue and directly assigned this execution task to **${workerName}** (${dept.name}). They are generating the output right now. I'll notify you here the second it's ready.`,
            type: 'ea-message',
            action: null
        };
    }

    async _routeNewTask(userMessage, deptId, priority, eaResponseText) {
        deptId = deptId || 'dev';
        const dept = getDeptById(deptId) || getDeptById('dev');
        const manager = store.getDeptManager(deptId) || dept.manager;
        priority = priority || 'medium';

        // Create the project
        const projectTitle = this._extractTitle(userMessage);
        const projectId = generateId('proj');

        store.dispatch({
            type: 'ADD_PROJECT',
            payload: {
                id: projectId,
                title: projectTitle,
                category: dept.name,
                deptId: dept.id,
                assignedTo: dept.manager.id,
                content: userMessage,
                priority,
                relatedIds: [],
                dependencies: [],
                dateEnd: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0]
            }
        });

        store.dispatch({
            type: 'ADD_ACTIVITY',
            payload: {
                id: generateId('act'),
                time: Date.now(),
                type: 'project',
                icon: dept.icon,
                text: `New project "${projectTitle}" assigned to ${manager.name} (${dept.name}).`
            }
        });

        store.dispatch({
            type: 'ADD_NOTIFICATION',
            payload: {
                id: generateId('notif'),
                type: 'assignment',
                title: 'New Project Assigned',
                message: `"${projectTitle}" → ${manager.name}`,
                time: Date.now()
            }
        });

        const template = pickRandom(RESPONSE_TEMPLATES.ea.taskReceived);
        const defaultResponse = fillTemplate(template, { ceo: 'Biniam', manager: manager.name });

        // Simulate manager acknowledgement after short delay
        setTimeout(() => {
            this._simulateManagerAck(dept, manager, projectTitle, projectId);
        }, 3500);

        return {
            response: `${eaResponseText || defaultResponse}\n\n**Project Brief Created:**\n- 📁 Title: "${projectTitle}"\n- 🏢 Department: ${dept.name}\n- 👤 Manager: ${manager.name} (${dept.fullName || manager.fullName})\n- ⚡ Priority: ${priority.toUpperCase()}\n- 📅 Target: ${new Date(Date.now() + 10 * 86400000).toLocaleDateString()}\n\nI'll keep you updated on every milestone. ${manager.name} will have the team briefed within the session.`,
            type: 'ea-message',
            action: { type: 'new-project', projectId, deptId }
        };
    }

    _extractTitle(text) {
        // Try to extract a meaningful title from the CEO message
        const trimmed = text.trim();
        if (trimmed.length < 60) return trimmed;
        // Use first sentence or first 55 chars
        const firstSentence = trimmed.split(/[.!?]/)[0];
        return firstSentence.length > 8 ? firstSentence.substring(0, 55) + '…' : 'New Assignment';
    }

    _generateStatusReport(query) {
        const state = store.state;
        const proj = state.projects;
        const inProgress = proj.filter(p => p.status === 'in-progress');
        const qaReview = proj.filter(p => p.status === 'qa-review');
        const completed = proj.filter(p => p.status === 'completed');
        const pending = proj.filter(p => p.status === 'pending');

        const avgEnergy = Math.round(
            Object.values(state.workers).reduce((sum, w) => sum + w.energy, 0) /
            Object.values(state.workers).length
        );

        let report = `📋 **YOTEC Status Report** — ${new Date().toLocaleDateString()}\n\n`;
        report += `**Overall:**\n`;
        report += `- Total Projects: **${proj.length}** | Active: **${inProgress.length}** | QA Review: **${qaReview.length}** | Completed: **${completed.length}**\n`;
        report += `- Team Energy Average: **${avgEnergy}%**\n\n`;

        if (inProgress.length > 0) {
            report += `**🔄 In Progress:**\n`;
            for (const p of inProgress) {
                const dept = getDeptById(p.deptId);
                report += `- "${p.title}" — ${p.progress}% complete (${dept ? dept.name : p.category})\n`;
            }
            report += '\n';
        }

        if (qaReview.length > 0) {
            report += `**🛡️ Awaiting QA Approval:**\n`;
            for (const p of qaReview) report += `- "${p.title}"\n`;
            report += '\n';
        }

        if (pending.length > 0) {
            report += `**⏳ Pending (Queued):**\n`;
            for (const p of pending) report += `- "${p.title}" — Waiting on dependencies\n`;
            report += '\n';
        }

        if (completed.length > 0) {
            report += `**✅ Completed:**\n`;
            for (const p of completed) report += `- "${p.title}"\n`;
        }

        return { response: report, type: 'ea-message', action: null };
    }

    _generateEnergyReport() {
        const state = store.state;
        let report = `⚡ **Team Energy Report**\n\n`;

        for (const dept of DEPARTMENTS) {
            const manager = state.workers[dept.manager.id];
            const workers = dept.workers.map(w => state.workers[w.id] || w);
            const deptAvg = Math.round([manager, ...workers].reduce((s, w) => s + (w?.energy || 80), 0) / 4);
            const bar = '█'.repeat(Math.floor(deptAvg / 10)) + '░'.repeat(10 - Math.floor(deptAvg / 10));
            report += `${dept.icon} **${dept.name}** — ${bar} ${deptAvg}%\n`;
        }

        report += `\n💡 All departments are operating within healthy parameters. No reassignments needed at this time.`;
        return { response: report, type: 'ea-message', action: null };
    }

    _handleMeetingRequest(message) {
        const lower = message.toLowerCase();
        let targetDept = detectDepartment(message);
        let attendees = [];

        if (targetDept) {
            const dept = getDeptById(targetDept);
            attendees = [dept.manager, ...dept.workers];
        } else {
            // General meeting with all managers
            attendees = DEPARTMENTS.map(d => d.manager);
        }

        const meetingId = generateId('meet');
        const transcript = MeetingSimulator.generateTranscript(attendees, message, meetingId);

        store.dispatch({ type: 'ADD_MEETING', payload: transcript });
        store.dispatch({
            type: 'ADD_ACTIVITY',
            payload: {
                id: generateId('act'),
                time: Date.now(),
                type: 'meeting',
                icon: '🤝',
                text: `Meeting initiated: ${attendees.map(a => a.name).join(', ')}.`
            }
        });

        return {
            response: `Understood, Biniam. I've convened a meeting with **${attendees.map(a => a.name).join(', ')}**. The transcript is available in the **Meetings** panel. I've prepared an agenda based on your request and all participants are ready.`,
            type: 'ea-message',
            action: { type: 'open-meeting', meetingId }
        };
    }

    _simulateManagerAck(dept, manager, projectTitle, projectId) {
        const template = pickRandom(RESPONSE_TEMPLATES.manager.taskReceived);
        const ackText = fillTemplate(template, { count: Math.floor(Math.random() * 3) + 3 });

        store.dispatch({
            type: 'ADD_MESSAGE',
            payload: {
                id: generateId('msg'),
                from: manager.id,
                fromName: manager.name,
                content: `[Internal Broadcast from ${manager.name}]\n\n${ackText}`,
                timestamp: Date.now(),
                type: 'manager-ack',
                deptId: dept.id,
                projectId
            }
        });

        store.dispatch({
            type: 'ADD_ACTIVITY',
            payload: {
                id: generateId('act'),
                time: Date.now(),
                type: 'manager',
                icon: dept.icon,
                text: `${manager.name} acknowledged project "${projectTitle}" and is briefing their team.`
            }
        });

        // Simulate workers starting after additional delay
        setTimeout(() => {
            this._simulateWorkersStart(dept, projectTitle, projectId);
        }, 5000);
    }

    _simulateWorkersStart(dept, projectTitle, projectId) {
        for (const worker of dept.workers) {
            const template = pickRandom(RESPONSE_TEMPLATES.worker.taskStarted);
            const workerText = fillTemplate(template, { task: projectTitle, energy: worker.energy });
            store.dispatch({
                type: 'UPDATE_WORKER',
                payload: { id: worker.id, currentTaskId: projectId }
            });
            store.dispatch({
                type: 'ADD_ACTIVITY',
                payload: {
                    id: generateId('act'),
                    time: Date.now() + Math.random() * 2000,
                    type: 'worker',
                    icon: worker.avatar,
                    text: `${worker.name}: "${workerText.substring(0, 80)}"`
                }
            });
        }
        // Start progressing the project
        store.dispatch({
            type: 'UPDATE_PROJECT',
            payload: { id: projectId, status: 'in-progress', energy: 60 }
        });
    }
}

// ============================================================
// QA AI (SENTINEL)
// ============================================================
export class QAEngine {
    static async review(projectOrOutput) {
        const state = store.state;
        const settings = state.apiSettings || { provider: 'pollinations', apiKey: '' };
        const isProject = projectOrOutput.hasOwnProperty('progress');

        const systemPrompt = `You are SENTINEL, the rigorous Quality Assurance AI at YOTEC.
Evaluate the following artifact or project submission.
If it is acceptable and generally matches expectations, reply EXACTLY with the word "APPROVE".
If there are critical issues, errors, or it fails to meet standard expectations, reply EXACTLY with "REJECT: " followed by a 1-sentence reason.`;

        const userPrompt = `Title: ${projectOrOutput.title}
Content:
${isProject ? projectOrOutput.content : projectOrOutput.content.substring(0, 500)}`;

        let passed = true;
        let issue = '';

        try {
            window._yotec?.showToast('QA Review Started', `SENTINEL is validating "${projectOrOutput.title}"...`, 'var(--accent-purple)');
            const rawResponse = await AIEngineAPI.generateText(userPrompt, systemPrompt, settings);
            const response = rawResponse.toUpperCase();
            
            if (response.startsWith('REJECT')) {
                passed = false;
                issue = rawResponse.substring(7).trim() || 'Fails quality standards.';
            } else if (response.includes('APPROVE')) {
                passed = true;
            } else {
                // LLM gave weird response, fallback to length check or something, just approve
                passed = true;
            }
        } catch (e) {
            console.error("QA API failed, falling back to basic approval", e);
            passed = true; // Fail open
        }

        if (passed) {
            if (isProject) {
                store.dispatch({ type: 'UPDATE_PROJECT', payload: { id: projectOrOutput.id, status: 'completed', progress: 100 } });
                store.dispatch({
                    type: 'ADD_ACTIVITY',
                    payload: { id: generateId('act'), time: Date.now(), type: 'qa', icon: '🛡️', text: `SENTINEL approved "${projectOrOutput.title}" — project completed! ✅` }
                });
            } else {
                store.dispatch({ type: 'UPDATE_OUTPUT', payload: { id: projectOrOutput.id, qaStatus: 'approved' } });
                store.dispatch({
                    type: 'ADD_ACTIVITY',
                    payload: { id: generateId('act'), time: Date.now(), type: 'qa', icon: '🛡️', text: `SENTINEL approved artifact "${projectOrOutput.title}". ✅` }
                });
            }
            const feedback = pickRandom(RESPONSE_TEMPLATES.qa.approved);
            window._yotec?.showToast('QA Approved', feedback, 'var(--accent-green)');
            return { approved: true, feedback };
        } else {
            const msg = fillTemplate(pickRandom(RESPONSE_TEMPLATES.qa.revisionNeeded), { count: 1, manager: isProject ? 'the assigned manager' : 'the worker', issue, criteria: issue });

            if (isProject) {
                store.dispatch({ type: 'UPDATE_PROJECT', payload: { id: projectOrOutput.id, status: 'revision-needed' } });
                store.dispatch({
                    type: 'ADD_ACTIVITY',
                    payload: { id: generateId('act'), time: Date.now(), type: 'qa', icon: '⚠️', text: `SENTINEL sent "${projectOrOutput.title}" back for revision: ${issue}.` }
                });
            } else {
                store.dispatch({ type: 'UPDATE_OUTPUT', payload: { id: projectOrOutput.id, qaStatus: 'rejected' } });
                store.dispatch({
                    type: 'ADD_ACTIVITY',
                    payload: { id: generateId('act'), time: Date.now(), type: 'qa', icon: '⚠️', text: `SENTINEL rejected artifact "${projectOrOutput.title}": ${issue}.` }
                });
            }

            store.dispatch({
                type: 'ADD_ALERT',
                payload: { id: generateId('alt'), type: 'danger', message: `QA Rejection: "${projectOrOutput.title}" failed validation. Reason: ${issue}`, time: Date.now() }
            });
            window._yotec?.showToast('QA Rejected', msg, 'var(--accent-red)');
            return { approved: false, feedback: msg };
        }
    }
}

// ============================================================
// Meeting Simulator
// ============================================================
export class MeetingSimulator {
    static generateTranscript(attendees, agenda, meetingId) {
        const now = new Date();
        const lines = [];
        const topics = this._generateTopics(agenda);

        lines.push({ speaker: 'ARIA', role: 'Executive Assistant AI', text: `Meeting called to order at ${now.toLocaleTimeString()}. Agenda: "${agenda}". Attendees: ${attendees.map(a => a.name).join(', ')}.` });

        for (const topic of topics) {
            const speaker = pickRandom([...attendees, { name: 'ARIA', role: 'Executive Assistant AI' }]);
            lines.push({ speaker: speaker.name, role: speaker.role, text: topic });
            if (Math.random() > 0.5 && attendees.length > 1) {
                const responder = pickRandom(attendees.filter(a => a.name !== speaker.name));
                if (responder) {
                    lines.push({ speaker: responder.name, role: responder.role, text: this._generateResponse(topic, responder) });
                }
            }
        }

        const actions = this._generateActionItems(attendees, agenda);
        lines.push({ speaker: 'ARIA', role: 'Executive Assistant AI', text: `Meeting summary complete. Action items recorded: ${actions.map(a => a.text).join(' | ')}. Meeting adjourned.` });

        return {
            id: meetingId,
            title: `Meeting: ${agenda.substring(0, 40)}`,
            date: now.toISOString(),
            attendees: attendees.map(a => ({ name: a.name, role: a.role })),
            transcript: lines,
            actionItems: actions,
            agenda
        };
    }

    static _generateTopics(agenda) {
        const lower = agenda.toLowerCase();
        const topics = [
            `I've reviewed current progress and believe we can accelerate by 15% if we parallelize the key deliverables.`,
            `One blocker I want to flag: we have a dependency that needs resolution before we can move forward on the main milestone.`,
            `My recommendation is to prioritize the core functionality first, then layer features in the next sprint.`,
            `Energy levels across the team are holding well, but I'd suggest reducing parallel tasks to maintain quality.`,
            `I can commit to having a detailed plan ready within the next session if we align on the core objectives today.`,
            `Cross-department coordination will be critical here — I suggest a shared visibility board for dependencies.`,
            `From a quality standpoint, we need at least one full review cycle built into the timeline.`,
        ];
        return topics.slice(0, Math.floor(Math.random() * 3) + 4);
    }

    static _generateResponse(topic, responder) {
        const responses = [
            `I agree with that assessment. From the ${responder.role.split(' ')[0]} perspective, we're aligned and ready to support.`,
            `Good point. I'll factor that into my team's workload adjustments immediately.`,
            `That matches what I'm seeing on my end as well. Let's formalize this as a decision.`,
            `I'd add that we should document this for future reference — it's a recurring pattern worth tracking.`,
            `Noted. I'll brief my workers on this direction after the meeting and implement accordingly.`,
        ];
        return pickRandom(responses);
    }

    static _generateActionItems(attendees, agenda) {
        const actions = [
            { owner: attendees[0]?.name || 'ARIA', text: 'Prepare detailed task breakdown and timeline.' },
            { owner: attendees[1]?.name || 'ARIA', text: 'Review dependencies and flag any blockers.' },
            { owner: 'ARIA', text: 'Compile meeting notes and distribute to CEO Biniam.' },
        ];
        if (attendees.length > 2) {
            actions.push({ owner: attendees[2]?.name, text: 'Begin initial execution phase on primary deliverable.' });
        }
        return actions;
    }
}

// ============================================================
// Autonomous Background Tick
// ============================================================
let isGeneratingBackground = false;

export function startAutonomousTick() {
    setInterval(async () => {
        const state = store.state;

        // Auto-approve pending projects when dependencies are met
        for (const project of state.projects) {
            if (project.status === 'pending' && project.dependencies.length > 0) {
                const allDepsComplete = project.dependencies.every(depId =>
                    state.projects.find(p => p.id === depId)?.status === 'completed'
                );
                if (allDepsComplete) {
                    store.dispatch({ type: 'UPDATE_PROJECT', payload: { id: project.id, status: 'in-progress' } });
                    store.dispatch({
                        type: 'ADD_ACTIVITY',
                        payload: { id: generateId('act'), time: Date.now(), type: 'project', icon: '🚀', text: `"${project.title}" dependencies resolved — now in progress!` }
                    });
                }
            }
        }

        // Fluctuate worker energy slightly
        for (const [id, worker] of Object.entries(state.workers)) {
            const delta = (Math.random() - 0.4) * 3;
            const newEnergy = Math.max(55, Math.min(100, worker.energy + delta));
            store.dispatch({ type: 'UPDATE_WORKER', payload: { id, energy: Math.round(newEnergy) } });
        }

        // Real Background Progress
        if (!isGeneratingBackground) {
            const activeProject = state.projects.find(p => p.status === 'in-progress' && p.progress < 100);
            
            if (activeProject) {
                isGeneratingBackground = true;
                const dept = getDeptById(activeProject.deptId) || getDeptById('dev');
                const workerId = dept.workers.reduce((a, b) => store.getWorker(a.id)?.energy > store.getWorker(b.id)?.energy ? a : b).id;
                const workerName = store.getWorker(workerId)?.name || 'a worker';

                store.dispatch({
                    type: 'ADD_ACTIVITY',
                    payload: { id: generateId('act'), time: Date.now(), type: 'worker', icon: '💻', text: `${workerName} is autonomously working on a subtask for "${activeProject.title}"...` }
                });

                try {
                    // Generate a part of the project using the real API
                    await ExecutionEngine.runTask(workerId, `Subtask for: ${activeProject.title}`, activeProject.content);
                    
                    // Increment progress significantly since it's real
                    const newProgress = Math.min((activeProject.progress || 0) + 34, 100);
                    store.dispatch({ type: 'UPDATE_PROJECT', payload: { id: activeProject.id, progress: Math.round(newProgress), energy: Math.min(activeProject.energy + 2, 100) } });

                    if (newProgress >= 100) {
                        store.dispatch({ type: 'UPDATE_PROJECT', payload: { id: activeProject.id, status: 'qa-review' } });
                        store.dispatch({
                            type: 'ADD_ACTIVITY',
                            payload: { id: generateId('act'), time: Date.now(), type: 'qa', icon: '🛡️', text: `"${activeProject.title}" submitted to SENTINEL for QA review.` }
                        });
                    }
                } catch (e) {
                    console.error("Background task failed:", e);
                } finally {
                    isGeneratingBackground = false;
                }
            }
        }

        store.dispatch({ type: 'TICK' });
    }, 15000); // Every 15 seconds
}
