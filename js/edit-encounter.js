'use strict';

// ═══════════════════════════════════════════════════════════
// ENCOUNTER EDIT PANEL
// ═══════════════════════════════════════════════════════════

function renderEncounterEdit(entry) {
  const hdrHtml = `
    <div id="edit-title">맵 [${escHtml(entry.mapId)}]</div>
    <div id="edit-subtitle">${escHtml(entry.mapName || '이름 없음')}</div>
    <button class="btn-save"   id="btn-save">저장 <span class="btn-shortcut">Ctrl+⇧+S</span></button>
    <button class="btn-cancel" id="btn-cancel">취소 <span class="btn-shortcut">Esc</span></button>
  `;

  let bodyHtml = `
    <div class="enc-map-header">
      <div class="field-label" style="padding-top:0">맵 이름</div>
      <input type="text" id="enc-map-name" value="${escHtml(entry.mapName)}" style="max-width:280px">
    </div>
    <div class="enc-add-type">
      <span style="color:var(--text-muted);font-size:12px">서식 타입 추가:</span>
      <select id="enc-new-type-sel">
        ${KNOWN_ENC_TYPES.map(t => `<option>${escHtml(t)}</option>`).join('')}
        <option value="__custom__">(직접 입력)</option>
      </select>
      <input type="text" id="enc-custom-type" placeholder="직접 입력" style="width:130px;display:none">
      <button class="btn-add" id="enc-btn-add-type">+ 추가</button>
    </div>
    <div id="enc-types-container">`;

  for (const typeName of entry._typeOrder) {
    const density = entry.encounterDensities?.[typeName] ?? null;
    bodyHtml += renderEncTypeBlock(typeName, entry.encounterTypes[typeName] || [], density);
  }
  bodyHtml += '</div>';

  setEditPanelLayout(hdrHtml, bodyHtml);
  attachEncounterHandlers(entry);
}

// 종족 ID -> 도감 번호(= PBS 파일 내 등장 순서) 맵을 만든다.
// pokemon.txt 등 SPECIES_NAMES 계열 파일의 순서가 곧 내셔널 도감 순서.
//  · 베이스 종족(pokemon.txt → pokemon_base_Gen_9_Pack.txt 순) : 1, 2, 3 …
//  · 폼([VENUSAUR,1] 등) : 베이스 번호 + 폼번호/1000
//       → 폼이 원종 바로 뒤에 오도록 (예: VENUSAUR=3 이면 VENUSAUR,1 = 3.001)
function buildSpeciesDexMap() {
  const map = {};
  let n = 0;

  // 1) 베이스 종족: 등장 순서대로 도감 번호 부여 (gen9 팩은 베이스 뒤에 이어짐)
  for (const [key, r] of Object.entries(PBS_REGISTRY)) {
    if (r.translationSection === 'SPECIES_NAMES' && state.pbsData[key]) {
      for (const p of state.pbsData[key]) {
        if (!(p.internalId in map)) map[p.internalId] = ++n;
      }
    }
  }

  // 2) 폼(SPECIES_FORM_NAMES): 베이스 종족 번호에 폼 번호를 소수로 더해 바로 뒤에 배치
  for (const [key, r] of Object.entries(PBS_REGISTRY)) {
    if (r.translationSection === 'SPECIES_FORM_NAMES' && state.pbsData[key]) {
      for (const p of state.pbsData[key]) {
        if (p.internalId in map) continue;
        const [baseId, formStr] = p.internalId.split(',');
        const base = map[baseId];
        if (base != null) {
          map[p.internalId] = base + Math.min(Number(formStr) || 0, 999) / 1000;
        }
      }
    }
  }
  return map;
}

// 확률 내림차순 → (동률 시) 도감 번호 오름차순으로 슬롯 정렬
function sortEncSlots(slots, dexMap) {
  // 맵에 없으면 베이스 종족(콤마 앞)으로 폴백, 그래도 없으면 맨 뒤
  const dexOf = sp => {
    if (sp in dexMap) return dexMap[sp];
    const base = (sp || '').split(',')[0];
    return dexMap[base] ?? Infinity;
  };
  // stable sort: 확률·도감번호가 모두 같으면 입력 순서 유지
  slots.sort((a, b) => {
    if (b.probability !== a.probability) return b.probability - a.probability;
    return dexOf(a.species) - dexOf(b.species);
  });
  return slots;
}

