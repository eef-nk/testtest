'use strict';

// ═══════════════════════════════════════════════════════════
// PBS REGISTRY & CONSTANTS
// ═══════════════════════════════════════════════════════════

const _SF_POKEMON = {
  Types:            'pokemon_types_pair',
  Moves:            'movelist',
  EggMoves:         'movelist_flat',
  TutorMoves:       'movelist_flat',
  Abilities:        'abilitylist',
  HiddenAbility:    'ability_single',
  HiddenAbilities:  'ability_single',
  WildItemCommon:   'item_single',
  WildItemUncommon: 'item_single',
  WildItemRare:     'item_single',
  BaseStats:        'basestats',
  GenderRatio:      'gender_ratio',
  GrowthRate:       'growth_rate',
  Evolutions:       'evolution_list',
};
const _SF_FORM = {
  Types:            'pokemon_types_pair',
  Moves:            'movelist',
  EggMoves:         'movelist_flat',
  TutorMoves:       'movelist_flat',
  Abilities:        'abilitylist',
  HiddenAbility:    'ability_single',
  HiddenAbilities:  'ability_single',
  MegaStone:        'item_single',
  BaseStats:        'basestats',
  GenderRatio:      'gender_ratio',
  GrowthRate:       'growth_rate',
  Evolutions:       'evolution_list',
};
const _SF_MOVE = {
  Type:        'pokemon_type',
  Category:    'move_category',
  Target:      'move_target',
  Priority:    'move_priority',
  TotalPP:     'move_pp',
  Flags:       'move_flags',
  Description: 'move_desc',
};
// 기술 탭 고정 필드 순서 (이 목록에 있으면 항상 렌더, 값이 없으면 저장 제외)
const _FIELD_ORDER_MOVE = [
  'Name','Type','Category','Power','Accuracy','TotalPP',
  'Target','Priority','FunctionCode','Flags','EffectChance','Description',
];

// ── 한국어 번역 폴더 목록 ────────────────────────────────────────
const KOREAN_DIRS = ['Text_korean_core', 'Text_korean_game'];

// ── Aux 파일 목록 (드롭다운 데이터 소스) ────────────────────────
const AUX_FILE_MAP = {
  abilities: ['PBS/abilities.txt', 'PBS/abilities_Gen_9_Pack.txt'],
  items:     ['PBS/items.txt',     'PBS/items_Gen_9_Pack.txt'],
};

const PBS_REGISTRY = {
  pokemon:            { label: '포켓몬',       filename: 'PBS/pokemon.txt',                    type: 'entity',   translationSection: 'SPECIES_NAMES',      specialFields: _SF_POKEMON },
  pokemon_gen9:       { label: '포켓몬 Gen9',  filename: 'PBS/pokemon_base_Gen_9_Pack.txt',    type: 'entity',   translationSection: 'SPECIES_NAMES',      specialFields: _SF_POKEMON },
  pokemon_forms:      { label: '폼',           filename: 'PBS/pokemon_forms.txt',              type: 'entity',   translationSection: 'SPECIES_FORM_NAMES', nameField: 'FormName', specialFields: _SF_FORM },
  pokemon_forms_gen9: { label: '폼 Gen9',      filename: 'PBS/pokemon_forms_Gen_9_Pack.txt',   type: 'entity',   translationSection: 'SPECIES_FORM_NAMES', nameField: 'FormName', specialFields: _SF_FORM },
  pokemon_forms_gmax: { label: '거다이맥스 폼',   filename: 'PBS/pokemon_forms_gmax.txt',         type: 'entity',   translationSection: 'SPECIES_FORM_NAMES', nameField: 'FormName', specialFields: _SF_FORM },
  pokemon_forms_caps: { label: '피카츄캡',     filename: 'PBS/pokemon_forms_pikachu_caps.txt', type: 'entity',   translationSection: 'SPECIES_FORM_NAMES', nameField: 'FormName', specialFields: _SF_FORM },
  moves:              { label: '기술',          filename: 'PBS/moves.txt',             type: 'entity', translationSection: 'MOVE_NAMES', specialFields: _SF_MOVE, fieldOrder: _FIELD_ORDER_MOVE },
  moves_gen9:         { label: '기술 Gen9',    filename: 'PBS/moves_Gen_9_Pack.txt',  type: 'entity', translationSection: 'MOVE_NAMES', specialFields: _SF_MOVE, fieldOrder: _FIELD_ORDER_MOVE },
  moves_terastal:     { label: '기술 테라스탈', filename: 'PBS/moves_terastal.txt',    type: 'entity', translationSection: 'MOVE_NAMES', specialFields: _SF_MOVE, fieldOrder: _FIELD_ORDER_MOVE },
  moves_dynamax:      { label: '기술 다이맥스', filename: 'PBS/moves_dynamax.txt',     type: 'entity', translationSection: 'MOVE_NAMES', specialFields: _SF_MOVE, fieldOrder: _FIELD_ORDER_MOVE },
  moves_zpower:       { label: '기술 Z기술',   filename: 'PBS/moves_zpower.txt',      type: 'entity', translationSection: 'MOVE_NAMES', specialFields: _SF_MOVE, fieldOrder: _FIELD_ORDER_MOVE },
  encounters:         { label: '서식 분포',    filename: 'PBS/encounters.txt',        type: 'location', specialFields: {} },
  trainer_types:      { label: '트레이너 타입', filename: 'PBS/trainer_types.txt',    type: 'entity',   translationSection: 'TRAINER_TYPE_NAMES', specialFields: { Gender: 'trainer_gender' }, fieldOrder: ['Name','Gender','BaseMoney','SkillLevel','Flags','IntroBGM','BattleBGM','VictoryBGM'] },
  trainers:           { label: '트레이너',      filename: 'PBS/trainers.txt',         type: 'trainer',  specialFields: {} },
};

