'use strict';

// ═══════════════════════════════════════════════════════════
// FIELD RENDERERS & COMBOBOX
// ═══════════════════════════════════════════════════════════

// ── 타입 이름 한국어 변환 ────────────────────────────────────────

function getTypeKorean(internalName) {
  if (!internalName) return '(없음)';
  const titleCase  = internalName[0] + internalName.slice(1).toLowerCase();
  const sectionMap = state.koreanMaps['TYPE_NAMES'] || {};
  const kor        = sectionMap[titleCase] || sectionMap[internalName];
  return kor ? `${kor}(${titleCase})` : titleCase;
}

// ── 드롭다운 옵션 목록 빌더 ─────────────────────────────────────

function getMovesList() {
  const reg  = PBS_REGISTRY['moves'];
  const list = [{ value: '', label: '(없음)' }];
  for (const [key, r] of Object.entries(PBS_REGISTRY)) {
    if (r.translationSection === 'MOVE_NAMES' && state.pbsData[key]) {
      for (const m of state.pbsData[key])
        list.push({ value: m.internalId, label: entryDisplayName(m, reg) });
    }
  }
  return list;
}

function getAbilitiesList() {
  const list = [{ value: '', label: '(없음)' }];
  for (const a of (state.pbsData['abilities'] || []))
    list.push({ value: a.internalId, label: getKorean(a.internalId, 'ABILITY_NAMES').display });
  return list;
}

function getItemsList() {
  const list = [{ value: '', label: '(없음)' }];
  const seen = new Set(['']);
  for (const it of (state.pbsData['items'] || [])) {
    if (seen.has(it.internalId)) continue;
    seen.add(it.internalId);
    list.push({ value: it.internalId, label: getKorean(it.internalId, 'ITEM_NAMES').display });
  }
  for (const item of Z_CRYSTAL_ITEMS) {
    if (seen.has(item.value)) continue;
    seen.add(item.value);
    list.push({ value: item.value, label: `${item.kor}(${item.eng})` });
  }
  return list;
}

/** 기본 종족(SPECIES_NAMES)만 — 트레이너 Pokemon 라인은 폼을 별도 Form 필드로 다룬다 */
function getBaseSpeciesList() {
  const list = [{ value: '', label: '(없음)' }];
  for (const [key, r] of Object.entries(PBS_REGISTRY)) {
    if (r.translationSection === 'SPECIES_NAMES' && state.pbsData[key]) {
      for (const p of state.pbsData[key])
        list.push({ value: p.internalId, label: entryDisplayName(p, r) });
    }
  }
  return list;
}

function getPokemonList() {
  const list = [{ value: '', label: '(없음)' }];
  for (const [key, r] of Object.entries(PBS_REGISTRY)) {
    if (!state.pbsData[key]) continue;
    if (r.translationSection === 'SPECIES_NAMES') {
      // 기본 포켓몬: 한국어(영어) 표시
      for (const p of state.pbsData[key])
        list.push({ value: p.internalId, label: entryDisplayName(p, r) });
    } else if (r.translationSection === 'SPECIES_FORM_NAMES') {
      // 폼 포켓몬: "종족명-폼명 (INTERNALID,form)" 형태로 표시
      for (const p of state.pbsData[key]) {
        const speciesId = p.internalId.split(',')[0];
        const { kor, eng } = getKorean(speciesId, 'SPECIES_NAMES');
        const speciesLabel = kor || eng || speciesId;
        const formName     = p.fields?.FormName || '';
        const label = formName
          ? `${speciesLabel}-${formName} (${p.internalId})`
          : `${speciesLabel} [${p.internalId}]`;
        list.push({ value: p.internalId, label });
      }
    }
  }
  return list;
}

// ── 콤보박스 ─────────────────────────────────────────────────────

function buildCombo(opts, selectedVal, cls = '') {
  const found   = opts.find(o => o.value === selectedVal);
  const display = found ? found.label : (selectedVal || '');
  const items   = opts.map(o =>
    `<div class="combo-item" data-value="${escHtml(o.value)}">${escHtml(o.label)}</div>`
  ).join('');
  return `<div class="combo-wrap${cls ? ' ' + cls : ''}" data-value="${escHtml(selectedVal)}">` +
    `<input type="text" class="combo-input" value="${escHtml(display)}" placeholder="검색…" autocomplete="off" spellcheck="false">` +
    `<div class="combo-list" hidden>${items}</div></div>`;
}

