'use strict';

// ═══════════════════════════════════════════════════════════
// TRAINER EDIT PANEL
// ═══════════════════════════════════════════════════════════

// PE v21.1 트레이너 헤더 레벨 고정 필드 (새 항목에서도 항상 렌더)
const _TRAINER_FIXED_FIELDS = ['Items', 'LoseText'];

/** 새로 추가한 포켓몬은 다이맥스와 테라스탈을 사용하지 않는 상태로 시작한다. */
function _createEmptyTrainerPokemon() {
  return {
    species: '', level: 5, form: 0,
    fields: { NoDynamax: 'true', NoTera: 'true' },
    _keyOrder: ['NoDynamax', 'NoTera'],
  };
}

// ── 종족/폼/특성 조회 헬퍼 ──────────────────────────────────────

/** SPECIES_NAMES + SPECIES_FORM_NAMES 전 탭에서 internalId로 엔트리 탐색 */
function _findAnySpeciesEntry(id) {
  if (!id) return null;
  for (const [key, r] of Object.entries(PBS_REGISTRY)) {
    if ((r.translationSection === 'SPECIES_NAMES' || r.translationSection === 'SPECIES_FORM_NAMES') && state.pbsData[key]) {
      const e = state.pbsData[key].find(x => x.internalId === id);
      if (e) return e;
    }
  }
  return null;
}

/** 특정 종족의 등록된 폼 목록 [{num, label}] (Form 드롭다운용) */
function _getSpeciesForms(speciesId) {
  const forms = [];
  if (!speciesId) return forms;
  const korMap = state.koreanMaps['SPECIES_FORM_NAMES'] || {};
  for (const [key, r] of Object.entries(PBS_REGISTRY)) {
    if (r.translationSection === 'SPECIES_FORM_NAMES' && state.pbsData[key]) {
      for (const p of state.pbsData[key]) {
        const comma = p.internalId.indexOf(',');
        if (comma < 0) continue;
        const base = p.internalId.slice(0, comma);
        const num  = p.internalId.slice(comma + 1);
        if (base !== speciesId || !/^\d+$/.test(num)) continue;
        const formName = p.fields?.FormName || '';
        const kor      = korMap[formName];
        const label    = formName ? (kor ? `${kor}(${formName})` : formName) : `폼 ${num}`;
        forms.push({ num: Number(num), label });
      }
    }
  }
  forms.sort((a, b) => a.num - b.num);
  return forms;
}

/** Form <select> 옵션 HTML (0=기본형 + 등록된 폼들, 알 수 없는 현재값도 보존) */
function _buildFormOpts(speciesId, selectedForm) {
  const sel   = String(selectedForm ?? 0);
  const opts  = [`<option value="0"${sel === '0' ? ' selected' : ''}>0 — 기본형</option>`];
  const known = new Set(['0']);
  for (const f of _getSpeciesForms(speciesId)) {
    known.add(String(f.num));
    opts.push(`<option value="${f.num}"${sel === String(f.num) ? ' selected' : ''}>${escHtml(`${f.num} — ${f.label}`)}</option>`);
  }
  if (!known.has(sel)) {
    opts.push(`<option value="${escHtml(sel)}" selected>${escHtml(sel)} (미등록 폼)</option>`);
  }
  return opts.join('');
}

/** 종족+폼 기준 특성 3개(0·1·숨겨진) 표시명. 폼이 특성을 재정의하지 않으면 기본 종족 상속 */
function _getPokeAbilityNames(speciesId, form) {
  if (!speciesId) return ['', '', ''];
  const baseEntry = _findAnySpeciesEntry(speciesId);
  const formEntry = form ? _findAnySpeciesEntry(`${speciesId},${form}`) : null;

  const pickField = keys => {
    for (const src of [formEntry, baseEntry]) {
      if (!src) continue;
      for (const k of keys) {
        const v = (src.fields[k] || '').trim();
        if (v) return v;
      }
    }
    return '';
  };

  const parts  = pickField(['Abilities']).split(',').map(a => a.trim()).filter(Boolean);
  const hidden = pickField(['HiddenAbility', 'HiddenAbilities']);
  return [
    parts[0] ? getKorean(parts[0], 'ABILITY_NAMES').display : '',
    parts[1] ? getKorean(parts[1], 'ABILITY_NAMES').display : '',
    hidden   ? getKorean(hidden,   'ABILITY_NAMES').display : '',
  ];
}

