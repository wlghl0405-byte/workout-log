// 변형 앱 생성: 루트 index.html / sw.js / manifest 를 바탕으로 pink/ 폴더(핑크 버전)를 만든다.
// 실행: node tools/build-variant.js            (index.html 을 고친 뒤 매번 실행 → pink/ 가 같은 코드로 갱신된다)
// pink/ 에는 index.html·sw.js·manifest.webmanifest·variant.js·theme.css 가 생성되고, 아이콘(icons/, apple-touch-icon.png)은 미리 만들어 둔 파일을 그대로 쓴다.
// 종목 사전·팁 데이터는 ../catalog.js, ../data/pink/tips.json 을 공유한다.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const C = require('../catalog.js');

const VARIANTS = {
  pink: {
    name: '운동일지',
    tips: 'data/pink/tips.json',
    themeColor: '#E8639A',
    description: 'PT에서 배운 운동을 루틴으로 기록하고 점진 과부하로 발전시키는 개인 운동 일지 (핑크)',
    // 파란 강조색 → 연핑크 계열. 라이트/다크 모두 같은 톤.
    css: `/* pink 버전 강조색 (build-variant.js 가 생성) */
:root{--accent:#E8639A;--accent-ink:#FFFFFF;--accent-soft:#FDEDF3;--accent-line:#F5C6D8;--sat:#E8639A}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--accent:#F48FB6;--accent-ink:#2A0F1B;--accent-soft:#3A1F2C;--accent-line:#6A3650;--sat:#F48FB6}}
:root[data-theme="dark"]{--accent:#F48FB6;--accent-ink:#2A0F1B;--accent-soft:#3A1F2C;--accent-line:#6A3650;--sat:#F48FB6}
`,
  },
};

function build(id) {
  const v = VARIANTS[id];
  const dir = path.join(root, id);
  fs.mkdirSync(path.join(dir, 'icons'), { recursive: true });
  let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const ver = (html.match(/const APP_VER="([^"]+)"/) || [])[1] || '0';

  // 1) 종목 사전·변형 설정 로드 + 테마 덮어쓰기
  const rep = (a, b) => { if (!html.includes(a)) throw new Error('index.html 에서 못 찾음: ' + a); html = html.replace(a, b); };
  rep('<script src="catalog.js"></script>', '<script src="../catalog.js"></script>\n<script src="variant.js"></script>');
  rep('</style>\n</head>', '</style>\n<link rel="stylesheet" href="theme.css">\n</head>');
  rep('<meta name="theme-color" content="#F3F4F6" media="(prefers-color-scheme: light)">', `<meta name="theme-color" content="${v.themeColor}" media="(prefers-color-scheme: light)">`);
  fs.writeFileSync(path.join(dir, 'index.html'), html);

  // 2) variant.js: 저장소 이름·팁 파일·프리셋·기본 종목(이 회원이 PT에서 한 종목 전부)
  const tips = JSON.parse(fs.readFileSync(path.join(root, v.tips), 'utf8'));
  const order = C.PARTS;
  const defaults = Object.keys(tips.tips).filter((k) => C.byKey[k]).sort((a, b) => order.indexOf(C.byKey[a].part) - order.indexOf(C.byKey[b].part) || C.byKey[a].name.localeCompare(C.byKey[b].name, 'ko'));
  const presetKeys = new Set(); (C.VARIANTS[id].PRESETS || []).forEach((p) => p.items.forEach((it) => presetKeys.add(it.key)));
  presetKeys.forEach((k) => { if (!defaults.includes(k)) defaults.push(k); });
  const variantJs = `// ${id} 버전 설정 (tools/build-variant.js 가 생성). 앱 본체(index.html)는 루트와 같은 코드.
window.WL_VARIANT = {
  id: "${id}",
  tips: "../${v.tips}",
  presets: CATALOG.VARIANTS.${id}.PRESETS,
  programs: CATALOG.VARIANTS.${id}.PROGRAMS,
  defaults: ${JSON.stringify(defaults)}
};
`;
  fs.writeFileSync(path.join(dir, 'variant.js'), variantJs);
  fs.writeFileSync(path.join(dir, 'theme.css'), v.css);

  // 3) 서비스 워커: 캐시 이름과 셸 목록만 바꾼다
  let sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  sw = sw.replace(/const VER = "[^"]+";/, `const VER = "wl-${id}-${ver}";`);
  sw = sw.replace(/const SHELL = \[[^\]]*\];/, `const SHELL = ["./", "./index.html", "../catalog.js", "./variant.js", "./theme.css", "../${v.tips}", "./manifest.webmanifest", "./apple-touch-icon.png", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png"];`);
  fs.writeFileSync(path.join(dir, 'sw.js'), sw);

  // 4) 매니페스트
  const man = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  man.name = v.name; man.short_name = v.name; man.description = v.description; man.theme_color = v.themeColor;
  fs.writeFileSync(path.join(dir, 'manifest.webmanifest'), JSON.stringify(man, null, 2) + '\n');

  const missing = ['apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'].filter((f) => !fs.existsSync(path.join(dir, f)));
  console.log(`${id}/ 생성 완료 · 앱 v${ver} · 기본 종목 ${defaults.length}개 · 프리셋 ${(C.VARIANTS[id].PRESETS || []).length}개${missing.length ? ' · 아이콘 없음: ' + missing.join(', ') : ''}`);
}

const which = process.argv[2] || 'pink';
build(which);
