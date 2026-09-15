var TOKEN = 'CHANGE-ME';

var SHEETS = {
  sessions: ['id', 'date', 'routineId', 'feel', 'memo', 'entries'],
  routines: ['id', 'name', 'items'],
  exercises: ['id', 'name', 'cat', 'unit'],
  meta: ['key', 'value']
};

function isJsonCol(name, col) {
  if (name === 'sessions' && col === 'entries') return true;
  if (name === 'routines' && col === 'items') return true;
  return false;
}

function out(obj) {
  var text = JSON.stringify(obj);
  var output = ContentService.createTextOutput(text);
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function sheet(name) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(SHEETS[name]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function readTable(name) {
  var sh = sheet(name);
  var cols = SHEETS[name];
  var vals = sh.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < vals.length; i++) {
    var r = vals[i];
    if (r[0] === '') continue;
    var o = {};
    for (var j = 0; j < cols.length; j++) {
      var c = cols[j];
      var v = r[j];
      if (isJsonCol(name, c)) {
        try {
          v = JSON.parse(v || '[]');
        } catch (e) {
          v = [];
        }
      }
      if (c === 'feel') v = Number(v) || 0;
      if (c === 'date' && v instanceof Date) {
        v = Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd');
      }
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
  if (name === 'sessions' && data.length > 1) {
    sh.getRange(2, 2, data.length - 1, 1).setNumberFormat('@');
  }
}

function getMeta() {
  var m = {};
  var rows = readTable('meta');
  for (var i = 0; i < rows.length; i++) {
    m[rows[i].key] = rows[i].value;
  }
  return m;
}

function setMeta(obj) {
  var m = getMeta();
  for (var k in obj) {
    m[k] = obj[k];
  }
  var rows = [];
  for (var key in m) {
    rows.push({ key: key, value: m[key] });
  }
  writeTable('meta', rows);
}

function byDate(a, b) {
  return String(a.date).localeCompare(String(b.date));
}

function pull() {
  var db = {};
  db.exercises = readTable('exercises');
  db.routines = readTable('routines');
  db.sessions = readTable('sessions');
  db.updatedAt = Number(getMeta().updatedAt) || 0;
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
    setMeta({ updatedAt: now, pushedAt: new Date().toISOString() });
    var counts = {};
    counts.sessions = sessions.length;
    counts.routines = (db.routines || []).length;
    counts.exercises = (db.exercises || []).length;
    return { ok: true, updatedAt: now, counts: counts };
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var p = e.parameter || {};
  if (p.token !== TOKEN) return out({ ok: false, error: 'bad token' });
  if (p.action === 'meta') {
    var t = Number(getMeta().updatedAt) || 0;
    return out({ ok: true, updatedAt: t });
  }
  if (p.action === 'pull') return out(pull());
  return out({ ok: true, ping: 'workout-log' });
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return out({ ok: false, error: 'bad json' });
  }
  if (body.token !== TOKEN) return out({ ok: false, error: 'bad token' });
  if (body.action === 'push') return out(push(body.db || {}));
  if (body.action === 'pull') return out(pull());
  return out({ ok: false, error: 'unknown action' });
}