/** 특성 인덱스 <select> 내부 옵션 HTML 생성 */
function _buildAbilityOpts(speciesId, form, selectedIdx) {
  const names = _getPokeAbilityNames(speciesId, form);
  return [
    `0${names[0] ? ' — ' + names[0] : ''}`,
    `1${names[1] ? ' — ' + names[1] : ''}`,
    `2 (숨겨진 특성)${names[2] ? ' — ' + names[2] : ''}`,
  ].map((label, i) => {
    const v = String(i);
    return `<option value="${v}"${v === String(selectedIdx) ? ' selected' : ''}>${escHtml(label)}</option>`;
  }).join('');
}

/** 성격 내부 ID는 그대로 유지하고, 선택지에만 한국어 이름을 함께 표시한다. */
function _buildNatureOpts(selectedNature) {
  const natures = ['', ...POKE_NATURES];
  if (selectedNature && !POKE_NATURES.includes(selectedNature)) natures.push(selectedNature);
  return natures.map(nature => {
    const label = nature
      ? `${nature} — ${POKE_NATURE_KOREAN[nature] || '(번역 없음)'}`
      : '(없음)';
    return `<option value="${escHtml(nature)}"${nature === selectedNature ? ' selected' : ''}>${escHtml(label)}</option>`;
  }).join('');
}

function renderTrainerField(key, val) {
  if (key === 'LoseText' || key === 'WinText') {
    return `<div class="field-row">
      <div class="field-label">${escHtml(key)}</div>
      <div class="field-value">
        <textarea data-field="${escHtml(key)}" rows="2" style="resize:vertical;width:100%">${escHtml(val || '')}</textarea>
      </div>
    </div>`;
  }
  return `<div class="field-row">
    <div class="field-label">${escHtml(key)}</div>
    <div class="field-value"><input type="text" data-field="${escHtml(key)}" value="${escHtml(val || '')}"></div>
  </div>`;
}