function initComboboxListeners() {
  // 포커스 → 드롭다운 열기 + 입력 초기화 (클릭하면 빈칸에서 바로 검색)
  document.addEventListener('focusin', e => {
    if (!e.target.classList.contains('combo-input')) return;
    const input = e.target;
    const wrap  = input.closest('.combo-wrap');
    const list  = wrap.querySelector('.combo-list');
    const rect  = input.getBoundingClientRect();
    list.style.left  = rect.left   + 'px';
    list.style.top   = rect.bottom + 'px';
    list.style.width = Math.max(rect.width, 200) + 'px';
    // 이전 검색 필터 초기화 후 전체 목록 표시
    list.querySelectorAll('.combo-item[hidden]').forEach(i => i.hidden = false);
    list.hidden = false;
    // 텍스트 지우기 — 사용자가 즉시 검색어를 입력할 수 있도록
    input.value = '';
  });

  // 포커스 해제 → 현재 선택된 값의 라벨 복원
  document.addEventListener('focusout', e => {
    if (!e.target.classList.contains('combo-input')) return;
    const input = e.target;
    const wrap  = input.closest('.combo-wrap');
    const list  = wrap.querySelector('.combo-list');
    const val   = wrap.dataset.value;
    const match = val ? list.querySelector(`.combo-item[data-value="${CSS.escape(val)}"]`) : null;
    input.value = match ? match.textContent : '';
    list.querySelectorAll('.combo-item[hidden]').forEach(i => i.hidden = false);
    list.hidden = true;
  });

  // 드롭다운 항목 클릭 시 input 포커스 유지 — focusout이 먼저 발동해 목록이 닫히는 것 방지
  document.addEventListener('mousedown', e => {
    if (e.target.closest('.combo-item')) e.preventDefault();
  });

  // 입력 → 필터링
  document.addEventListener('input', e => {
    if (!e.target.classList.contains('combo-input')) return;
    const wrap = e.target.closest('.combo-wrap');
    const list = wrap.querySelector('.combo-list');
    const q    = e.target.value.trim().toLowerCase();
    list.querySelectorAll('.combo-item').forEach(item => {
      item.hidden = !!q && !item.textContent.toLowerCase().includes(q);
    });
    list.hidden = false;
    if (!e.target.value) wrap.dataset.value = '';
  });

  // 클릭 → 선택 or 외부 클릭 닫기
  document.addEventListener('click', e => {
    const item = e.target.closest('.combo-item');
    if (item) {
      const wrap  = item.closest('.combo-wrap');
      const input = wrap.querySelector('.combo-input');
      wrap.dataset.value = item.dataset.value;
      input.value = item.textContent;
      wrap.dispatchEvent(new CustomEvent('pbs:combo', { bubbles: true }));
      const list = wrap.querySelector('.combo-list');
      list.hidden = true;
      list.querySelectorAll('.combo-item[hidden]').forEach(i => i.hidden = false);
      wrap.querySelector('.combo-item.kb-focus')?.classList.remove('kb-focus');
      return;
    }
    if (!e.target.closest('.combo-wrap')) {
      document.querySelectorAll('.combo-list:not([hidden])').forEach(l => l.hidden = true);
    }
  });

  // 키보드 내비게이션
  document.addEventListener('keydown', e => {
    if (!e.target.classList.contains('combo-input')) return;
    const wrap    = e.target.closest('.combo-wrap');
    const list    = wrap.querySelector('.combo-list');
    const visible = [...list.querySelectorAll('.combo-item:not([hidden])')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      list.hidden = false;
      const cur  = list.querySelector('.combo-item.kb-focus');
      const idx  = cur ? visible.indexOf(cur) : -1;
      cur?.classList.remove('kb-focus');
      const next = visible[e.key === 'ArrowDown'
        ? Math.min(idx + 1, visible.length - 1)
        : Math.max(idx - 1, 0)];
      next?.classList.add('kb-focus');
      next?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      list.querySelector('.combo-item.kb-focus')?.click();
    } else if (e.key === 'Escape') {
      list.hidden = true;
    }
  });
}

// ── 개별 필드 위젯 렌더러 ────────────────────────────────────────

