// PT 선생님 노션 수업기록(공개 페이지) → data/notion_sessions.json
// 실행: node tools/notion-sync.js            (Node 18+, 외부 패키지 없음)
// 공개 notion.site 페이지의 비공식 API(loadPageChunk/queryCollection)를 그대로 쓴다. Apps Script의 notionSync와 같은 로직.
const fs = require('fs');
const path = require('path');

const SITE = 'https://third-hail-d47.notion.site';
const DB_PAGE = '89a7ddeb-dcb1-8235-837d-010de4fe115e';           // 운동일지 (1) 데이터베이스 페이지
const COLLECTION = '3237ddeb-dcb1-8264-a05f-074c15c37a47';
const VIEW = 'fcd7ddeb-dcb1-8249-8922-8871e94cc986';              // 수업기록 뷰
const PROP = { date: 'wn<G', order: 'fJp|' };

const dash = (id) => id.replace(/-/g, '').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
const flat = (id) => id.replace(/-/g, '');
const post = async (p, body) => {
  const r = await fetch(SITE + '/api/v3/' + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(p + ' ' + r.status);
  return r.json();
};
const val = (rec) => (rec && rec.value && rec.value.value ? rec.value.value : rec && rec.value);
const txt = (t) => (t || []).map((x) => (x[0] === '‣' ? '' : x[0])).join('');

async function fetchAll() {
  const first = await post('loadPageChunk', { pageId: DB_PAGE, limit: 50, cursor: { stack: [] }, chunkNumber: 0, verticalColumns: false });
  const spaceId = first.recordMap.block[DB_PAGE].spaceId;
  let q = await post('queryCollection', { source: { type: 'collection', id: COLLECTION, spaceId }, collectionView: { id: VIEW, spaceId },
    loader: { type: 'reducer', reducers: { collection_group_results: { type: 'results', limit: 200 } }, searchQuery: '', userTimeZone: 'Asia/Seoul' } });
  const ids = q.result.reducerResults.collection_group_results.blockIds;
  const pages = [];
  for (const id of ids) {
    const r = await post('loadPageChunk', { pageId: id, limit: 300, cursor: { stack: [] }, chunkNumber: 0, verticalColumns: false });
    const B = r.recordMap.block || {};
    const g = (k) => val(B[k]);
    const pg = g(id); if (!pg) continue;
    const P = pg.properties || {};
    let date = ''; const dp = P[PROP.date];
    if (dp) { const d = (dp[0][1] || []).find((a) => a[0] === 'd'); if (d) date = d[1].start_date; }
    const page = { id: flat(id), title: txt(P.title), date, order: +txt(P[PROP.order]) || 0, exercises: [] };
    let cur = null;
    const walk = (k) => {
      const v = g(k); if (!v) return; const t = v.type;
      if (t === 'video' || t === 'image') {
        if (cur) cur.media.push({ type: t, block: flat(k), src: (v.properties && v.properties.source && v.properties.source[0] && v.properties.source[0][0]) || '' });
      } else if (['bulleted_list', 'numbered_list', 'sub_header', 'sub_sub_header', 'header', 'text', 'toggle', 'quote', 'callout'].includes(t)) {
        const s = txt(v.properties && v.properties.title).trim();
        for (const line of s.split('\n')) {
          const L = line.trim(); if (!L) continue;
          if (/^중량\s*[:：]/.test(L)) { if (cur) cur.weight = L.replace(/^중량\s*[:：]\s*/, ''); }
          else if (/^비고\s*[:：]/.test(L)) { if (cur) cur.note = (cur.note ? cur.note + ' ' : '') + L.replace(/^비고\s*[:：]\s*/, ''); }
          else { cur = { raw: L, weight: '', note: '', media: [] }; page.exercises.push(cur); }
        }
      }
      (v.content || []).forEach(walk);
    };
    (pg.content || []).forEach(walk);
    pages.push(page);
  }
  pages.sort((a, b) => a.order - b.order || a.date.localeCompare(b.date));
  // 제목의 "8/25" 로 날짜 보완 (날짜 속성이 비어 있는 초기 기록)
  for (const p of pages) if (!p.date) { const m = p.title.match(/^(\d{1,2})\/(\d{1,2})/); if (m) p.date = `2026-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; }
  return { source: SITE + '/' + flat(DB_PAGE), spaceId, fetchedAt: new Date().toISOString(), pages };
}

// 영상/이미지 서명 URL (약 1시간 유효)
async function signedUrl(block, src) {
  const r = await post('getSignedFileUrls', { urls: [{ url: src, permissionRecord: { table: 'block', id: dash(block) } }] });
  return r.signedUrls && r.signedUrls[0];
}

if (require.main === module) {
  (async () => {
    const data = await fetchAll();
    const outDir = path.join(__dirname, '..', 'data'); fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'notion_sessions.json'), JSON.stringify(data, null, 1));
    const n = data.pages.reduce((a, p) => a + p.exercises.length, 0);
    console.log('pages', data.pages.length, 'exercises', n, '→ data/notion_sessions.json');
    if (process.argv.includes('--test-video')) {
      const m = data.pages.flatMap((p) => p.exercises.flatMap((e) => e.media)).find((x) => x.type === 'video');
      const u = await signedUrl(m.block, m.src);
      console.log('signed url host:', u && new URL(u).host, '| len', u && u.length);
      const h = await fetch(u, { method: 'GET', headers: { Range: 'bytes=0-0' } });
      console.log('video fetch:', h.status, h.headers.get('content-type'), h.headers.get('content-range'));
    }
  })().catch((e) => { console.error(e); process.exit(1); });
}
module.exports = { fetchAll, signedUrl };
