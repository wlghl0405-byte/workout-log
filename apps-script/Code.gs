// 운동일지 구글시트 동기화 웹앱 v3
// v2: exercises 열(part·equip·key), notionSync(선생님 노션 수업기록 읽기), notionFile(영상·사진 서명 URL)
// v3: 요청마다 sheet 파라미터(스프레드시트 ID)로 다른 시트를 고를 수 있음 → 스크립트 하나로 앱 여러 개(각자 시트) 운용.
//     비어 있으면 이 스크립트가 붙은 시트를 쓴다(기존 동작 그대로). 다른 시트는 이 계정이 편집할 수 있어야 한다.
var TOKEN = 'CHANGE-ME';
var VER = 3;

// 노션 공개 페이지(선생님 수업기록). 바뀌면 여기만 수정.
var NOTION_SITE = 'https://third-hail-d47.notion.site';
var NOTION_DB_PAGE = '89a7ddeb-dcb1-8235-837d-010de4fe115e';
var NOTION_COLLECTION = '3237ddeb-dcb1-8264-a05f-074c15c37a47';
var NOTION_VIEW = 'fcd7ddeb-dcb1-8249-8922-8871e94cc986';
var NOTION_PROP_DATE = 'wn<G';
var NOTION_PROP_ORDER = 'fJp|';

var SHEETS = {
  sessions: ['id', 'date', 'routineId', 'feel', 'memo', 'entries', 'dur'],
  routines: ['id', 'name', 'items', 'preset'],
  exercises: ['id', 'name', 'part', 'equip', 'unit', 'key'],
  meta: ['key', 'value']
};

// 이번 요청이 쓸 스프레드시트 ID(doGet/doPost 에서 설정). 비어 있으면 스크립트가 붙은 시트.
var SHEET_ID = '';
function ss() {
  if (SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  return SpreadsheetApp.getActive();
}

function isJsonCol(name, col) {
  if (name === 'sessions' && col === 'entries') return true;
  if (name === 'routines' && col === 'items') return true;
  return false;
}

function out(obj) {
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function sheet(name) {
  var s = ss();
  var sh = s.getSheetByName(name);
  if (!sh) {
    sh = s.insertSheet(name);
    sh.appendRow(SHEETS[name]);
    sh.setFrozenRows(1);
  }
  return sh;
}

// 헤더 행을 읽어 열 순서를 맞춘다(옛 시트에 열이 없거나 순서가 달라도 동작)
function readTable(name) {
  var sh = sheet(name);
  var vals = sh.getDataRange().getValues();
  if (!vals.length) return [];
  var header = vals[0].map(String);
  var rows = [];
  for (var i = 1; i < vals.length; i++) {
    var r = vals[i];
    if (r[0] === '') continue;
    var o = {};
    for (var j = 0; j < header.length; j++) {
      var c = header[j];
      if (!c) continue;
      var v = r[j];
      if (isJsonCol(name, c)) {
        try { v = JSON.parse(v || '[]'); } catch (e) { v = []; }
      }
      if (c === 'feel' || c === 'dur') v = Number(v) || 0;
      if (c === 'date' && v instanceof Date) v = Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd');
      if (v === '' && (c === 'preset' || c === 'key')) continue;
      o[c] = v;
    }
    rows.push(o);
  }
  return rows;
}

function writeTable(name, rows) {
  var sh = sheet(name);
  var cols = SHEETS[name];
  sh.clearContents();
  var data = [cols];
  for (var i = 0; i < rows.length; i++) {
    var o = rows[i];
    var line = [];
    for (var j = 0; j < cols.length; j++) {
      var c = cols[j];
      var v = o[c];
      if (isJsonCol(name, c)) v = JSON.stringify(v || []);
      if (v === null || v === undefined) v = '';
      line.push(v);
    }
    data.push(line);
  }
  sh.getRange(1, 1, data.length, cols.length).setValues(data);
  sh.setFrozenRows(1);
  if (name === 'sessions' && data.length > 1) sh.getRange(2, 2, data.length - 1, 1).setNumberFormat('@');
}

function getMeta() {
  var m = {};
  var rows = readTable('meta');
  for (var i = 0; i < rows.length; i++) m[rows[i].key] = rows[i].value;
  return m;
}

function setMeta(obj) {
  var m = getMeta();
  for (var k in obj) m[k] = obj[k];
  var rows = [];
  for (var key in m) rows.push({ key: key, value: m[key] });
  writeTable('meta', rows);
}

function byDate(a, b) { return String(a.date).localeCompare(String(b.date)); }

function pull() {
  var db = {};
  db.exercises = readTable('exercises');
  db.routines = readTable('routines');
  db.sessions = readTable('sessions');
  db.updatedAt = Number(getMeta().updatedAt) || 0;
  db.version = Number(getMeta().version) || 2;
  return { ok: true, db: db };
}

function push(db) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sessions = (db.sessions || []).slice();
    sessions.sort(byDate);
    writeTable('exercises', db.exercises || []);
    writeTable('routines', db.routines || []);
    writeTable('sessions', sessions);
    var now = db.updatedAt || Date.now();
    setMeta({ updatedAt: now, pushedAt: new Date().toISOString(), version: db.version || 2 });
    return { ok: true, updatedAt: now, counts: { sessions: sessions.length, routines: (db.routines || []).length, exercises: (db.exercises || []).length } };
  } finally {
    lock.releaseLock();
  }
}

