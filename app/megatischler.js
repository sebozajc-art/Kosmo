/* Kje je kos — samodejni uvoz dokumentacije iz Mega Tischlerja.
   Iz zipa dokumentacije prebere:
   - DXF: 3D telesa (ACIS, zakodirana v DXF) in v kateri element (blok "NN_...") spada vsako telo,
   - etikete.pdf: kodo (npr. 09-62), ime kosa, element, material, mere in robni trak na vsaki stranici,
   nato vsako etiketo poveže s ploščo v istem elementu z enakimi merami. Enote mm. */
(function (root) {
  "use strict";
  const r1 = v => Math.round(v * 10) / 10;

  /* ---------- DXF: telesa po elementih ---------- */
  function parseDxf(text, onProgress) {
    const L = text.replace(/\r\n?/g, "\n").split("\n");
    const bodies = [], elNames = {}, inserts = {};
    let section = null, block = null;
    const dec = s => { let o = ""; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); o += c === 32 ? " " : String.fromCharCode(159 - c); } return o; };
    for (let i = 0; i + 1 < L.length; i += 2) {
      const code = L[i].trim(), val = L[i + 1];
      if (code !== "0") {
        if (code === "1" && /^\d{2} - /.test(val)) elNames[val.slice(0, 2)] = fixEnc(val.slice(5).trim());
        continue;
      }
      if (onProgress && i % 40000 === 0) onProgress(i / L.length);
      if (val === "SECTION") { section = L[i + 3] && L[i + 3].trim(); continue; }
      if (val === "BLOCK") { let j = i + 2; while (j + 1 < L.length && L[j].trim() !== "2") j += 2; block = L[j + 1] && L[j + 1].trim(); continue; }
      if (val === "ENDBLK") { block = null; continue; }
      if (val === "INSERT" && section === "ENTITIES") {
        const g = {}; let j = i + 2;
        while (j + 1 < L.length && L[j].trim() !== "0") { g[L[j].trim()] = L[j + 1].trim(); j += 2; }
        if (g["2"]) inserts[g["2"]] = { x: +g["10"] || 0, y: +g["20"] || 0, z: +g["30"] || 0, rot: (+g["50"] || 0) * Math.PI / 180, s: +g["41"] || 1 };
        continue;
      }
      if (val !== "BODY") continue;
      // zberi vrstice ACIS (koda 1, nadaljevanje 3) do naslednje entitete
      const lines = []; let j = i + 2;
      while (j + 1 < L.length && L[j].trim() !== "0") {
        const c = L[j].trim();
        if (c === "1") lines.push(L[j + 1]); else if (c === "3" && lines.length) lines[lines.length - 1] += L[j + 1];
        j += 2;
      }
      i = j - 2;
      const sat = lines.map(l => dec(l.replace(/\^ /g, "^"))).join("\n");   // "^ " je v DXF ubežni zapis za "^"
      const b = acisBody(sat);
      if (!b) continue;
      b.block = section === "BLOCKS" ? block : null;
      const m = b.block && b.block.match(/^(\d{2})_/);
      b.element = m ? m[1] : null;
      bodies.push(b);
    }
    // premik vstavljenih blokov (običajno v izhodišču)
    for (const b of bodies) {
      const ins = b.block && inserts[b.block]; if (!ins || (!ins.x && !ins.y && !ins.z && !ins.rot && ins.s === 1)) continue;
      const cs = corners(b.mn, b.mx).map(p => { const x = p[0] * ins.s, y = p[1] * ins.s, c = Math.cos(ins.rot), s = Math.sin(ins.rot); return [x * c - y * s + ins.x, x * s + y * c + ins.y, p[2] * ins.s + ins.z]; });
      [b.mn, b.mx] = bounds(cs);
    }
    if (onProgress) onProgress(1);
    return { bodies, elNames };
  }
  function fixEnc(s) { try { return decodeURIComponent(escape(s)); } catch (e) { return s; } } // UTF-8 bralno kot latin-1
  // eno telo: vse točke + transformacija + ime + barva (neodvisno od različice zapisa ACIS)
  function acisBody(sat) {
    const recs = sat.split(/#\s*\n?/);
    let name = "", T = null, color = null; const pts = [];
    for (const r0 of recs) {
      const r = r0.trim(); if (!r) continue;
      const sp = r.indexOf(" "), t = sp < 0 ? r : r.slice(0, sp);
      if (t === "point") { const n = nums(r).slice(-3); if (n.length === 3) pts.push(n); }
      else if (t === "transform" && !T) { const n = nums(r); if (n.length >= 13) T = n.slice(-13); }
      else if (t.startsWith("string_attrib") && r.indexOf("ATTRIB_XACIS_NAME") >= 0 && !name) {
        const m = r.match(/ATTRIB_XACIS_NAME @(\d+) /); if (m) name = r.substr(r.indexOf(m[0]) + m[0].length, +m[1]).trim();
      } else if (t.startsWith("rgb_color") && !color) { const n = nums(r).slice(-3); if (n.length === 3) color = n.map(v => Math.round(v * 255)); }
    }
    if (!pts.length) return null;
    const [mn, mx] = bounds(pts);
    const tr = T || [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1];
    const [wmn, wmx] = bounds(corners(mn, mx).map(p => applyT(p, tr)));
    // plošče: kvader in kvader z obdelavo (Razlika, Vsota, Prerez, Rez); valji so mozniki in luknje
    const n = name.toLowerCase();
    const kind = /^(kvader|razlika|vsota|prerez|rez)$/.test(n) ? "Kvader" : n === "valj" ? "Valj" : n === "ravna prizma" ? "Ravna prizma" : name || "3D objekt";
    return { kind, mn: wmn, mx: wmx, color };
  }
  function nums(r) { return r.replace(/@(\d+) [^@#]*/g, " ").split(/\s+/).filter(t => /^-?\d*\.?\d+(e[-+]?\d+)?$/i.test(t)).map(Number); }
  function applyT(p, t) { const v = [0, 1, 2].map(j => p[0] * t[j] + p[1] * t[3 + j] + p[2] * t[6 + j]); return v.map((x, j) => x * t[12] + t[9 + j]); }
  function corners(mn, mx) { const o = []; for (const x of [mn[0], mx[0]]) for (const y of [mn[1], mx[1]]) for (const z of [mn[2], mx[2]]) o.push([x, y, z]); return o; }
  function bounds(ps) { return [[0, 1, 2].map(i => Math.min(...ps.map(p => p[i]))), [0, 1, 2].map(i => Math.max(...ps.map(p => p[i])))]; }

  /* ---------- etikete.pdf (pdf.js) ---------- */
  async function parseLabelsPdf(pdfjs, data, onProgress) {
    const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
    const all = [];
    for (let pn = 1; pn <= doc.numPages; pn++) {
      if (onProgress) onProgress(pn / doc.numPages);
      const page = await doc.getPage(pn);
      const tc = await page.getTextContent();
      all.push(...labelsFromItems(tc.items));
    }
    return all;
  }
  // postavitev etikete glede na kodo (koordinate PDF, y navzgor), izmerjeno na etiketah Mega Tischler
  function labelsFromItems(items) {
    const it = items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str.trim(), x: i.transform[4], y: i.transform[5], rot: Math.abs(i.transform[1]) > 0.01 }));
    const num = s => parseFloat(String(s).replace(",", "."));
    const edge = s => { const m = s.match(/([\d.,]+)\s*mm\s*([A-Za-z]\S*)?/); return m ? [num(m[1]), m[2] || null] : null; };
    const out = [];
    for (const c of it) {
      if (c.rot || !/^\d{2}-\d{1,5}$/.test(c.s)) continue;
      const sel = (dxA, dxB, dyA, dyB, rot) => it.filter(i => i !== c && !!i.rot === !!rot && i.x - c.x >= dxA && i.x - c.x < dxB && i.y - c.y >= dyA && i.y - c.y < dyB).sort((a, b) => a.x - b.x);
      const mat = sel(40, 160, -2, 2).map(i => i.s).join(" ");
      const nl = sel(-3, 160, -14, -7);
      const name = nl.filter(i => i.x - c.x < 60).map(i => i.s).join(" ");
      const elem = nl.filter(i => i.x - c.x >= 60).map(i => i.s).join(" ");
      const dm = sel(-3, 60, -28, -19).map(i => i.s).join(" ").match(/([\d.,]+)\s*x\s*([\d.,]+)/);
      if (!dm) continue;
      const edges = {};
      const put = (k, arr) => { for (const i of arr) { const e = edge(i.s); if (e) { edges[k] = e; break; } } };
      put("L1", sel(15, 150, 7, 17)); put("L2", sel(15, 150, -63, -51));
      put("W1", sel(-18, -4, -55, -20, true)); put("W2", sel(140, 165, -55, -20, true));
      out.push({ code: c.s, name, element: elem, mat, L: num(dm[1]), W: num(dm[2]), edges });
    }
    return out;
  }

  /* ---------- povezava etiket s ploščami in projekt ---------- */
  function buildProject(bodies, elNames, labels, name) {
    const panels = bodies.filter(b => b.kind === "Kvader").map((b, i) => {
      const d = [0, 1, 2].map(k => b.mx[k] - b.mn[k]);
      return { ...b, idx: i, d, dims: d.slice().sort((a, x) => x - a) };
    });
    const used = new Set(), codeOf = new Map(), seen = new Set();
    const fits = (p, LW, tol) => Math.abs(p.dims[0] - LW[0]) <= tol && Math.abs(p.dims[1] - LW[1]) <= tol;
    const uniq = labels.filter(l => !seen.has(l.code) && seen.add(l.code));
    for (const pass of [1, 2]) {
      for (const l of uniq) {
        if ([...codeOf.values()].includes(l.code)) continue;
        const LW = [l.L, l.W].sort((a, b) => b - a), el = l.code.slice(0, 2);
        const pool = panels.filter(p => !used.has(p.idx) && (pass === 2 || p.element === el));
        const hit = pool.find(p => fits(p, LW, 1.5)) || pool.find(p => fits(p, LW, 3));
        if (hit) { used.add(hit.idx); codeOf.set(hit.idx, l.code); }
      }
    }
    const lab = new Map(uniq.map(l => [l.code, l]));
    const elLabel = e => e ? `${e} · ${elNames[e] || "ELEMENT"}` : "OSTALO";
    const box = b => ({ size: [r1(b.mx[0] - b.mn[0]), r1(b.mx[2] - b.mn[2]), r1(b.mx[1] - b.mn[1])], pos: [r1((b.mn[0] + b.mx[0]) / 2), r1((b.mn[2] + b.mx[2]) / 2), r1(-(b.mn[1] + b.mx[1]) / 2)] });
    const parts = [], extras = [], cnt = {};
    for (const p of panels) {
      if (Math.min(...p.d) < 1) continue;
      const ta = [0, 1, 2].sort((a, b) => p.d[a] - p.d[b])[0];
      const LW = [0, 1, 2].filter(i => i !== ta).map(i => p.d[i]).sort((a, b) => b - a);
      const code = codeOf.get(p.idx);
      if (code) {
        const l = lab.get(code), es = {};
        for (const [k, v] of Object.entries(l.edges)) if (v[1]) es[k] = v[1];
        const nm = l.name || "KOS";
        parts.push({ code, name: nm, element: elLabel(code.slice(0, 2)), L: l.L, W: l.W, T: r1(p.d[ta]), ...box(p), mat: "_",
          color: /VRATA|FRONT|MASKA|VIDNA|PREDAL/.test(nm) ? "#ECEAE6" : "#DAD6CF", matText: l.mat,
          edges: Object.entries(es).map(([k, v]) => `${k}: ${v}`).join(" / ") || "brez robnega traku", es });
      } else {
        const e = p.element; cnt[e] = (cnt[e] || 0) + 1;
        parts.push({ code: `X${e || "00"}-${String(cnt[e]).padStart(2, "0")}`, name: LW[0] < 120 ? "NOGICA" : "PLOŠČA", element: elLabel(e),
          L: r1(LW[0]), W: r1(LW[1]), T: r1(p.d[ta]), ...box(p), mat: "_", color: "#B9BEC2", matText: "ni na etiketah", edges: "", esUnknown: true });
      }
    }
    for (const b of bodies) {
      if (b.kind === "Kvader" || b.kind === "Valj") continue;
      const d = [0, 1, 2].map(k => b.mx[k] - b.mn[k]); if (Math.min(...d) < 1) continue;
      const k = b.kind === "Ravna prizma" ? "wall" : "hw";
      extras.push({ k, ...box(b), color: k === "hw" ? (b.color ? "#" + b.color.map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase() : "#ACAEBA") : "#2A2F35" });
    }
    parts.sort((a, b) => a.element < b.element ? -1 : a.element > b.element ? 1 : a.code < b.code ? -1 : 1);
    const linked = parts.filter(p => !p.esUnknown).length;
    return { name: name || "Projekt", program: "Mega Tischler", createdAt: Date.now(), parts, extras,
      note: `Povezano z etiketami: ${linked} kosov` + (uniq.length > linked ? ` (${uniq.length - linked} etiket brez plošče v modelu)` : "") + "." };
  }

  const api = { parseDxf, parseLabelsPdf, labelsFromItems, buildProject };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.MegaTischler = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