function renderTypesPairField(key, val) {
  const parts = val ? val.split(',') : [];
  const t1    = parts[0] || '';
  const t2    = parts[1] || '';
  const makeOpts = selected => ['', ...POKEMON_TYPES].map(t => {
    const sel     = t === selected ? ' selected' : '';
    const display = t ? getTypeKorean(t) : '(없음)';
    return `<option value="${escHtml(t)}"${sel}>${escHtml(display)}</option>`;
  }).join('');
  return `<div class="types-pair-wrap" data-field="${escHtml(key)}" data-renderer="pokemon_types_pair">
    <select class="type-sel-1">${makeOpts(t1)}</select>
    <select class="type-sel-2">${makeOpts(t2)}</select>
  </div>`;
}

function renderBasestatsField(key, val) {
  const n = val ? val.split(',').map(v => Number(v.trim()) || 0) : [0,0,0,0,0,0];
  // 표시 순서: HP, 공격, 방어, 특공, 특방, 스피드
  const stats = [
    { label: 'HP',     key: 'hp',  val: n[0] },
    { label: '공격',   key: 'atk', val: n[1] },
    { label: '방어',   key: 'def', val: n[2] },
    { label: '특공',   key: 'spa', val: n[4] },
    { label: '특방',   key: 'spd', val: n[5] },
    { label: '스피드', key: 'spe', val: n[3] },
  ];
  const inputs = stats.map(s =>
    `<div class="stat-item">
      <span class="stat-label">${s.label}</span>
      <input type="number" class="stat-input" data-stat="${s.key}" value="${s.val}" min="1" max="255">
    </div>`
  ).join('');
  return `<div class="basestats-wrap" data-field="${escHtml(key)}" data-renderer="basestats">${inputs}</div>`;
}

function renderMovelistField(key, val, withLevel) {
  const items = val ? val.split(',') : [];
  let rows = '';
  if (withLevel) {
    for (let i = 0; i < items.length - 1; i += 2) {
      rows += `<div class="movelist-row">
        <input type="number" class="ml-level" value="${escHtml(items[i] || '')}" min="0" max="100" placeholder="Lv">
        ${buildCombo(getMovesList(), items[i + 1] || '', 'ml-combo')}
        <button class="btn-remove" title="삭제">×</button>
      </div>`;
    }
  } else {
    for (const mv of items.filter(Boolean)) {
      rows += `<div class="movelist-row">
        ${buildCombo(getMovesList(), mv, 'ml-combo')}
        <button class="btn-remove" title="삭제">×</button>
      </div>`;
    }
  }
  return `<div class="movelist-rows" data-field="${escHtml(key)}" data-renderer="${withLevel ? 'movelist' : 'movelist_flat'}">${rows}</div>
    <button class="btn-add ml-add" data-field="${escHtml(key)}" data-with-level="${withLevel}">+ 기술 추가</button>`;
}

function renderAbilitylistField(key, val, maxCount) {
  const items = val ? val.split(',').map(s => s.trim()).filter(Boolean) : [];
  let rows = '';
  if (maxCount === 1) {
    rows = `<div class="abilitylist-row">${buildCombo(getAbilitiesList(), items[0] || '', 'al-combo')}</div>`;
  } else {
    const renderCount = Math.max(items.length, 1);
    for (let i = 0; i < Math.min(renderCount, maxCount); i++) {
      rows += `<div class="abilitylist-row">
        ${buildCombo(getAbilitiesList(), items[i] || '', 'al-combo')}
        <button class="btn-remove" title="삭제">×</button>
      </div>`;
    }
  }
  const currentCount = maxCount === 1 ? 1 : Math.max(items.length, 1);
  const addBtn = maxCount > 1 && currentCount < maxCount
    ? `<button class="btn-add al-add" data-field="${escHtml(key)}" data-max="${maxCount}">+ 특성 추가</button>`
    : '';
  const renderer = maxCount > 1 ? 'abilitylist' : 'ability_single';
  return `<div class="abilitylist-rows" data-field="${escHtml(key)}" data-renderer="${renderer}">${rows}</div>${addBtn}`;
}

function renderItemField(key, val) {
  return buildCombo(getItemsList(), val, 'item-combo')
    .replace('class="combo-wrap item-combo"',
      `class="combo-wrap item-combo" data-field="${escHtml(key)}" data-renderer="item_single"`);
}

// ── 진화 목록 렌더러 ─────────────────────────────────────────────