function renderTrainerPokeBlock(poke, idx) {
  // 기술
  const movesVal  = poke.fields['Moves'] || '';
  const moveItems = movesVal ? movesVal.split(',').map(s => s.trim()).filter(Boolean) : [];
  let movesHtml = '';
  for (let mi = 0; mi < 4; mi++) {
    movesHtml += `<div class="tr-poke-field">
      <label>기술 ${mi + 1}</label>
      ${buildCombo(getMovesList(), moveItems[mi] || '', 'tr-move-combo')}
    </div>`;
  }

  // IV / EV  (PBS 저장 순서: HP[0],Atk[1],Def[2],Spe[3],SpA[4],SpD[5])
  const ivField   = (poke.fields['IV'] || '').trim();
  const evField   = (poke.fields['EV'] || '').trim();
  const ivEnabled = ivField !== '';
  const evEnabled = evField !== '';
  const ivRaw = ivField.split(',').map(v => parseInt(v.trim()));
  const evRaw = evField.split(',').map(v => parseInt(v.trim()));
  const safeIv = n => (Number.isFinite(n) ? n : 31);
  const ivHtml = IV_EV_STATS.map(s =>
    `<div class="tr-stat-item"><label>${escHtml(s.label)}</label>
      <input type="number" class="tr-iv" data-stat="${s.key}" value="${safeIv(ivRaw[s.pbsIdx])}" min="0" max="31">
    </div>`).join('');
  const evHtml = IV_EV_STATS.map(s =>
    `<div class="tr-stat-item"><label>${escHtml(s.label)}</label>
      <input type="number" class="tr-ev" data-stat="${s.key}" value="${Number.isFinite(evRaw[s.pbsIdx]) ? evRaw[s.pbsIdx] : 0}" min="0" max="255">
    </div>`).join('');

  const form        = poke.form ?? 0;
  const formOpts    = _buildFormOpts(poke.species, form);

  const abilityIdx  = poke.fields['AbilityIndex'] ?? '0';
  const abilityOpts = _buildAbilityOpts(poke.species, form, abilityIdx);

  const nature      = poke.fields['Nature'] || '';
  const natureOpts  = _buildNatureOpts(nature);

  const gender      = poke.fields['Gender'] || '';
  const genderOpts  = POKE_GENDERS_TR.map(([v, l]) =>
    `<option value="${escHtml(v)}"${v === gender ? ' selected' : ''}>${escHtml(l)}</option>`).join('');

  const item      = poke.fields['Item']      || '';
  const ball      = poke.fields['Ball']      || '';
  const nickname  = poke.fields['Name']      || '';
  const happiness = poke.fields['Happiness'] || '';
  const shiny     = poke.fields['Shiny']  === 'true';
  const shadow    = poke.fields['Shadow'] === 'true';
  const dynamaxEnabled = String(poke.fields['NoDynamax'] || '').toLowerCase() !== 'true';
  const teraDisabled   = String(poke.fields['NoTera'] || '').toLowerCase() === 'true';
  const teraType       = teraDisabled ? '__NO_TERA__' : (poke.fields['TeraType'] || '');
  const teraTypeOpts   = [
    `<option value="__NO_TERA__"${teraType === '__NO_TERA__' ? ' selected' : ''}>(사용 안 함)</option>`,
    `<option value=""${teraType === '' ? ' selected' : ''}>(기본 타입 사용)</option>`,
    ...TERA_TYPES.map(type =>
      `<option value="${type}"${teraType === type ? ' selected' : ''}>${escHtml(getTypeKorean(type))}</option>`),
  ];
  if (teraType && teraType !== '__NO_TERA__' && !TERA_TYPES.includes(teraType)) {
    teraTypeOpts.push(`<option value="${escHtml(teraType)}" selected>${escHtml(teraType)} (직접 지정)</option>`);
  }

  return `<div class="tr-poke-block" data-poke-idx="${idx}">
    <div class="tr-poke-header">
      <span class="tr-poke-num">#${idx + 1}</span>
      <div style="flex:1">${buildCombo(getBaseSpeciesList(), poke.species, 'tr-species-combo')}</div>
      <label style="font-size:11px;color:var(--text-muted);flex-shrink:0">Lv.</label>
      <input type="number" class="tr-level" value="${poke.level}" min="1" max="100" style="width:52px;flex-shrink:0">
      <button class="btn-remove tr-poke-remove" title="포켓몬 삭제" style="flex-shrink:0">×</button>
    </div>
    <div class="tr-poke-body">
      <div class="tr-poke-moves">${movesHtml}</div>

      <div class="tr-poke-field">
        <label>폼 (Form)</label>
        <select class="tr-form" style="width:auto">${formOpts}</select>
      </div>
      <div class="tr-poke-field">
        <label>특성 인덱스</label>
        <select class="tr-ability-idx" style="width:auto">${abilityOpts}</select>
      </div>
      <div class="tr-poke-field">
        <label>아이템</label>
        ${buildCombo(getItemsList(), item, 'tr-item-combo')}
      </div>
      <div class="tr-poke-field">
        <label>성격</label>
        <select class="tr-nature">${natureOpts}</select>
      </div>
      <div class="tr-poke-field">
        <label>성별</label>
        <select class="tr-gender" style="width:auto">${genderOpts}</select>
      </div>
      <div class="tr-poke-field">
        <label>닉네임</label>
        <input type="text" class="tr-nickname" value="${escHtml(nickname)}">
      </div>
      <div class="tr-poke-field">
        <label>행복도</label>
        <input type="number" class="tr-happiness" value="${escHtml(happiness)}" min="0" max="255" style="width:72px">
      </div>
      <div class="tr-poke-field">
        <label>볼</label>
        ${buildCombo(getItemsList(), ball, 'tr-ball-combo')}
      </div>
      <div class="tr-poke-field tr-flag-row">
        <label><input type="checkbox" class="tr-shiny"  ${shiny  ? 'checked' : ''}> 이로치</label>
        <label><input type="checkbox" class="tr-shadow" ${shadow ? 'checked' : ''}> 쉐도우</label>
      </div>
      <div class="tr-poke-field tr-flag-row">
        <label><input type="checkbox" class="tr-dynamax-enabled" ${dynamaxEnabled ? 'checked' : ''}> 다이맥스 사용</label>
      </div>
      <div class="tr-poke-field">
        <label>테라스탈 사용 타입</label>
        <select class="tr-tera-type" style="width:auto">${teraTypeOpts.join('')}</select>
      </div>

      <div class="tr-poke-stats-section">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span style="font-size:10px;color:var(--text-muted)">개체값 (IV)</span>
          <label style="font-size:10px;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;gap:3px;user-select:none">
            <input type="checkbox" class="tr-iv-enabled"${ivEnabled ? ' checked' : ''}> 직접 지정
          </label>
        </div>
        <div class="tr-poke-stats tr-iv-stats"${ivEnabled ? '' : ' style="display:none"'}>${ivHtml}</div>
        <div style="display:flex;align-items:center;gap:8px;margin:6px 0 4px">
          <span style="font-size:10px;color:var(--text-muted)">노력치 (EV)</span>
          <label style="font-size:10px;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;gap:3px;user-select:none">
            <input type="checkbox" class="tr-ev-enabled"${evEnabled ? ' checked' : ''}> 직접 지정
          </label>
        </div>
        <div class="tr-poke-stats tr-ev-stats"${evEnabled ? '' : ' style="display:none"'}>${evHtml}</div>
      </div>
    </div>
  </div>`;
}

