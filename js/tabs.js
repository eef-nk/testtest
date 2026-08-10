'use strict';

// ═══════════════════════════════════════════════════════════
// TABS (카테고리 드롭다운)
// ═══════════════════════════════════════════════════════════

let _tabDropdownCloseSetup = false;

function closeAllDropdowns() {
  document.querySelectorAll('.tab-dropdown.open').forEach(d => d.classList.remove('open'));
  document.querySelectorAll('.tab-group-btn.open').forEach(b => b.classList.remove('open'));
}

function renderTabs() {
  const container = document.getElementById('tabs');
  container.innerHTML = '';

  for (const cat of TAB_CATEGORIES) {
    const group = document.createElement('div');
    group.className = 'tab-group';

    const btn = document.createElement('button');
    btn.className  = 'tab-group-btn';
    btn.dataset.cat = cat.id;
    btn.innerHTML  = `${escHtml(cat.label)} <span class="tab-group-arrow">▾</span>`;

    const anyWarn = cat.keys.some(k => PBS_REGISTRY[k] && !state.pbsLoaded[k]);
    if (anyWarn) btn.classList.add('has-warn');

    const dropdown = document.createElement('div');
    dropdown.className  = 'tab-dropdown';
    dropdown.dataset.cat = cat.id;

    for (const key of cat.keys) {
      const reg = PBS_REGISTRY[key];
      if (!reg) continue;
      const item = document.createElement('button');
      item.className  = 'tab-dropdown-item' + (state.pbsLoaded[key] ? '' : ' warn');
      item.textContent = reg.label + (state.pbsLoaded[key] ? '' : ' (없음)');
      item.dataset.key = key;
      item.addEventListener('click', e => {
        e.stopPropagation();
        switchTab(key);
        closeAllDropdowns();
      });
      dropdown.appendChild(item);
    }

    btn.addEventListener('click', e => {
      e.stopPropagation();
      const wasOpen = dropdown.classList.contains('open');
      closeAllDropdowns();
      if (!wasOpen) {
        dropdown.classList.add('open');
        btn.classList.add('open');
      }
    });

    group.appendChild(btn);
    group.appendChild(dropdown);
    container.appendChild(group);
  }

  // 외부 클릭 시 닫기 (최초 1회만)
  if (!_tabDropdownCloseSetup) {
    _tabDropdownCloseSetup = true;
    document.addEventListener('click', closeAllDropdowns);
  }

  // 로그 버튼
  let logBtn = document.getElementById('btn-log');
  if (!logBtn) {
    logBtn = document.createElement('button');
    logBtn.id = 'btn-log';
    logBtn.style.cssText = 'background:#1a3a5c;color:#fff;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:12px;margin-left:4px;white-space:nowrap;';
    logBtn.textContent = '📋 로그 (0)';
    logBtn.addEventListener('click', showLogModal);
    document.getElementById('header').insertBefore(logBtn, document.getElementById('load-status'));
  }

  // 내보내기 버튼
  let exportBtn = document.getElementById('btn-export');
  if (!exportBtn) {
    exportBtn = document.createElement('button');
    exportBtn.id = 'btn-export';
    exportBtn.style.cssText = 'background:#1a6b4a;color:#fff;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:12px;margin-left:6px;display:none;';
    exportBtn.textContent = '💾 파일 내보내기';
    exportBtn.addEventListener('click', () => saveTab(state.currentTab));
    document.getElementById('header').insertBefore(exportBtn, document.getElementById('load-status'));
  }

  const firstLoaded = Object.keys(PBS_REGISTRY).find(k => state.pbsLoaded[k]);
  if (firstLoaded) switchTab(firstLoaded);
}

