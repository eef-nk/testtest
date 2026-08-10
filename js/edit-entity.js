'use strict';

// ═══════════════════════════════════════════════════════════
// ENTITY EDIT PANEL
// ═══════════════════════════════════════════════════════════

/**
 * 값이 없어도 항상 렌더링(=공란으로 살려두는) 필드인지 판정합니다.
 * - movelist 계열(Moves/EggMoves/TutorMoves): PBS에 줄이 없어도 기술 추가 UI 표시
 * - 특성 계열(Abilities / HiddenAbilities): 특성을 상속받는 폼·메가 포켓몬에서도
 *   특성을 재정의할 수 있도록 공란 위젯을 표시
 *   (HiddenAbility 단수형은 강제 표시하지 않음 — PE v21.1 표준은 HiddenAbilities)
 */
function _isForceShowField(key, reg) {
  const rnd = (reg.specialFields || {})[key];
  if (rnd === 'movelist' || rnd === 'movelist_flat') return true;
  if (key === 'Abilities' || key === 'HiddenAbilities') return true;
  return false;
}

/**
 * 렌더링에 사용할 필드 목록을 반환합니다.
 * reg.fieldOrder가 있으면 그대로 사용하고,
 * 없으면 entry._keyOrder에 강제 표시 대상이면서 아직 포함되지 않은 키를 덧붙입니다.
 */
function _buildRenderFieldList(entry, reg) {
  if (reg.fieldOrder) return reg.fieldOrder;
  const base = entry._keyOrder;
  if (!reg.specialFields) return base;
  const extra = Object.keys(reg.specialFields).filter(k =>
    _isForceShowField(k, reg) &&
    !base.includes(k) &&
    // 단수 HiddenAbility가 이미 있으면 복수형을 중복 표시하지 않음
    !(k === 'HiddenAbilities' && base.includes('HiddenAbility'))
  );
  return extra.length ? [...base, ...extra] : base;
}

function renderEntityEdit(entry, reg) {
  const compareBtn = isComparableTab(reg)
    ? `<button class="btn-compare${state.compareTargetId ? ' active' : ''}" id="btn-compare">🔍 비교</button>`
    : '';
  const hdrHtml = `
    <div id="edit-title">[${escHtml(entry.internalId)}]</div>
    <div id="edit-subtitle">${escHtml(entryDisplayName(entry, reg))}</div>
    <button class="btn-save"   id="btn-save">저장 <span class="btn-shortcut">Ctrl+⇧+S</span></button>
    <button class="btn-cancel" id="btn-cancel">취소 <span class="btn-shortcut">Esc</span></button>
    ${compareBtn}
  `;
  // reg.fieldOrder가 있으면 고정 필드 목록을 사용, 없으면 파싱된 키 순서 사용
  // (PBS에 해당 줄이 없어도 movelist 계열 필드는 항상 렌더링)
  const fieldList = _buildRenderFieldList(entry, reg);
  let fieldsHtml = '';
  for (const key of fieldList) {
    fieldsHtml += renderFieldRow(key, entry.fields[key] ?? '', reg);
  }
  setEditPanelLayout(hdrHtml, fieldsHtml);
  attachEntityEditHandlers(entry, reg);

  // 비교 버튼을 눌러 패널이 열린 상태에서 항목을 전환한 경우 복원
  if (state.comparePanelOpen && isComparableTab(reg)) {
    restoreComparePanel(entry, reg);
  }
}

