
'use strict';

const STORAGE = 'story-studio-v1';
const $ = id => document.getElementById(id);

const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  ('id-' + Date.now() + '-' + Math.random().toString(36).slice(2));

const makeProject = (title = 'Untitled Story') => ({
  id: uid(),
  title,
  premise: '',
  synopsis: '',
  theme: '',
  characters: [],
  scenes: [],
  ideas: [],
  blocks: [
    {
      id: uid(),
      type: 'scene',
      text: 'EXT. DESERTED STREET - NIGHT'
    },
    {
      id: uid(),
      type: 'action',
      text: 'A nervous man walks beneath a streetlight.'
    }
  ]
});

const defaultData = () => ({
  version: 1,
  activeId: null,
  projects: [makeProject('The Square')]
});

let data;

try {
  data = JSON.parse(localStorage.getItem(STORAGE));
  if (!data || !Array.isArray(data.projects) || !data.projects.length) {
    throw Error('Invalid');
  }
} catch {
  data = defaultData();
}

if (!data.activeId || !data.projects.some(p => p.id === data.activeId)) {
  data.activeId = data.projects[0].id;
}

let section = 'story';
let selectedId = null;
let activeBlockId = null;
let saveTimer = null;

const project = () =>
  data.projects.find(p => p.id === data.activeId);

function save() {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(data));
    $('saveStatus').textContent = 'Saved locally';
  } catch (e) {
    $('saveStatus').textContent = 'Storage full — export backup';
    console.error(e);
  }
}

function scheduleSave() {
  $('saveStatus').textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 300);
}

function field(label, value, handler, multiline = false) {
  const wrap = document.createElement('label');
  wrap.className = 'field';

  const title = document.createElement('span');
  title.textContent = label;

  const el = document.createElement(multiline ? 'textarea' : 'input');
  el.value = value || '';

  el.addEventListener('input', () => {
    handler(el.value);
    scheduleSave();
  });

  wrap.append(title, el);
  return wrap;
}

function btn(text, handler, cls = '') {
  const el = document.createElement('button');
  el.textContent = text;
  el.className = cls;
  el.addEventListener('click', handler);
  return el;
}

function renderProjects() {
  $('projectSelect').replaceChildren(
    ...data.projects.map(p => {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.title;
      return o;
    })
  );

  $('projectSelect').value = data.activeId;
  $('scriptTitle').textContent = project().title;
}