function _buildEvoParamWidget(method, param) {
  const mDef  = EVOLUTION_METHODS.find(m => m.value === method);
  const pType = mDef ? mDef.param : 'text';
  switch (pType) {
    case 'level':
    case 'number':
      return `<input type="number" class="evo-param-input" value="${escHtml(param)}"
        min="1" max="100" placeholder="값" style="width:64px">`;
    case 'item':
      return buildCombo(getItemsList(), param, 'evo-item-combo');
    case 'move':
      return buildCombo(getMovesList(), param, 'evo-move-combo');
    case 'pokemon':
      return buildCombo(getPokemonList(), param, 'evo-poke-combo');
    case 'type': {
      const opts = ['', ...POKEMON_TYPES].map(t =>
        `<option value="${escHtml(t)}"${t === param ? ' selected' : ''}>${escHtml(t ? getTypeKorean(t) : '(타입 선택)')}</option>`
      ).join('');
      return `<select class="evo-param-type">${opts}</select>`;
    }
    case 'none':
      return `<span class="evo-param-none" style="color:var(--text-muted);font-size:11px">—</span>`;
    default:
      return `<input type="text" class="evo-param-input" value="${escHtml(param)}"
        placeholder="파라미터" style="width:120px">`;
  }
}

function _buildEvoRow(species, method, param) {
  const methodOpts = [{ value: '', label: '(방식 선택)' }, ...EVOLUTION_METHODS].map(m =>
    `<option value="${escHtml(m.value)}"${m.value === method ? ' selected' : ''}>${escHtml(m.label)}</option>`
  ).join('');
  return `<div class="evolist-row">
    <div class="evo-species">${buildCombo(getPokemonList(), species, 'evo-species-combo')}</div>
    <select class="evo-method">${methodOpts}</select>
    <div class="evo-param">${_buildEvoParamWidget(method, param)}</div>
    <button class="btn-remove" title="삭제">×</button>
  </div>`;
}

function renderEvolutionlistField(key, val) {
  const tokens = val ? val.split(',').map(s => s.trim()) : [];
  let rows = '';
  for (let i = 0; i + 2 < tokens.length; i += 3) {
    rows += _buildEvoRow(tokens[i], tokens[i + 1], tokens[i + 2] || '');
  }
  return `<div class="evolist-rows" data-field="${escHtml(key)}">${rows}</div>
    <button class="btn-add evo-add" data-field="${escHtml(key)}">+ 진화 추가</button>`;
}

// ── 범용 필드 행 렌더러 ──────────────────────────────────────────

