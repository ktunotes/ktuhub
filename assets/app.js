/* KTU Notes Hub — public site.
   All content comes from data/catalog.json, which the admin panel edits.
   Pages are addressed with query strings so they work on GitHub Pages:
     ?p=mca                 programme (semester 1)
     ?p=mca&s=2             programme, semester 2
     ?sub=<subject-id>      subject page
     ?q=dbms                search                                    */
(function () {
  'use strict';
  const app = document.getElementById('app');
  const TYPES = [
    ['notes', 'Notes', 'PDF', 'Notes'],
    ['qp', 'Question papers', 'QP', 'Question paper'],
    ['syllabus', 'Syllabus', 'SYL', 'Syllabus'],
    ['other', 'Other materials', '•', 'Other material'],
  ];
  let DB = null;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const qs = () => new URLSearchParams(location.search);
  const href = params => '?' + new URLSearchParams(params).toString();
  const prog = id => DB.programmes.find(p => p.id === id);
  const subj = id => DB.subjects.find(s => s.id === id);
  const itemsOf = sid => DB.items.filter(i => i.subject === sid);
  const fmtDate = d => { const t = new Date(d); return isNaN(t) ? '' : t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const safeUrl = u => /^(https?:)?\/\//i.test(u) || /^files\//.test(u) ? u : '#';

  function setTitle(t, desc) {
    document.title = t ? `${t} | KTU Notes Hub` : 'KTU Notes Hub – MCA, MBA, BCA, BBA Notes, Question Papers & Syllabus';
    if (desc) { const m = document.querySelector('meta[name="description"]'); if (m) m.setAttribute('content', desc); }
  }

  function itemRow(i, showSubject) {
    const t = TYPES.find(x => x[0] === i.type) || TYPES[3];
    const s = subj(i.subject); const p = s && prog(s.programme);
    const where = showSubject && s ? `<b>${esc(p ? p.code : '')} S${esc(s.semester)}</b> ${esc(s.name)} · ` : '';
    const mod = i.module ? `Module ${esc(i.module)} · ` : '';
    return `<li><a class="item" href="${esc(safeUrl(i.url))}" target="_blank" rel="noopener">
      <span class="ico" aria-hidden="true">${t[2]}</span>
      <span><span class="t">${esc(i.title)}</span><br><span class="s">${where}${mod}${t[3]}${i.added ? ' · added ' + esc(fmtDate(i.added)) : ''}</span></span>
      <span class="go">Open</span></a></li>`;
  }

  function home() {
    setTitle('');
    const counts = id => DB.items.filter(i => { const s = subj(i.subject); return s && s.programme === id; }).length;
    const progs = DB.programmes.map((p, n) => `<a class="prog${n === 0 ? ' featured' : ''}" href="${href({ p: p.id })}">
        <span class="code${p.code.length > 4 ? ' long' : ''}">${esc(p.code)}</span><span class="name">${esc(p.name)}</span>
        <span class="count">${counts(p.id) ? counts(p.id) + ' files' : 'Coming soon'}</span></a>`).join('');
    const latest = DB.items.slice().sort((a, b) => String(b.added || '').localeCompare(String(a.added || ''))).slice(0, 8);
    app.innerHTML = `
      <section class="hero">
        <h1>Notes for every KTU course beyond B.Tech</h1>
        <p class="lead">Module-wise notes, previous question papers and syllabus for MCA, MBA, BCA, BBA and more. Free, and shared by KTU students and teachers.</p>
        <form class="search" role="search" action="./">
          <label for="q" class="sr" style="position:absolute;left:-9999px">Search notes</label>
          <input id="q" name="q" type="search" placeholder="Search a subject or code, e.g. DBMS or 20MCA103" autocomplete="off">
          <button type="submit">Search</button>
        </form>
        <div class="progs">${progs}</div>
      </section>
      <section class="block">
        <h2>Browse by type</h2>
        <div class="quick">
          <a href="?type=notes"><span class="ico">PDF</span><span>Notes<small>${DB.items.filter(i => i.type === 'notes').length} module-wise notes</small></span></a>
          <a href="?type=qp"><span class="ico">QP</span><span>Question papers<small>${DB.items.filter(i => i.type === 'qp').length} previous papers</small></span></a>
          <a href="?type=syllabus"><span class="ico">SYL</span><span>Syllabus<small>${DB.items.filter(i => i.type === 'syllabus').length} syllabus files</small></span></a>
        </div>
      </section>
      <section class="block latest">
        <h2>Recently added</h2>
        ${latest.length ? `<ul class="items">${latest.map(i => itemRow(i, true)).join('')}</ul>`
          : `<div class="empty"><b>Notes are on their way</b>New notes appear here as soon as they're added. Follow @ktunotes.in for updates.</div>`}
      </section>`;
  }

  function programme(p, sem) {
    sem = Math.min(Math.max(1, sem || 1), p.semesters);
    setTitle(`KTU ${p.code} S${sem} Notes`, `KTU ${p.code} semester ${sem} notes, question papers and syllabus.`);
    const tabs = Array.from({ length: p.semesters }, (_, k) => k + 1)
      .map(n => `<a href="${href({ p: p.id, s: n })}" aria-current="${n === sem}">S${n}</a>`).join('');
    const list = DB.subjects.filter(s => s.programme === p.id && +s.semester === sem)
      .sort((a, b) => String(a.code).localeCompare(String(b.code)));
    const cards = list.map(s => {
      const its = itemsOf(s.id);
      const n = t => its.filter(i => i.type === t).length;
      const meta = [n('notes') && `${n('notes')} notes`, n('qp') && `${n('qp')} papers`, n('syllabus') && 'syllabus'].filter(Boolean).join(' · ') || 'Nothing uploaded yet';
      return `<a class="subject" href="${href({ sub: s.id })}"><div class="scode">${esc(s.code)}</div><div class="sname">${esc(s.name)}</div><div class="meta">${meta}</div></a>`;
    }).join('');
    app.innerHTML = `
      <div class="crumbs"><a href="./">Home</a> › ${esc(p.code)}</div>
      <div class="page-head"><h1>KTU ${esc(p.code)} notes</h1><p>${esc(p.name)}. Pick your semester.</p></div>
      <nav class="sems" aria-label="Semesters">${tabs}</nav>
      ${cards ? `<div class="subjects">${cards}</div>`
        : `<div class="empty"><b>No subjects for ${esc(p.code)} S${sem} yet</b>We're adding them. Check back soon or follow @ktunotes.in.</div>`}`;
  }

  function subject(s) {
    const p = prog(s.programme);
    setTitle(`${s.code} ${s.name} Notes`, `KTU ${p ? p.code : ''} ${s.code} ${s.name}: notes, question papers and syllabus.`);
    const its = itemsOf(s.id);
    const groups = TYPES.map(([t, label]) => {
      let list = its.filter(i => i.type === t);
      if (!list.length) return '';
      if (t === 'notes') list.sort((a, b) => (+a.module || 99) - (+b.module || 99) || String(a.title).localeCompare(String(b.title)));
      else list.sort((a, b) => String(b.added || '').localeCompare(String(a.added || '')));
      return `<div class="group" id="${t}"><h3>${label}</h3><ul class="items">${list.map(i => itemRow(i, false)).join('')}</ul></div>`;
    }).join('');
    app.innerHTML = `
      <div class="crumbs"><a href="./">Home</a> › <a href="${href({ p: s.programme, s: s.semester })}">${esc(p ? p.code : '')} S${esc(s.semester)}</a> › ${esc(s.code)}</div>
      <div class="page-head"><h1>${esc(s.name)}</h1><p>${esc(s.code)} · ${esc(p ? p.code : '')} semester ${esc(s.semester)}</p></div>
      ${(() => { const have = TYPES.filter(([t]) => its.some(i => i.type === t)); return have.length > 1 ? `<nav class="jump" aria-label="Jump to">${have.map(([t, l]) => `<a href="#${t}">${l}</a>`).join('')}</nav>` : ''; })()}
      ${groups || `<div class="empty"><b>Nothing here yet</b>Notes for this subject will appear here once they're added.</div>`}`;
  }

  function byType(type, pid) {
    const T = TYPES.find(x => x[0] === type);
    const p = pid && prog(pid);
    setTitle(`KTU ${p ? p.code + ' ' : ''}${T[1]}`, `KTU ${p ? p.code : 'MCA, MBA, BCA, BBA'} ${T[1].toLowerCase()} by semester and subject.`);
    const chips = `<a href="${href({ type })}" aria-current="${!p}">All courses</a>` +
      DB.programmes.map(x => `<a href="${href({ type, p: x.id })}" aria-current="${p && p.id === x.id}">${esc(x.code)}</a>`).join('');
    const items = DB.items.filter(i => i.type === type);
    const subs = DB.subjects.filter(s => (!p || s.programme === p.id) && items.some(i => i.subject === s.id))
      .sort((a, b) => (DB.programmes.indexOf(prog(a.programme)) - DB.programmes.indexOf(prog(b.programme))) || (a.semester - b.semester) || String(a.code).localeCompare(String(b.code)));
    let html = '', last = '';
    subs.forEach(s => {
      const pp = prog(s.programme), key = s.programme + s.semester;
      if (key !== last) { html += `<div class="semhead">${esc(pp ? pp.code : '')} · Semester ${esc(s.semester)}</div>`; last = key; }
      const list = items.filter(i => i.subject === s.id)
        .sort((a, b) => (+a.module || 99) - (+b.module || 99) || String(b.added || '').localeCompare(String(a.added || '')));
      html += `<a class="subjhead" href="${href({ sub: s.id })}"><b>${esc(s.name)}</b><span>${esc(s.code)}</span></a><ul class="items">${list.map(i => itemRow(i, false)).join('')}</ul>`;
    });
    app.innerHTML = `
      <div class="crumbs"><a href="./">Home</a> › ${T[1]}</div>
      <div class="page-head"><h1>${p ? esc(p.code) + ' ' : ''}${T[1]}</h1><p>${type === 'qp' ? 'Previous year KTU question papers' : type === 'syllabus' ? 'Official KTU syllabus' : 'Module-wise notes'}, by course, semester and subject.</p></div>
      <nav class="chips" aria-label="Course">${chips}</nav>
      ${html || `<div class="empty"><b>Nothing here yet</b>${T[1]} for ${p ? esc(p.code) : 'these courses'} will appear here as soon as they're added.</div>`}`;
  }

  function searchPage() {
    setTitle('Search');
    app.innerHTML = `
      <div class="page-head" style="padding-top:28px"><h1>Search</h1><p>Find notes, question papers and syllabus by subject name or code.</p></div>
      <form class="search" role="search" action="./"><input name="q" type="search" placeholder="e.g. DBMS, 20MCA103, Marketing" aria-label="Search" autofocus><button type="submit">Search</button></form>`;
    const inp = app.querySelector('input'); if (inp) inp.focus();
  }

  function search(q) {
    setTitle(`Search: ${q}`);
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const hit = text => words.every(w => text.toLowerCase().includes(w));
    const subs = DB.subjects.filter(s => { const p = prog(s.programme); return hit(`${s.code} ${s.name} ${p ? p.code + ' ' + p.name : ''} s${s.semester}`); });
    const its = DB.items.filter(i => { const s = subj(i.subject); return hit(`${i.title} ${s ? s.code + ' ' + s.name : ''}`); }).slice(0, 40);
    app.innerHTML = `
      <div class="crumbs"><a href="./">Home</a> › Search</div>
      <div class="page-head"><h1>Results for “${esc(q)}”</h1></div>
      <form class="search" role="search" action="./" style="margin-bottom:24px"><input name="q" type="search" value="${esc(q)}" aria-label="Search"><button type="submit">Search</button></form>
      ${subs.length ? `<h2>Subjects</h2><div class="subjects" style="margin-bottom:24px">${subs.map(s => { const p = prog(s.programme);
        return `<a class="subject" href="${href({ sub: s.id })}"><div class="scode">${esc(p ? p.code : '')} S${esc(s.semester)} · ${esc(s.code)}</div><div class="sname">${esc(s.name)}</div><div class="meta">${itemsOf(s.id).length} files</div></a>`; }).join('')}</div>` : ''}
      ${its.length ? `<h2>Files</h2><ul class="items">${its.map(i => itemRow(i, true)).join('')}</ul>` : ''}
      ${!subs.length && !its.length ? `<div class="empty"><b>Nothing found</b>Try a subject code, a shorter word, or browse by course from the home page.</div>` : ''}`;
  }

  function markNav(key) {
    document.querySelectorAll('[data-nav]').forEach(a => { if (a.dataset.nav === key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }
  function route() {
    const q = qs();
    const t = q.get('type');
    markNav(q.get('q') || q.get('search') ? 'search' : t && TYPES.some(x => x[0] === t) ? t : (q.toString() ? '' : 'home'));
    if (q.get('search') && !q.get('q')) return searchPage();
    if (q.get('q')) return search(q.get('q'));
    if (t && TYPES.some(x => x[0] === t)) return byType(t, q.get('p'));
    if (q.get('sub')) { const s = subj(q.get('sub')); return s ? subject(s) : notFound(); }
    if (q.get('p')) { const p = prog(q.get('p')); return p ? programme(p, +q.get('s') || 1) : notFound(); }
    home();
  }
  function notFound() { setTitle('Not found'); app.innerHTML = `<div class="empty" style="margin-top:40px"><b>Page not found</b><a href="./">Go to the home page</a></div>`; }

  // Same-page links navigate without a reload.
  document.addEventListener('click', e => {
    const a = e.target.closest('a');
    if (!a || a.target || e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (a.getAttribute('href').charAt(0) === '#') return;
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin || u.pathname !== location.pathname) return;
    e.preventDefault(); history.pushState(null, '', u.search || './'); route(); window.scrollTo(0, 0);
  });
  window.addEventListener('popstate', route);

  // no-store: notes added in the admin panel show up on the next page load.
  fetch('data/catalog.json', { cache: 'no-store' })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => { DB = Object.assign({ programmes: [], subjects: [], items: [] }, d); route(); })
    .catch(() => { app.innerHTML = '<div class="empty" style="margin-top:40px"><b>Could not load notes</b>Please refresh the page.</div>'; });
})();