function renderTrainerEdit(entry) {
  const hdrHtml = `
    <div id="edit-title">[${escHtml(entry.internalId)}]</div>
    <div id="edit-subtitle">${escHtml(entry.trainerName)}${entry.version != null ? ' v' + entry.version : ''}</div>
    <button class="btn-save"   id="btn-save">저장 <span class="btn-shortcut">Ctrl+⇧+S</span></button>
    <button class="btn-cancel" id="btn-cancel">취소 <span class="btn-shortcut">Esc</span></button>
  `;

  let bodyHtml = `<div class="trainer-section">
    <div class="trainer-section-title">트레이너 정보</div>
    <div class="field-row">
      <div class="field-label">TrainerType</div>
      <div class="field-value"><input type="text" id="tr-type" value="${escHtml(entry.trainerType)}"></div>
    </div>
    <div class="field-row">
      <div class="field-label">TrainerName</div>
      <div class="field-value"><input type="text" id="tr-name" value="${escHtml(entry.trainerName)}"></div>
    </div>
    <div class="field-row">
      <div class="field-label">Version</div>
      <div class="field-value">
        <input type="number" id="tr-version" value="${entry.version != null ? entry.version : ''}"
          placeholder="(없음)" min="0" style="width:80px">
      </div>
    </div>`;

  for (const key of _TRAINER_FIXED_FIELDS) {
    bodyHtml += renderTrainerField(key, entry.fields[key] ?? '');
  }
  bodyHtml += `</div>
  <div class="trainer-section">
    <div class="trainer-section-title">포켓몬 (${entry.pokemon.length}마리)</div>
    <div id="tr-poke-list">`;
  entry.pokemon.forEach((poke, i) => { bodyHtml += renderTrainerPokeBlock(poke, i); });
  bodyHtml += `</div>
    <button class="btn-add" id="tr-btn-add-poke">+ 포켓몬 추가</button>
  </div>`;

  setEditPanelLayout(hdrHtml, bodyHtml);
  attachTrainerHandlers(entry);
}