// ---------- 노션(선생님 수업기록) ----------
function notionPost(path, body) {
  var res = UrlFetchApp.fetch(NOTION_SITE + '/api/v3/' + path, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('notion ' + path + ' ' + res.getResponseCode());
  return JSON.parse(res.getContentText());
}
function dashId(id) {
  id = String(id).replace(/-/g, '');
  return id.slice(0, 8) + '-' + id.slice(8, 12) + '-' + id.slice(12, 16) + '-' + id.slice(16, 20) + '-' + id.slice(20);
}
function recVal(rec) { return rec && rec.value && rec.value.value ? rec.value.value : rec && rec.value; }
function richText(t) {
  var s = '';
  (t || []).forEach(function (x) { if (x[0] !== '‣') s += x[0]; });
  return s;
}

// 영상·사진 서명 URL(약 1시간 유효). 공개 페이지라면 어느 회원 기록이든 같은 방식으로 받는다.
function notionFile(block, src) {
  var r = notionPost('getSignedFileUrls', { urls: [{ url: src, permissionRecord: { table: 'block', id: dashId(block) } }] });
  var u = r.signedUrls && r.signedUrls[0];
  if (!u) throw new Error('signed url 없음');
  return { ok: true, url: u };
}

// 수업기록 전체 → {pages:[{id,title,date,order,exercises:[{raw,weight,note,media:[{type,block,src}]}]}]}
// (앱에서는 더 이상 쓰지 않고, 내장 데이터는 tools/notion-sync.js 로 만든다. 필요하면 수동 호출용으로 남겨 둠)
function notionSync() {
  var first = notionPost('loadPageChunk', { pageId: NOTION_DB_PAGE, limit: 50, cursor: { stack: [] }, chunkNumber: 0, verticalColumns: false });
  var spaceId = first.recordMap.block[NOTION_DB_PAGE].spaceId;
  var q = notionPost('queryCollection', {
    source: { type: 'collection', id: NOTION_COLLECTION, spaceId: spaceId },
    collectionView: { id: NOTION_VIEW, spaceId: spaceId },
    loader: { type: 'reducer', reducers: { collection_group_results: { type: 'results', limit: 200 } }, searchQuery: '', userTimeZone: 'Asia/Seoul' }
  });
  var ids = q.result.reducerResults.collection_group_results.blockIds;
  var pages = [];
  var TEXT_TYPES = { bulleted_list: 1, numbered_list: 1, sub_header: 1, sub_sub_header: 1, header: 1, text: 1, toggle: 1, quote: 1, callout: 1 };
  ids.forEach(function (id) {
    var r = notionPost('loadPageChunk', { pageId: id, limit: 300, cursor: { stack: [] }, chunkNumber: 0, verticalColumns: false });
    var B = r.recordMap.block || {};
    var g = function (k) { return recVal(B[k]); };
    var pg = g(id); if (!pg) return;
    var P = pg.properties || {};
    var date = '';
    var dp = P[NOTION_PROP_DATE];
    if (dp && dp[0] && dp[0][1]) {
      dp[0][1].forEach(function (a) { if (a[0] === 'd') date = a[1].start_date; });
    }
    var page = { id: id.replace(/-/g, ''), title: richText(P.title), date: date, order: Number(richText(P[NOTION_PROP_ORDER])) || 0, exercises: [] };
    var cur = null;
    var walk = function (k) {
      var v = g(k); if (!v) return;
      var t = v.type;
      if (t === 'video' || t === 'image') {
        if (cur) cur.media.push({ type: t, block: k.replace(/-/g, ''), src: (v.properties && v.properties.source && v.properties.source[0] && v.properties.source[0][0]) || '' });
      } else if (TEXT_TYPES[t]) {
        var s = richText(v.properties && v.properties.title).trim();
        s.split('\n').forEach(function (line) {
          var L = line.trim(); if (!L) return;
          if (/^중량\s*[:：]/.test(L)) { if (cur) cur.weight = L.replace(/^중량\s*[:：]\s*/, ''); }
          else if (/^비고\s*[:：]/.test(L)) { if (cur) cur.note = (cur.note ? cur.note + ' ' : '') + L.replace(/^비고\s*[:：]\s*/, ''); }
          else { cur = { raw: L, weight: '', note: '', media: [] }; page.exercises.push(cur); }
        });
      }
      (v.content || []).forEach(walk);
    };
    (pg.content || []).forEach(walk);
    if (!page.date) { var m = page.title.match(/^(\d{1,2})\/(\d{1,2})/); if (m) page.date = '2026-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2); }
    pages.push(page);
  });
  pages.sort(function (a, b) { return (a.order - b.order) || String(a.date).localeCompare(String(b.date)); });
  return { ok: true, data: { source: NOTION_SITE + '/' + NOTION_DB_PAGE.replace(/-/g, ''), spaceId: spaceId, fetchedAt: new Date().toISOString(), pages: pages } };
}

function doGet(e) {
  var p = e.parameter || {};
  if (p.token !== TOKEN) return out({ ok: false, error: 'bad token' });
  SHEET_ID = String(p.sheet || '').trim();
  try {
    if (p.action === 'meta') return out({ ok: true, updatedAt: Number(getMeta().updatedAt) || 0, ver: VER, sheet: ss().getName() });
    if (p.action === 'pull') return out(pull());
    if (p.action === 'notionSync') return out(notionSync());
    if (p.action === 'notionFile') return out(notionFile(p.block, p.src));
    return out({ ok: true, ping: 'workout-log', ver: VER });
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'bad json' }); }
  if (body.token !== TOKEN) return out({ ok: false, error: 'bad token' });
  SHEET_ID = String(body.sheet || '').trim();
  try {
    if (body.action === 'push') return out(push(body.db || {}));
    if (body.action === 'pull') return out(pull());
    return out({ ok: false, error: 'unknown action' });
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}
