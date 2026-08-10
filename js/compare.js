'use strict';

// ═══════════════════════════════════════════════════════════
// POKÉMON COMPARE PANEL
// ═══════════════════════════════════════════════════════════

const _CMP_FIELDS = ['BaseStats', 'Moves', 'EggMoves', 'TutorMoves'];

// BaseStats 표시 순서 (HP, 공격, 방어, 특공, 특방, 스피드)
// PBS 저장 순서 인덱스: HP=0, Atk=1, Def=2, Spe=3, SpA=4, SpD=5
const _STAT_DEFS = [
  { label: 'HP',     pbsIdx: 0 },
  { label: '공격',   pbsIdx: 1 },
  { label: '방어',   pbsIdx: 2 },
  { label: '특공',   pbsIdx: 4 },
  { label: '특방',   pbsIdx: 5 },
  { label: '스피드', pbsIdx: 3 },
];

// ── 유틸 ─────────────────────────────────────────────────────────

function isComparableTab(reg) {
  return !!(reg && reg.type === 'entity' &&
    (reg.translationSection === 'SPECIES_NAMES' ||
     reg.translationSection === 'SPECIES_FORM_NAMES'));
}

/** SPECIES_NAMES + SPECIES_FORM_NAMES 탭 전체를 합산한 포켓몬 목록 */
function _getAllSpeciesList() {
  const list = [{ value: '', label: '(대상 선택…)' }];
  for (const [key, r] of Object.entries(PBS_REGISTRY)) {
    if ((r.translationSection === 'SPECIES_NAMES' ||
         r.translationSection === 'SPECIES_FORM_NAMES') && state.pbsData[key]) {
      for (const p of state.pbsData[key]) {
        list.push({ value: p.internalId, label: entryDisplayName(p, r) });
      }
    }
  }
  return list;
}

/** 모든 포켓몬 탭에서 internalId로 엔트리 탐색 */
function _findSpeciesEntry(id) {
  for (const [key, r] of Object.entries(PBS_REGISTRY)) {
    if ((r.translationSection === 'SPECIES_NAMES' ||
         r.translationSection === 'SPECIES_FORM_NAMES') && state.pbsData[key]) {
      const found = state.pbsData[key].find(e => e.internalId === id);
      if (found) return { entry: found, reg: r };
    }
  }
  return null;
}

// ── 비교 렌더러 ──────────────────────────────────────────────────