// 한 블록(tbody)의 현재 슬롯들을 데이터로 읽어온다
function readSlotsFromBlock(block) {
  const slots = [];
  block.querySelectorAll('tbody tr').forEach(tr => {
    slots.push({
      probability: Number(tr.querySelector('.enc-prob')?.value) || 0,
      species:     tr.querySelector('.enc-species-cell .combo-wrap')?.dataset.value || '',
      minLevel:    Number(tr.querySelector('.enc-min')?.value) || 0,
      maxLevel:    Number(tr.querySelector('.enc-max')?.value) || 0,
    });
  });
  return slots;
}

// 슬롯 한 행의 HTML (신규 추가·복제 시 공용)
function encSlotRowHtml(slot) {
  return `<tr>
    <td><input type="number" class="enc-prob" value="${slot.probability}" min="0" max="100" style="width:52px"></td>
    <td class="enc-species-cell">${buildCombo(getPokemonList(), slot.species, 'enc-combo')}</td>
    <td><input type="number" class="enc-min" value="${slot.minLevel}" min="0" max="100" style="width:52px"></td>
    <td><input type="number" class="enc-max" value="${slot.maxLevel}" min="0" max="100" style="width:52px"></td>
    <td><button class="btn-remove enc-slot-remove">×</button></td>
  </tr>`;
}

function renderEncTypeBlock(typeName, slots, density) {
  const densityVal = density != null ? density : '';
  const rows = slots.map(encSlotRowHtml).join('');

  return `<div class="enc-type-block" data-type="${escHtml(typeName)}">
    <div class="enc-type-header">
      <span class="type-name">${escHtml(typeName)}</span>
      <span style="color:var(--text-muted);font-size:11px;margin-left:4px">밀도</span>
      <input type="number" class="enc-density" value="${escHtml(String(densityVal))}"
        placeholder="없음" min="0" style="width:56px;margin-left:4px">
      <button class="btn-remove enc-type-remove" title="서식 타입 삭제"
        style="width:auto;padding:0 8px;margin-left:auto">타입 삭제</button>
    </div>
    <table class="enc-table">
      <thead><tr><th>확률</th><th>종족</th><th>최소Lv</th><th>최대Lv</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="enc-add-slot">
      <button class="btn-add enc-slot-add">+ 슬롯 추가</button>
      <span class="enc-copy-tools">
        <select class="enc-copy-src" title="다른 서식 타입의 슬롯 목록을 이 타입으로 복제"></select>
        <button class="btn-add enc-copy-btn">⎘ 복제</button>
      </span>
    </div>
  </div>`;
}

// 각 블록의 '복제 원본' 드롭다운을 현재 타입 목록으로 갱신 (자기 자신 제외)
function refreshEncCopyDropdowns() {
  const blocks   = [...document.querySelectorAll('.enc-type-block')];
  const allTypes = blocks.map(b => b.dataset.type);
  blocks.forEach(b => {
    const sel = b.querySelector('.enc-copy-src');
    if (!sel) return;
    const others = allTypes.filter(t => t !== b.dataset.type);
    const prev   = sel.value;
    sel.innerHTML = `<option value="">다른 타입에서 복제…</option>` +
      others.map(t => `<option value="${escHtml(t)}">${escHtml(t)}</option>`).join('');
    if (others.includes(prev)) sel.value = prev;
    const btn = b.querySelector('.enc-copy-btn');
    const none = others.length === 0;
    sel.disabled = none;
    if (btn) btn.disabled = none;
  });
}

