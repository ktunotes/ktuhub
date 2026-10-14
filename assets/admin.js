/* KTU Notes Hub — admin panel.
   Saves everything to the GitHub repository that hosts the site, using the
   GitHub REST API with a token the admin enters (kept only in this browser).
   - data/catalog.json : courses, subjects and the list of files
   - files/...         : uploaded PDFs
   Every save is a commit; GitHub Pages republishes the site in about a minute. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KEY = 'ktuhub-admin';
  const MAX_MB = 25;
  const TYPE_LABEL = { notes: 'Notes', qp: 'Question paper', syllabus: 'Syllabus', other: 'Other' };
  let cfg = null, DB = null, sha = null;

  /* ---------- storage ---------- */
  function loadCfg() { try { return JSON.parse(localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function saveCfg(c, remember) {
    try { (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(c)); (remember ? sessionStorage : localStorage).removeItem(KEY); } catch (e) {}
  }
  function clearCfg() { try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch (e) {} }

  /* ---------- helpers ---------- */
  function status(msg, kind) { const el = $('status'); el.className = 'status ' + (kind || 'info'); el.textContent = msg || ''; if (msg && kind !== 'err') setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 6000); }
  const slug = s => String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'file';
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const today = () => new Date().toISOString().slice(0, 10);
  const stamp = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  function b64utf8(str) { const bytes = new TextEncoder().encode(str); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); }
  function fileB64(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(new Error('Could not read ' + file.name)); r.readAsDataURL(file); }); }
  const encPath = p => p.split('/').map(encodeURIComponent).join('/');

  /* ---------- GitHub API ---------- */
  async function gh(path, opts = {}) {
    const url = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/${path}`;
    const r = await fetch(url, Object.assign({}, opts, { headers: Object.assign({
      Authorization: 'Bearer ' + cfg.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
    }, opts.headers || {}) }));
    if (!r.ok) {
      let m = ''; try { m = (await r.json()).message || ''; } catch (e) {}
      const e = new Error(r.status === 401 ? 'The token was rejected. Check it and its permissions.' :
        r.status === 403 ? 'Permission denied. The token needs "Contents: read and write" on this repository. ' + m :
        r.status === 404 ? 'Not found. Check the username, repository and branch. ' + m :
        r.status === 409 || r.status === 422 ? 'The site data changed in another window. Reload this page and try again.' : `GitHub error ${r.status}. ${m}`);
      e.code = r.status; throw e;
    }
    return r.status === 204 ? null : r.json();
  }
  function b64decodeUtf8(b64) {
    const bin = atob(String(b64).replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  async function loadCatalog() {
    // Read the file's sha, then its content through the blob API, which
    // always returns base64 JSON (works for files of any size up to 100 MB).
    const meta = await gh('contents/data/catalog.json?ref=' + encodeURIComponent(cfg.branch));
    sha = meta.sha;
    const blob = await gh('git/blobs/' + meta.sha);
    let parsed;
    try { parsed = JSON.parse(b64decodeUtf8(blob.content)); }
    catch (e) { throw new Error('data/catalog.json is not valid JSON. Fix or re-upload it on GitHub.'); }
    // Refuse to continue with a file that doesn't look like the catalog:
    // saving on top of it would wipe the site's data.
    if (!parsed || !Array.isArray(parsed.programmes)) throw new Error('data/catalog.json has no course list. Re-upload the original data/catalog.json from the zip.');
    DB = Object.assign({ programmes: [], subjects: [], items: [] }, parsed);
    if (!DB.programmes.length) status('There are no courses yet. Add one in the Courses tab.', 'info');
  }
  async function saveCatalog(message) {
    DB.updated = today();
    const r = await gh('contents/data/catalog.json', { method: 'PUT', body: JSON.stringify({
      message, branch: cfg.branch, sha, content: b64utf8(JSON.stringify(DB, null, 1) + '\n') }) });
    sha = r.content.sha;
  }
  async function uploadFile(path, file) {
    const content = await fileB64(file);
    await gh('contents/' + encPath(path), { method: 'PUT', body: JSON.stringify({ message: 'Upload ' + path, branch: cfg.branch, content }) });
  }
  async function deleteFile(path) {
    try {
      const meta = await gh('contents/' + encPath(path) + '?ref=' + encodeURIComponent(cfg.branch));
      await gh('contents/' + encPath(path), { method: 'DELETE', body: JSON.stringify({ message: 'Delete ' + path, branch: cfg.branch, sha: meta.sha }) });
    } catch (e) { if (e.code !== 404) throw e; }
  }

  /* ---------- selects ---------- */
  const prog = id => DB.programmes.find(p => p.id === id);
  function fillProg(sel, withAll) {
    const v = sel.value;
    sel.innerHTML = (withAll ? '<option value="">All courses</option>' : '') + DB.programmes.map(p => `<option value="${esc(p.id)}">${esc(p.code)}</option>`).join('');
    if ([...sel.options].some(o => o.value === v)) sel.value = v;
  }
  function fillSem(sel, pid) {
    const v = sel.value, p = prog(pid);
    sel.innerHTML = p ? Array.from({ length: p.semesters }, (_, i) => `<option value="${i + 1}">S${i + 1}</option>`).join('') : '';
    if ([...sel.options].some(o => o.value === v)) sel.value = v;
  }
  function fillSub() {
    const list = DB.subjects.filter(s => s.programme === $('aProg').value && +s.semester === +$('aSem').value)
      .sort((a, b) => String(a.code).localeCompare(String(b.code)));
    $('aSub').innerHTML = list.length ? list.map(s => `<option value="${esc(s.id)}">${esc(s.code)} – ${esc(s.name)}</option>`).join('')
      : '<option value="">No subjects yet: add one in the Subjects tab</option>';
  }

  /* ---------- render ---------- */
  function renderAll() {
    fillProg($('aProg')); fillSem($('aSem'), $('aProg').value); fillSub();
    fillProg($('sProg')); fillSem($('sSem'), $('sProg').value);
    fillProg($('fProg'), true);
    renderFiles(); renderSubjects(); renderCourses();
  }
  function subLabel(s) { const p = s && prog(s.programme); return s ? `${p ? p.code : ''} S${s.semester} · ${s.code}` : '(deleted subject)'; }
  function renderFiles() {
    const pf = $('fProg').value, q = $('fQ').value.trim().toLowerCase();
    const rows = DB.items.map(i => ({ i, s: DB.subjects.find(x => x.id === i.subject) }))
      .filter(({ i, s }) => (!pf || (s && s.programme === pf)) && (!q || `${i.title} ${s ? s.code + ' ' + s.name : ''}`.toLowerCase().includes(q)))
      .sort((a, b) => String(b.i.added || '').localeCompare(String(a.i.added || '')));
    $('fBody').innerHTML = rows.map(({ i, s }) => `<tr>
      <td><a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.title)}</a>${i.module ? `<br><span class="hint">Module ${esc(i.module)}</span>` : ''}</td>
      <td>${esc(subLabel(s))}<br><span class="hint">${esc(s ? s.name : '')}</span></td>
      <td>${esc(TYPE_LABEL[i.type] || i.type)}</td><td>${esc(i.added || '')}</td>
      <td><div class="row"><button class="btn ghost small" data-edit="${esc(i.id)}">Edit</button><button class="btn danger" data-del="${esc(i.id)}">Delete</button></div></td></tr>`).join('')
      || '<tr><td colspan="5" class="hint">No files yet.</td></tr>';
  }
  function renderSubjects() {
    const rows = DB.subjects.slice().sort((a, b) => (a.programme + a.semester + a.code).localeCompare(b.programme + b.semester + b.code));
    $('sBody').innerHTML = rows.map(s => `<tr><td>${esc(prog(s.programme) ? prog(s.programme).code : s.programme)}</td><td>S${esc(s.semester)}</td>
      <td>${esc(s.code)}</td><td>${esc(s.name)}</td><td>${DB.items.filter(i => i.subject === s.id).length}</td>
      <td><div class="row"><button class="btn ghost small" data-sedit="${esc(s.id)}">Edit</button><button class="btn danger" data-sdel="${esc(s.id)}">Delete</button></div></td></tr>`).join('')
      || '<tr><td colspan="6" class="hint">No subjects yet. Add the first one above.</td></tr>';
  }
  function renderCourses() {
    $('cBody').innerHTML = DB.programmes.map(p => `<tr><td><b>${esc(p.code)}</b></td><td>${esc(p.name)}</td><td>${esc(p.level || '')}</td>
      <td><input class="in" type="number" min="1" max="12" value="${esc(p.semesters)}" data-csem="${esc(p.id)}" style="width:90px" aria-label="Semesters for ${esc(p.code)}"></td>
      <td><button class="btn danger" data-cdel="${esc(p.id)}">Delete</button></td></tr>`).join('');
  }

  /* ---------- busy wrapper ---------- */
  async function run(label, fn) {
    document.body.style.cursor = 'progress';
    document.querySelectorAll('#admin button').forEach(b => b.disabled = true);
    try { await fn(); status(label + ' Saved. The site updates in a minute or two.', 'ok'); }
    catch (e) {
      status(e.message || String(e), 'err');
      if (e.code === 409 || e.code === 422) { try { await loadCatalog(); renderAll(); } catch (x) {} }
    } finally { document.body.style.cursor = ''; document.querySelectorAll('#admin button').forEach(b => b.disabled = false); }
  }

  /* ---------- events: add notes ---------- */
  $('aProg').addEventListener('change', () => { fillSem($('aSem'), $('aProg').value); fillSub(); });
  $('aSem').addEventListener('change', fillSub);
  $('aType').addEventListener('change', () => { $('aModWrap').hidden = $('aType').value !== 'notes'; });
  document.querySelectorAll('input[name="src"]').forEach(r => r.addEventListener('change', () => {
    const up = document.querySelector('input[name="src"]:checked').value === 'upload';
    $('srcUpload').hidden = !up; $('srcLink').hidden = up;
  }));
  $('addForm').addEventListener('submit', e => {
    e.preventDefault();
    const sub = DB.subjects.find(s => s.id === $('aSub').value);
    if (!sub) return status('Choose a subject first. Add it in the Subjects tab if it is missing.', 'err');
    const type = $('aType').value, module = type === 'notes' ? $('aMod').value : '';
    const upload = document.querySelector('input[name="src"]:checked').value === 'upload';
    const base = { subject: sub.id, type, module, added: today() };
    if (!upload) {
      const url = $('aUrl').value.trim();
      if (!/^https?:\/\//i.test(url)) return status('Paste a full link starting with https://', 'err');
      const title = $('aTitle').value.trim() || (module ? `Module ${module} notes` : TYPE_LABEL[type]);
      return run(`Added “${title}”.`, async () => {
        DB.items.push(Object.assign({ id: uid(), title, url }, base));
        await saveCatalog(`Add ${type}: ${sub.code} ${title}`);
        $('aUrl').value = ''; $('aTitle').value = ''; renderFiles(); renderSubjects();
      });
    }
    const files = [...$('aFile').files];
    if (!files.length) return status('Choose at least one PDF.', 'err');
    const big = files.find(f => f.size > MAX_MB * 1048576);
    if (big) return status(`${big.name} is larger than ${MAX_MB} MB. Compress it or use a Google Drive link instead.`, 'err');
    run(`Added ${files.length} file${files.length > 1 ? 's' : ''}.`, async () => {
      const added = [];
      for (let n = 0; n < files.length; n++) {
        const f = files[n];
        $('addProgress').textContent = `Uploading ${n + 1} of ${files.length}: ${f.name}`;
        const title = files.length === 1 && $('aTitle').value.trim() ? $('aTitle').value.trim() : f.name.replace(/\.pdf$/i, '');
        const path = `files/${sub.programme}/s${sub.semester}/${slug(sub.code)}/${slug(title)}-${stamp()}${n}.pdf`;
        await uploadFile(path, f);
        added.push(Object.assign({ id: uid(), title, url: path }, base));
      }
      $('addProgress').textContent = 'Saving the list…';
      DB.items.push(...added);
      await saveCatalog(`Add ${added.length} ${type} file(s): ${sub.code}`);
      $('aFile').value = ''; $('aTitle').value = ''; $('addProgress').textContent = '';
      renderFiles(); renderSubjects();
    }).finally(() => { $('addProgress').textContent = ''; });
  });

  /* ---------- events: files ---------- */
  $('fProg').addEventListener('change', renderFiles);
  $('fQ').addEventListener('input', renderFiles);
  $('fBody').addEventListener('click', e => {
    const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
    if (ed) {
      const it = DB.items.find(i => i.id === ed.dataset.edit); if (!it) return;
      const title = prompt('Title shown on the site:', it.title); if (title === null) return;
      let module = it.module || '';
      if (it.type === 'notes') { const m = prompt('Module number (leave empty if not module-wise):', module); if (m === null) return; module = m.trim(); }
      let url = it.url;
      if (!/^files\//.test(it.url)) { const u = prompt('Link:', it.url); if (u === null) return; url = u.trim(); }
      run('Updated.', async () => { Object.assign(it, { title: title.trim() || it.title, module, url }); await saveCatalog(`Edit: ${it.title}`); renderFiles(); });
    }
    if (del) {
      const it = DB.items.find(i => i.id === del.dataset.del); if (!it) return;
      if (!confirm(`Delete “${it.title}” from the site?` + (/^files\//.test(it.url) ? ' The uploaded PDF is deleted too.' : ''))) return;
      run('Deleted.', async () => {
        if (/^files\//.test(it.url)) await deleteFile(it.url);
        DB.items = DB.items.filter(i => i.id !== it.id);
        await saveCatalog(`Delete: ${it.title}`); renderFiles(); renderSubjects();
      });
    }
  });

  /* ---------- events: subjects ---------- */
  $('sProg').addEventListener('change', () => fillSem($('sSem'), $('sProg').value));
  $('subForm').addEventListener('submit', e => {
    e.preventDefault();
    const programme = $('sProg').value, semester = +$('sSem').value, code = $('sCode').value.trim(), name = $('sName').value.trim();
    const id = `${programme}-s${semester}-${slug(code)}`;
    if (DB.subjects.some(s => s.id === id)) return status(`${code} already exists in this semester.`, 'err');
    run(`Added ${code}.`, async () => {
      DB.subjects.push({ id, programme, semester, code, name });
      await saveCatalog(`Add subject ${code} ${name}`);
      $('sCode').value = ''; $('sName').value = ''; renderSubjects();
      if ($('aProg').value === programme && +$('aSem').value === semester) fillSub();
    });
  });
  $('sBody').addEventListener('click', e => {
    const ed = e.target.closest('[data-sedit]'), del = e.target.closest('[data-sdel]');
    if (ed) {
      const s = DB.subjects.find(x => x.id === ed.dataset.sedit); if (!s) return;
      const code = prompt('Course code:', s.code); if (code === null) return;
      const name = prompt('Subject name:', s.name); if (name === null) return;
      run('Subject updated.', async () => { s.code = code.trim() || s.code; s.name = name.trim() || s.name; await saveCatalog(`Edit subject ${s.code}`); renderAll(); });
    }
    if (del) {
      const s = DB.subjects.find(x => x.id === del.dataset.sdel); if (!s) return;
      const its = DB.items.filter(i => i.subject === s.id);
      if (!confirm(`Delete ${s.code} ${s.name}?` + (its.length ? ` Its ${its.length} file(s) are removed from the site too.` : ''))) return;
      run('Subject deleted.', async () => {
        for (const it of its) if (/^files\//.test(it.url)) await deleteFile(it.url);
        DB.items = DB.items.filter(i => i.subject !== s.id);
        DB.subjects = DB.subjects.filter(x => x.id !== s.id);
        await saveCatalog(`Delete subject ${s.code}`); renderAll();
      });
    }
  });

  /* ---------- events: courses ---------- */
  $('courseForm').addEventListener('submit', e => {
    e.preventDefault();
    const code = $('cCode').value.trim(), id = slug(code).replace(/-/g, '');
    if (!id || DB.programmes.some(p => p.id === id)) return status('That course already exists.', 'err');
    run(`Added ${code}.`, async () => {
      DB.programmes.push({ id, code, name: $('cName').value.trim(), level: $('cLevel').value, semesters: Math.max(1, Math.min(12, +$('cSems').value || 4)) });
      await saveCatalog(`Add course ${code}`); $('cCode').value = ''; $('cName').value = ''; renderAll();
    });
  });
  $('cBody').addEventListener('change', e => {
    const inp = e.target.closest('[data-csem]'); if (!inp) return;
    const p = prog(inp.dataset.csem); const n = Math.max(1, Math.min(12, +inp.value || p.semesters));
    run(`${p.code} now has ${n} semesters.`, async () => { p.semesters = n; await saveCatalog(`Set ${p.code} semesters to ${n}`); renderAll(); });
  });
  $('cBody').addEventListener('click', e => {
    const del = e.target.closest('[data-cdel]'); if (!del) return;
    const p = prog(del.dataset.cdel);
    if (DB.subjects.some(s => s.programme === p.id)) return status(`Delete ${p.code}'s subjects first.`, 'err');
    if (!confirm(`Delete the course ${p.code}?`)) return;
    run(`Deleted ${p.code}.`, async () => { DB.programmes = DB.programmes.filter(x => x.id !== p.id); await saveCatalog(`Delete course ${p.code}`); renderAll(); });
  });

  /* ---------- tabs ---------- */
  document.querySelectorAll('[data-tab]').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', x === t));
    document.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t.dataset.tab; });
  }));

  /* ---------- sign in ---------- */
  async function connect(c, remember) {
    cfg = c;
    await loadCatalog();
    if (remember !== undefined) saveCfg(c, remember);
    $('login').hidden = true; $('admin').hidden = false; $('logout').hidden = false;
    $('repoInfo').textContent = `${c.owner}/${c.repo} (${c.branch})`;
    renderAll();
  }
  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const c = { owner: $('owner').value.trim(), repo: $('repo').value.trim(), branch: $('branch').value.trim() || 'main', token: $('token').value.trim() };
    const st = $('loginStatus'); st.className = 'status info'; st.textContent = 'Connecting…';
    try { await connect(c, $('remember').checked); st.textContent = ''; }
    catch (err) { st.className = 'status err'; st.textContent = err.message; }
  });
  $('logout').addEventListener('click', e => { e.preventDefault(); clearCfg(); location.reload(); });

  // Pre-fill owner/repo when hosted at https://<owner>.github.io/<repo>/
  const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
  if (m) { $('owner').value = m[1]; const seg = location.pathname.split('/').filter(Boolean)[0]; if (seg && !/\.html$/.test(seg)) $('repo').value = seg; }

  const saved = loadCfg();
  if (saved && saved.token) connect(saved).catch(err => { $('login').hidden = false; const st = $('loginStatus'); st.className = 'status err'; st.textContent = err.message; });
  else $('login').hidden = false;
})();
