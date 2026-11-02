/* Kje je kos — uvoz 3D modela iz Mega Tischlerja / MegaCAD (ACIS .SAT, besedilna oblika).
   Iz vsakega telesa (body) prebere obliko, položaj in ime; plošče (Kvader) postanejo kosi,
   okovje in stene pa ostanejo kot okolica. Enote: mm. Koordinate aplikacije: X desno, Y gor, Z proti gledalcu. */
(function (root) {
  "use strict";

  function parseSat(text, onProgress) {
    text = text.replace(/\r\n?/g, "\n");
    const headEnd = nthIndex(text, "\n", 3);
    const head = text.slice(0, headEnd).split("\n");
    const declared = parseInt((head[0] || "").trim().split(/\s+/)[2], 10);
    const recs = text.slice(headEnd + 1).split(/#[ \t]*\n/).map(r => r.trim()).filter(r => r && !r.startsWith("End-of-ACIS"));
    const ptrCache = new Array(recs.length);
    const typ = i => recs[i].slice(0, recs[i].indexOf(" ") < 0 ? undefined : recs[i].indexOf(" "));
    function ptrs(i) {
      let p = ptrCache[i];
      if (p) return p;
      p = []; const r = stripStrings(recs[i]); const re = /\$(-?\d+)/g; let m;
      while ((m = re.exec(r))) p.push(+m[1]);
      ptrCache[i] = p; return p;
    }
    function strings(i) {
      const out = [], r = recs[i]; const re = /@(\d+) /g; let m;
      while ((m = re.exec(r))) { const L = +m[1], s = m.index + m[0].length; out.push(r.substr(s, L)); re.lastIndex = s + L; }
      return out;
    }
    function nums(i) { return stripStrings(recs[i]).split(/\s+/).filter(t => /^-?\d*\.?\d+(e[-+]?\d+)?$/i.test(t)).map(Number); }

    // število teles: iz glave, sicer preštej zapise "body" na začetku
    let NB = declared > 0 && declared <= recs.length ? declared : 0;
    if (!NB) { while (NB < recs.length && /(^|\s)body\s/.test(recs[NB].slice(0, 200))) NB++; }

    function attrChain(first) {
      const out = []; let a = first, g = 0;
      while (a != null && a >= 0 && g++ < 200) { out.push(a); const p = ptrs(a); a = p.length > 1 ? p[1] : null; }
      return out;
    }
    function bodyAttrs(b) {
      const o = {};
      for (const a of attrChain(ptrs(b)[0])) { const s = strings(a); if (s.length >= 2) o[s[0]] = s[1]; else if (s.length === 1) o[s[0]] = ""; }
      return o;
    }
    function rgbOf(a) { const n = nums(a).slice(-3); return n.length === 3 ? n.map(v => Math.round(v * 255)) : null; }

    const bodies = [];
    for (let b = 0; b < NB; b++) {
      if (onProgress && b % 200 === 0) onProgress(b / NB);
      const bp = ptrs(b);
      const name = (bodyAttrs(b).ATTRIB_XACIS_NAME || "").trim();
      if (name === "Valj") continue;                                  // mozniki, vijaki, luknje
      const lumpFirst = bp[2], tr = bp[4];
      const pts = [], paths = new Map(), cols = new Map();
      const addCol = (c, w) => { if (c) { const k = c.join(","); cols.set(k, (cols.get(k) || 0) + w); } };
      for (let lump = lumpFirst, g1 = 0; lump != null && lump >= 0 && g1++ < 100;) {
        const lp = ptrs(lump);
        for (const a of attrChain(lp[0])) if (recs[a].startsWith("rgb_color")) addCol(rgbOf(a), 1000);
        for (let shell = lp[3], g2 = 0; shell != null && shell >= 0 && g2++ < 1000;) {
          const sp = ptrs(shell);
          for (let face = sp[4], g3 = 0; face != null && face >= 0 && g3++ < 100000;) {
            const fp = ptrs(face);
            for (const a of attrChain(fp[0])) {
              const r = recs[a];
              if (r.startsWith("rgb_color")) addCol(rgbOf(a), 1);
              else if (r.indexOf("FullPath") >= 0) {
                const s = strings(a); const v = (s[1] || "").replace(/\.Razlika.*$/, "");
                paths.set(v, (paths.get(v) || 0) + 1);
              }
            }
            for (let loop = fp[3], g4 = 0; loop != null && loop >= 0 && g4++ < 10000;) {
              const lpp = ptrs(loop); const start = lpp[3];
              for (let ce = start, g5 = 0; ce != null && ce >= 0 && g5++ < 5000;) {
                const cp = ptrs(ce), ep = ptrs(cp[5]);
                for (const v of [ep[2], ep[3]]) if (v != null && v >= 0) { const pn = nums(ptrs(v).slice(-1)[0]).slice(-3); if (pn.length === 3) pts.push(pn); }
                ce = cp[2]; if (ce === start) break;
              }
              loop = lpp[2];
            }
            face = fp[2];
          }
          shell = sp[2];
        }
        lump = lp[2];
      }
      if (!pts.length) continue;
      const mn = [0, 1, 2].map(i => Math.min(...pts.map(p => p[i]))), mx = [0, 1, 2].map(i => Math.max(...pts.map(p => p[i])));
      let T = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1];
      if (tr != null && tr >= 0 && typ(tr) === "transform") { const n = nums(tr); if (n.length >= 13) T = n.slice(-13); }
      const corners = [];
      for (const x of [mn[0], mx[0]]) for (const y of [mn[1], mx[1]]) for (const z of [mn[2], mx[2]]) corners.push(applyT([x, y, z], T));
      const wmn = [0, 1, 2].map(i => Math.min(...corners.map(c => c[i]))), wmx = [0, 1, 2].map(i => Math.max(...corners.map(c => c[i])));
      bodies.push({ kind: name, mn: wmn, mx: wmx, color: top(cols), path: top(paths) });
    }
    if (onProgress) onProgress(1);
    return bodies;
  }
  function applyT(p, t) { // ACIS: točka kot vrstica, krat 3x3, plus premik, krat merilo
    const v = [0, 1, 2].map(j => p[0] * t[j] + p[1] * t[3 + j] + p[2] * t[6 + j]);
    return v.map((x, j) => x * t[12] + t[9 + j]);
  }
  function top(m) { let best = null, bv = -1; for (const [k, v] of m) if (v > bv) { best = k; bv = v; } return best; }
  function stripStrings(r) { // odstrani besedila @N ... (lahko vsebujejo presledke in $)
    let out = "", i = 0; const re = /@(\d+) /g; let m;
    while ((m = re.exec(r))) { out += r.slice(i, m.index) + " "; i = m.index + m[0].length + (+m[1]); re.lastIndex = i; }
    return out + r.slice(i);
  }
  function nthIndex(s, ch, n) { let i = -1; while (n-- > 0) { i = s.indexOf(ch, i + 1); if (i < 0) return s.length; } return i; }

  /* Iz teles sestavi projekt: elementi po številkah iz Mega Tischlerja, imena kosov, okovje in stene. */
  function buildProject(bodies, name) {
    const r1 = v => Math.round(v * 10) / 10;
    const panels = bodies.filter(o => o.kind === "Kvader");
    const elBox = {};
    for (const o of panels) {
      const m = o.path && o.path.match(/^(\d+)\./); if (!m) continue;
      const b = elBox[m[1]] || (elBox[m[1]] = [o.mn.slice(), o.mx.slice()]);
      for (let i = 0; i < 3; i++) { b[0][i] = Math.min(b[0][i], o.mn[i]); b[1][i] = Math.max(b[1][i], o.mx[i]); }
    }
    const center = o => [0, 1, 2].map(i => (o.mn[i] + o.mx[i]) / 2);
    function findEl(o) {
      const c = center(o), pad = [40, 120, 40]; let best = null;
      for (const [e, [mn, mx]] of Object.entries(elBox)) {
        if ([0, 1, 2].every(i => mn[i] - pad[i] <= c[i] && c[i] <= mx[i] + pad[i])) {
          const vol = (mx[0] - mn[0]) * (mx[1] - mn[1]) * (mx[2] - mn[2]);
          if (!best || vol < best[1]) best = [e, vol];
        }
      }
      return best && best[0];
    }
    function pathName(path) {
      const s = path.split(".").slice(1).join(".");
      if (/Stranica/.test(s)) return "STRANICA " + (/L$/.test(s) ? "L" : /D$/.test(s) ? "D" : "").trim();
      if (/Legrabox/.test(s) && /Dno$/.test(s)) return "DNO PREDALA";
      if (/Legrabox/.test(s) && /Zadaj$/.test(s)) return "ZADNJA STRANICA PREDALA";
      if (/Podno/.test(s)) return "PODNOŽJE";
      return (s.split(".").pop() || "KOS").toUpperCase();
    }
    const parts = [], counters = {};
    for (const o of panels) {
      let e = null, nm = null;
      if (o.path && /^(\d+)\./.test(o.path)) { e = o.path.match(/^(\d+)\./)[1]; nm = pathName(o.path); }
      else e = findEl(o);
      const d = [0, 1, 2].map(i => o.mx[i] - o.mn[i]);
      const ta = [0, 1, 2].sort((a, b) => d[a] - d[b])[0];
      if (!nm) {
        if (e && elBox[e]) {
          const [mn, mx] = elBox[e], c = center(o);
          if (ta === 0) nm = "STRANICA";
          else if (ta === 2) {
            const rel = (c[2] - mn[2]) / Math.max(mx[2] - mn[2], 1);
            nm = Math.min(d[0], d[1]) <= 130 ? "VEZNA LETEV" : rel < .15 ? "DNO" : rel > .85 ? "STROP" : "POLICA";
          } else nm = c[1] <= mn[1] + 30 ? "FRONTA" : c[1] >= mx[1] - 40 ? "HRBET" : "PREGRADA";
        } else nm = ["STRANICA", "PLOŠČA", "VODORAVNA PLOŠČA"][ta];
      }
      const eid = e || "00"; counters[eid] = (counters[eid] || 0) + 1;
      const LW = [0, 1, 2].filter(i => i !== ta).map(i => d[i]).sort((a, b) => b - a);
      parts.push({
        code: `E${eid}-${String(counters[eid]).padStart(2, "0")}`, name: nm, element: e ? `ELEMENT ${eid}` : "BREZ ELEMENTA",
        L: r1(LW[0]), W: r1(LW[1]), T: r1(d[ta]),
        size: [r1(d[0]), r1(d[2]), r1(d[1])], pos: [r1((o.mn[0] + o.mx[0]) / 2), r1((o.mn[2] + o.mx[2]) / 2), r1(-(o.mn[1] + o.mx[1]) / 2)],
        mat: "_", color: nm === "FRONTA" ? "#ECEAE6" : "#DAD6CF", matText: `plošča ${String(r1(d[ta])).replace(".", ",")} mm`, edges: "", esUnknown: true
      });
    }
    // kosi brez elementa: gruče plošč, ki se dotikajo
    const un = parts.filter(p => p.element === "BREZ ELEMENTA"), par = un.map((_, i) => i);
    const fnd = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
    const bb = p => [p.pos.map((v, i) => v - p.size[i] / 2), p.pos.map((v, i) => v + p.size[i] / 2)];
    for (let i = 0; i < un.length; i++) { const [a0, a1] = bb(un[i]);
      for (let j = i + 1; j < un.length; j++) { const [b0, b1] = bb(un[j]);
        if ([0, 1, 2].every(k => a0[k] - 6 <= b1[k] && b0[k] - 6 <= a1[k])) par[fnd(i)] = fnd(j); } }
    const groups = new Map(); un.forEach((p, i) => { const g = fnd(i); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(p); });
    [...groups.values()].sort((a, b) => Math.min(...a.map(p => p.pos[0])) - Math.min(...b.map(p => p.pos[0])))
      .forEach((ps, n) => ps.forEach((p, k) => { p.element = "SKLOP " + (n < 26 ? String.fromCharCode(65 + n) : n + 1); p.code = `S${String(n + 1).padStart(2, "0")}-${String(k + 1).padStart(2, "0")}`; }));
    parts.sort((a, b) => a.element < b.element ? -1 : a.element > b.element ? 1 : (a.pos[1] - b.pos[1]) || (a.pos[0] - b.pos[0]));
    const extras = [];
    for (const o of bodies) {
      if (o.kind === "Kvader") continue;
      const d = [0, 1, 2].map(i => o.mx[i] - o.mn[i]); if (Math.min(...d) < 1) continue;
      const k = o.kind === "Ravna prizma" ? "wall" : "hw";
      const col = k === "hw" ? (o.color ? "#" + o.color.split(",").map(v => (+v).toString(16).padStart(2, "0")).join("").toUpperCase() : "#ACAEBA") : "#2A2F35";
      extras.push({ k, size: [r1(d[0]), r1(d[2]), r1(d[1])], pos: [r1((o.mn[0] + o.mx[0]) / 2), r1((o.mn[2] + o.mx[2]) / 2), r1(-(o.mn[1] + o.mx[1]) / 2)], color: col });
    }
    return { name: name || "Projekt", program: "Mega Tischler", createdAt: Date.now(), parts, extras,
      note: "3D iz Mega Tischlerja (SAT). Kode kosov so začasne, dokler ne uvoziš kosovnice z etiket." };
  }

  const api = { parseSat, buildProject };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.SatImport = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