function switchTab(key) {
  state.currentTab   = key;
  state.selectedIndex = -1;

  document.querySelectorAll('.tab-dropdown-item').forEach(b => {
    b.classList.toggle('active', b.dataset.key === key);
  });
  document.querySelectorAll('.tab-group-btn').forEach(btn => {
    const cat = TAB_CATEGORIES.find(c => c.id === btn.dataset.cat);
    btn.classList.toggle('active', !!(cat && cat.keys.includes(key)));
  });

  // 현재 탭 레이블 업데이트
  const tabLabel = document.getElementById('list-tab-label');
  if (tabLabel) {
    const cat     = TAB_CATEGORIES.find(c => c.keys.includes(key));
    const catName = cat ? cat.label : '';
    const tabName = (PBS_REGISTRY[key] || {}).label || key;
    tabLabel.innerHTML = catName
      ? `<span class="ltl-cat">${escHtml(catName)}</span><span class="ltl-sep">›</span><span class="ltl-name">${escHtml(tabName)}</span>`
      : `<span class="ltl-name">${escHtml(tabName)}</span>`;
  }

  const exportBtn = document.getElementById('btn-export');
  if (exportBtn) exportBtn.style.display = state.pbsLoaded[key] ? '' : 'none';

  const newEntryBtn = document.getElementById('btn-new-entry');
  if (newEntryBtn) {
    newEntryBtn.style.display = (CREATABLE_TABS.has(key) && !!state.pbsLoaded[key]) ? '' : 'none';
  }

  renderList();
  clearEditPanel();
}

// ═══════════════════════════════════════════════════════════
// LIST PANEL
// ═══════════════════════════════════════════════════════════

function getListDisplayName(entry) {
  const reg = PBS_REGISTRY[state.currentTab];
  if (!reg) return '';
  if (reg.type === 'location') {
    return entry.mapName && entry.mapName !== entry.mapId
      ? `${entry.mapName} [${entry.mapId}]`
      : `[${entry.mapId}]`;
  }
  if (reg.type === 'trainer') {
    const name = entry.trainerName || entry.internalId;
    return entry.version != null ? `${name} (v${entry.version})` : name;
  }
  if (reg.nameField === 'FormName') {
    const species     = entry.internalId.split(',')[0];
    const r           = getKorean(species, 'SPECIES_NAMES');
    const speciesName = r.kor || r.eng || species;
    const formName    = entry.fields.FormName || '';
    const initial     = formName ? formName[0].toUpperCase() : '?';
    return `${speciesName}-${initial}`;
  }
  return entryDisplayName(entry, reg);
}

function renderList(filter = '') {
  const ul   = document.getElementById('entity-list');
  ul.innerHTML = '';
  const data = state.pbsData[state.currentTab] || [];
  const reg  = PBS_REGISTRY[state.currentTab];
  const q    = filter.toLowerCase();
  let count  = 0;

  // 세대별 배경색: SPECIES_NAMES 탭(포켓몬 목록)에서만 활성화
  const showGenColors = reg?.translationSection === 'SPECIES_NAMES';

  data.forEach((entry, idx) => {
    const id      = entry.internalId || entry.mapId || '';
    const display = getListDisplayName(entry);
    if (q && !display.toLowerCase().includes(q) && !id.toLowerCase().includes(q)) return;

    count++;
    const li = document.createElement('li');
    li.dataset.idx = idx;
    if (showGenColors && entry.fields?.Generation) {
      li.dataset.gen = entry.fields.Generation;
    }
    const idChip = (reg?.type === 'trainer') ? (entry.trainerType || '') : id;
    li.innerHTML = `${escHtml(display)}<span class="list-id">${escHtml(idChip)}</span>`;
    if (idx === state.selectedIndex) li.classList.add('selected');
    li.addEventListener('click', () => selectEntry(idx));
    ul.appendChild(li);
  });

  document.getElementById('list-count').textContent = `${count} / ${data.length}`;
}

function deleteCurrentEntry() {
  const tab = state.currentTab;
  const idx = state.selectedIndex;
  if (idx < 0 || !state.pbsData[tab] || !state.pbsData[tab][idx]) return;

  const entry = state.pbsData[tab][idx];
  const label = entry.internalId || entry.mapId || `#${idx + 1}`;

  state.pbsData[tab].splice(idx, 1);
  state.selectedIndex = -1;

  renderList(document.getElementById('search-input')?.value || '');
  clearEditPanel();
  toast(`[${label}] 삭제됨`);
}

function selectEntry(idx) {
  state.selectedIndex = idx;
  document.querySelectorAll('#entity-list li').forEach(li => {
    li.classList.toggle('selected', Number(li.dataset.idx) === idx);
  });
  const data = state.pbsData[state.currentTab];
  if (!data || !data[idx]) return;
  const reg = PBS_REGISTRY[state.currentTab];
  if (reg.type === 'entity')       renderEntityEdit(data[idx], reg);
  else if (reg.type === 'trainer') renderTrainerEdit(data[idx]);
  else                             renderEncounterEdit(data[idx]);
}
