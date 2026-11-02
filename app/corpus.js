/* Kosmo — uvoz projekta iz 3D Corpusa (datoteka .S3D).
   Datoteka vsebuje elemente (<ELEMENT>, vgnezdeni <ELM>) s položajem in zasukom ter plošče (<AD>)
   s smerjo (SMJER), merami, kodo programa (PROGRAM = QR na etiketi) in robnim trakom (<POTITEM> STR0..STR3).
   Enote mm. Koordinate: X desno, Y gor, Z proti gledalcu (lice elementa je pri z = 0, globina gre v -Z). */
(function (root) {
  "use strict";
  const r1 = v => Math.round(v * 10) / 10;
  const attr = (s, k) => { const m = s.match(new RegExp("\\b" + k + '="([^"]*)"')); return m ? decodeEnt(m[1]) : ""; };
  const num = (s, k) => { const v = parseFloat(attr(s, k).replace(",", ".")); return isFinite(v) ? v : 0; };
  function decodeEnt(s) { return s.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)); }

  // 4x4 kot [R(3x3), t] — samo zasuk okoli Y in premik
  const ident = () => ({ c: 1, s: 0, t: [0, 0, 0] });
  function compose(P, x, y, z, kutDeg) {
    const a = kutDeg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const t = apply(P, [x, y, z]);
    return { c: P.c * c - P.s * s, s: P.s * c + P.c * s, t };
  }
  function apply(T, p) { return [T.c * p[0] + T.s * p[2] + T.t[0], p[1] + T.t[1], -T.s * p[0] + T.c * p[2] + T.t[2]]; }
  function rotDir(T, d) { return [T.c * d[0] + T.s * d[2], d[1], -T.s * d[0] + T.c * d[2]]; }

  function parseS3D(text) {
    const tagRe = /<(\/?)([A-Z][A-Z0-9_]*)\b([^>]*?)(\/?)>/g;
    const stack = [{ T: ident(), name: "", top: "", eid: 0 }];
    const panels = [], extras = [], hw = [];
    let nEl = 0;
    let m, curAD = null;
    while ((m = tagRe.exec(text))) {
      const [, close, tag, attrs, selfClose] = m;
      if (tag === "ELEMENT" || tag === "ELM") {
        if (close) { if (stack.length > 1) stack.pop(); continue; }
        const P = stack[stack.length - 1];
        const T = compose(P.T, num(attrs, "EXPOX"), num(attrs, "EYPOS"), num(attrs, "EZPOS"), num(attrs, "EKUT"));
        const name = attr(attrs, "ENAME");
        const isTop = tag === "ELEMENT";
        stack.push({ T, name, top: isTop ? name : P.top, eid: isTop ? ++nEl : P.eid });
        continue;
      }
      if (tag === "AD") {
        if (close) { if (curAD) { finishAD(curAD); curAD = null; } continue; }
        const E = stack[stack.length - 1];
        curAD = { a: attrs, E, bands: [] };
        if (selfClose) { finishAD(curAD); curAD = null; }
        continue;
      }
      if (tag === "POTITEM" && attr(attrs, "TIP") === "1") {   // okovje (vodila, okvirji, nosilci ...)
        const E = stack[stack.length - 1];
        if (E.eid) hw.push({ eid: E.eid, sub: E.name, y: r1(E.T.t[1]), name: attr(attrs, "NAZIV"), qty: Math.max(1, Math.round(num(attrs, "KOMADA")) || 1) });
        continue;
      }
      if (tag === "POTITEM" && curAD) {
        const sides = ["STR0", "STR1", "STR2", "STR3"].filter(k => attr(attrs, k) === "true");
        curAD.bands.push({ sides, name: attr(attrs, "NAZIV") });
      }
    }
    function finishAD(ad) {
      const a = ad.a, E = ad.E;
      if (attr(a, "VISIBLE") === "false") return;
      const V = num(a, "VISINA"), D = num(a, "DUBINA"), T = num(a, "DEBLJINA");
      const x = num(a, "DXPOS"), y = num(a, "DYPOS"), z = num(a, "DZPOS"), smer = Math.round(num(a, "SMJER"));
      if (!(V > 0 && D > 0 && T > 0)) return;
      // lokalni kvader in robovi (STR0..3) glede na smer plošče
      let mn, mx, edges;
      if (smer === 0) {        // stranica: višina po Y, globina v -Z, debelina po +X
        mn = [x, y, z - D]; mx = [x + T, y + V, z];
        edges = { STR0: [1, -1], STR1: [1, 1], STR2: [2, 1], STR3: [2, -1] };   // [os odmika, smer]
      } else if (smer === 1) { // fronta / hrbet: višina po Y, širina po X, debelina po +Z
        mn = [x, y, z]; mx = [x + D, y + V, z + T];
        edges = { STR0: [1, -1], STR1: [1, 1], STR2: [0, -1], STR3: [0, 1] };
      } else {                 // vodoravna: širina po X, globina v -Z, debelina po +Y
        mn = [x, y, z - D]; mx = [x + V, y + T, z];
        edges = { STR0: [0, -1], STR1: [0, 1], STR2: [2, 1], STR3: [2, -1] };
      }
      const cs = []; for (const px of [mn[0], mx[0]]) for (const py of [mn[1], mx[1]]) for (const pz of [mn[2], mx[2]]) cs.push(apply(E.T, [px, py, pz]));
      const wmn = [0, 1, 2].map(i => Math.min(...cs.map(c => c[i]))), wmx = [0, 1, 2].map(i => Math.max(...cs.map(c => c[i])));
      const bands = [];
      for (const b of ad.bands) {
        if (/EMBALA/i.test(b.name) || !b.name) continue;
        for (const s of b.sides) { const e = edges[s]; if (!e) continue; const d = [0, 0, 0]; d[e[0]] = e[1]; bands.push({ dir: rotDir(E.T, d), name: b.name }); }
      }
      const tip = Math.round(num(a, "TIPDASKE"));
      const item = { name: attr(a, "DNAME"), element: E.top || E.name, eid: E.eid, sub: E.name, program: attr(a, "PROGRAM"),
        mat: (attr(a, "MATNAME") || "").replace(/^EGGER_[A-Z]+_(IV_)?/, ""), mn: wmn, mx: wmx, bands, tip, T };
      if (tip === 14) extras.push(item); else panels.push(item);
    }
    return { panels, extras, hw };
  }

  // okovje po elementih: vodila (z NL) od spodaj navzgor in seznam vsega okovja
  function hardware(hw) {
    const names = [], ix = n => { let i = names.indexOf(n); if (i < 0) { names.push(n); i = names.length - 1; } return i; };
    const byEl = {};
    for (const h of hw) {
      if (!h.name) continue;
      const base = h.name.replace(/_L$/, "");
      const e = byEl[h.eid] || (byEl[h.eid] = { r: [], i: {} });
      e.i[base] = (e.i[base] || 0) + h.qty;
      if (/_L$/.test(h.name)) continue;                       // levi in desni del para štejemo enkrat
      if (/vodil|runner|schiene|tandem|movento|legrabox|quadro/i.test(base) && /NL\s*=\s*\d+/i.test(base) && !/okvir|zarge|frame/i.test(base))
        e.r.push([h.y, ix(base), h.sub]);
    }
    const out = {};
    for (const [k, e] of Object.entries(byEl)) {
      e.r.sort((a, b) => a[0] - b[0]);
      out[k] = { r: e.r, i: Object.entries(e.i).map(([n, q]) => [ix(n), q]) };
    }
    return { hwN: names, hw: out };
  }

  function buildProject(parsed, name) {
    const box = o => ({ size: [r1(o.mx[0] - o.mn[0]), r1(o.mx[1] - o.mn[1]), r1(o.mx[2] - o.mn[2])], pos: [0, 1, 2].map(i => r1((o.mn[i] + o.mx[i]) / 2)) });
    const parts = []; let n = 0;
    const colorFor = (m, nm) => /OREH|ORE[HŠ]/i.test(m) ? "#8A5A3B" : /BRONZE/i.test(m) ? "#A8835A" : /EMBALA/i.test(m) ? "#C9B99A" : /U961/i.test(m) ? "#3B3E42" : /FRONT|FR\b|FR\./i.test(nm) ? "#ECEAE6" : "#D9D3C7";
    for (const p of parsed.panels) {
      const d = [0, 1, 2].map(i => p.mx[i] - p.mn[i]);
      const ta = [0, 1, 2].sort((a, b) => d[a] - d[b])[0];
      const ord = [0, 1, 2].filter(i => i !== ta).sort((a, b) => d[b] - d[a]), La = ord[0], Wa = ord[1];
      // robovi v svetu -> L1/L2 (dolga robova, ob +/- strani osi širine) in W1/W2 (kratka, ob +/- strani osi dolžine)
      const es = {};
      for (const b of p.bands) {
        const ax = [0, 1, 2].reduce((best, i) => Math.abs(b.dir[i]) > Math.abs(b.dir[best]) ? i : best, 0), sg = Math.sign(b.dir[ax]);
        if (ax === Wa) es[sg > 0 ? "L1" : "L2"] = b.name.replace(/\s*\(\s*\d+\s*\)/, "");
        else if (ax === La) es[sg > 0 ? "W1" : "W2"] = b.name.replace(/\s*\(\s*\d+\s*\)/, "");
      }
      n++;
      const code = p.program || `C-${String(n).padStart(3, "0")}`;
      parts.push({ code, name: p.name || "KOS", element: p.element || "BREZ ELEMENTA", el: p.eid || undefined, note: p.sub && p.sub !== p.element ? p.sub : undefined,
        L: r1(d[La]), W: r1(d[Wa]), T: r1(d[ta]), ...box(p), mat: "_", color: colorFor(p.mat, p.name), matText: p.mat || "–",
        edges: Object.entries(es).map(([k, v]) => `${k}: ${v}`).join(" / ") || "brez robnega traku", es, noLabel: !p.program || undefined });
    }
    const extras = parsed.extras.map(e => ({ k: "hw", ...box(e), color: "#ACAEBA" }));
    parts.sort((a, b) => a.element < b.element ? -1 : a.element > b.element ? 1 : a.name < b.name ? -1 : 1);
    const withCode = parts.filter(p => !p.noLabel).length;
    return { name: name || "Projekt", program: "3D Corpus", createdAt: Date.now(), parts, extras, ...hardware(parsed.hw || []),
      note: `3D Corpus: ${parts.length} kosov, ${withCode} s kodo z etikete (QR).` };
  }

  const api = { parseS3D, buildProject, hardware };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.CorpusImport = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