function renderFieldRow(key, val, reg) {
  const renderer = (reg.specialFields || {})[key] || 'text';
  // 일부 렌더러는 필드 라벨을 커스텀 표시
  let labelText = key;
  if (renderer === 'gender_ratio') labelText = 'GenderRatio(♂ : ♀)';
  let label       = `<div class="field-label">${escHtml(labelText)}</div>`;
  let valueHtml   = '';

  switch (renderer) {
    case 'pokemon_type': {
      const opts = ['', ...POKEMON_TYPES].map(t => {
        const sel = t === val ? ' selected' : '';
        return `<option value="${escHtml(t)}"${sel}>${escHtml(t ? getTypeKorean(t) : '(없음)')}</option>`;
      }).join('');
      valueHtml = `<select data-field="${escHtml(key)}" data-renderer="pokemon_type">${opts}</select>`;
      break;
    }
    case 'pokemon_types_pair':
      valueHtml = renderTypesPairField(key, val);
      break;
    case 'move_category': {
      const opts = MOVE_CATEGORIES.map(c =>
        `<option value="${escHtml(c)}"${c === val ? ' selected' : ''}>${escHtml(c)}</option>`
      ).join('');
      valueHtml = `<select data-field="${escHtml(key)}" data-renderer="move_category">${opts}</select>`;
      break;
    }
    case 'move_target': {
      const opts = ['', ...MOVE_TARGETS.map(t => t.value)].map(v => {
        const meta = MOVE_TARGETS.find(t => t.value === v);
        const label = v ? `${v}  —  ${meta.desc}` : '(미설정)';
        return `<option value="${escHtml(v)}"${v === val ? ' selected' : ''}>${escHtml(label)}</option>`;
      }).join('');
      valueHtml = `<select data-field="${escHtml(key)}" data-renderer="move_target" style="max-width:100%">${opts}</select>`;
      break;
    }
    case 'move_priority': {
      const opts = ['', ...MOVE_PRIORITY_RANGE.map(String)].map(v => {
        const label = v === '' ? '0 (기본)' : (v === '0' ? '0' : (Number(v) > 0 ? `+${v}` : v));
        return `<option value="${escHtml(v)}"${v === val ? ' selected' : ''}>${escHtml(label)}</option>`;
      }).join('');
      valueHtml = `<select data-field="${escHtml(key)}" data-renderer="move_priority" style="width:120px">${opts}</select>`;
      break;
    }
    case 'move_pp': {
      const opts = ['', ...MOVE_PP_VALUES.map(String)].map(v =>
        `<option value="${escHtml(v)}"${v === val ? ' selected' : ''}>${escHtml(v || '(미설정)')}</option>`
      ).join('');
      valueHtml = `<select data-field="${escHtml(key)}" data-renderer="move_pp" style="width:100px">${opts}</select>`;
      break;
    }
    case 'move_flags': {
      const active  = val ? val.split(',').map(f => f.trim()).filter(Boolean) : [];
      const custom  = active.filter(f => !MOVE_FLAGS.includes(f));
      const boxes   = MOVE_FLAGS.map(flag => {
        const chk = active.includes(flag) ? ' checked' : '';
        return `<label class="mf-label"><input type="checkbox" value="${escHtml(flag)}"${chk}>${escHtml(flag)}</label>`;
      }).join('');
      valueHtml = `<div class="move-flags-wrap" data-field="${escHtml(key)}">
        ${boxes}
        <div class="mf-custom-row">
          <span class="mf-custom-label">커스텀:</span>
          <input type="text" class="mf-custom-input"
            placeholder="추가 플래그 (쉼표로 구분)"
            value="${escHtml(custom.join(','))}">
        </div>
      </div>`;
      break;
    }
    case 'move_desc': {
      valueHtml = `<textarea data-field="${escHtml(key)}" rows="3"
        style="resize:vertical;width:100%;font-family:var(--font);font-size:12px"
        >${escHtml(val)}</textarea>`;
      break;
    }
    case 'movelist':
      valueHtml = renderMovelistField(key, val, true);
      break;
    case 'movelist_flat':
      valueHtml = renderMovelistField(key, val, false);
      break;
    case 'abilitylist':
      valueHtml = renderAbilitylistField(key, val, 2);
      break;
    case 'ability_single':
      valueHtml = renderAbilitylistField(key, val, 1);
      break;
    case 'basestats':
      valueHtml = renderBasestatsField(key, val);
      break;
    case 'item_single':
      valueHtml = renderItemField(key, val);
      break;
    case 'evolution_list':
      valueHtml = renderEvolutionlistField(key, val);
      break;
    case 'trainer_gender': {
      const opts = ['', ...TRAINER_GENDERS].map(g => {
        const sel = g === val ? ' selected' : '';
        return `<option value="${escHtml(g)}"${sel}>${escHtml(g || '(없음)')}</option>`;
      }).join('');
      valueHtml = `<select data-field="${escHtml(key)}" data-renderer="trainer_gender">${opts}</select>`;
      break;
    }
    case 'gender_ratio': {
      const opts = [{ value: '', label: '(미설정)' }, ...GENDER_RATIOS].map(gr => {
        const sel = gr.value === val ? ' selected' : '';
        return `<option value="${escHtml(gr.value)}"${sel}>${escHtml(gr.label)}</option>`;
      }).join('');
      valueHtml = `<select data-field="${escHtml(key)}" data-renderer="gender_ratio">${opts}</select>`;
      break;
    }
    case 'growth_rate': {
      const opts = [{ value: '', desc: '' }, ...GROWTH_RATES].map(gr => {
        const label = gr.value ? `${gr.value}  —  ${gr.desc}` : '(미설정)';
        const sel   = gr.value === val ? ' selected' : '';
        return `<option value="${escHtml(gr.value)}"${sel}>${escHtml(label)}</option>`;
      }).join('');
      valueHtml = `<select data-field="${escHtml(key)}" data-renderer="growth_rate" style="max-width:100%">${opts}</select>`;
      break;
    }
    default:
      valueHtml = `<input type="text" data-field="${escHtml(key)}" value="${escHtml(val)}">`;
  }

  return `<div class="field-row">${label}<div class="field-value">${valueHtml}</div></div>`;
}