function attachEncounterHandlers(entry) {
  const body = document.getElementById('edit-body');

  document.getElementById('enc-new-type-sel').addEventListener('change', e => {
    document.getElementById('enc-custom-type').style.display =
      e.target.value === '__custom__' ? '' : 'none';
  });

  document.getElementById('enc-btn-add-type').addEventListener('click', () => {
    const sel = document.getElementById('enc-new-type-sel');
    const typeName = sel.value === '__custom__'
      ? document.getElementById('enc-custom-type').value.trim()
      : sel.value;
    if (!typeName) return;
    if (entry.encounterTypes[typeName]) { toast('이미 있는 서식 타입입니다.', true); return; }
    entry.encounterTypes[typeName] = [];
    if (!entry.encounterDensities) entry.encounterDensities = {};
    entry.encounterDensities[typeName] = null;
    entry._typeOrder.push(typeName);
    document.getElementById('enc-types-container')
      .insertAdjacentHTML('beforeend', renderEncTypeBlock(typeName, [], null));
    refreshEncCopyDropdowns();
  });

  body.addEventListener('click', e => {
    if (e.target.classList.contains('enc-type-remove')) {
      const block    = e.target.closest('.enc-type-block');
      const typeName = block.dataset.type;
      if (confirm(`"${typeName}" 서식 타입을 삭제하시겠습니까?`)) {
        delete entry.encounterTypes[typeName];
        delete entry.encounterDensities?.[typeName];
        entry._typeOrder = entry._typeOrder.filter(t => t !== typeName);
        block.remove();
        refreshEncCopyDropdowns();
      }
    }
    if (e.target.classList.contains('enc-slot-remove')) {
      e.target.closest('tr')?.remove();
    }
    if (e.target.classList.contains('enc-slot-add')) {
      const tbody = e.target.closest('.enc-type-block').querySelector('tbody');
      tbody.insertAdjacentHTML('beforeend',
        encSlotRowHtml({ probability: 10, species: '', minLevel: 5, maxLevel: 10 }));
    }
    // 다른 서식 타입의 슬롯 목록을 이 타입으로 복제
    if (e.target.classList.contains('enc-copy-btn')) {
      const destBlock = e.target.closest('.enc-type-block');
      const srcType   = destBlock.querySelector('.enc-copy-src')?.value;
      if (!srcType) { toast('복제할 원본 서식 타입을 선택하세요.', true); return; }
      const srcBlock = [...document.querySelectorAll('.enc-type-block')]
        .find(b => b.dataset.type === srcType);
      if (!srcBlock) return;

      const srcSlots = readSlotsFromBlock(srcBlock);
      if (srcSlots.length === 0) { toast(`"${srcType}" 타입에 복제할 슬롯이 없습니다.`, true); return; }

      const destBody = destBlock.querySelector('tbody');
      if (destBody.querySelector('tr') &&
          !confirm(`"${destBlock.dataset.type}" 타입의 기존 슬롯을 "${srcType}" 타입의 내용으로 덮어쓸까요?`)) {
        return;
      }
      destBody.innerHTML = srcSlots.map(encSlotRowHtml).join('');
      document.getElementById('btn-save').classList.add('dirty');
      toast(`"${srcType}" → "${destBlock.dataset.type}" (${srcSlots.length}개 슬롯 복제됨)`);
    }
  });

  const btnSave   = document.getElementById('btn-save');
  const markDirty = () => btnSave.classList.add('dirty');
  body.addEventListener('input',     markDirty);
  body.addEventListener('change',    markDirty);
  body.addEventListener('pbs:combo', markDirty);

  btnSave.addEventListener('click', () => saveEncounterEdit(entry));
  document.getElementById('btn-cancel').addEventListener('click', () => renderEncounterEdit(entry));

  refreshEncCopyDropdowns();
}

function collectEncounterData(entry) {
  entry.mapName           = document.getElementById('enc-map-name').value;
  entry.encounterDensities = entry.encounterDensities || {};
  entry._typeOrder        = [];
  entry.encounterTypes    = {};

  const dexMap = buildSpeciesDexMap();

  document.querySelectorAll('.enc-type-block').forEach(block => {
    const typeName = block.dataset.type;
    entry._typeOrder.push(typeName);

    const densityRaw = block.querySelector('.enc-density')?.value.trim();
    entry.encounterDensities[typeName] = densityRaw !== '' ? Number(densityRaw) : null;

    // 확률 내림차순 → 도감 번호 오름차순 자동 정렬
    entry.encounterTypes[typeName] = sortEncSlots(readSlotsFromBlock(block), dexMap);
  });
}

async function saveEncounterEdit(entry) {
  collectEncounterData(entry);
  appendChangeLog({
    tab:      '서식 분포',
    filename: 'PBS/encounters.txt',
    entryId:  `맵 ${entry.mapId}${entry.mapName ? ' (' + entry.mapName + ')' : ''}`,
    changes:  [{ field: '(서식 분포)', from: '', to: '수정됨' }],
  });

  if (state.usesFSAPI && state.rootHandle) {
    await saveTab(state.currentTab);
  } else {
    toast('메모리에 저장됨 — 파일 반영은 "파일 내보내기" 필요');
  }

  renderList(document.getElementById('search-input').value);
  renderEncounterEdit(entry);
}