function _renderCmpStats(curRaw, tgtRaw) {
  const toArr = raw => {
    const a = (raw || '').split(',').map(v => Number(v.trim()) || 0);
    while (a.length < 6) a.push(0);
    return a;
  };
  const cur = toArr(curRaw);
  const tgt = toArr(tgtRaw);

  let curTotal = 0, tgtTotal = 0;
  let rows = _STAT_DEFS.map(s => {
    const c = cur[s.pbsIdx], t = tgt[s.pbsIdx], d = t - c;
    curTotal += c; tgtTotal += t;
    const cls = d > 0 ? 'cmp-plus' : (d < 0 ? 'cmp-minus' : 'cmp-same');
    const dStr = d === 0 ? '—' : (d > 0 ? `+${d}` : `${d}`);
    return `<tr class="${cls}">
      <td class="cmp-stat-label">${escHtml(s.label)}</td>
      <td class="cmp-val">${c}</td>
      <td class="cmp-val cmp-tgt">${t}</td>
      <td class="cmp-diff ${cls}">${escHtml(dStr)}</td>
    </tr>`;
  }).join('');

  const dTotal = tgtTotal - curTotal;
  const dtCls  = dTotal > 0 ? 'cmp-plus' : (dTotal < 0 ? 'cmp-minus' : 'cmp-same');
  const dtStr  = dTotal === 0 ? '—' : (dTotal > 0 ? `+${dTotal}` : `${dTotal}`);
  rows += `<tr class="cmp-total-row ${dtCls}">
    <td class="cmp-stat-label">합계</td>
    <td class="cmp-val">${curTotal}</td>
    <td class="cmp-val cmp-tgt">${tgtTotal}</td>
    <td class="cmp-diff ${dtCls}">${escHtml(dtStr)}</td>
  </tr>`;

  return `<table class="cmp-table cmp-stats-table">
    <thead><tr><th></th><th>현재</th><th>비교</th><th>차이</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function _renderCmpMoves(curRaw, tgtRaw, withLevel) {
  if (withLevel) {
    // 파싱: [lv, move, lv, move, ...]
    const parse = raw => {
      const tokens = (raw || '').split(',').map(s => s.trim()).filter(Boolean);
      const pairs = [];
      for (let i = 0; i + 1 < tokens.length; i += 2)
        pairs.push({ lv: Number(tokens[i]) || 0, move: tokens[i + 1] });
      return pairs;
    };
    const curList = parse(curRaw);
    const tgtList = parse(tgtRaw);

    // (lv, move) 조합을 키로 통합
    const allKeys = new Map();
    curList.forEach(p => allKeys.set(`${p.lv}|${p.move}`, { lv: p.lv, move: p.move, inCur: true,  inTgt: false }));
    tgtList.forEach(p => {
      const k = `${p.lv}|${p.move}`;
      if (allKeys.has(k)) allKeys.get(k).inTgt = true;
      else allKeys.set(k, { lv: p.lv, move: p.move, inCur: false, inTgt: true });
    });

    const sorted = [...allKeys.values()].sort((a, b) => a.lv - b.lv || a.move.localeCompare(b.move));
    if (!sorted.length) return '<p class="cmp-empty">기술 없음</p>';

    const rowsHtml = sorted.map(p => {
      const cls   = !p.inCur ? 'cmp-tgt-only' : (!p.inTgt ? 'cmp-cur-only' : '');
      const moveName = _getMoveDisplay(p.move);
      const curCell  = p.inCur ? escHtml(moveName) : '<span class="cmp-dash">·</span>';
      const tgtCell  = p.inTgt ? escHtml(moveName) : '<span class="cmp-dash">·</span>';
      return `<tr class="${cls}">
        <td class="cmp-lv">Lv.${p.lv}</td>
        <td class="cmp-move">${curCell}</td>
        <td class="cmp-move">${tgtCell}</td>
      </tr>`;
    }).join('');

    return `<table class="cmp-table cmp-move-table">
      <thead><tr><th>레벨</th><th>현재</th><th>비교</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;
  } else {
    // flat list (EggMoves / TutorMoves)
    const parse = raw =>
      new Set((raw || '').split(',').map(s => s.trim()).filter(Boolean));
    const curSet = parse(curRaw);
    const tgtSet = parse(tgtRaw);
    const all    = new Set([...curSet, ...tgtSet]);

    if (!all.size) return '<p class="cmp-empty">기술 없음</p>';

    const sorted  = [...all].sort();
    const rowsHtml = sorted.map(mv => {
      const inCur = curSet.has(mv), inTgt = tgtSet.has(mv);
      const cls   = !inCur ? 'cmp-tgt-only' : (!inTgt ? 'cmp-cur-only' : '');
      const name  = _getMoveDisplay(mv);
      return `<tr class="${cls}">
        <td class="cmp-move">${escHtml(name)}</td>
        <td class="cmp-check">${inCur ? '✓' : '<span class="cmp-dash">·</span>'}</td>
        <td class="cmp-check">${inTgt ? '✓' : '<span class="cmp-dash">·</span>'}</td>
      </tr>`;
    }).join('');

    return `<table class="cmp-table cmp-move-table">
      <thead><tr><th>기술</th><th>현재</th><th>비교</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;
  }
}

function _getMoveDisplay(id) {
  if (!id) return '';
  const k = getKorean(id, 'MOVE_NAMES');
  return k.display || id;
}

// ── 좌측 패널 차이 강조 ─────────────────────────────────────────

function _highlightCompareDiffs(currentEntry, targetEntry) {
  const body = document.getElementById('edit-body');
  if (!body) return;
  _CMP_FIELDS.forEach(key => {
    // field-row는 data-field를 가진 첫 자식 요소의 조상
    const el = body.querySelector(`[data-field="${CSS.escape(key)}"]`);
    const row = el?.closest('.field-row');
    if (!row) return;
    const curVal = currentEntry.fields[key] ?? '';
    const tgtVal = targetEntry.fields[key] ?? '';
    row.classList.remove('cmp-diff', 'cmp-nodiff');
    row.classList.add(curVal !== tgtVal ? 'cmp-diff' : 'cmp-nodiff');
  });
}

function _clearCompareDiffs() {
  document.querySelectorAll('.field-row.cmp-diff, .field-row.cmp-nodiff').forEach(el => {
    el.classList.remove('cmp-diff', 'cmp-nodiff');
  });
}

// ── 비교 패널 오픈 / 클로즈 ─────────────────────────────────────

function openComparePanel(currentEntry, currentReg) {
  const panel   = document.getElementById('compare-panel');
  const wrapper = document.getElementById('edit-body-wrapper');
  if (!panel || !wrapper) return;

  panel.hidden = false;
  wrapper.classList.add('compare-active');
  state.comparePanelOpen = true;

  const btnCmp = document.getElementById('btn-compare');
  if (btnCmp) btnCmp.classList.add('active');

  const allSpecies = _getAllSpeciesList();
  panel.innerHTML = `
    <div id="compare-header">
      <span class="cmp-label">비교 대상</span>
      ${buildCombo(allSpecies, state.compareTargetId || '', 'cmp-species-combo')}
      <button id="btn-compare-close" title="비교 닫기">✕</button>
    </div>
    <div id="compare-body">
      <p class="cmp-hint">위에서 비교할 포켓몬을 선택하세요.<br>
        <span class="cmp-legend cur-only">■</span> 현재만 &nbsp;
        <span class="cmp-legend tgt-only">■</span> 비교만 &nbsp;
        <span class="cmp-legend both">■</span> 공통
      </p>
    </div>`;

  document.getElementById('btn-compare-close').addEventListener('click', closeComparePanel);

  // 콤보 선택 이벤트
  panel.querySelector('.cmp-species-combo').addEventListener('pbs:combo', () => {
    const id = panel.querySelector('.cmp-species-combo').dataset.value;
    _onCompareTargetSelected(id, currentEntry, currentReg);
  });

  // 이미 저장된 타겟이 있으면 즉시 표시
  if (state.compareTargetId) {
    _onCompareTargetSelected(state.compareTargetId, currentEntry, currentReg);
  }
}

function restoreComparePanel(currentEntry, currentReg) {
  openComparePanel(currentEntry, currentReg);
}

function closeComparePanel() {
  const panel   = document.getElementById('compare-panel');
  const wrapper = document.getElementById('edit-body-wrapper');
  if (panel)   { panel.hidden = true; panel.innerHTML = ''; }
  if (wrapper) wrapper.classList.remove('compare-active');

  const btnCmp = document.getElementById('btn-compare');
  if (btnCmp) btnCmp.classList.remove('active');

  state.comparePanelOpen = false;
  // compareTargetId는 유지 — 다음에 패널을 다시 열면 마지막 대상이 자동으로 채워짐
  _clearCompareDiffs();
}

function _onCompareTargetSelected(targetId, currentEntry, currentReg) {
  state.compareTargetId = targetId || null;

  // 비교 버튼 상태 갱신
  const btnCmp = document.getElementById('btn-compare');
  if (btnCmp) btnCmp.classList.toggle('active', !!targetId);

  const body = document.getElementById('compare-body');
  if (!body) return;

  if (!targetId) {
    body.innerHTML = '<p class="cmp-hint">대상을 선택하세요.</p>';
    _clearCompareDiffs();
    return;
  }

  const result = _findSpeciesEntry(targetId);
  if (!result) {
    body.innerHTML = '<p class="cmp-hint" style="color:var(--accent)">해당 ID를 찾을 수 없습니다.</p>';
    return;
  }

  const { entry: tgtEntry, reg: tgtReg } = result;
  _renderCompareSections(currentEntry, currentReg, tgtEntry, tgtReg, body);
  _highlightCompareDiffs(currentEntry, tgtEntry);
}

function _renderCompareSections(curEntry, curReg, tgtEntry, tgtReg, body) {
  const curName = entryDisplayName(curEntry, curReg);
  const tgtName = entryDisplayName(tgtEntry, tgtReg);

  let html = `<div class="cmp-names">
    <span class="cmp-cur-name">${escHtml(curName)}</span>
    <span class="cmp-vs">vs</span>
    <span class="cmp-tgt-name">${escHtml(tgtName)}</span>
  </div>`;

  const sections = [
    { key: 'BaseStats',  label: '📊 기본 능력치', fn: () => _renderCmpStats(curEntry.fields['BaseStats'], tgtEntry.fields['BaseStats']) },
    { key: 'Moves',      label: '⚔️ 레벨업 기술', fn: () => _renderCmpMoves(curEntry.fields['Moves'],     tgtEntry.fields['Moves'],     true)  },
    { key: 'EggMoves',   label: '🥚 유전기',       fn: () => _renderCmpMoves(curEntry.fields['EggMoves'],  tgtEntry.fields['EggMoves'],  false) },
    { key: 'TutorMoves', label: '📖 가르치기',     fn: () => _renderCmpMoves(curEntry.fields['TutorMoves'],tgtEntry.fields['TutorMoves'],false) },
  ];

  for (const sec of sections) {
    const curHas = !!(curEntry.fields[sec.key]);
    const tgtHas = !!(tgtEntry.fields[sec.key]);
    if (!curHas && !tgtHas) continue;
    html += `<div class="cmp-section">
      <div class="cmp-section-title">${sec.label}</div>
      ${sec.fn()}
    </div>`;
  }

  body.innerHTML = html;
}
