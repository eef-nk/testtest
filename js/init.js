'use strict';

// ═══════════════════════════════════════════════════════════
// 이벤트 리스너 & 초기화
// ═══════════════════════════════════════════════════════════

// ── 폴더 선택 ─────────────────────────────────────────────────

document.getElementById('btn-open-folder').addEventListener('click', async () => {
  if ('showDirectoryPicker' in window) {
    try {
      state.rootHandle = await window.showDirectoryPicker();
      state.usesFSAPI  = true;
      await loadAll();
    } catch (e) {
      if (e.name !== 'AbortError') toast('폴더를 열 수 없습니다: ' + e.message, true);
    }
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.webkitdirectory = true;
  input.multiple = true;
  input.onchange = async () => {
    state.rootFiles = {};
    state.usesFSAPI = false;
    for (const file of input.files) {
      const parts = file.webkitRelativePath.split('/');
      const rel   = parts.slice(1).join('/');
      state.rootFiles[rel]               = file;
      state.rootFiles[rel.toLowerCase()] = file;
    }
    await loadAll();
  };
  input.click();
});

// ── 번역 폴더 선택 ────────────────────────────────────────────

document.getElementById('btn-load-kor').addEventListener('click', async () => {
  if ('showDirectoryPicker' in window) {
    try {
      const dirHandle = await window.showDirectoryPicker();
      const result    = {};
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind !== 'file' || !name.endsWith('.txt')) continue;
        const file = await handle.getFile();
        const text = await readFileText(file);
        mergeKoreanParsed(parseKoreanCore(text), result);
      }
      await applyKoreanMaps(result);
    } catch (e) {
      if (e.name !== 'AbortError') toast('번역 폴더 오픈 실패: ' + e.message, true);
    }
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.webkitdirectory = true;
  input.multiple = true;
  input.onchange = async () => {
    const result = {};
    for (const file of input.files) {
      if (!file.name.endsWith('.txt')) continue;
      const text = await readFileText(file);
      mergeKoreanParsed(parseKoreanCore(text), result);
    }
    await applyKoreanMaps(result);
  };
  input.click();
});

// ── 도움말 모달 ──────────────────────────────────────────────

document.getElementById('btn-help').addEventListener('click', () => {
  document.getElementById('help-overlay').classList.add('open');
});

// 도움말 배경 클릭 시 닫기
document.getElementById('help-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('help-overlay'))
    document.getElementById('help-overlay').classList.remove('open');
});

// ── 단축키 ───────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  // Ctrl+Shift+S → 저장
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
    e.preventDefault();
    const btnSave = document.getElementById('btn-save');
    if (btnSave && !btnSave.disabled) btnSave.click();
    return;
  }
  // Escape → 모달 닫기 또는 취소
  if (e.key === 'Escape') {
    // 도움말이 열려있으면 닫기
    if (document.getElementById('help-overlay')?.classList.contains('open')) {
      document.getElementById('help-overlay').classList.remove('open');
      return;
    }
    if (document.getElementById('new-entry-overlay')?.classList.contains('open')) return;
    if (document.getElementById('log-overlay')?.classList.contains('open')) return;
    if (document.querySelector('.combo-list:not([hidden])')) return;
    const btnCancel = document.getElementById('btn-cancel');
    if (btnCancel) { e.preventDefault(); btnCancel.click(); }
  }
});

// ── 검색 ─────────────────────────────────────────────────────

document.getElementById('search-input').addEventListener('input', e => {
  renderList(e.target.value);
});

// ── DOMContentLoaded ─────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadChangeLogFromStorage();   // 이전 세션 로그 복원
  initComboboxListeners();
});