function collectTrainerPokeFromBlock(block) {
  const species    = block.querySelector('.combo-wrap.tr-species-combo')?.dataset.value || '';
  const level      = parseInt(block.querySelector('.tr-level')?.value || '5', 10) || 5;
  const form       = parseInt(block.querySelector('.tr-form')?.value || '0', 10) || 0;
  const moveWraps  = [...block.querySelectorAll('.combo-wrap.tr-move-combo')];
  const moves      = moveWraps.map(w => w.dataset.value).filter(Boolean);
  const abilityIdx = block.querySelector('.tr-ability-idx')?.value ?? '0';
  const item       = block.querySelector('.combo-wrap.tr-item-combo')?.dataset.value || '';
  const nature     = block.querySelector('.tr-nature')?.value || '';
  const gender     = block.querySelector('.tr-gender')?.value || '';
  const nickname   = block.querySelector('.tr-nickname')?.value.trim() || '';
  const happiness  = block.querySelector('.tr-happiness')?.value.trim() || '';
  const shiny      = block.querySelector('.tr-shiny')?.checked  || false;
  const shadow     = block.querySelector('.tr-shadow')?.checked || false;
  const ball       = block.querySelector('.combo-wrap.tr-ball-combo')?.dataset.value || '';
  const dynamaxEnabled = block.querySelector('.tr-dynamax-enabled')?.checked ?? false;
  const teraType       = block.querySelector('.tr-tera-type')?.value ?? '__NO_TERA__';

  const ivEnabled = block.querySelector('.tr-iv-enabled')?.checked ?? false;
  const evEnabled = block.querySelector('.tr-ev-enabled')?.checked ?? false;
  const ivMap = {}, evMap = {};
  block.querySelectorAll('.tr-iv').forEach(i => { ivMap[i.dataset.stat] = parseInt(i.value) || 0; });
  block.querySelectorAll('.tr-ev').forEach(i => { evMap[i.dataset.stat] = parseInt(i.value) || 0; });
  const toArr = (m, def) => IV_EV_STATS
    .slice().sort((a, b) => a.pbsIdx - b.pbsIdx)
    .map(s => m[s.key] ?? def);
  const ivArr = toArr(ivMap, 31);
  const evArr = toArr(evMap, 0);

  const fields = {}, keyOrder = [];
  const add = (k, v) => { keyOrder.push(k); fields[k] = v; };

  if (moves.length)     add('Moves',        moves.join(','));
  add('AbilityIndex',   String(abilityIdx));
  if (item)             add('Item',          item);
  if (nature)           add('Nature',        nature);
  if (gender)           add('Gender',        gender);
  if (nickname)         add('Name',          nickname);
  if (happiness !== '') add('Happiness',     happiness);
  if (shiny)            add('Shiny',         'true');
  if (shadow)           add('Shadow',        'true');
  if (ball)             add('Ball',          ball);
  if (ivEnabled) add('IV', ivArr.join(','));
  if (evEnabled) add('EV', evArr.join(','));
  if (!dynamaxEnabled) add('NoDynamax', 'true');
  if (teraType === '__NO_TERA__') add('NoTera', 'true');
  else if (teraType) add('TeraType', teraType);

  return { species, level, form, fields, _keyOrder: keyOrder };
}