function attachEntityEditHandlers(entry, reg) {
  const body = document.getElementById('edit-body');

  body.addEventListener('click', e => {
    // 기술 추가
    if (e.target.classList.contains('ml-add')) {
      const withLevel = e.target.dataset.withLevel === 'true';
      const fieldKey  = e.target.dataset.field;
      const container = body.querySelector(`.movelist-rows[data-field="${CSS.escape(fieldKey)}"]`);
      if (!container) return;
      const div = document.createElement('div');
      div.className = 'movelist-row';
      div.innerHTML = withLevel
        ? `<input type="number" class="ml-level" value="" min="0" max="100" placeholder="Lv">
           ${buildCombo(getMovesList(), '', 'ml-combo')}
           <button class="btn-remove" title="삭제">×</button>`
        : `${buildCombo(getMovesList(), '', 'ml-combo')}
           <button class="btn-remove" title="삭제">×</button>`;
      container.appendChild(div);
    }
    // 특성 추가
    if (e.target.classList.contains('al-add')) {
      const fieldKey  = e.target.dataset.field;
      const maxCount  = Number(e.target.dataset.max) || 2;
      const container = body.querySelector(`.abilitylist-rows[data-field="${CSS.escape(fieldKey)}"]`);
      if (!container) return;
      const currentCount = container.querySelectorAll('.abilitylist-row').length;
      if (currentCount >= maxCount) return;
      const div = document.createElement('div');
      div.className = 'abilitylist-row';
      div.innerHTML = `${buildCombo(getAbilitiesList(), '', 'al-combo')}
        <button class="btn-remove" title="삭제">×</button>`;
      container.appendChild(div);
      if (currentCount + 1 >= maxCount) e.target.style.display = 'none';
    }
    // 진화 행 추가
    if (e.target.classList.contains('evo-add')) {
      const fieldKey  = e.target.dataset.field;
      const container = body.querySelector(`.evolist-rows[data-field="${CSS.escape(fieldKey)}"]`);
      if (!container) return;
      container.insertAdjacentHTML('beforeend', _buildEvoRow('', 'Level', ''));
    }
    // 행 삭제
    if (e.target.classList.contains('btn-remove')) {
      e.target.closest('.movelist-row, .abilitylist-row, .evolist-row')?.remove();
    }
  });

  // 진화 방식 드롭다운 변경 → 파라미터 위젯 교체
  body.addEventListener('change', e => {
    if (e.target.classList.contains('evo-method')) {
      const row = e.target.closest('.evolist-row');
      if (!row) return;
      row.querySelector('.evo-param').innerHTML = _buildEvoParamWidget(e.target.value, '');
    }
  });

  const btnSave  = document.getElementById('btn-save');
  const markDirty = () => btnSave.classList.add('dirty');
  body.addEventListener('input',     markDirty);
  body.addEventListener('change',    markDirty);
  body.addEventListener('pbs:combo', markDirty);

  btnSave.addEventListener('click', () => saveEntityEdit(entry, reg));
  document.getElementById('btn-cancel').addEventListener('click', () => renderEntityEdit(entry, reg));

  // 비교 버튼
  const btnCmp = document.getElementById('btn-compare');
  if (btnCmp) {
    btnCmp.addEventListener('click', () => {
      if (document.getElementById('compare-panel')?.hidden === false) {
        closeComparePanel();
      } else {
        openComparePanel(entry, reg);
      }
    });
  }
}

function collectEntityFieldValue(body, key, reg) {
  const renderer = (reg.specialFields || {})[key] || 'text';
  switch (renderer) {
    case 'pokemon_type':
    case 'move_category':
    case 'move_target':
    case 'move_priority':
    case 'move_pp':
    case 'trainer_gender':
    case 'gender_ratio':
    case 'growth_rate': {
      const sel = body.querySelector(`select[data-field="${CSS.escape(key)}"]`);
      return sel ? sel.value : '';
    }
    case 'move_flags': {
      const wrap = body.querySelector(`.move-flags-wrap[data-field="${CSS.escape(key)}"]`);
      if (!wrap) return '';
      const checked = [...wrap.querySelectorAll('input[type="checkbox"]:checked')].map(cb => cb.value);
      const customRaw = wrap.querySelector('.mf-custom-input')?.value.trim() || '';
      const custom = customRaw.split(',').map(f => f.trim()).filter(f => f && !checked.includes(f));
      return [...checked, ...custom].join(',');
    }
    case 'move_desc': {
      const ta = body.querySelector(`textarea[data-field="${CSS.escape(key)}"]`);
      return ta ? ta.value : '';
    }
    case 'item_single': {
      const wrap = body.querySelector(`.combo-wrap[data-field="${CSS.escape(key)}"]`);
      return wrap ? wrap.dataset.value : '';
    }
    case 'pokemon_types_pair': {
      const wrap = body.querySelector(`.types-pair-wrap[data-field="${CSS.escape(key)}"]`);
      if (!wrap) return '';
      const t1 = wrap.querySelector('.type-sel-1')?.value || '';
      const t2 = wrap.querySelector('.type-sel-2')?.value || '';
      if (!t1) return '';
      return t2 ? `${t1},${t2}` : t1;
    }
    case 'movelist': {
      const pairs = [];
      body.querySelectorAll(`.movelist-rows[data-field="${CSS.escape(key)}"] .movelist-row`).forEach(row => {
        const lvStr = row.querySelector('.ml-level')?.value?.trim() || '0';
        const mv    = row.querySelector('.combo-wrap')?.dataset.value || '';
        if (mv) pairs.push({ lv: Number(lvStr) || 0, lvStr, mv });
      });
      // 레벨 오름차순 정렬 (동일 레벨은 입력 순서 유지 — stable sort)
      pairs.sort((a, b) => a.lv - b.lv);
      return pairs.flatMap(p => [p.lvStr, p.mv]).join(',');
    }
    case 'movelist_flat': {
      const parts = [];
      body.querySelectorAll(`.movelist-rows[data-field="${CSS.escape(key)}"] .movelist-row`).forEach(row => {
        const mv = row.querySelector('.combo-wrap')?.dataset.value || '';
        if (mv) parts.push(mv);
      });
      return parts.join(',');
    }
    case 'abilitylist': {
      const parts = [];
      body.querySelectorAll(`.abilitylist-rows[data-field="${CSS.escape(key)}"] .abilitylist-row`).forEach(row => {
        const ab = row.querySelector('.combo-wrap')?.dataset.value || '';
        if (ab) parts.push(ab);
      });
      return parts.join(',');
    }
    case 'ability_single': {
      const wrap = body.querySelector(`.abilitylist-rows[data-field="${CSS.escape(key)}"] .combo-wrap`);
      return wrap ? wrap.dataset.value : '';
    }
    case 'basestats': {
      const wrap = body.querySelector(`.basestats-wrap[data-field="${CSS.escape(key)}"]`);
      if (!wrap) return '';
      const g = s => Number(wrap.querySelector(`[data-stat="${s}"]`)?.value) || 0;
      // PBS 저장 순서: HP, Atk, Def, Speed, SpAtk, SpDef
      return [g('hp'), g('atk'), g('def'), g('spe'), g('spa'), g('spd')].join(',');
    }
    case 'evolution_list': {
      const parts = [];
      body.querySelectorAll(`.evolist-rows[data-field="${CSS.escape(key)}"] .evolist-row`).forEach(row => {
        const species = row.querySelector('.evo-species .combo-wrap')?.dataset.value || '';
        const method  = row.querySelector('.evo-method')?.value || '';
        if (!species && !method) return;
        const mDef  = EVOLUTION_METHODS.find(m => m.value === method);
        const pType = mDef ? mDef.param : 'text';
        let param = '';
        if (pType === 'item' || pType === 'move' || pType === 'pokemon') {
          param = row.querySelector('.evo-param .combo-wrap')?.dataset.value || '';
        } else if (pType === 'type') {
          param = row.querySelector('.evo-param-type')?.value || '';
        } else if (pType !== 'none') {
          param = row.querySelector('.evo-param-input')?.value || '';
        }
        parts.push(species, method, param);
      });
      return parts.join(',');
    }
    default: {
      const inp = body.querySelector(`input[data-field="${CSS.escape(key)}"]`);
      return inp ? inp.value : '';
    }
  }
}

