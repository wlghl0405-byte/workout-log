/**
 * 운동일지 구글시트 동기화 백엔드 (Google Apps Script 웹앱)
 *
 * 설치: 구글시트 → 확장 프로그램 → Apps Script → 이 코드 붙여넣기 → TOKEN 바꾸기
 *       → 배포 → 새 배포 → 유형 "웹 앱", 실행: 나, 액세스: 모든 사용자 → 웹앱 URL을 앱 설정에 입력
 *
 * 시트 구조 (없으면 자동 생성)
 *   sessions  : id | date | routineId | feel | memo | entries(JSON)
 *   routines  : id | name | items(JSON)
 *   exercises : id | name | cat | unit
 *   meta      : key | value   (updatedAt = 마지막 저장 시각 ms)
 */
const TOKEN = 'CHANGE-ME';           // 앱 설정의 토큰과 같아야 함 (아무 문자열)

const SHEETS = {
  sessions:  ['id', 'date', 'routineId', 'feel', 'memo', 'entries'],
  routines:  ['id', 'name', 'items'],
  exercises: ['id', 'name', 'cat', 'unit'],
  meta:      ['key', 'value'],
};
const JSON_COLS = { sessions: ['entries'], routines: ['items'] };

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function sheet(name) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(SHEETS[name]); sh.setFrozenRows(1); }
  return sh;
}
function readTable(name) {
  const sh = sheet(name), cols = SHEETS[name];
  const vals = sh.getDataRange().getValues().slice(1);
  return vals.filter(r => r[0] !== '').map(r => {
    const o = {};
    cols.forEach((c, i) => {
      let v = r[i];
      if ((JSON_COLS[name] || []).includes(c)) { try { v = JSON.parse(v || '[]'); } catch (e) { v = []; } }
      if (c === 'feel') v = Number(v) || 0;
      if (c === 'date' && v instanceof Date) v = Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd');
      o[c] = v;
    });
    return o;
  });
}
function writeTable(name, rows) {
  const sh = sheet(name), cols = SHEETS[name];
  sh.clearContents();
  const data = [cols].concat(rows.map(o => cols.map(c => {
    let v = o[c];
    if ((JSON_COLS[name] || []).includes(c)) v = JSON.stringify(v || []);
    if (v == null) v = '';
    return v;
  })));
  sh.getRange(1, 1, data.length, cols.length).setValues(data);
  sh.setFrozenRows(1);
  // 날짜 열은 문자열로 고정 (자동 날짜 변환 방지)
  if (name === 'sessions' && data.length > 1) sh.getRange(2, 2, data.length - 1, 1).setNumberFormat('@');
}
function getMeta() {
  const m = {}; readTable('meta').forEach(r => m[r.key] = r.value); return m;
}
function setMeta(obj) {
  const m = getMeta(); Object.assign(m, obj);
  writeTable('meta', Object.keys(m).map(k => ({ key: k, value: m[k] })));
}
function pull() {
  return { ok: true, db: { exercises: readTable('exercises'), routines: readTable('routines'), sessions: readTable('sessions'), updatedAt: Number(getMeta().updatedAt) || 0 } };
}
function push(db) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    writeTable('exercises', db.exercises || []);
    writeTable('routines', db.routines || []);
    writeTable('sessions', (db.sessions || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date))));
    setMeta({ updatedAt: db.updatedAt || Date.now(), pushedAt: new Date().toISOString() });
    return { ok: true, updatedAt: db.updatedAt || 0, counts: { sessions: (db.sessions || []).length, routines: (db.routines || []).length, exercises: (db.exercises || []).length } };
  } finally { lock.releaseLock(); }
}

function doGet(e) {
  const p = e.parameter || {};
  if (p.token !== TOKEN) return out({ ok: false, error: 'bad token' });
  if (p.action === 'meta') return out({ ok: true, updatedAt: Number(getMeta().updatedAt) || 0 });
  if (p.action === 'pull') return out(pull());
  return out({ ok: true, ping: 'workout-log', time: new Date().toISOString() });
}
function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'bad json' }); }
  if (body.token !== TOKEN) return out({ ok: false, error: 'bad token' });
  if (body.action === 'push') return out(push(body.db || {}));
  if (body.action === 'pull') return out(pull());
  return out({ ok: false, error: 'unknown action' });
}
