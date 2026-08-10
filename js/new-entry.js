'use strict';

// ═══════════════════════════════════════════════════════════
// NEW ENTRY CREATION
// ═══════════════════════════════════════════════════════════

// ── 다이얼로그 열기 ────────────────────────────────────────────

function showNewEntryDialog() {
  const tab = state.currentTab;
  const reg = PBS_REGISTRY[tab];
  if (!CREATABLE_TABS.has(tab) || !state.pbsLoaded[tab]) return;

  const title = document.getElementById('new-entry-title');
  const form  = document.getElementById('new-entry-form');
  const errEl = document.getElementById('new-entry-error');
  if (errEl) errEl.textContent = '';

  if (reg.type === 'location') {
    // 서식 분포
    title.textContent = '새 서식 분포 맵 추가';
    const copyOpts = (state.pbsData[tab] || []).map(e => {
      const lbl = e.mapName ? `${escHtml(e.mapName)} [${escHtml(e.mapId)}]` : `[${escHtml(e.mapId)}]`;
      return `<option value="${escHtml(e.mapId)}">${lbl}</option>`;
    }).join('');
    form.innerHTML = `
      <div class="ne-field">
        <label>맵 ID</label>
        <input type="text" id="ne-map-id" placeholder="예: 001" autocomplete="off">
      </div>
      <div class="ne-field">
        <label>맵 이름 <span class="ne-optional">(선택)</span></label>
        <input type="text" id="ne-map-name" placeholder="예: 1번도로" autocomplete="off">
      </div>
      <div class="ne-field">
        <label>서식지 복제 <span class="ne-optional">(선택 — 다른 서식지에서 복사)</span></label>
        <select id="ne-copy-from">
          <option value="">(빈 서식지로 시작)</option>
          ${copyOpts}
        </select>
      </div>`;

  } else if (reg.type === 'trainer') {
    // 트레이너
    title.textContent = '새 트레이너 추가';
    form.innerHTML = `
      <div class="ne-field">
        <label>트레이너 타입</label>
        <input type="text" id="ne-trainer-type" placeholder="예: YOUNGSTER" autocomplete="off">
      </div>
      <div class="ne-field">
        <label>트레이너 이름</label>
        <input type="text" id="ne-trainer-name" placeholder="예: Joey" autocomplete="off">
      </div>
      <div class="ne-field">
        <label>버전 <span class="ne-optional">(선택 — 같은 이름의 복수 배틀 시)</span></label>
        <input type="number" id="ne-trainer-version" placeholder="(없음)" min="0" style="width:80px">
      </div>`;

  } else {
    // 엔티티 (기술, 트레이너 타입 등)
    title.textContent = `새 ${reg.label} 추가`;
    form.innerHTML = `
      <div class="ne-field">
        <label>내부 ID</label>
        <input type="text" id="ne-internal-id" placeholder="예: MOVE_WATERFALL" autocomplete="off">
      </div>`;
  }

  document.getElementById('new-entry-overlay').classList.add('open');
  // 첫 번째 input에 포커스
  setTimeout(() => form.querySelector('input')?.focus(), 40);
}

// ── 다이얼로그 닫기 ────────────────────────────────────────────

function closeNewEntryDialog() {
  document.getElementById('new-entry-overlay').classList.remove('open');
}

// ── 생성 실행 ─────────────────────────────────────────────────