const TAB_CATEGORIES = [
  { id: 'pokemon',   label: '포켓몬',    keys: ['pokemon','pokemon_gen9','pokemon_forms','pokemon_forms_gen9','pokemon_forms_gmax','pokemon_forms_caps'] },
  { id: 'moves',     label: '기술',      keys: ['moves','moves_gen9','moves_terastal','moves_dynamax','moves_zpower'] },
  { id: 'encounter', label: '서식 분포', keys: ['encounters'] },
  { id: 'trainer',   label: '트레이너',  keys: ['trainer_types','trainers'] },
];

const POKEMON_TYPES = [
  'NORMAL','FIRE','WATER','ELECTRIC','GRASS','ICE',
  'FIGHTING','POISON','GROUND','FLYING','PSYCHIC',
  'BUG','ROCK','GHOST','DRAGON','DARK','STEEL','FAIRY',
];

const MOVE_CATEGORIES  = ['Physical','Special','Status'];
const MOVE_PP_VALUES   = [5, 10, 15, 20, 25, 30, 35, 40];
const MOVE_PRIORITY_RANGE = [-7,-6,-5,-4,-3,-2,-1, 0, 1, 2, 3, 4, 5, 6, 7];

// 기술 플래그 고정 목록 (Pokémon Essentials v21.1+, moves.txt 기준)
const MOVE_FLAGS = [
  'Biting',             // 물기 기술 (Strong Jaw 강화)
  'Bomb',               // 구체 기술 (Bulletproof 무효)
  'CanMirrorMove',      // Mirror Move 복사 대상
  'CanProtect',         // Protect 계열로 막을 수 있음
  'Contact',            // 접촉 기술
  'Dance',              // 춤 기술 (Dancer 발동)
  'HighCriticalHitRate',// 급소율 +1단계
  'Powder',             // 가루 기술 (풀 타입 / 방진고글 무효)
  'Pulse',              // 파동 기술 (Mega Launcher 강화)
  'Punching',           // 주먹 기술 (Iron Fist 강화)
  'Slicing',            // 베기 기술 (Sharpness 강화)
  'Sound',              // 소리 기술 (방음 특성 무효)
  'ThawsUser',          // 사용자의 얼음 상태 해제
  'TramplesMinimize',   // 분신 중인 상대에 반드시 명중 + 위력 2배
  'Wind',               // 바람 기술 (풍력발전 발동)
];

