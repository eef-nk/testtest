'use strict';

// ═══════════════════════════════════════════════════════════
// APPLICATION STATE
// ═══════════════════════════════════════════════════════════

const state = {
  rootHandle:    null,   // FileSystemDirectoryHandle
  rootFiles:     {},     // path → File (fallback mode)
  usesFSAPI:     false,
  currentTab:    null,
  pbsData:       {},     // tabKey → parsed entries[]
  pbsLoaded:     {},     // tabKey → bool
  pbsFiles:      {},     // tabKey → FileSystemFileHandle or File
  translations:  {},     // internalId → koreanName (per section)
  engNameMaps:   {},     // internalId → englishName (per file type)
  koreanMaps:    {},     // englishName → koreanName (per section)
  selectedIndex: -1,
  changeLog:     [],     // { time, tab, filename, entryId, changes[] }
  encounterSlotOrder: 'prob_first',
  compareTargetId:  null,  // 비교 패널에 마지막으로 선택한 종족 ID
  comparePanelOpen: false, // 비교 패널이 현재 열려 있는지 여부
};
