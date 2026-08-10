'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({
  console,
  state: {
    pbsData: {
      items: [
        { internalId: 'POKEBALL', fields: { Name: 'Poké Ball' } },
        { internalId: 'NORMALIUMZ', fields: { Name: 'Normalium Z' } },
      ],
    },
    koreanMaps: {},
    engNameMaps: {},
  },
  escHtml: value => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;'),
  getKorean: id => ({ display: id }),
  document: {
    addEventListener: () => {},
    getElementById: () => null,
  },
});

for (const file of ['js/constants.js', 'js/renderers.js', 'js/edit-trainer.js', 'js/serializers.js', 'js/new-entry.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

const jsonEval = expression => JSON.parse(JSON.stringify(vm.runInContext(expression, context)));

assert.deepEqual(
  jsonEval('DEFAULT_TRAINER_ITEMS'),
  ['TERAORB', 'DYNAMAXBAND', 'ZRING'],
  '새 트레이너의 기본 아이템이 세 기믹 아이템이어야 합니다.',
);

const newTrainerElements = {
  'ne-trainer-type': { value: 'ACE_TRAINER' },
  'ne-trainer-name': { value: 'Test' },
  'ne-trainer-version': { value: '' },
  'new-entry-error': { textContent: '' },
};
context.document.getElementById = id => newTrainerElements[id] || null;
context.state.currentTab = 'trainers';
context.state.pbsData.trainers = [];
vm.runInContext(`
  let capturedNewTrainer = null;
  _appendAndSelect = (_tab, entry) => { capturedNewTrainer = entry; };
  closeNewEntryDialog = () => {};
  toast = () => {};
  submitNewEntry();
`, context);
assert.deepEqual(
  jsonEval('capturedNewTrainer.fields'),
  { Items: 'TERAORB,DYNAMAXBAND,ZRING' },
  '새 트레이너 생성 경로에서 기본 아이템을 넣어야 합니다.',
);

const natureHtml = vm.runInContext("_buildNatureOpts('ADAMANT')", context);
assert.match(natureHtml, /value="ADAMANT" selected>ADAMANT — 고집<\/option>/);
assert.doesNotMatch(natureHtml, /value="고집"/);

const zValues = jsonEval('Z_CRYSTAL_ITEMS.map(item => item.value)');
assert.equal(zValues.length, 35, '모든 타입/전용 Z크리스탈 35종이 있어야 합니다.');
const itemValues = jsonEval('getItemsList().map(item => item.value)');
for (const value of zValues) assert.ok(itemValues.includes(value), `${value}가 아이템 목록에 없습니다.`);
assert.equal(itemValues.filter(value => value === 'NORMALIUMZ').length, 1, '로드된 Z크리스탈은 중복되면 안 됩니다.');

assert.deepEqual(
  jsonEval('_createEmptyTrainerPokemon()'),
  {
    species: '', level: 5, form: 0,
    fields: { NoDynamax: 'true', NoTera: 'true' },
    _keyOrder: ['NoDynamax', 'NoTera'],
  },
);

function makeBlock({ dynamaxEnabled, teraType }) {
  const elements = {
    '.combo-wrap.tr-species-combo': { dataset: { value: 'PIKACHU' } },
    '.tr-level': { value: '50' },
    '.tr-form': { value: '0' },
    '.tr-ability-idx': { value: '0' },
    '.combo-wrap.tr-item-combo': { dataset: { value: 'PIKANIUMZ' } },
    '.tr-nature': { value: 'ADAMANT' },
    '.tr-gender': { value: '' },
    '.tr-nickname': { value: '' },
    '.tr-happiness': { value: '' },
    '.tr-shiny': { checked: false },
    '.tr-shadow': { checked: false },
    '.combo-wrap.tr-ball-combo': { dataset: { value: '' } },
    '.tr-dynamax-enabled': { checked: dynamaxEnabled },
    '.tr-tera-type': { value: teraType },
    '.tr-iv-enabled': { checked: false },
    '.tr-ev-enabled': { checked: false },
  };
  return {
    querySelector: selector => elements[selector] || null,
    querySelectorAll: () => [],
  };
}

context.testBlock = makeBlock({ dynamaxEnabled: false, teraType: '__NO_TERA__' });
const disabledPoke = jsonEval('collectTrainerPokeFromBlock(testBlock)');
assert.equal(disabledPoke.fields.NoDynamax, 'true');
assert.equal(disabledPoke.fields.NoTera, 'true');
assert.equal(disabledPoke.fields.TeraType, undefined);

context.testBlock = makeBlock({ dynamaxEnabled: true, teraType: 'NORMAL' });
const enabledPoke = jsonEval('collectTrainerPokeFromBlock(testBlock)');
assert.equal(enabledPoke.fields.NoDynamax, undefined);
assert.equal(enabledPoke.fields.NoTera, undefined);
assert.equal(enabledPoke.fields.TeraType, 'NORMAL');
assert.equal(enabledPoke.fields.Nature, 'ADAMANT');

context.testPoke = disabledPoke;
const serialized = vm.runInContext(`serializeTrainers([{
  internalId: 'ACE_TRAINER,Test',
  fields: { Items: DEFAULT_TRAINER_ITEMS.join(',') },
  _keyOrder: ['Items'],
  pokemon: [testPoke],
}])`, context);
assert.match(serialized, /Items = TERAORB,DYNAMAXBAND,ZRING/);
assert.match(serialized, /    Nature = ADAMANT/);
assert.match(serialized, /    NoDynamax = true/);
assert.match(serialized, /    NoTera = true/);

console.log('trainer feature tests passed');
