// data/notion_sessions.json + catalog.js → data/tips.json (종목별 PT 메모·중량 이력·영상 목록)
// 실행: node tools/build-tips.js                                   (대장: data/notion_sessions.json → data/tips.json)
//       node tools/build-tips.js --in data/pink/notion_sessions.json --out data/pink/tips.json   (핑크 버전)
// 먼저 node tools/notion-sync.js 로 최신 노션 데이터를 받는다.
const fs = require('fs');
const path = require('path');
const C = require('../catalog.js');

const root = path.join(__dirname, '..');
function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def; }

// 종목 줄의 괄호 안 문구 중 코칭 메모로 볼 것: 공백이 있는 한글 문구(예: "팔꿈치 각도, 상체 각도 살짝 숙여서"), 종목명·부위·장비·영문명은 제외
function parenNotes(raw) {
  const out = [];
  for (const m of String(raw || '').matchAll(/\(([^)]*)\)/g)) {
    const s = m[1].trim();
    if (s.length < 5 || !/\s/.test(s) || !/[가-힣]/.test(s)) continue;
    if (C.match(s)) continue;                       // "(시티드 로우)" 같은 다른 이름
    if (/^[가-힣]{1,3}(,\s*[가-힣]{1,3})*$/.test(s)) continue; // "(가슴, 어깨)" 같은 부위 나열
    out.push(s);
  }
  return out;
}

function buildTips(notion) {
  const tips = {}; const unmatched = [];
  const get = (k) => (tips[k] = tips[k] || { key: k, name: C.byKey[k].name, notes: [], weights: [], media: [] });
  for (const p of notion.pages) {
    for (const ex of p.exercises) {
      const keys = C.matchAll(ex.raw);
      if (!keys.length) { unmatched.push({ page: p.title, raw: ex.raw }); continue; }
      const w = C.parseWeight(ex.weight) ?? C.parseWeight(ex.raw);
      let wText = ex.weight || (ex.raw.includes(' - ') ? ex.raw.split(' - ').slice(1).join(' - ') : '');
      if (!/\d/.test(wText) && !/맨몸|무게|빈\s*바|보조|가볍|최대/.test(wText)) wText = ''; // "- 등", "- 삼두" 같은 부위 표시는 중량이 아님
      const notes = [ex.note, ...parenNotes(ex.raw)].filter(Boolean);
      keys.forEach((k, i) => {
        const t = get(k);
        notes.forEach((n) => t.notes.push({ date: p.date, text: n, page: p.id }));
        if (w != null || wText) t.weights.push({ date: p.date, kg: w, text: wText });
        // 묶인 종목(A + B)은 영상이 순서대로 하나씩이면 나눠 붙이고, 아니면 전부 붙인다
        const med = keys.length > 1 && ex.media.length === keys.length ? [ex.media[i]] : ex.media;
        med.forEach((m) => t.media.push({ date: p.date, type: m.type, block: m.block, src: m.src, page: p.id, title: p.title }));
      });
    }
  }
  // 최신순 정렬 + 같은 문장 메모 중복 제거
  for (const k in tips) {
    const t = tips[k];
    t.notes.sort((a, b) => b.date.localeCompare(a.date));
    const seen = new Set(); t.notes = t.notes.filter((n) => { const s = n.text.replace(/\s+/g, ''); if (seen.has(s)) return false; seen.add(s); return true; });
    t.weights.sort((a, b) => a.date.localeCompare(b.date));
    t.media.sort((a, b) => b.date.localeCompare(a.date));
  }
  return { builtAt: new Date().toISOString(), source: notion.source, fetchedAt: notion.fetchedAt, spaceId: notion.spaceId, tips, unmatched };
}

if (require.main === module) {
  const inFile = path.resolve(root, arg('--in', 'data/notion_sessions.json'));
  const outFile = path.resolve(root, arg('--out', 'data/tips.json'));
  const src = JSON.parse(fs.readFileSync(inFile, 'utf8'));
  const out = buildTips(src);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(out));
  const keys = Object.keys(out.tips);
  console.log('종목', keys.length, '/ 메모 있는 종목', keys.filter((k) => out.tips[k].notes.length).length, '/ 영상·사진', keys.reduce((a, k) => a + out.tips[k].media.length, 0), '→', path.relative(root, outFile));
  console.log('매칭 실패:', out.unmatched.length ? out.unmatched.map((u) => u.raw).join(' | ') : '없음');
}
module.exports = { buildTips, parenNotes };