function renderSide() {
  const root = $('sideContent');
  root.replaceChildren();

  const p = project();
  const heading = document.createElement('h2');

  heading.textContent = {
    story: 'Story overview',
    characters: 'Characters',
    scenes: 'Scenes',
    ideas: 'Ideas'
  }[section];

  root.append(heading);

  if (section === 'story') {
    root.append(
      field('Story title', p.title, v => {
        p.title = v || 'Untitled Story';
        renderProjects();
      }),
      field('Premise', p.premise, v => p.premise = v, true),
      field('Synopsis / outline', p.synopsis, v => p.synopsis = v, true),
      field('Theme', p.theme, v => p.theme = v, true)
    );

    const row = document.createElement('div');
    row.className = 'side-actions';

    row.append(
      btn('New story', newProject),
      btn('Delete this story', deleteProject, 'danger')
    );

    root.append(row);

  } else if (section === 'characters') {
    const current = p.characters.find(c => c.id === selectedId);

    if (current) {
      root.append(
        btn('← All characters', () => {
          selectedId = null;
          renderSide();
        }, 'back'),

        field('Name', current.name, v => current.name = v),
        field('Role', current.role, v => current.role = v),
        field('Description', current.description,
          v => current.description = v, true),
        field('Background & motivations', current.notes,
          v => current.notes = v, true),

        btn('Delete character', () => {
          if (confirm('Delete this character profile?')) {
            p.characters = p.characters.filter(c => c.id !== current.id);
            selectedId = null;
            renderSide();
            scheduleSave();
          }
        }, 'danger')
      );
    } else {
      root.append(btn('+ New character', () => {
        const c = {
          id: uid(),
          name: 'New character',
          role: '',
          description: '',
          notes: ''
        };

        p.characters.push(c);
        selectedId = c.id;
        renderSide();
        scheduleSave();
      }));

      p.characters.forEach(c => {
        root.append(btn(c.name || 'Unnamed character', () => {
          selectedId = c.id;
          renderSide();
        }, 'item'));
      });
    }

  } else if (section === 'scenes') {
    const current = p.scenes.find(s => s.id === selectedId);

    if (current) {
      root.append(
        btn('← All scenes', () => {
          selectedId = null;
          renderSide();
        }, 'back'),

        field('Scene name', current.name, v => current.name = v),

        field('Scene notes (separate from screenplay)',
          current.notes, v => current.notes = v, true)
      );

      const actions = document.createElement('div');
      actions.className = 'side-actions';

      actions.append(
        btn(
          current.blockId
            ? 'Jump to screenplay scene'
            : 'Link to screenplay scene',
          () => {
            if (
              current.blockId &&
              p.blocks.some(b => b.id === current.blockId)
            ) {
              focusBlock(current.blockId);
            } else {
              const b = {
                id: uid(),
                type: 'scene',
                text: 'INT. LOCATION - DAY'
              };

              p.blocks.push(b);
              current.blockId = b.id;
              renderBlocks();
              focusBlock(b.id);
              scheduleSave();
            }
          }
        ),

        btn('Unlink', () => {
          current.blockId = null;
          renderSide();
          scheduleSave();
        })
      );

      root.append(
        actions,

        btn('Delete scene notes', () => {
          if (confirm(
            'Delete these scene notes? The screenplay stays unchanged.'
          )) {
            p.scenes = p.scenes.filter(s => s.id !== current.id);
            selectedId = null;
            renderSide();
            scheduleSave();
          }
        }, 'danger')
      );

    } else {
      root.append(btn('+ New scene notes', () => {
        const s = {
          id: uid(),
          name: 'New scene',
          notes: '',
          blockId: null
        };

        p.scenes.push(s);
        selectedId = s.id;
        renderSide();
        scheduleSave();
      }));

      p.scenes.forEach(s => {
        const b = btn(s.name || 'Unnamed scene', () => {
          selectedId = s.id;
          renderSide();
        }, 'item');

        const small = document.createElement('small');
        small.textContent = s.blockId
          ? 'Linked to screenplay'
          : 'Planning notes';

        b.append(small);
        root.append(b);
      });
    }

  } else {
    root.append(btn('+ New idea', () => {
      const i = {
        id: uid(),
        title: 'New idea',
        notes: ''
      };

      p.ideas.push(i);
      selectedId = i.id;
      renderSide();
      scheduleSave();
    }));

    const current = p.ideas.find(i => i.id === selectedId);

    if (current) {
      root.append(
        btn('← All ideas', () => {
          selectedId = null;
          renderSide();
        }, 'back'),

        field('Idea title', current.title, v => current.title = v),
        field('Notes', current.notes, v => current.notes = v, true),

        btn('Delete idea', () => {
          if (confirm('Delete this idea?')) {
            p.ideas = p.ideas.filter(i => i.id !== current.id);
            selectedId = null;
            renderSide();
            scheduleSave();
          }
        }, 'danger')
      );

    } else {
      p.ideas.forEach(i => {
        root.append(btn(i.title || 'Untitled idea', () => {
          selectedId = i.id;
          renderSide();
        }, 'item'));
      });
    }
  }

  const note = document.createElement('p');
  note.className = 'footer-note';
  note.textContent =
    'Your writing is saved in this browser only. ' +
    'Export a backup regularly; browser data can be cleared.';

  root.append(note);
}

