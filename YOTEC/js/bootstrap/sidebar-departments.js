// Sidebar department quick-links bootstrap module

import { DEPARTMENTS } from '../data.js';

export function initSidebarDepartments() {
  const el = document.getElementById('sidebar-depts');
  if (!el) return;

  el.innerHTML = DEPARTMENTS.map(dept => `
    <div class="nav-item" style="padding:6px 10px;font-size:0.75rem;" onclick="window._yotec?.switchPanel('team')" tabindex="0">
      <span>${dept.icon}</span><span>${dept.name}</span>
    </div>
  `).join('');
}
