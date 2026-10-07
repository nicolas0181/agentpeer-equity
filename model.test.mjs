// Tests du modèle du simulateur. Lancer : node model.test.mjs [index.html|en.html]
// Le code du modèle est extrait de la page elle-même : on teste exactement ce qui est en ligne.
import fs from "node:fs";
import assert from "node:assert/strict";

const file = process.argv[2] || new URL("./index.html", import.meta.url).pathname;
const html = fs.readFileSync(file, "utf8");
const model = html.split("<script>\n// ============================================================ mod")[1].split("// ============================================================ interface")[0];
const fair = html.slice(html.indexOf("function fairCalc"), html.indexOf("let fairKey"));
const M = new Function(model.replace(/^[^\n]*\n/, "") + "\n" + fair +
  ";return {defaultParams,simulate,calibrate,paths,proceeds,waterfall,monteCarlo,fTot,FN,POOL,SECOND,STAGES,RS,PATHS,fairCalc,roundSplit,clone};")();
const { defaultParams, simulate, calibrate, paths, waterfall, monteCarlo, fTot, FN, POOL, SECOND, STAGES, RS, PATHS, fairCalc, roundSplit, clone } = M;

let n = 0, failed = 0;
function test(name, fn) { n++; try { fn(); console.log("  ✓ " + name); } catch (e) { failed++; console.log("  ✗ " + name + "\n    " + e.message); } }
const close = (a, b, tol = 1e-9, msg = "") => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg} ${a} ≠ ${b}`);
const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
const [PRE, SEED, A, B, C, D] = STAGES;
const F0 = FN[0], F1 = FN[1], F2 = FN[2], FUT = FN[3];

// paramètres "propres" pour les calculs à la main : pas de pool, pas de bridge, parcours propre, pas de pré-seed
function clean(extra = {}) {
  const P = defaultParams();
  Object.assign(P, { pool_on: false, bridge_on: false, path_mode: PATHS[1], preseed_mode: P.preseed_mode, condition_preseed: false, frictions: {} });
  P.founders = { [F0]: 50, [F1]: 50, [F2]: 0, [FUT]: 0 };
  return Object.assign(P, extra);
}
const safeKey = o => Object.keys(o).find(k => /^SAFE.*pr[ée]-seed/i.test(k)); // libellé FR ou EN
function rng(seed) { let a = seed; return () => { a = (a * 1664525 + 1013904223) % 4294967296; return a / 4294967296; }; }

console.log("Modèle — " + file);

test("les parts font toujours 100 % (300 combinaisons aléatoires)", () => {
  const r = rng(42);
  for (let k = 0; k < 300; k++) {
    const P = defaultParams(); P.frictions = calibrate(P.sector);
    P.founders = { [F0]: 10 + 40 * r(), [F1]: 10 + 40 * r(), [F2]: 10 + 40 * r(), [FUT]: 20 * r() };
    P.path_mode = PATHS[r() < .5 ? 0 : 1]; P.pool_on = r() < .8; P.pool_mode = r() < .5 ? "pre" : "post"; P.bridge_on = r() < .5; P.ext_on = r() < .3;
    P.seed_mode = r() < .3 ? "SAFE" : P.seed_mode; P.sec_on = r() < .3; P.antidil = ["none", "broad", "ratchet"][Math.floor(r() * 3)];
    if (r() < .3) { P.down_stage = RS[1 + Math.floor(r() * 3)]; P.down_factor = .4 + .5 * r(); }
    if (r() < .3) P.ref_who = FN[Math.floor(r() * 4)];
    if (r() < .3) { P.leaver = FN[Math.floor(r() * 3)]; P.leave_month = Math.floor(60 * r()); P.leaver_type = r() < .5 ? "good" : "bad"; }
    P.fut_mode = r() < .5 ? "join" : "reserve"; P.last_stage = STAGES[1 + Math.floor(r() * 5)];
    const z = {}; RS.forEach(s => z[s] = 2 * (r() - .5) * 2);
    for (const sn of simulate(P, z)) {
      close(sum(sn.own), 1, 1e-9, sn.stage);
      for (const v of Object.values(sn.own)) assert.ok(v >= -1e-12, "part négative");
    }
  }
});

test("cascade de sortie : la somme versée = prix de vente, rien de négatif", () => {
  const P = defaultParams(); P.frictions = calibrate(P.sector); const s = paths(P).P50.at(-1);
  for (const part of [false, true]) for (const sen of ["pari passu", "stacked"]) for (const E of [0, 5, 50, 150, 400, 2000]) {
    const pr = waterfall(s.own, s.invested, E, 1, part, sen);
    close(sum(pr), E, 1e-7, `E=${E} part=${part} ${sen}`);
    for (const v of Object.values(pr)) assert.ok(v >= -1e-9);
  }
});

test("cascade : pour une très grosse vente, chacun touche sa part (non participatif)", () => {
  const P = defaultParams(); P.frictions = calibrate(P.sector); const s = paths(P).P50.at(-1);
  const E = 1e6, pr = waterfall(s.own, s.invested, E);
  for (const h in s.own) close(pr[h] || 0, s.own[h] * E, 1e-6, h);
});

test("cascade : ce que touchent les founders ne baisse jamais quand le prix monte", () => {
  const P = defaultParams(); P.frictions = calibrate(P.sector); const s = paths(P).P50.at(-1);
  let prev = -1; for (let E = 0; E <= 1500; E += 7.5) { const v = waterfall(s.own, s.invested, E)[F0]; assert.ok(v >= prev - 1e-9, "E=" + E); prev = v; }
});

test("SAFE post-money : 1 M$ sur un cap de 10 M$ = 10 % avant l'argent du seed", () => {
  const P = clean({ preseed_mode: "SAFE", preseed: Object.assign(defaultParams().preseed, { amount: 1, cap: 10 }), last_stage: SEED });
  P.rounds[SEED].post = 25; P.rounds[SEED].dil = .2; // pré-money 20 > cap
  const sn = simulate(P).at(-1);
  close(sn.own[safeKey(sn.own)], .1 * .8); close(sn.own[F0] + sn.own[F1], .9 * .8);
});

test("SAFE sous le cap : se convertit au prix du seed (1/8 si pré-money = 8)", () => {
  const P = clean({ preseed_mode: "SAFE", preseed: Object.assign(defaultParams().preseed, { amount: 1, cap: 10 }), last_stage: SEED });
  P.rounds[SEED].post = 10; P.rounds[SEED].dil = .2;
  { const o = simulate(P).at(-1).own; close(o[safeKey(o)], (1 / 8) * .8); }
});

test("plancher BSA AIR : conversion au plancher si le seed est plus bas", () => {
  const P = clean({ preseed_mode: "SAFE", preseed: Object.assign(defaultParams().preseed, { amount: 1, cap: 10 }), air_floor: 9, last_stage: SEED });
  P.rounds[SEED].post = 10; P.rounds[SEED].dil = .2;
  { const o = simulate(P).at(-1).own; close(o[safeKey(o)], (1 / 9) * .8); }
});

test("SAFE converti : garde sa préférence de liquidation", () => {
  const P = clean({ preseed_mode: "SAFE", preseed: Object.assign(defaultParams().preseed, { amount: 1, cap: 10 }), last_stage: SEED });
  { const i = simulate(P).at(-1).invested; close(i[safeKey(i)], 1); }
});

test("calcul à la main : 50/50, seed 20 %, Série A 20 % → founders 64 %", () => {
  const P = clean({ last_stage: A }); P.preseed = Object.assign(P.preseed, { amount: 1e-9, cap: 1e9 });
  P.rounds[SEED].dil = .2; P.rounds[A].dil = .2;
  close(fTot(simulate(P).at(-1)), .64, 1e-6);
});

test("pool rechargé en pré-money : le pool vaut exactement la cible après le tour", () => {
  const P = clean({ pool_on: true, pool_mode: "pre", last_stage: SEED }); P.preseed = Object.assign(P.preseed, { amount: 1e-6, cap: 1e9 });
  P.rounds[SEED].pool = .12; close(simulate(P).at(-1).own[POOL], .12, 1e-6);
});

test("good leaver au mois 24 (vesting 48, cliff 12) : garde la moitié", () => {
  const P = clean({ leaver: F1, leave_month: 24, leaver_type: "good", vest_months: 48, cliff: 12, last_stage: A }); P.preseed = Object.assign(P.preseed, { amount: 1e-6, cap: 1e9 });
  const o = simulate(P).at(-1).own; close(o[F0] / o[F1], 2, 1e-6);
});

test("bad leaver : perd tout", () => {
  const P = clean({ leaver: F1, leave_month: 24, leaver_type: "bad", last_stage: A }); P.preseed = Object.assign(P.preseed, { amount: 1e-6, cap: 1e9 });
  close(simulate(P).at(-1).own[F1], 0, 1e-12);
});

test("anti-dilution moyenne pondérée : identique au calcul à la main", () => {
  const P = clean({ last_stage: A, down_stage: A, down_factor: .5, antidil: "broad" }); P.preseed = Object.assign(P.preseed, { amount: 1e-12, cap: 1e12 });
  P.founders = { [F0]: 100, [F1]: 0, [F2]: 0, [FUT]: 0 };
  P.rounds[SEED].post = 10; P.rounds[SEED].dil = .2; P.rounds[A].post = 20; P.rounds[A].dil = .2;
  // à la main : seed -> N=1,25 action, prix 8 ; Série A : post 5, besoin 4 → d=0,45, levée 2,25, pré-money 2,75 → prix 2,2
  const N = 1.25, cp = 8, R = 2.25, p2 = 2.75 / N, shSeed = .25;
  const ncp = cp * (N + R / cp) / (N + R / p2), extra = shSeed * (cp / ncp - 1);
  const founders = (1 / N) * N / (N + extra) * (1 - .45);
  close(simulate(P).at(-1).own[F0], founders, 1e-9);
});

test("full ratchet : l'investisseur est recalculé au nouveau prix", () => {
  const P = clean({ last_stage: A, down_stage: A, down_factor: .5, antidil: "ratchet" }); P.preseed = Object.assign(P.preseed, { amount: 1e-12, cap: 1e12 });
  P.founders = { [F0]: 100, [F1]: 0, [F2]: 0, [FUT]: 0 };
  P.rounds[SEED].post = 10; P.rounds[SEED].dil = .2; P.rounds[A].post = 20; P.rounds[A].dil = .2;
  const N = 1.25, p2 = 2.75 / N, extra = .25 * (8 / p2 - 1);
  close(simulate(P).at(-1).own[F0], (1 / N) * N / (N + extra) * .55, 1e-9);
});

test("pas d'anti-dilution si le tour est plus cher", () => {
  const P = defaultParams(); P.frictions = calibrate(P.sector);
  assert.equal(paths(P).P50.at(-1).flags.length, 0);
});

test("vente secondaire : argent encaissé = actions vendues × prix du tour", () => {
  const P = clean({ sec_on: true, sec_stage: A, sec_pct: .1, last_stage: A }); P.preseed = Object.assign(P.preseed, { amount: 1e-6, cap: 1e9 });
  const before = (() => { const Q = clone(P); Q.sec_on = false; return simulate(Q).at(-1); })(), after = simulate(P).at(-1);
  close(after.cash[F0], before.own[F0] * .1 * after.post, 1e-9); close(after.own[SECOND], (before.own[F0] + before.own[F1]) * .1, 1e-9);
});

test("répartition juste : notes égales → parts égales ; « déjà fait » seul → au prorata des mois", () => {
  const fa = { w: [30, 25, 20, 15, 10], r: [[4, 4, 4, 0], [4, 4, 4, 0], [4, 4, 4, 0], [4, 4, 4, 0], [4, 4, 4, 0]], past: [0, 0, 0, 0], P: .1, incl_fut: false };
  fairCalc(fa, .1).share.forEach(x => close(x, 1 / 3, 1e-12));
  const fb = clone(fa); fb.past = [6, 3, 3, 0]; const s = fairCalc(fb, 1).share; close(s[0], .5); close(s[1], .25);
  const fc = clone(fa); fc.past = [6, 0, 0, 0]; const t = fairCalc(fc, .1).share; close(t[0], .9 / 3 + .1); // 40 / 30 / 30
  assert.deepEqual(roundSplit(t).slice(0, 3), [40, 30, 30]);
});

test("Monte Carlo : reproductible (même graine → mêmes résultats)", () => {
  const P = defaultParams(); P.frictions = calibrate(P.sector);
  const a = monteCarlo(P, 500, .7, .5), b = monteCarlo(P, 500, .7, .5);
  assert.deepEqual(Array.from(a.gross[F0]), Array.from(b.gross[F0]));
});

console.log(`\n${n - failed}/${n} tests réussis`);
process.exit(failed ? 1 : 0);