function renderBlocks(focusId = null) {
  const root = $('screenplay');
  root.replaceChildren();

  const p = project();

  p.blocks.forEach(b => {
    const el = document.createElement('div');

    el.className = 'block ' + b.type;
    el.contentEditable = 'true';
    el.spellcheck = true;
    el.dataset.id = b.id;

    el.setAttribute('role', 'textbox');
    el.setAttribute('aria-label', b.type + ' paragraph');

    el.textContent = b.text;

    el.addEventListener('focus', () => {
      activeBlockId = b.id;
      $('elementType').value = b.type;
    });

    el.addEventListener('input', () => {
      b.text = el.innerText.replace(/\r/g, '');
      scheduleSave();
    });

    el.addEventListener('keydown', e => handleKeys(e, b, el));

    el.addEventListener('paste', e => {
      e.preventDefault();
      const t = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, t);
    });

    root.append(el);
  });

  if (focusId) focusBlock(focusId);
}

const types = [
  'scene',
  'action',
  'character',
  'dialogue',
  'parenthetical',
  'transition'
];

function nextType(type) {
  if (type === 'scene') return 'action';
  if (type === 'character') return 'dialogue';
  if (type === 'parenthetical') return 'dialogue';
  return 'action';
}

function handleKeys(e, b, el) {
  if (e.key === 'Tab') {
    e.preventDefault();

    b.type = types[
      (types.indexOf(b.type) +
        (e.shiftKey ? types.length - 1 : 1)) % types.length
    ];

    el.className = 'block ' + b.type;
    $('elementType').value = b.type;

    scheduleSave();
    return;
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();

    const sel = window.getSelection();
    let offset = 0;

    if (sel && sel.rangeCount) {
      const r = sel.getRangeAt(0).cloneRange();

      r.selectNodeContents(el);
      r.setEnd(sel.anchorNode, sel.anchorOffset);

      offset = r.toString().length;
    }

    const text = el.innerText.replace(/\r/g, '');

    b.text = text.slice(0, offset);

    const newBlock = {
      id: uid(),
      type: nextType(b.type),
      text: text.slice(offset).replace(/^\n/, '')
    };

    const blocks = project().blocks;
    blocks.splice(blocks.indexOf(b) + 1, 0, newBlock);

    renderBlocks(newBlock.id);
    scheduleSave();
    return;
  }

  if (
    e.key === 'Backspace' &&
    el.innerText.length === 0 &&
    project().blocks.length > 1
  ) {
    e.preventDefault();

    const blocks = project().blocks;
    const idx = blocks.indexOf(b);

    if (idx > 0) {
      blocks.splice(idx, 1);
      renderBlocks(blocks[idx - 1].id);
      scheduleSave();
    }
  }
}

function focusBlock(id) {
  const el = [...$('screenplay').children]
    .find(e => e.dataset.id === id);

  if (el) {
    el.focus();
    el.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth'
    });

    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);

    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

function addBlock() {
  const p = project();

  const idx = p.blocks.findIndex(b => b.id === activeBlockId);

  const b = {
    id: uid(),
    type: $('elementType').value,
    text: ''
  };

  p.blocks.splice(
    idx < 0 ? p.blocks.length : idx + 1,
    0,
    b
  );

  renderBlocks(b.id);
  scheduleSave();
}

function changeType(type) {
  const b = project().blocks.find(b => b.id === activeBlockId);

  if (b) {
    b.type = type;

    const el = [...$('screenplay').children]
      .find(e => e.dataset.id === b.id);

    if (el) el.className = 'block ' + type;

    scheduleSave();
  }
}

function newProject() {
  const title = prompt('Story title?', 'New Story');

  if (title === null) return;

  const p = makeProject(title.trim() || 'Untitled Story');

  p.blocks = [
    {
      id: uid(),
      type: 'scene',
      text: 'INT. LOCATION - DAY'
    },
    {
      id: uid(),
      type: 'action',
      text: ''
    }
  ];

  data.projects.push(p);
  data.activeId = p.id;

  selectedId = null;
  section = 'story';

  refresh();
  scheduleSave();
}

