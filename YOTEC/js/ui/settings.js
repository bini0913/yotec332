import { store } from '../state.js';

export function renderSettings(container) {
    const state = store.state;
    const settings = state.apiSettings || { provider: 'pollinations', apiKey: '' };

    container.innerHTML = `
        <div class="panel-header">
            <h2 class="panel-title">System Settings</h2>
            <div class="panel-actions">
                <button class="btn btn-primary" id="save-settings-btn">Save Configuration</button>
            </div>
        </div>
        <div class="panel-content" style="max-width: 600px; margin: 0 auto; padding-top: 2rem;">
            <div class="module-card">
                <h3 style="margin-bottom: 1rem; color: var(--accent-cyan); display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.5rem;">⚙️</span> AI Execution Engine API
                </h3>
                <p style="color: var(--text-muted); margin-bottom: 2rem; font-size: 0.9rem; line-height: 1.5;">
                    Configure the AI provider that powers your workers. YOTEC uses these APIs to generate real-time functional artifacts when workers execute tasks.
                </p>

                <div class="input-group" style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: var(--text-primary); font-weight: 500;">API Provider</label>
                    <select id="api-provider" class="input" style="width: 100%; padding: 12px; background: var(--bg-deep); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px; font-family: inherit;">
                        <option value="pollinations" ${settings.provider === 'pollinations' ? 'selected' : ''}>Pollinations.ai (Free, No Key Required)</option>
                        <option value="gemini" ${settings.provider === 'gemini' ? 'selected' : ''}>Google Gemini API (Bring Your Own Key)</option>
                    </select>
                </div>

                <div class="input-group" id="api-key-group" style="margin-bottom: 1.5rem; ${settings.provider === 'pollinations' ? 'display: none;' : ''}">
                    <label style="display: block; margin-bottom: 0.5rem; color: var(--text-primary); font-weight: 500;">API Key</label>
                    <input type="password" id="api-key" class="input" value="${settings.apiKey || ''}" placeholder="Enter your API key..." style="width: 100%; padding: 12px; background: var(--bg-deep); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px; font-family: inherit;">
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 6px;">Your key is stored locally in your browser and never sent to our servers.</div>
                </div>
            </div>
        </div>
    `;

    const providerSelect = document.getElementById('api-provider');
    const keyGroup = document.getElementById('api-key-group');
    const keyInput = document.getElementById('api-key');

    providerSelect.addEventListener('change', (e) => {
        if (e.target.value === 'gemini') {
            keyGroup.style.display = 'block';
        } else {
            keyGroup.style.display = 'none';
        }
    });

    document.getElementById('save-settings-btn').addEventListener('click', () => {
        store.dispatch({
            type: 'UPDATE_API_SETTINGS',
            payload: {
                provider: providerSelect.value,
                apiKey: keyInput.value.trim()
            }
        });
        window._yotec?.showToast('Settings Saved', 'AI configuration has been updated successfully.', 'var(--accent-purple)');
    });
}