function submitNewEntry() {
  const tab   = state.currentTab;
  const reg   = PBS_REGISTRY[tab];
  const errEl = document.getElementById('new-entry-error');
  const showErr = msg => { if (errEl) errEl.textContent = msg; };

  if (reg.type === 'location') {
    // ── 서식 분포 ──────────────────────────────────────────
    const mapId    = (document.getElementById('ne-map-id')?.value    || '').trim();
    const mapName  = (document.getElementById('ne-map-name')?.value   || '').trim();
    const copyFrom = (document.getElementById('ne-copy-from')?.value  || '').trim();
    if (!mapId) { showErr('맵 ID를 입력하세요.'); return; }
    if ((state.pbsData[tab] || []).some(e => e.mapId === mapId)) {
      showErr(`맵 ID "${mapId}"가 이미 존재합니다.`); return;
    }
    let newEntry;
    if (copyFrom) {
      const src = (state.pbsData[tab] || []).find(e => e.mapId === copyFrom);
      if (src) {
        newEntry = {
          mapId, mapName,
          encounterTypes:     JSON.parse(JSON.stringify(src.encounterTypes)),
          encounterDensities: JSON.parse(JSON.stringify(src.encounterDensities || {})),
          _typeOrder:         [...src._typeOrder],
        };
      }
    }
    if (!newEntry) {
      newEntry = {
        mapId, mapName,
        encounterTypes:     {},
        encounterDensities: {},
        _typeOrder:         [],
      };
    }
    _appendAndSelect(tab, newEntry);
    closeNewEntryDialog();
    const copyMsg = copyFrom ? ` (맵 ${copyFrom}에서 복제)` : '';
    toast(`맵 [${mapId}] 추가됨${copyMsg}`);

  } else if (reg.type === 'trainer') {
    // ── 트레이너 ─────────────────────────────────────────────
    const trainerType = (document.getElementById('ne-trainer-type')?.value    || '').trim();
    const trainerName = (document.getElementById('ne-trainer-name')?.value    || '').trim();
    const verRaw      = (document.getElementById('ne-trainer-version')?.value || '').trim();
    const version     = verRaw !== '' ? parseInt(verRaw, 10) : null;
    if (!trainerType) { showErr('트레이너 타입을 입력하세요.'); return; }
    if (!trainerName) { showErr('트레이너 이름을 입력하세요.'); return; }
    const internalId = version != null
      ? `${trainerType},${trainerName},${version}`
      : `${trainerType},${trainerName}`;
    if ((state.pbsData[tab] || []).some(e => e.internalId === internalId)) {
      showErr(`"${internalId}"가 이미 존재합니다.`); return;
    }
    const newEntry = {
      internalId, trainerType, trainerName, version,
      fields: { Items: DEFAULT_TRAINER_ITEMS.join(',') },
      _keyOrder: ['Items'],
      pokemon: [],
    };
    _appendAndSelect(tab, newEntry);
    closeNewEntryDialog();
    toast(`트레이너 [${internalId}] 추가됨`);

  } else {
    // ── 엔티티 (기술, 트레이너 타입 등) ──────────────────────
    const internalId = (document.getElementById('ne-internal-id')?.value || '').trim();
    if (!internalId) { showErr('내부 ID를 입력하세요.'); return; }
    if ((state.pbsData[tab] || []).some(e => e.internalId === internalId)) {
      showErr(`"${internalId}"가 이미 존재합니다.`); return;
    }
    // 기존 첫 항목의 키 순서를 복사해 빈 필드 세트 생성.
    // 커스텀 파일처럼 비어있는 경우, 베이스 탭(pokemon, moves 등)에서 참조.
    let template = (state.pbsData[tab] || [])[0];
    if (!template && !reg.fieldOrder) {
      const baseFilename = reg.filename.replace(/_Custom\.txt$/i, '.txt');
      const baseKey = Object.keys(PBS_REGISTRY).find(
        k => k !== tab && PBS_REGISTRY[k].filename.toLowerCase() === baseFilename.toLowerCase()
      );
      if (baseKey) template = (state.pbsData[baseKey] || [])[0];
    }
    const _keyOrder = template ? [...template._keyOrder] : [];
    const fields    = Object.fromEntries(_keyOrder.map(k => [k, '']));
    const newEntry  = { internalId, fields, _keyOrder };
    _appendAndSelect(tab, newEntry);
    closeNewEntryDialog();
    toast(`[${internalId}] 추가됨`);
  }
}

// ── 공통 헬퍼 ─────────────────────────────────────────────────

function _appendAndSelect(tab, newEntry) {
  if (!state.pbsData[tab]) state.pbsData[tab] = [];
  state.pbsData[tab].push(newEntry);

  // 검색 필터 초기화 후 목록 렌더
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  renderList('');

  // 새 항목을 선택 → 편집 패널 열기
  const newIdx = state.pbsData[tab].length - 1;
  state.selectedIndex = newIdx;
  selectEntry(newIdx);

  // 목록 스크롤을 새 항목으로 이동
  requestAnimationFrame(() => {
    document.querySelector('#entity-list li.selected')?.scrollIntoView({ block: 'nearest' });
  });
}

// ── 이벤트 연결 ────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-new-entry').addEventListener('click', showNewEntryDialog);
  document.getElementById('ne-btn-ok').addEventListener('click', submitNewEntry);
  document.getElementById('ne-btn-cancel').addEventListener('click', closeNewEntryDialog);

  // 모달 배경 클릭 시 닫기
  document.getElementById('new-entry-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('new-entry-overlay')) closeNewEntryDialog();
  });

  // 모달 내 Enter/Escape 키
  document.getElementById('new-entry-modal').addEventListener('keydown', e => {
    if (e.key === 'Enter'  && !e.shiftKey) { e.preventDefault(); submitNewEntry(); }
    if (e.key === 'Escape')                { closeNewEntryDialog(); }
  });
});
