/* 다훈 플래너 - 예약 알림 전송 (GitHub Actions에서 실행)
   서비스 계정으로 DB를 읽어 오늘 요약을 만들고, 등록된 기기(FCM 토큰)에 푸시 */
const admin = require('firebase-admin');

const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(svc),
  databaseURL: 'https://dahoon-planner-default-rtdb.asia-southeast1.firebasedatabase.app'
});
const db = admin.database();

const sanitizeKey = k => k.replace(/[.#$\[\]]/g, '_');
const pad = x => String(x).padStart(2, '0');
const won = n => (n || 0).toLocaleString('ko-KR') + '원';

(async () => {
  const snap = await db.ref('dahoon/data').once('value');
  const data = snap.val() || {};
  const get = k => data[sanitizeKey(k)];

  // KST(UTC+9) 기준 오늘
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear(), m = kst.getUTCMonth(), d = kst.getUTCDate();
  const dateKey = `${y}-${pad(m + 1)}-${pad(d)}`;
  const todayStr = `${pad(m + 1)}/${pad(d)}`;

  let led = []; try { led = JSON.parse(get('ledger-' + y + '-' + m) || '[]'); } catch (e) {}
  const todayExp = led.filter(r => r.type === 'expense' && r.date === todayStr).reduce((s, r) => s + (r.amt || 0), 0);
  const monthExp = led.filter(r => r.type === 'expense').reduce((s, r) => s + (r.amt || 0), 0);

  let goals = {}; try { goals = JSON.parse(get('budget_goals') || '{}'); } catch (e) {}
  const monthBudget = parseInt(get('budget-' + y + '-' + m) || goals.monthly || 0) || 0;
  let fixed = []; try { fixed = JSON.parse(get('fixed_expenses') || '[]'); } catch (e) {}
  const fixedTotal = fixed.reduce((s, f) => s + (f.amt || 0), 0);
  const daily = parseInt(get('daily_budget') || 0) || 0;

  const dayTasks = dk => ({
    am: get('date-' + dk + '-am') || '', amC: get('date-' + dk + '-am-check') === '1',
    pm: get('date-' + dk + '-pm') || '', pmC: get('date-' + dk + '-pm-check') === '1',
  });
  const t = dayTasks(dateKey);
  const undone = [t.am && !t.amC ? '오전' : null, t.pm && !t.pmC ? '오후' : null].filter(Boolean);
  let forgot = 0;
  for (let i = 1; i <= 14; i++) {
    const dd = new Date(Date.UTC(y, m, d)); dd.setUTCDate(dd.getUTCDate() - i);
    const dk = `${dd.getUTCFullYear()}-${pad(dd.getUTCMonth() + 1)}-${pad(dd.getUTCDate())}`;
    const tt = dayTasks(dk);
    if (tt.am && !tt.amC) forgot++;
    if (tt.pm && !tt.pmC) forgot++;
  }

  const lines = [`오늘 지출 ${won(todayExp)}`];
  if (daily && todayExp > daily) lines.push(`일 예산 ${won(todayExp - daily)} 초과`);
  if (monthBudget) lines.push(`이번 달 여유 ${won(monthBudget - fixedTotal - monthExp)}`);
  if (undone.length) lines.push(`오늘 ${undone.join('·')} 할 일 남음`);
  if (forgot) lines.push(`까먹은 일 ${forgot}건`);

  const title = '📋 오늘의 정리';
  const body = lines.join(' · ');

  let tokens = []; try { tokens = JSON.parse(get('fcm_tokens') || '[]'); } catch (e) {}
  if (!Array.isArray(tokens) || !tokens.length) { console.log('등록된 기기(토큰)가 없습니다.'); return; }

  const invalid = [];
  for (const token of tokens) {
    try {
      await admin.messaging().send({ token, notification: { title, body } });
      console.log('전송 성공:', token.slice(0, 12) + '...');
    } catch (e) {
      console.log('전송 실패:', token.slice(0, 12) + '...', e.code || e.message);
      if (e.code === 'messaging/registration-token-not-registered' || e.code === 'messaging/invalid-argument') invalid.push(token);
    }
  }
  if (invalid.length) {
    const kept = tokens.filter(t => !invalid.includes(t));
    await db.ref('dahoon/data/' + sanitizeKey('fcm_tokens')).set(JSON.stringify(kept));
    console.log('무효 토큰 정리:', invalid.length);
  }
})().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