// 기술 타겟 고정 목록 (Pokémon Essentials v21.1+)
const MOVE_TARGETS = [
  { value: 'None',           desc: 'Bide / Counter / Mirror Coat 등'        },
  { value: 'User',           desc: '사용자 자신'                             },
  { value: 'NearAlly',       desc: '인접한 아군 (Helping Hand 등)'           },
  { value: 'UserOrNearAlly', desc: '자신 또는 인접 아군 (Acupressure)'       },
  { value: 'AllAllies',      desc: '모든 아군 (Coaching)'                    },
  { value: 'UserAndAllies',  desc: '자신 + 모든 아군 (Heal Bell 등)'         },
  { value: 'NearFoe',        desc: '인접한 상대 1체 (Me First)'              },
  { value: 'RandomNearFoe',  desc: '랜덤 인접 상대 (Outrage / Thrash 등)'   },
  { value: 'AllNearFoes',    desc: '인접한 모든 상대'                        },
  { value: 'Foe',            desc: '상대 1체 (포켓볼 던지기 등)'             },
  { value: 'AllFoes',        desc: '모든 상대 (기본 미사용)'                 },
  { value: 'NearOther',      desc: '인접한 상대 또는 아군 1체'               },
  { value: 'AllNearOthers',  desc: '인접한 모든 상대 + 아군'                 },
  { value: 'Other',          desc: '상대 또는 아군 (파동기 / 비행기 등)'     },
  { value: 'AllBattlers',    desc: '필드 전체 (Perish Song / Rototiller 등)' },
  { value: 'UserSide',       desc: '자신의 진영 전체'                        },
  { value: 'FoeSide',        desc: '상대 진영 전체 (돌뿌리기 등)'            },
  { value: 'BothSides',      desc: '양 진영 (날씨 기술 등)'                  },
];
const TRAINER_GENDERS  = ['Male','Female','Mixed'];
const POKE_NATURES     = [
  'HARDY','LONELY','BRAVE','ADAMANT','NAUGHTY',
'BOLD','DOCILE','RELAXED','IMPISH','LAX',
'TIMID','HASTY','SERIOUS','JOLLY','NAIVE',
'MODEST','MILD','QUIET','BASHFUL','RASH',
'CALM','GENTLE','SASSY','CAREFUL','QUIRKY',
];
const POKE_GENDERS_TR  = [['','(미지정)'],['male','Male'],['female','Female']];

// IV/EV 표시 순서 (BaseStats 표시와 동일)
// PBS 저장 순서: HP[0], Atk[1], Def[2], Spe[3], SpA[4], SpD[5]
const IV_EV_STATS = [
  { label: 'HP',     key: 'hp',  pbsIdx: 0 },
  { label: '공격',   key: 'atk', pbsIdx: 1 },
  { label: '방어',   key: 'def', pbsIdx: 2 },
  { label: '특공',   key: 'spa', pbsIdx: 4 },
  { label: '특방',   key: 'spd', pbsIdx: 5 },
  { label: '스피드', key: 'spe', pbsIdx: 3 },
];

// 새 항목 생성을 지원하는 탭 목록
const CREATABLE_TABS = new Set([
  'pokemon', 'pokemon_gen9', 'pokemon_forms', 'pokemon_forms_gen9', 'pokemon_forms_gmax', 'pokemon_forms_caps',
  'moves', 'moves_gen9', 'moves_terastal', 'moves_dynamax', 'moves_zpower',
  'encounters',
  'trainer_types',
  'trainers',
]);

// GrowthRate 고정 목록 (Pokémon Essentials v21.1+)
// 경험치 공식 출처: https://bulbapedia.bulbagarden.net/wiki/Experience
const GROWTH_RATES = [
  { value: 'Erratic',     desc: 'Lv.100: 60만 EXP · 초반 매우 느리고 후반에 급성장 (주로 3세대 벌레·물)' },
  { value: 'Fast',        desc: 'Lv.100: 80만 EXP · 중후반으로 갈수록 빠름 (일반·페어리 계열)' },
  { value: 'Medium',      desc: 'Lv.100: 100만 EXP · n³ 공식, 균형 성장, 전체 포켓몬 중 가장 많음' },
  { value: 'Parabolic',   desc: 'Lv.100: 약 106만 EXP · 초반 빠름, 중반 이후 점점 느려짐 (스타터·3단계 진화)' },
  { value: 'Slow',        desc: 'Lv.100: 125만 EXP · 전 구간 균일하게 느림 (전설·유사전설)' },
  { value: 'Fluctuating', desc: 'Lv.100: 164만 EXP · 초반 빠르나 후반에 급격히 느려짐 (14종만 해당)' },
];

// GenderRatio 고정 목록 (Pokémon Essentials v21.1+)
// value: PBS 내부 값 / label: 웹앱 표시 (수컷:암컷 비율)
const GENDER_RATIOS = [
  { value: 'AlwaysMale',         label: '100 : 0'      },
  { value: 'FemaleOneEighth',    label: '87.5 : 12.5'  },
  { value: 'Female25Percent',    label: '75 : 25'       },
  { value: 'Female50Percent',    label: '50 : 50'       },
  { value: 'Female75Percent',    label: '25 : 75'       },
  { value: 'FemaleSevenEighths', label: '12.5 : 87.5'  },
  { value: 'AlwaysFemale',       label: '0 : 100'       },
  { value: 'Genderless',         label: '(불명)'        },
];

