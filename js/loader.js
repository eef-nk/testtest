'use strict';

// ═══════════════════════════════════════════════════════════
// FILE LOADING  (FSAPI / input[file] 양방향)
// ═══════════════════════════════════════════════════════════

// ── 공통 헬퍼 ────────────────────────────────────────────────

function mergeKoreanParsed(parsed, target) {
  for (const [sec, map] of Object.entries(parsed)) {
    target[sec] = { ...target[sec], ...map };
  }
}

// ── 한국어 번역 파일 로드 ─────────────────────────────────────

async function loadKoreanFiles() {
  const result = {};
  if (state.usesFSAPI) {
    for (const dirName of KOREAN_DIRS) {
      let korDir;
      try { korDir = await state.rootHandle.getDirectoryHandle(dirName); }
      catch { continue; }
      for await (const [name, handle] of korDir.entries()) {
        if (handle.kind !== 'file' || !name.endsWith('.txt')) continue;
        const file = await handle.getFile();
        const text = await readFileText(file);
        mergeKoreanParsed(parseKoreanCore(text), result);
      }
    }
  } else {
    const prefixes = KOREAN_DIRS.map(d => d.toLowerCase() + '/');
    for (const [path, file] of Object.entries(state.rootFiles)) {
      if (!prefixes.some(p => path.toLowerCase().startsWith(p))) continue;
      if (!path.endsWith('.txt')) continue;
      const text = await readFileText(file);
      mergeKoreanParsed(parseKoreanCore(text), result);
    }
  }
  return result;
}

// ── *_Custom.txt 자동 감지 & 동적 등록 ──────────────────────────

/**
 * customFiles 배열을 받아 PBS_REGISTRY / TAB_CATEGORIES / CREATABLE_TABS에 동적 등록.
 * 기존에 등록된 파일은 건너뜁니다.
 */
function _registerCustomFiles(customFiles) {
  for (const { name, path } of customFiles) {
    // "moves_Custom.txt" → baseName = "moves"
    const baseName  = name.replace(/_Custom\.txt$/i, '');
    const customKey = `${baseName.toLowerCase()}_custom`;

    if (PBS_REGISTRY[customKey]) continue; // 이미 등록됨

    // 베이스 파일명이 등록된 항목 탐색 (예: PBS/moves.txt → key: 'moves')
    const templateKey = Object.keys(PBS_REGISTRY).find(
      k => PBS_REGISTRY[k].filename.toLowerCase() === `pbs/${baseName.toLowerCase()}.txt`
    );
    if (!templateKey) continue; // 알 수 없는 형식 → 무시

    const tmpl = PBS_REGISTRY[templateKey];
    PBS_REGISTRY[customKey] = {
      ...tmpl,
      filename: path,
      label:    `${tmpl.label} 커스텀`,
    };

    // 같은 카테고리 그룹 끝에 추가
    const cat = TAB_CATEGORIES.find(c => c.keys.includes(templateKey));
    if (cat && !cat.keys.includes(customKey)) cat.keys.push(customKey);

    // 새 항목 생성 허용
    CREATABLE_TABS.add(customKey);
  }
}

/** FSAPI / input[file] 모드에서 PBS/ 내 *_Custom.txt 탐색 */
async function _discoverCustomFiles() {
  const files = [];

  if (state.usesFSAPI && state.rootHandle) {
    let pbsDir;
    try { pbsDir = await state.rootHandle.getDirectoryHandle('PBS'); }
    catch { return files; }
    for await (const [name, handle] of pbsDir.entries()) {
      if (handle.kind === 'file' && /_Custom\.txt$/i.test(name))
        files.push({ name, path: `PBS/${name}` });
    }
  } else {
    const seen = new Set();
    for (const keyPath of Object.keys(state.rootFiles)) {
      const lp = keyPath.toLowerCase();
      if (!lp.match(/^pbs\/[^/]+_custom\.txt$/)) continue;
      if (seen.has(lp)) continue;
      seen.add(lp);
      const name = state.rootFiles[keyPath]?.name || lp.split('/').pop();
      files.push({ name, path: `PBS/${name}` });
    }
  }
  return files;
}

