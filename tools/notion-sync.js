// PT 선생님 노션 수업기록(공개 페이지) → data/notion_sessions.json
// 실행: node tools/notion-sync.js                          (대장 기본 페이지 → data/notion_sessions.json)
//       node tools/notion-sync.js --page <페이지ID> --out data/pink/notion_sessions.json --year 2026   (다른 회원 페이지)
// 공개 notion.site 페이지의 비공식 API(loadPageChunk/queryCollection)를 그대로 쓴다. Apps Script의 notionSync와 같은 로직.
// 페이지 안의 데이터베이스(collection_view)를 자동으로 찾고, 기록이 하위 페이지로 묶여 있으면(예: "1~4월 운동 기록" 안의 날짜별 페이지) 끝까지 내려간다.
const fs = require('fs');
const path = require('path');

const SITE = 'https://third-hail-d47.notion.site';
const DEFAULT_PAGE = '89a7ddeb-dcb1-8235-837d-010de4fe115e';   // 운동일지 (1) 데이터베이스 페이지(대장)
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
const TEXT_TYPES = ['bulleted_list', 'numbered_list', 'sub_header', 'sub_sub_header', 'header', 'text', 'toggle', 'quote', 'callout'];

function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def; }

// 페이지(또는 그 안의 첫 데이터베이스)에서 collection / view id 를 찾는다
async function discover(pageId) {
  const first = await post('loadPageChunk', { pageId, limit: 100, cursor: { stack: [] }, chunkNumber: 0, verticalColumns: false });
  const B = first.recordMap.block || {};
  const pg = val(B[pageId]); if (!pg) throw new Error('페이지를 못 읽음: ' + pageId);
  let holder = pg.collection_id ? pg : null;
  if (!holder) for (const k of pg.content || []) { const v = val(B[k]); if (v && v.type === 'collection_view' && v.collection_id) { holder = v; break; } }
  if (!holder) throw new Error('페이지 안에 데이터베이스가 없음');
  const views = first.recordMap.collection_view || {};
  let view = holder.view_ids[0];
  for (const id of holder.view_ids) { const v = val(views[id]); if (v && (v.name === '수업기록' || v.type === 'list')) { view = id; break; } }
  return { spaceId: pg.space_id || holder.space_id || pg.spaceId || holder.spaceId, collection: holder.collection_id, view };
}

// 한 페이지의 블록을 훑어 종목 줄(raw/중량/비고/영상)을 모으고, 하위 페이지는 따로 돌려준다
function parsePage(id, B) {
  const g = (k) => val(B[k]);
  const pg = g(id); if (!pg) return null;
  const P = pg.properties || {};
  let date = ''; const dp = P[PROP.date];
  if (dp) { const d = (dp[0][1] || []).find((a) => a[0] === 'd'); if (d) date = d[1].start_date; }
  const page = { id: flat(id), title: txt(P.title), date, order: +txt(P[PROP.order]) || 0, comments: [], exercises: [] };
  const children = [];
  let cur = null;
  const addNote = (s) => { if (cur && s) cur.note = (cur.note ? cur.note + ' ' : '') + s; };
  const walk = (k) => {
    const v = g(k); if (!v) return; const t = v.type;
    if (t === 'page') { children.push(k); return; }
    if (t === 'video' || t === 'image') {
      if (cur) cur.media.push({ type: t, block: flat(k), src: (v.properties && v.properties.source && v.properties.source[0] && v.properties.source[0][0]) || '' });
    } else if (TEXT_TYPES.includes(t)) {
      const s = txt(v.properties && v.properties.title).trim();
      for (const line of s.split('\n')) {
        let L = line.trim(); if (!L) continue;
        if (/^중량\s*[:：]/.test(L)) { if (cur) cur.weight = L.replace(/^중량\s*[:：]\s*/, ''); }
        else if (/^비고\s*[:：]/.test(L)) addNote(L.replace(/^비고\s*[:：]\s*/, ''));
        else if (/^>+/.test(L)) page.comments.push(L.replace(/^>+\s*/, ''));                 // ">>지구력을 길러 보자구요" : 그날 전체 코멘트
        else if (/^[“”"]{2,}\s*\S/.test(L) && cur) {                                          // “”“” 로우 : 앞 종목의 첫 단어(덤벨)를 이어받는 줄임 표기
          L = cur.raw.split(/\s+/)[0] + ' ' + L.replace(/^[“”"]+\s*/, '');
          cur = { raw: L, weight: '', note: '', media: [] }; page.exercises.push(cur);
        }
        else if (/^[‘’“”"']/.test(L)) addNote(L.replace(/^[‘’“”"']+|[‘’“”"']+$/g, '').trim()); // ‘뒷발에 힘 빼실게요’ : 바로 앞 종목 메모
        else if (/운동\s*(목록|기록)$|^(오전|오후)\s*운동/.test(L)) continue;                  // "1월 24일 운동 목록", "오후 운동 (어깨 운동)" 같은 머리글
        else {
          L = L.replace(/^웜업\s*[-–]\s*(.+)$/, '$1 (웜업)');                                   // "웜업 - 원 레그 데드리프트"
          cur = { raw: L, weight: '', note: '', media: [] }; page.exercises.push(cur);
        }
      }
    }
    (v.content || []).forEach(walk);
  };
  (pg.content || []).forEach(walk);
  return { page, children };
}

async function fetchAll(rootPage, year) {
  const root = dash(rootPage);
  const { spaceId, collection, view } = await discover(root);
  const q = await post('queryCollection', { source: { type: 'collection', id: collection, spaceId }, collectionView: { id: view, spaceId },
    loader: { type: 'reducer', reducers: { collection_group_results: { type: 'results', limit: 200 } }, searchQuery: '', userTimeZone: 'Asia/Seoul' } });
  const ids = q.result.reducerResults.collection_group_results.blockIds;
  const pages = [];
  const queue = ids.slice();
  while (queue.length) {
    const id = queue.shift();
    const r = await post('loadPageChunk', { pageId: id, limit: 300, cursor: { stack: [] }, chunkNumber: 0, verticalColumns: false });
    const res = parsePage(id, r.recordMap.block || {});
    if (!res) continue;
    queue.push(...res.children);                       // 묶음 페이지 안의 날짜별 기록
    if (res.page.exercises.length) pages.push(res.page); // 종목 줄이 없는 묶음 페이지 자체는 버린다
  }
  // 제목의 "8/25" 로 날짜 보완 (날짜 속성이 비어 있는 기록)
  for (const p of pages) if (!p.date) { const m = p.title.match(/^(\d{1,2})\/(\d{1,2})/); if (m) p.date = `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; }
  pages.sort((a, b) => a.order - b.order || a.date.localeCompare(b.date));
  return { source: SITE + '/' + flat(root), spaceId, fetchedAt: new Date().toISOString(), pages };
}

// 영상/이미지 서명 URL (약 1시간 유효)
async function signedUrl(block, src) {
  const r = await post('getSignedFileUrls', { urls: [{ url: src, permissionRecord: { table: 'block', id: dash(block) } }] });
  return r.signedUrls && r.signedUrls[0];
}

if (require.main === module) {
  (async () => {
    const pageId = arg('--page', DEFAULT_PAGE);
    const year = arg('--year', '2026');
    const outFile = path.resolve(arg('--out', path.join(__dirname, '..', 'data', 'notion_sessions.json')));
    const data = await fetchAll(pageId, year);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(data, null, 1));
    const n = data.pages.reduce((a, p) => a + p.exercises.length, 0);
    console.log('pages', data.pages.length, 'exercises', n, '→', outFile);
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
