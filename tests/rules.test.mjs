// Checks firestore.rules in the Firebase emulator. Run by .github/workflows/rules-test.yml.
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, addDoc, deleteDoc, collection, query, where, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';

const env = await initializeTestEnvironment({ projectId: 'demo-letterbox', firestore: { rules: readFileSync('../firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
const DAY = Math.floor((Date.now() - 1792972800000) / 86400000);
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('PASS', name) } catch (e) { fail++; console.log('FAIL', name, '-', e.message) } }

await env.withSecurityRulesDisabled(async c => {
  const db = c.firestore();
  await setDoc(doc(db, 'names/mathew'), { uid: 'mod' });
  await setDoc(doc(db, 'names/alice'), { uid: 'alice' });
  await setDoc(doc(db, 'names/bob'), { uid: 'bob' });
  await setDoc(doc(db, 'players/mod'), { name: 'Mathew', total: 0, played: 0, last: -1 });
  await setDoc(doc(db, 'players/alice'), { name: 'Alice', total: 300, played: 1, last: DAY });
  await setDoc(doc(db, 'players/bob'), { name: 'Bob', total: 0, played: 0, last: -1 });
  await setDoc(doc(db, `scores/${DAY}_alice`), { uid: 'alice', name: 'Alice', day: DAY, week: Math.floor(DAY / 7), theme: 'Phrase', points: 300, solved: true, secs: 50, ts: new Date() });
  await setDoc(doc(db, 'comments/c1'), { uid: 'alice', name: 'Alice', day: DAY, text: 'Got it in one!', ts: new Date() });
  await setDoc(doc(db, 'comments/old'), { uid: 'bob', name: 'Bob', day: DAY - 3, text: 'Old day', ts: new Date() });
});
const as = uid => env.authenticatedContext(uid).firestore();
const anon = env.unauthenticatedContext().firestore();
const A = as('alice'), B = as('bob'), M = as('mod');
const today = db => query(collection(db, 'comments'), where('day', '==', DAY));

console.log('--- reading the chat (no spoilers)');
await t('finished player can read today\'s chat', () => assertSucceeds(getDocs(today(A))));
await t('player who has not finished cannot read it', () => assertFails(getDocs(today(B))));
await t('signed-out visitor cannot read it', () => assertFails(getDocs(today(anon))));
await t('finished player cannot open one comment from a day they did not play', () => assertFails(getDoc(doc(A, 'comments/old'))));
await t('player who has not finished cannot open a single comment', () => assertFails(getDoc(doc(B, 'comments/c1'))));
await t('nobody can list every day at once', () => assertFails(getDocs(collection(A, 'comments'))));
await t('moderator can read today without playing', () => assertSucceeds(getDocs(today(M))));
await t('moderator can read an earlier day', () => assertSucceeds(getDocs(query(collection(M, 'comments'), where('day', '==', DAY - 3)))));

console.log('--- posting');
const post = (db, uid, name, extra = {}) => addDoc(collection(db, 'comments'), { uid, name, day: DAY, text: 'Nice one', ts: serverTimestamp(), ...extra });
await t('finished player can post', () => assertSucceeds(post(A, 'alice', 'Alice')));
await t('280 characters is allowed', () => assertSucceeds(post(A, 'alice', 'Alice', { text: 'x'.repeat(280) })));
await t('281 characters is refused', () => assertFails(post(A, 'alice', 'Alice', { text: 'x'.repeat(281) })));
await t('empty comment is refused', () => assertFails(post(A, 'alice', 'Alice', { text: '' })));
await t('cannot post under someone else\'s nickname', () => assertFails(post(A, 'alice', 'Bob')));
await t('cannot post as another player', () => assertFails(post(A, 'bob', 'Bob')));
await t('cannot post on a day you have not finished', () => assertFails(post(A, 'alice', 'Alice', { day: DAY + 1 })));
await t('cannot fake the time', () => assertFails(post(A, 'alice', 'Alice', { ts: new Date(2020, 0, 1) })));
await t('cannot add extra fields', () => assertFails(post(A, 'alice', 'Alice', { colour: 'red' })));
await t('player who has not finished cannot post', () => assertFails(post(B, 'bob', 'Bob')));
await t('signed-out visitor cannot post', () => assertFails(post(anon, 'x', 'X')));
await t('comments cannot be edited', () => assertFails(setDoc(doc(A, 'comments/c1'), { text: 'changed' }, { merge: true })));

console.log('--- deleting');
await env.withSecurityRulesDisabled(async c => { const db = c.firestore(); await setDoc(doc(db, 'comments/a2'), { uid: 'alice', name: 'Alice', day: DAY, text: 'two', ts: new Date() }); await setDoc(doc(db, 'comments/a3'), { uid: 'alice', name: 'Alice', day: DAY, text: 'three', ts: new Date() }) });
await t('player cannot delete someone else\'s comment', () => assertFails(deleteDoc(doc(B, 'comments/a2'))));
await t('player can delete their own comment', () => assertSucceeds(deleteDoc(doc(A, 'comments/a2'))));
await t('moderator can delete anyone\'s comment', () => assertSucceeds(deleteDoc(doc(M, 'comments/a3'))));

console.log('--- reporting');
const rep = (db, by, id = `c1_${by}`) => setDoc(doc(db, 'reports', id), { cid: 'c1', day: DAY, uid: 'alice', name: 'Alice', text: 'Got it in one!', by, ts: serverTimestamp() });
await t('anyone signed in can report a comment', () => assertSucceeds(rep(B, 'bob')));
await t('cannot report in someone else\'s name', () => assertFails(rep(B, 'alice', 'c1_alice')));
await t('report must use the right id', () => assertFails(rep(B, 'bob', 'whatever')));
await t('signed-out visitor cannot report', () => assertFails(rep(anon, 'x', 'c1_x')));
await t('players cannot see reports', () => assertFails(getDocs(collection(A, 'reports'))));
await t('moderator can see all reports (including earlier days)', () => assertSucceeds(getDocs(collection(M, 'reports'))));
await t('players cannot remove a report', () => assertFails(deleteDoc(doc(B, 'reports/c1_bob'))));
await t('moderator can "Keep it" (remove the report)', () => assertSucceeds(deleteDoc(doc(M, 'reports/c1_bob'))));

console.log('--- stopping a nickname posting');
await t('players cannot ban anyone', () => assertFails(setDoc(doc(A, 'bans/bob'), { name: 'Bob', ts: serverTimestamp() })));
await t('moderator can stop a nickname posting', () => assertSucceeds(setDoc(doc(M, 'bans/alice'), { name: 'Alice', ts: serverTimestamp() })));
await t('stopped player cannot post', () => assertFails(post(A, 'alice', 'Alice')));
await t('stopped player can still read the chat', () => assertSucceeds(getDocs(today(A))));
await t('player can see they have been stopped', () => assertSucceeds(getDoc(doc(A, 'bans/alice'))));
await t('others cannot see who has been stopped', () => assertFails(getDoc(doc(B, 'bans/alice'))));
await t('moderator can let them post again', () => assertSucceeds(deleteDoc(doc(M, 'bans/alice'))));
await t('and then they can post again', () => assertSucceeds(post(A, 'alice', 'Alice')));

console.log('--- the existing game rules still work');
await t('a new player can save today\'s score', async () => {
  const bt = writeBatch(B);
  bt.set(doc(B, `scores/${DAY}_bob`), { uid: 'bob', name: 'Bob', day: DAY, week: Math.floor(DAY / 7), theme: 'Phrase', points: 250, solved: true, secs: 70, ts: serverTimestamp() });
  bt.set(doc(B, 'players/bob'), { name: 'Bob', total: 250, played: 1, last: DAY });
  await assertSucceeds(bt.commit());
});
await t('…and can then read the chat', () => assertSucceeds(getDocs(today(B))));
await t('scores can\'t be posted twice in a day', async () => {
  const bt = writeBatch(B);
  bt.set(doc(B, `scores/${DAY}_bob`), { uid: 'bob', name: 'Bob', day: DAY, week: Math.floor(DAY / 7), theme: 'Phrase', points: 999, solved: true, secs: 70, ts: serverTimestamp() });
  bt.set(doc(B, 'players/bob'), { name: 'Bob', total: 1249, played: 2, last: DAY });
  await assertFails(bt.commit());
});
await t('leaderboards are still public', () => assertSucceeds(getDocs(query(collection(anon, 'scores'), where('day', '==', DAY)))));
await t('My stats query (your own scores) works', () => assertSucceeds(getDocs(query(collection(B, 'scores'), where('uid', '==', 'bob')))));

await env.cleanup();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