// ── PBS 파일 파싱 공통 ────────────────────────────────────────

/** 등록된 폼 ID 집합( MEOWTH,1 형태 )을 구성 — 인카운터의 언더스코어 폼 정규화용 */
function _buildKnownFormsSet() {
  const s = new Set();
  for (const [key, r] of Object.entries(PBS_REGISTRY)) {
    if (r.translationSection === 'SPECIES_FORM_NAMES' && state.pbsData[key]) {
      for (const p of state.pbsData[key]) s.add(p.internalId);
    }
  }
  return s;
}

function _parsePBSText(key, reg, text) {
  if (reg.type === 'entity') {
    state.pbsData[key] = parseEntityPBS(text);
  } else if (reg.type === 'trainer') {
    state.pbsData[key] = parseTrainersPBS(text);
  } else {
    // encounters: PBS_REGISTRY 순서상 폼 탭이 먼저 등록돼 있으므로
    // 이 시점에 state.pbsData에 폼 데이터가 이미 채워져 있음
    const knownForms = _buildKnownFormsSet();
    const result = parseEncountersPBS(text, knownForms);
    state.pbsData[key] = result.entries;
    state.encounterSlotOrder = result.slotOrder;
  }
  state.pbsLoaded[key] = true;
}

// ── 폴더 선택 모드 ────────────────────────────────────────────

async function loadAll() {
  document.getElementById('load-status').textContent = '로딩 중...';

  // 재선택 시 이전 상태 초기화
  state.pbsData       = {};
  state.pbsLoaded     = {};
  state.pbsFiles      = {};
  state.engNameMaps   = {};
  state.selectedIndex = -1;

  // 이전에 동적 등록된 _Custom 탭 제거 (폴더마다 새로 탐지)
  for (const key of Object.keys(PBS_REGISTRY)) {
    if (!key.endsWith('_custom')) continue;
    delete PBS_REGISTRY[key];
    for (const cat of TAB_CATEGORIES) cat.keys = cat.keys.filter(k => k !== key);
    CREATABLE_TABS.delete(key);
  }

  for (const [auxKey, paths] of Object.entries(AUX_FILE_MAP)) {
    const merged = [];
    for (const path of paths) {
      const text = await readPath(path);
      if (text) merged.push(...parseEntityPBS(text));
    }
    if (merged.length) state.pbsData[auxKey] = merged;
  }

  state.koreanMaps = await loadKoreanFiles();

  // *_Custom.txt 파일 자동 감지 후 레지스트리 등록
  _registerCustomFiles(await _discoverCustomFiles());

  for (const [key, reg] of Object.entries(PBS_REGISTRY)) {
    const text = await readPath(reg.filename);
    if (text) _parsePBSText(key, reg, text);
    else state.pbsLoaded[key] = false;
  }

  buildTranslations();
  renderTabs();
  document.getElementById('load-status').textContent =
    Object.values(state.pbsLoaded).filter(Boolean).length + ' 파일 로드됨';
}

// ── 번역 폴더 적용 ────────────────────────────────────────────

async function applyKoreanMaps(maps) {
  state.koreanMaps = maps;
  buildTranslations();
  if (state.currentTab) renderList(document.getElementById('search-input').value);
  const idx = state.selectedIndex;
  if (idx >= 0) {
    const data = state.pbsData[state.currentTab];
    const reg  = PBS_REGISTRY[state.currentTab];
    if (data && data[idx]) {
      if (reg.type === 'entity')       renderEntityEdit(data[idx], reg);
      else if (reg.type === 'trainer') renderTrainerEdit(data[idx]);
      else                             renderEncounterEdit(data[idx]);
    }
  }
  const btn          = document.getElementById('btn-load-kor');
  const sectionCount = Object.keys(maps).length;
  btn.classList.add('loaded');
  btn.textContent = `🌐 번역 (${sectionCount}섹션)`;
  toast(`번역 로드 완료 — ${sectionCount}개 섹션`);
}
