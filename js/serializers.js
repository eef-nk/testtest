'use strict';

// ═══════════════════════════════════════════════════════════
// SERIALIZATION & FILE SAVE
// ═══════════════════════════════════════════════════════════

function serializeEntity(entries) {
  const lines = [];
  for (const entry of entries) {
    lines.push('#-------------------------------');
    lines.push(`[${entry.internalId}]`);
    for (const key of entry._keyOrder) lines.push(`${key} = ${entry.fields[key] ?? ''}`);
    lines.push('');
  }
  return lines.join('\n');
}

function serializeEncounters(entries, slotOrder) {
  const lines = [];
  for (const entry of entries) {
    lines.push('#-------------------------------');
    lines.push(entry.mapName ? `[${entry.mapId}] # ${entry.mapName}` : `[${entry.mapId}]`);
    for (const typeName of entry._typeOrder) {
      const density = entry.encounterDensities?.[typeName];
      lines.push(density != null ? `${typeName},${density}` : typeName);
      for (const slot of (entry.encounterTypes[typeName] || [])) {
        const lvPart = slot.minLevel === slot.maxLevel
          ? String(slot.minLevel)
          : `${slot.minLevel},${slot.maxLevel}`;
        // 내부 표준 폼 표기( MEOWTH,1 )를 encounters.txt 표기( MEOWTH_1 )로 변환
        const species = (slot.species || '').replace(',', '_');
        lines.push(slotOrder === 'species_first'
          ? `    ${species},${slot.probability},${lvPart}`
          : `    ${slot.probability},${species},${lvPart}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

function serializeTrainers(entries) {
  const lines = [];
  for (const entry of entries) {
    lines.push('#-------------------------------');
    lines.push(`[${entry.internalId}]`);
    for (const key of entry._keyOrder) lines.push(`${key} = ${entry.fields[key] ?? ''}`);
    for (const poke of entry.pokemon) {
      lines.push(`Pokemon = ${poke.species},${poke.level}`);
      // 폼은 별도 Form 필드로 기록 (0/미지정은 생략)
      if (poke.form) lines.push(`    Form = ${poke.form}`);
      for (const key of poke._keyOrder) lines.push(`    ${key} = ${poke.fields[key] ?? ''}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ── 파일 저장 ──────────────────────────────────────────────────

async function saveTab(key) {
  const reg  = PBS_REGISTRY[key];
  const data = state.pbsData[key];
  if (!data) { toast('데이터가 없습니다.', true); return; }

  let text;
  if (reg.type === 'entity')        text = serializeEntity(data);
  else if (reg.type === 'trainer')  text = serializeTrainers(data);
  else                              text = serializeEncounters(data, state.encounterSlotOrder || 'prob_first');

  // FSAPI 직접 저장
  if (state.usesFSAPI && state.rootHandle) {
    try {
      const parts = reg.filename.split('/');
      let dir = state.rootHandle;
      for (let i = 0; i < parts.length - 1; i++) dir = await dir.getDirectoryHandle(parts[i]);
      const fh       = await dir.getFileHandle(parts[parts.length - 1], { create: true });
      const writable = await fh.createWritable();
      await writable.write(text);
      await writable.close();
      toast(`${reg.filename} 저장 완료`);
      return;
    } catch (e) {
      toast('직접 저장 실패: ' + e.message + ' — 다운로드로 대체합니다.', true);
    }
  }

  // Fallback: 다운로드
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = reg.filename.split('/').pop();
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast(`${reg.filename} 다운로드 완료`);
}
