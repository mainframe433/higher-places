// Live check of the circles backend: three test people, one private circle.
import fs from 'node:fs';
import vm from 'node:vm';
const URL = process.env.SB_URL, KEY = process.env.SB_KEY;
const ctx = { fetch, Blob, Uint8Array, JSON, Date, Math, Error, Array, Object, Promise, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new globalThis.URL('./hpdb.js', import.meta.url), 'utf8') + ';this.hpDB=hpDB', ctx);
const mem = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };
const A = ctx.hpDB(URL, KEY, mem()), B = ctx.hpDB(URL, KEY, mem()), C = ctx.hpDB(URL, KEY, mem());
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const throws = async (p) => { try { await p; return false; } catch (e) { return e.message || true; } };
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

let circle = null, path = null;
try {
  const [a, b, c] = await Promise.all([A.signIn(), B.signIn(), C.signIn()]);
  ok(a && b && c && a !== b, 'three people signed in anonymously');
  await A.upsert('profiles', { id: a, name: 'Test A' });
  await B.upsert('profiles', { id: b, name: 'Test B' });
  await C.upsert('profiles', { id: c, name: 'Test C' });
  ok(true, 'names saved');

  circle = await A.rpc('create_circle', { circle_name: 'Test circle' });
  ok(circle && /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/.test(circle.code), 'circle made with code ' + (circle && circle.code));
  const pretty = 'hp-' + circle.code.slice(0, 4).toLowerCase() + '-' + circle.code.slice(4).toLowerCase();
  const jb = await B.rpc('join_circle', { invite: pretty });
  ok(jb && jb.id === circle.id, 'B joined with ' + pretty);
  const again = await B.rpc('join_circle', { invite: circle.code });
  ok(again && again.id === circle.id, 'joining twice is harmless');
  const jc = await C.rpc('join_circle', { invite: 'HP-AAAA-AAAA' });
  ok(jc === null, 'a wrong code gets nothing');

  path = circle.id + '/' + Date.now() + '.jpg';
  await A.upload('circle-photos', path, new Uint8Array(JPG), 'image/jpeg');
  ok(true, 'A uploaded a photo');
  const spot = await A.ins('circle_spots', { circle_id: circle.id, name: 'Test spot', note: 'hi', lat: 33.45, lng: -112.07, photo_path: path });
  ok(spot && spot.id && spot.user_id === a, 'A shared a spot');

  const bs = await B.sel('circle_spots', 'select=*&circle_id=eq.' + circle.id);
  ok(bs.length === 1, 'B sees the spot');
  const urls = await B.sign('circle-photos', [path], 600);
  ok(!!urls[path], 'B gets a photo link');
  const img = urls[path] ? await fetch(urls[path]) : null;
  ok(img && img.status === 200, 'the photo link opens (' + (img && img.status) + ')');
  const bm = await B.sel('circle_members', 'select=user_id,role&circle_id=eq.' + circle.id);
  ok(bm.length === 2, 'B sees 2 members');
  const bp = await B.sel('profiles', 'select=id,name&id=eq.' + a);
  ok(bp.length === 1 && bp[0].name === 'Test A', 'B sees A’s name');

  ok((await C.sel('circle_spots', 'select=*')).length === 0, 'outsider C sees no spots');
  ok((await C.sel('circles', 'select=*')).length === 0, 'outsider C sees no circles');
  ok((await C.sel('circle_members', 'select=*')).length === 0, 'outsider C sees no members');
  ok((await C.sel('profiles', 'select=*&id=eq.' + a)).length === 0, 'outsider C can’t see A’s name');
  const cu = await C.sign('circle-photos', [path], 600);
  ok(!cu[path], 'outsider C gets no photo link');
  ok(!!await throws(C.ins('circle_spots', { circle_id: circle.id, name: 'x', lat: 1, lng: 1 })), 'outsider C can’t post into the circle');
  ok(!!await throws(C.upload('circle-photos', circle.id + '/c.jpg', new Uint8Array(JPG), 'image/jpeg')), 'outsider C can’t upload into the circle');
  const pub = await fetch(URL + '/rest/v1/circle_spots?select=*', { headers: { apikey: KEY } });
  const pj = await pub.json().catch(() => null);
  ok(!pub.ok || (Array.isArray(pj) && pj.length === 0), 'signed-out visitors see nothing (' + pub.status + ')');

  const bd = await B.del('circle_spots', 'id=eq.' + spot.id);
  ok(Array.isArray(bd) && bd.length === 0, 'B can’t delete A’s spot');
  ok((await A.sel('circle_spots', 'select=id&id=eq.' + spot.id)).length === 1, 'spot still there');
  const bc = await B.del('circles', 'id=eq.' + circle.id);
  ok(Array.isArray(bc) && bc.length === 0, 'B can’t delete A’s circle');

  const left = await B.del('circle_members', 'circle_id=eq.' + circle.id + '&user_id=eq.' + b);
  ok(left.length === 1, 'B can leave');
  ok((await B.sel('circle_spots', 'select=*')).length === 0, 'after leaving, B sees nothing');
} catch (e) {
  ok(false, 'crashed: ' + e.message + ' ' + JSON.stringify(e.body || ''));
} finally {
  try { if (path) await A.unlink('circle-photos', [path]); console.log('cleanup photo ok'); } catch (e) { console.log('cleanup photo: ' + e.message); fails++; }
  try { if (circle) { const d = await A.del('circles', 'id=eq.' + circle.id); console.log('cleanup circle: ' + d.length); } } catch (e) { console.log('cleanup circle: ' + e.message); }
  try { await A.upsert('profiles', { id: A.me(), name: 'Test A' }); } catch (e) {}
}
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
