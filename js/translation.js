'use strict';

// ═══════════════════════════════════════════════════════════
// TRANSLATION & NAME DISPLAY
// ═══════════════════════════════════════════════════════════

function buildTranslations() {
  for (const [key, reg] of Object.entries(PBS_REGISTRY)) {
    if (reg.type !== 'entity') continue;
    const data = state.pbsData[key];
    if (!data) continue;
    const map = {};
    for (const entry of data) {
      if (entry.fields.Name) map[entry.internalId] = entry.fields.Name;
    }
    state.engNameMaps[key] = map;
  }
  for (const auxKey of ['abilities', 'items']) {
    if (state.pbsData[auxKey]) {
      const map = {};
      for (const entry of state.pbsData[auxKey]) {
        if (entry.fields.Name) map[entry.internalId] = entry.fields.Name;
      }
      state.engNameMaps[auxKey] = map;
    }
  }
}

function getKorean(internalId, section) {
  const km = state.koreanMaps;
  const em = state.engNameMaps;
  let eng = null;
  for (const map of Object.values(em)) {
    if (map[internalId]) { eng = map[internalId]; break; }
  }
  if (!eng) eng = internalId;
  const sectionMap = km[section] || {};
  const kor = sectionMap[eng];
  if (kor) return { kor, eng, internal: internalId, display: `${kor}(${eng})` };
  return { kor: null, eng, internal: internalId, display: eng };
}

function displayName(internalId, section) {
  return getKorean(internalId, section).display;
}

function entryDisplayName(entry, reg) {
  const nameKey = reg.nameField || 'Name';
  const eng = entry.fields[nameKey] || entry.internalId;
  if (!reg.translationSection) return eng;
  const sectionMap = state.koreanMaps[reg.translationSection] || {};
  const kor = sectionMap[eng];
  return kor ? `${kor}(${eng})` : eng;
}