function deleteProject() {
  if (data.projects.length === 1) {
    alert('Keep at least one story. You can rename it instead.');
    return;
  }

  if (confirm(
    'Permanently delete this story from this browser? ' +
    'Export a backup first.'
  )) {
    data.projects = data.projects.filter(
      p => p.id !== data.activeId
    );

    data.activeId = data.projects[0].id;
    selectedId = null;

    refresh();
    scheduleSave();
  }
}

function refresh() {
  renderProjects();

  document.querySelectorAll('.tab').forEach(b => {
    b.classList.toggle(
      'active',
      b.dataset.section === section
    );
  });

  renderSide();
  renderBlocks();
}

function download(name, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = name;

  document.body.append(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const filename = s =>
  (s || 'story')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'story';

function exportBackup() {
  save();

  download(
    'story-studio-backup.json',
    JSON.stringify(data, null, 2),
    'application/json'
  );
}

function exportFountain() {
  const lines = project().blocks.map(b => {
    let t = b.text.trim();

    if (['scene', 'character', 'transition'].includes(b.type)) {
      t = t.toUpperCase();
    }

    if (
      b.type === 'scene' &&
      !/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.|EST\.|\.)/i.test(t)
    ) {
      t = '.' + t;
    }

    if (
      b.type === 'transition' &&
      !t.endsWith('TO:')
    ) {
      t = '>' + t;
    }

    if (
      b.type === 'character' &&
      !/^[A-Z0-9 .()'\-]+$/.test(t)
    ) {
      t = '@' + t;
    }

    return t;
  }).join('\n\n');

  download(
    filename(project().title) + '.fountain',
    `Title: ${project().title}\n\n${lines}\n`,
    'text/plain'
  );
}

function validImport(obj) {
  return obj &&
    obj.version === 1 &&
    Array.isArray(obj.projects) &&
    obj.projects.length > 0 &&
    obj.projects.every(p =>
      typeof p.id === 'string' &&
      typeof p.title === 'string' &&
      Array.isArray(p.blocks) &&
      Array.isArray(p.characters) &&
      Array.isArray(p.scenes) &&
      Array.isArray(p.ideas) &&
      p.blocks.every(b =>
        typeof b.id === 'string' &&
        types.includes(b.type) &&
        typeof b.text === 'string'
      )
    );
}

$('importFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    if (file.size > 10 * 1024 * 1024) {
      throw Error('File is too large');
    }

    const obj = JSON.parse(await file.text());

    if (!validImport(obj)) {
      throw Error('Not a Story Studio v1 backup');
    }

    if (!confirm(
      'Replace all locally saved stories with this backup? ' +
      'Export your current backup first.'
    )) {
      return;
    }

    data = obj;

    data.activeId = data.projects.some(
      p => p.id === obj.activeId
    ) ? obj.activeId : data.projects[0].id;

    section = 'story';
    selectedId = null;

    refresh();
    save();

  } catch (err) {
    alert('Could not import: ' + err.message);

  } finally {
    e.target.value = '';
  }
});

$('projectSelect').addEventListener('change', e => {
  data.activeId = e.target.value;
  selectedId = null;

  refresh();
  scheduleSave();
});

$('newProject').addEventListener('click', newProject);
$('exportBtn').addEventListener('click', exportBackup);
$('fountainBtn').addEventListener('click', exportFountain);
$('addBlock').addEventListener('click', addBlock);

$('elementType').addEventListener('change', e => {
  changeType(e.target.value);
});

document.querySelectorAll('.tab').forEach(b => {
  b.addEventListener('click', () => {
    section = b.dataset.section;
    selectedId = null;
    refresh();
  });
});

window.addEventListener('beforeunload', save);

refresh();
save();
