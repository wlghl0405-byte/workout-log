// data/notion_sessions.json + catalog.js → data/tips.json (종목별 PT 메모·중량 이력·영상 목록)
// 실행: node tools/build-tips.js   (먼저 node tools/notion-sync.js 로 최신 노션 데이터를 받는다)
const fs = require('fs');
const path = require('path');
const C = require('../catalog.js');

const root = path.join(__dirname, '..');
const src = JSON.parse(fs.readFileSync(path.join(root, 'data', 'notion_sessions.json'), 'utf8'));

// 브라우저(index.html)에서도 같은 함수를 쓰므로 여기 로직은 catalog와 함께 유지한다.
function buildTips(notion) {
  const tips = {}; const unmatched = [];
  const get = (k) => (tips[k] = tips[k] || { key: k, name: C.byKey[k].name, notes: [], weights: [], media: [] });
  for (const p of notion.pages) {
    for (const ex of p.exercises) {
      const keys = C.matchAll(ex.raw);
      if (!keys.length) { unmatched.push({ page: p.title, raw: ex.raw }); continue; }
      const w = C.parseWeight(ex.weight) ?? C.parseWeight(ex.raw);
      const wText = ex.weight || (ex.raw.includes(' - ') ? ex.raw.split(' - ').slice(1).join(' - ') : '');
      keys.forEach((k, i) => {
        const t = get(k);
        if (ex.note) t.notes.push({ date: p.date, text: ex.note, page: p.id });
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
  const out = buildTips(src);
  fs.writeFileSync(path.join(root, 'data', 'tips.json'), JSON.stringify(out));
  const keys = Object.keys(out.tips);
  console.log('종목', keys.length, '/ 메모 있는 종목', keys.filter((k) => out.tips[k].notes.length).length, '/ 영상·사진', keys.reduce((a, k) => a + out.tips[k].media.length, 0));
  console.log('매칭 실패:', out.unmatched.length ? out.unmatched : '없음');
  const noNote = C.EX.filter((e) => !out.tips[e.key] || !out.tips[e.key].notes.length).map((e) => e.name);
  console.log('PT 메모 없음(기본 설명 사용):', noNote.join(', '));
}
module.exports = { buildTips };