function attachTrainerHandlers(entry) {
  const body = document.getElementById('edit-body');

  document.getElementById('tr-btn-add-poke').addEventListener('click', () => {
    const emptyPoke = _createEmptyTrainerPokemon();
    const idx = body.querySelectorAll('.tr-poke-block').length;
    document.getElementById('tr-poke-list').insertAdjacentHTML(
      'beforeend', renderTrainerPokeBlock(emptyPoke, idx));
  });

  body.addEventListener('click', e => {
    if (e.target.classList.contains('tr-poke-remove')) {
      const block = e.target.closest('.tr-poke-block');
      if (confirm('이 포켓몬을 삭제하시겠습니까?')) {
        block.remove();
        body.querySelectorAll('.tr-poke-block').forEach((b, i) => {
          b.dataset.pokeIdx = i;
          const numEl = b.querySelector('.tr-poke-num');
          if (numEl) numEl.textContent = `#${i + 1}`;
        });
      }
    }
  });

  // 종족 콤보 변경 → 폼 목록 + 특성 드롭다운 즉시 갱신
  body.addEventListener('pbs:combo', e => {
    const wrap = e.target;
    if (!wrap.classList.contains('tr-species-combo')) return;
    const speciesId = wrap.dataset.value;
    const block = wrap.closest('.tr-poke-block');
    if (!block) return;
    const formSel = block.querySelector('.tr-form');
    if (formSel) formSel.innerHTML = _buildFormOpts(speciesId, 0); // 종족이 바뀌면 폼 초기화
    const abilSel = block.querySelector('.tr-ability-idx');
    if (abilSel) abilSel.innerHTML = _buildAbilityOpts(speciesId, 0, abilSel.value);
  });

  // 폼/체크박스 변경 처리
  body.addEventListener('change', e => {
    // 폼 변경 → 특성 드롭다운 갱신 (폼별 특성 반영)
    if (e.target.classList.contains('tr-form')) {
      const block     = e.target.closest('.tr-poke-block');
      const speciesId = block?.querySelector('.combo-wrap.tr-species-combo')?.dataset.value || '';
      const abilSel   = block?.querySelector('.tr-ability-idx');
      if (abilSel) abilSel.innerHTML = _buildAbilityOpts(speciesId, e.target.value, abilSel.value);
    }
    // IV / EV 직접 지정 체크박스 → 입력 칸 표시/숨김
    if (e.target.classList.contains('tr-iv-enabled')) {
      const statsDiv = e.target.closest('.tr-poke-stats-section')?.querySelector('.tr-iv-stats');
      if (statsDiv) statsDiv.style.display = e.target.checked ? '' : 'none';
    }
    if (e.target.classList.contains('tr-ev-enabled')) {
      const statsDiv = e.target.closest('.tr-poke-stats-section')?.querySelector('.tr-ev-stats');
      if (statsDiv) statsDiv.style.display = e.target.checked ? '' : 'none';
    }
  });

  const btnSave   = document.getElementById('btn-save');
  const markDirty = () => btnSave.classList.add('dirty');
  body.addEventListener('input',     markDirty);
  body.addEventListener('change',    markDirty);
  body.addEventListener('pbs:combo', markDirty);

  btnSave.addEventListener('click', () => saveTrainerEdit(entry));
  document.getElementById('btn-cancel').addEventListener('click', () => renderTrainerEdit(entry));
}

async function saveTrainerEdit(entry) {
  const body      = document.getElementById('edit-body');
  const oldPokeSn = entry.pokemon.length;
  const newType   = document.getElementById('tr-type').value.trim();
  const newName   = document.getElementById('tr-name').value.trim();
  const verRaw    = document.getElementById('tr-version').value.trim();
  const newVersion = verRaw !== '' ? parseInt(verRaw, 10) : null;

  const changes = [];
  if (newType !== entry.trainerType) changes.push({ field: 'TrainerType', from: entry.trainerType, to: newType });
  if (newName !== entry.trainerName) changes.push({ field: 'TrainerName', from: entry.trainerName, to: newName });

  entry.trainerType = newType;
  entry.trainerName = newName;
  entry.version     = newVersion;
  entry.internalId  = newVersion != null
    ? `${newType},${newName},${newVersion}`
    : `${newType},${newName}`;

  const newKeyOrder = [];
  for (const key of _TRAINER_FIXED_FIELDS) {
    const el = body.querySelector(`[data-field="${CSS.escape(key)}"]`);
    const newVal = el ? el.value.trim() : '';
    if (newVal !== (entry.fields[key] ?? ''))
      changes.push({ field: key, from: entry.fields[key] ?? '', to: newVal });
    entry.fields[key] = newVal;
    if (newVal) newKeyOrder.push(key);
  }
  entry._keyOrder = newKeyOrder;

  const newPoke = [];
  body.querySelectorAll('.tr-poke-block').forEach(block => newPoke.push(collectTrainerPokeFromBlock(block)));
  if (newPoke.length !== oldPokeSn)
    changes.push({ field: '포켓몬 수', from: String(oldPokeSn), to: String(newPoke.length) });
  entry.pokemon = newPoke;

  if (changes.length) {
    appendChangeLog({
      tab: PBS_REGISTRY['trainers'].label,
      filename: PBS_REGISTRY['trainers'].filename,
      entryId: entry.internalId,
      changes,
    });
  }

  if (state.usesFSAPI && state.rootHandle) {
    await saveTab('trainers');
  } else {
    toast(changes.length ? '메모리에 저장됨 — 파일 반영은 "파일 내보내기" 필요' : '변경사항 없음');
  }

  renderList(document.getElementById('search-input').value);
  renderTrainerEdit(entry);
}
