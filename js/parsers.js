'use strict';

// ═══════════════════════════════════════════════════════════
// PBS PARSERS
// ═══════════════════════════════════════════════════════════

function parseEntityPBS(text) {
  const entries = [];
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line || line.startsWith('#')) continue;
    const idMatch = line.match(/^\[([^\]]+)\]/);
    if (idMatch) {
      if (current) entries.push(current);
      current = { internalId: idMatch[1], fields: {}, _keyOrder: [] };
      continue;
    }
    if (current) {
      const eq = line.indexOf('=');
      if (eq !== -1) {
        const key = line.slice(0, eq).trim();
        const val = line.slice(eq + 1).trim();
        if (!current.fields.hasOwnProperty(key)) current._keyOrder.push(key);
        current.fields[key] = val;
      }
    }
  }
  if (current) entries.push(current);
  return entries;
}

function parseEncountersPBS(text, knownForms) {
  const entries = [];
  let current     = null;
  let currentType = null;
  let slotOrder   = null; // 'prob_first' | 'species_first'

  function detectSlotOrder(line) {
    const first = line.trim().split(',')[0];
    return isNaN(first.trim()) ? 'species_first' : 'prob_first';
  }

  // encounters.txt 의 폼 표기는 언더스코어( MEOWTH_1 ) — 앱 전역 표준인
  // 쉼표 표기( MEOWTH,1 )로 정규화한다. 단, 끝의 "_숫자"가 실제 등록된
  // 폼일 때만 변환해 MR_MIME 같은 본래 종족명을 건드리지 않는다.
  function normalizeSpecies(token) {
    const m = token.match(/^(.*)_(\d+)$/);
    if (!m) return token;
    const candidate = `${m[1]},${m[2]}`;
    return knownForms?.has(candidate) ? candidate : token;
  }

  // 슬롯 형식 (종족은 항상 쉼표 없는 단일 토큰):
  //   prob_first   : PROB, SPECIES, MIN[, MAX]
  //   species_first: SPECIES, PROB, MIN[, MAX]
  function parseSlot(line) {
    const tokens = line.trim().split(',').map(t => t.trim());
    const speciesIdx = slotOrder === 'species_first' ? 0 : 1;
    const probIdx    = slotOrder === 'species_first' ? 1 : 0;
    const species = normalizeSpecies(tokens[speciesIdx] || '');
    const prob    = Number(tokens[probIdx]) || 0;
    const minLv   = Number(tokens[2]) || 0;
    const maxLv   = tokens.length >= 4 ? Number(tokens[3]) : minLv;
    return { probability: prob, species, minLevel: minLv, maxLevel: maxLv };
  }

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line || line.startsWith('#------')) continue;
    const idMatch = line.match(/^\[([^\]]+)\](?:\s*#\s*(.*))?/);
    if (idMatch) {
      if (current) entries.push(current);
      current = {
        mapId:               idMatch[1].trim(),
        mapName:             (idMatch[2] || '').trim(),
        encounterTypes:      {},
        encounterDensities:  {},
        _typeOrder:          [],
      };
      currentType = null;
      continue;
    }
    if (!current || line.startsWith('#')) continue;
    const isIndented = /^\s/.test(raw);
    if (!isIndented) {
      const parts = line.trim().split(',');
      currentType = parts[0].trim();
      const density = parts.length >= 2 ? Number(parts[1]) : null;
      if (!current.encounterTypes[currentType]) {
        current.encounterTypes[currentType]    = [];
        current.encounterDensities[currentType] = density;
        current._typeOrder.push(currentType);
      }
    } else if (currentType) {
      if (!slotOrder) slotOrder = detectSlotOrder(line);
      current.encounterTypes[currentType].push(parseSlot(line));
    }
  }
  if (current) entries.push(current);
  return { entries, slotOrder: slotOrder || 'prob_first' };
}

function parseTrainersPBS(text) {
  const entries = [];
  let current     = null;
  let currentPoke = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line || line.startsWith('#')) continue;

    const idMatch = line.match(/^\[([^\]]+)\]/);
    if (idMatch) {
      if (current) entries.push(current);
      const parts      = idMatch[1].split(',');
      const trainerType = parts[0].trim();
      let trainerName   = (parts[1] || '').trim();
      let version       = null;
      if (parts.length >= 3) {
        const lastPart = parts[parts.length - 1].trim();
        if (/^\d+$/.test(lastPart)) {
          version     = parseInt(lastPart, 10);
          trainerName = parts.slice(1, -1).join(',').trim();
        } else {
          trainerName = parts.slice(1).join(',').trim();
        }
      }
      current = {
        internalId: idMatch[1].trim(),
        trainerType, trainerName, version,
        fields: {}, _keyOrder: [], pokemon: [],
      };
      currentPoke = null;
      continue;
    }

    if (!current) continue;

    const isIndented = /^\s/.test(raw);
    const trimmed    = line.trim();
    const eqIdx      = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();

    if (!isIndented) {
      if (key === 'Pokemon') {
        // 정식 형식: "SPECIES,LEVEL" (폼은 별도 Form 필드, 기본값 0)
        // 레거시 호환: "SPECIES,FORM,LEVEL" (구버전 도구가 잘못 기록한 인라인 폼)
        const pokeParts = val.split(',').map(s => s.trim());
        let species, level, form = 0;
        if (pokeParts.length >= 3) {
          species = pokeParts[0];
          form    = parseInt(pokeParts[1], 10) || 0;
          level   = parseInt(pokeParts[2], 10) || 5;
        } else {
          species = pokeParts[0] || '';
          level   = parseInt(pokeParts[1], 10) || 5;
        }
        currentPoke = { species, level, form, fields: {}, _keyOrder: [] };
        current.pokemon.push(currentPoke);
      } else {
        if (!current.fields.hasOwnProperty(key)) current._keyOrder.push(key);
        current.fields[key] = val;
      }
    } else if (currentPoke) {
      if (key === 'Form') {
        // Form 은 fields/_keyOrder 에 넣지 않고 별도 속성으로 보관 (직렬화 시 제어)
        currentPoke.form = parseInt(val, 10) || 0;
      } else {
        if (!currentPoke.fields.hasOwnProperty(key)) currentPoke._keyOrder.push(key);
        currentPoke.fields[key] = val;
      }
    }
  }
  if (current) entries.push(current);
  return entries;
}

function parseKoreanCore(text) {
  const result = {};
  let section = null;
  let pairs   = [];
  let toggle  = false;
  let lastEng = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line || line.startsWith('#')) continue;
    const secMatch = line.match(/^\[([^\]]+)\]/);
    if (secMatch) {
      if (section && pairs.length) result[section] = { ...result[section], ...Object.fromEntries(pairs) };
      section = secMatch[1]; pairs = []; toggle = false; lastEng = null;
      continue;
    }
    if (!section) continue;
    if (!toggle) { lastEng = line; toggle = true; }
    else {
      if (lastEng !== null) pairs.push([lastEng, line]);
      toggle = false; lastEng = null;
    }
  }
  if (section && pairs.length) result[section] = { ...result[section], ...Object.fromEntries(pairs) };
  return result;
}