async function saveEntityEdit(entry, reg) {
  const body = document.getElementById('edit-body');

  // reg.fieldOrder가 있으면 고정 필드 목록을 사용, 없으면 파싱된 키 순서 사용
  // (PBS에 해당 줄이 없어도 movelist 계열 필드는 항상 수집)
  const fieldList = _buildRenderFieldList(entry, reg);

  const oldFields = {};
  for (const key of fieldList) oldFields[key] = entry.fields[key];
  for (const key of fieldList) entry.fields[key] = collectEntityFieldValue(body, key, reg);

  // fieldOrder 모드에서는 _keyOrder를 값이 있는 필드만 포함하도록 재구성
  // (단, 첫 번째 필드 'Name' 등은 비어도 항상 포함)
  if (reg.fieldOrder) {
    entry._keyOrder = reg.fieldOrder.filter(k =>
      k === reg.fieldOrder[0] || (entry.fields[k] ?? '') !== ''
    );
  } else {
    // _keyOrder 모드: 새로 값이 생긴 강제 표시 필드(기술/특성 계열)를 _keyOrder에 추가
    // (공란이면 추가하지 않으므로, 상속형 폼·메가의 빈 특성 필드는 기록되지 않음)
    const newlyFilled = Object.keys(reg.specialFields || {}).filter(k =>
      _isForceShowField(k, reg) &&
      !entry._keyOrder.includes(k) &&
      !(k === 'HiddenAbilities' && entry._keyOrder.includes('HiddenAbility')) &&
      (entry.fields[k] ?? '') !== ''
    );
    if (newlyFilled.length) {
      entry._keyOrder = [...entry._keyOrder, ...newlyFilled];
    }
  }

  const changes = fieldList
    .filter(k => oldFields[k] !== entry.fields[k])
    .map(k => ({ field: k, from: oldFields[k] ?? '', to: entry.fields[k] ?? '' }));

  if (changes.length) {
    appendChangeLog({ tab: reg.label || state.currentTab, filename: reg.filename, entryId: entry.internalId, changes });
  }

  if (state.usesFSAPI && state.rootHandle) {
    await saveTab(state.currentTab);
  } else {
    toast(changes.length ? '메모리에 저장됨 — 파일 반영은 "파일 내보내기" 필요' : '변경사항 없음');
  }

  renderList(document.getElementById('search-input').value);
  renderEntityEdit(entry, reg);
}
