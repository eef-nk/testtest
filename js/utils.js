'use strict';

// ═══════════════════════════════════════════════════════════
// GENERAL UTILITIES
// ═══════════════════════════════════════════════════════════

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show' + (isError ? ' error' : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = ''; }, 3000);
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file, 'utf-8');
  });
}

async function getFileHandle(path) {
  if (!state.usesFSAPI) return state.rootFiles[path] || null;
  const parts = path.split('/');
  let handle = state.rootHandle;
  try {
    for (let i = 0; i < parts.length - 1; i++) {
      handle = await handle.getDirectoryHandle(parts[i]);
    }
    return await handle.getFileHandle(parts[parts.length - 1]);
  } catch { return null; }
}

async function readPath(path) {
  const h = await getFileHandle(path);
  if (!h) return null;
  const file = state.usesFSAPI ? await h.getFile() : h;
  return readFileText(file);
}

// ── 편집 패널 레이아웃 ──────────────────────────────────────

function clearEditPanel() {
  document.getElementById('edit-panel').innerHTML =
    '<div id="welcome" style="display:flex;flex-direction:column;align-items:center;' +
    'justify-content:center;height:100%;gap:12px;color:var(--text-muted)">' +
    '<div class="big" style="font-size:18px;color:var(--text);font-weight:600">항목을 선택하세요</div></div>';
}

function setEditPanelLayout(header, body) {
  const panel = document.getElementById('edit-panel');
  panel.innerHTML = '';

  const hdr = document.createElement('div');
  hdr.id = 'edit-header';
  hdr.innerHTML = header +
    `<button class="btn-delete" id="btn-delete-entry">🗑 삭제</button>`;
  panel.appendChild(hdr);

  // edit-body와 compare-panel을 나란히 감싸는 wrapper
  const wrapper = document.createElement('div');
  wrapper.id = 'edit-body-wrapper';

  const bd = document.createElement('div');
  bd.id = 'edit-body';
  bd.innerHTML = body;
  wrapper.appendChild(bd);

  const cmp = document.createElement('div');
  cmp.id = 'compare-panel';
  cmp.hidden = true;
  wrapper.appendChild(cmp);

  panel.appendChild(wrapper);

  attachDeleteButtonHandler();
}

// ── 삭제 버튼 더블액션 ─────────────────────────────────────────

function attachDeleteButtonHandler() {
  const btn = document.getElementById('btn-delete-entry');
  if (!btn) return;
  let armed = false;
  let armedTimer = null;

  btn.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      btn.textContent = '⚠ 한 번 더 클릭하면 삭제';
      btn.classList.add('armed');
      armedTimer = setTimeout(() => {
        armed = false;
        btn.textContent = '🗑 삭제';
        btn.classList.remove('armed');
      }, 3000);
    } else {
      clearTimeout(armedTimer);
      deleteCurrentEntry();  // tabs.js에 정의
    }
  });
}

// ── 변경 로그 ─────────────────────────────────────────────────

const _CHANGELOG_KEY = 'pbs_editor_changelog';
const _CHANGELOG_MAX = 3000; // localStorage 용량 초과 방지

function _saveChangeLog() {
  try {
    const slice = state.changeLog.slice(-_CHANGELOG_MAX);
    localStorage.setItem(_CHANGELOG_KEY, JSON.stringify(slice));
  } catch (e) {
    // 저장 실패 시 무시 (private 모드 등)
  }
}

/** 앱 시작 시 호출 — localStorage에서 로그 복원 */
function loadChangeLogFromStorage() {
  try {
    const raw = localStorage.getItem(_CHANGELOG_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      state.changeLog = parsed;
      updateLogButton();
    }
  } catch (e) { /* 손상된 데이터 무시 */ }
}

function appendChangeLog({ tab, filename, entryId, changes }) {
  const now = new Date();
  state.changeLog.push({
    time: now.toLocaleTimeString('ko-KR'),
    date: now.toLocaleDateString('ko-KR'),
    tab, filename, entryId, changes,
  });
  _saveChangeLog();
  updateLogButton();
}

/** 로그 초기화 (모달 버튼용) */
function clearChangeLog() {
  state.changeLog = [];
  try { localStorage.removeItem(_CHANGELOG_KEY); } catch (e) {}
  updateLogButton();
  document.getElementById('log-overlay').classList.remove('open');
}

function updateLogButton() {
  const btn = document.getElementById('btn-log');
  if (btn) btn.textContent = `📋 로그 (${state.changeLog.length})`;
}

function showLogModal() {
  const overlay = document.getElementById('log-overlay');
  const body    = document.getElementById('log-modal-body');
  if (!overlay || !body) return;

  if (state.changeLog.length === 0) {
    body.innerHTML = '<div class="log-empty">변경 내역이 없습니다.</div>';
  } else {
    body.innerHTML = [...state.changeLog].reverse().map(e => {
      const fields = e.changes.map(c => {
        const from = c.from.length > 60 ? c.from.slice(0, 57) + '…' : c.from;
        const to   = c.to.length   > 60 ? c.to.slice(0, 57)   + '…' : c.to;
        return `<div class="log-field">
          <span class="field-name">${escHtml(c.field)}</span>:
          <span class="from-val">${escHtml(from || '(없음)')}</span>
          → <span class="to-val">${escHtml(to || '(없음)')}</span>
        </div>`;
      }).join('');
      return `<div class="log-entry">
        <div class="log-time">${escHtml(e.date)} ${escHtml(e.time)} — ${escHtml(e.filename)}</div>
        <div class="log-who">[${escHtml(e.entryId)}] ${escHtml(e.tab)}</div>
        ${fields}
      </div>`;
    }).join('');
  }

  overlay.classList.add('open');
}

function exportChangeLog() {
  if (state.changeLog.length === 0) { toast('변경 내역이 없습니다.', true); return; }
  const lines = state.changeLog.map(e => {
    const header = `[${e.date} ${e.time}] ${e.tab} / ${e.filename} — ${e.entryId}`;
    const fields = e.changes.map(c => `  ${c.field}: "${c.from}" → "${c.to}"`).join('\n');
    return header + '\n' + fields;
  });
  const blob = new Blob([lines.join('\n\n')], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `pbs_changelog_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