// 진화 방식 목록 (Pokémon Essentials v21.1+)
// param 타입: 'level'|'item'|'move'|'pokemon'|'type'|'number'|'text'|'none'
const EVOLUTION_METHODS = [
  { value: 'Level',                param: 'level',   label: 'Level — 레벨업' },
  { value: 'LevelMale',            param: 'level',   label: 'LevelMale — 레벨업 (수컷)' },
  { value: 'LevelFemale',          param: 'level',   label: 'LevelFemale — 레벨업 (암컷)' },
  { value: 'LevelDay',             param: 'level',   label: 'LevelDay — 레벨업 (낮)' },
  { value: 'LevelNight',           param: 'level',   label: 'LevelNight — 레벨업 (밤)' },
  { value: 'LevelRain',            param: 'level',   label: 'LevelRain — 레벨업 (비)' },
  { value: 'LevelDarkness',        param: 'level',   label: 'LevelDarkness — 레벨업 (어두운 곳)' },
  { value: 'LevelDarknessNoCave',  param: 'level',   label: 'LevelDarknessNoCave — 레벨업 (동굴 외 어두운 곳)' },
  { value: 'LevelElsewhere',       param: 'level',   label: 'LevelElsewhere — 레벨업 (지정 장소 외)' },
  { value: 'AttackGreater',        param: 'level',   label: 'AttackGreater — 레벨업 (공격 > 방어)' },
  { value: 'AtkDefEqual',          param: 'level',   label: 'AtkDefEqual — 레벨업 (공격 = 방어)' },
  { value: 'DefenseGreater',       param: 'level',   label: 'DefenseGreater — 레벨업 (방어 > 공격)' },
  { value: 'Happiness',            param: 'none',    label: 'Happiness — 친밀도' },
  { value: 'HappinessDay',         param: 'none',    label: 'HappinessDay — 친밀도 (낮)' },
  { value: 'HappinessNight',       param: 'none',    label: 'HappinessNight — 친밀도 (밤)' },
  { value: 'HappinessMoveType',    param: 'type',    label: 'HappinessMoveType — 친밀도 + 특정 타입 기술 보유' },
  { value: 'Beauty',               param: 'number',  label: 'Beauty — 아름다움 수치 도달' },
  { value: 'Item',                 param: 'item',    label: 'Item — 도구 사용' },
  { value: 'ItemMale',             param: 'item',    label: 'ItemMale — 도구 사용 (수컷)' },
  { value: 'ItemFemale',           param: 'item',    label: 'ItemFemale — 도구 사용 (암컷)' },
  { value: 'ItemDay',              param: 'item',    label: 'ItemDay — 도구 사용 (낮)' },
  { value: 'ItemNight',            param: 'item',    label: 'ItemNight — 도구 사용 (밤)' },
  { value: 'Trade',                param: 'none',    label: 'Trade — 통신교환' },
  { value: 'TradeItem',            param: 'item',    label: 'TradeItem — 도구 장착 통신교환' },
  { value: 'TradePokemon',         param: 'pokemon', label: 'TradePokemon — 특정 포켓몬과 교환' },
  { value: 'DaHoldItem',           param: 'item',    label: 'DaHoldItem — 낮에 도구 지참 레벨업' },
  { value: 'NightHoldItem',        param: 'item',    label: 'NightHoldItem — 밤에 도구 지참 레벨업' },
  { value: 'HasMove',              param: 'move',    label: 'HasMove — 특정 기술 보유' },
  { value: 'HasMoveType',          param: 'type',    label: 'HasMoveType — 특정 타입 기술 보유' },
  { value: 'HasPokemonInParty',    param: 'pokemon', label: 'HasPokemonInParty — 파티에 특정 포켓몬' },
  { value: 'Location',             param: 'text',    label: 'Location — 특정 장소에서 레벨업' },
];

const KNOWN_ENC_TYPES = [
  'Land','LandMorning','LandDay','LandNight','Cave',
  'Water','RockSmash','OldRod','GoodRod','SuperRod',
  'HeadbuttLow','HeadbuttHigh','PokeRadar','BugContest',
];
