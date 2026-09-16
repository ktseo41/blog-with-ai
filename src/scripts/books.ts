import records from '../data/books.json';
import { defaults, groupBooks, selectBooks, renderSelectableBook, bookSelectionKey, selectedBooksCSV, PAGE_SIZE } from '../lib/books';
import type { Filters } from '../lib/books';

const groups = groupBooks(records);
const byId = new Map(groups.map(g => [g.id, g]));
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = $<HTMLFormElement>('book-filters');
const fields = ['query','year','institution','selector'] as const;
const storageKey = 'selected-books-v1';
let selectedKeys = new Set<string>();
let storageAvailable = true;
try {
  const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]');
  const known = new Set(groups.map(bookSelectionKey));
  if (Array.isArray(saved)) selectedKeys = new Set(saved.filter(key => typeof key === 'string' && known.has(key)));
} catch { storageAvailable = false; }
let filters: Filters = {...defaults};
let view = 'all';
let page = 1;
const results = () => selectBooks(view === 'selected' ? groups.filter(g=>selectedKeys.has(bookSelectionKey(g))) : groups, filters);

function updateURL() {
  const url = new URL(location.href);
  url.search = '';
  for (const key of fields) if (filters[key]) url.searchParams.set(key, filters[key]);
  if (filters.sort !== defaults.sort) url.searchParams.set('sort', filters.sort);
  if (view !== 'all') url.searchParams.set('view', view);
  if (page > 1) url.searchParams.set('page', String(page));
  history.replaceState(null, '', url);
}
function updateSelectionUI() {
  $('selected-count').textContent = String(selectedKeys.size);
  $('selection-status').textContent = `선택한 책 ${selectedKeys.size}권${storageAvailable ? '' : ' · 이 화면에서만 유지'}`;
  $<HTMLButtonElement>('export-selected').disabled = !selectedKeys.size;
  $<HTMLButtonElement>('clear-selected').disabled = !selectedKeys.size;
  const visible = results().slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const checked = visible.filter(g=>selectedKeys.has(bookSelectionKey(g))).length;
  const bulk = $<HTMLInputElement>('select-page');
  bulk.disabled = !visible.length;
  bulk.checked = visible.length > 0 && checked === visible.length;
  bulk.indeterminate = checked > 0 && checked < visible.length;
}
function render(sync = true) {
  const openIds = [...document.querySelectorAll<HTMLDetailsElement>('.book-row[open]')].map(el=>el.id);
  const focused = (document.activeElement as HTMLElement)?.dataset.selectBook;
  const winners = view === 'winners';
  $('browse-panel').hidden = winners;
  $('winners-panel').hidden = !winners;
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  const selected = results();
  const max = Math.max(1, Math.ceil(selected.length / PAGE_SIZE));
  page = Math.min(Math.max(1, page), max);
  $('book-results').innerHTML = selected.length
    ? selected.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE).map(g => renderSelectableBook(g, byId.get(g.id)!, selectedKeys.has(bookSelectionKey(g)))).join('')
    : `<div class="empty-state"><h3>${view === 'selected' && !selectedKeys.size ? '선택한 책이 없습니다.' : '조건에 맞는 책이 없습니다.'}</h3><p>${view === 'selected' ? '책 제목 옆 체크박스로 읽고 싶은 책을 골라 보세요.' : '검색어나 필터를 줄여 보세요. 겹치는 책은 현재 조건에서 두 번 이상 선정된 책입니다.'}</p><button type="button" id="empty-reset">전체 책 보기</button></div>`;
  for (const id of openIds) { const el = $<HTMLDetailsElement>(id); if(el) el.open = true; }
  if (focused) document.querySelector<HTMLInputElement>(`[data-select-book="${focused}"]`)?.focus({preventScroll:true});
  $('result-count').innerHTML = `<strong>${selected.length.toLocaleString()}</strong>권 · ${selected.reduce((n,g) => n + g.records.length,0).toLocaleString()}개 기록${view === 'overlap' ? ' <span class="result-caption">2회 이상 선정</span>' : ''}`;
  $('page-status').textContent = `${selected.length ? page : 0} / ${selected.length ? max : 0}`;
  $<HTMLButtonElement>('prev-page').disabled = page <= 1;
  $<HTMLButtonElement>('next-page').disabled = page >= max;
  $('empty-reset')?.addEventListener('click', () => {view = 'all'; form.reset();});
  updateSelectionUI();
  if (sync) updateURL();
}
function saveSelection() {
  try { localStorage.setItem(storageKey, JSON.stringify([...selectedKeys])); }
  catch { storageAvailable = false; }
  render();
}
$('book-results').addEventListener('change', e => {
  const input = e.target as HTMLInputElement;
  const g = byId.get(input.dataset.selectBook || '');
  if (!g) return;
  const key = bookSelectionKey(g);
  if (input.checked) selectedKeys.add(key); else selectedKeys.delete(key);
  saveSelection();
});
$('select-page').addEventListener('change', e => {
  const checked = (e.target as HTMLInputElement).checked;
  for (const g of results().slice((page-1)*PAGE_SIZE,page*PAGE_SIZE)) {
    if (checked) selectedKeys.add(bookSelectionKey(g)); else selectedKeys.delete(bookSelectionKey(g));
  }
  saveSelection();
});
$('clear-selected').addEventListener('click', () => {selectedKeys.clear();saveSelection();});
$('export-selected').addEventListener('click', () => {
  const chosen = groups.filter(g=>selectedKeys.has(bookSelectionKey(g)));
  if (!chosen.length) return;
  const url = URL.createObjectURL(new Blob([selectedBooksCSV(chosen)], {type:'text/csv;charset=utf-8;'}));
  const a = document.createElement('a');
  a.href = url; a.download = '선택한_도서.csv'; document.body.append(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
function readForm() {
  for (const key of fields) filters[key] = (form.elements.namedItem(key) as HTMLInputElement).value;
  page = 1;
  render();
}
let timer: ReturnType<typeof setTimeout>;
form.addEventListener('submit', e => e.preventDefault());
$('book-query').addEventListener('input', () => {clearTimeout(timer); timer = setTimeout(readForm, 120);});
form.addEventListener('change', readForm);
form.addEventListener('reset', () => {
  clearTimeout(timer);
  filters = {...defaults, overlap: view === 'overlap'};
  $<HTMLSelectElement>('book-sort').value = defaults.sort;
  page = 1;
  render();
});
$('book-sort').addEventListener('change', e => {filters.sort = (e.target as HTMLSelectElement).value; page = 1; render();});
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b => b.addEventListener('click', () => {
  clearTimeout(timer);
  view = b.dataset.view!;
  filters.overlap = view === 'overlap';
  if (view === 'selected') { form.reset(); return; }
  readForm();
}));
for (const [id, delta] of [['prev-page',-1],['next-page',1]] as const) {
  $(id).addEventListener('click', () => {page += delta; render(); $('result-count').scrollIntoView({block:'start'});});
}
function restoreURL() {
  const params = new URLSearchParams(location.search);
  for (const key of fields) {
    const field = form.elements.namedItem(key) as HTMLInputElement | HTMLSelectElement;
    field.value = params.get(key) || '';
    filters[key] = field.value;
  }
  const sort = params.get('sort') || defaults.sort;
  filters.sort = ['overlap','institutions','latest','title'].includes(sort) ? sort : defaults.sort;
  $<HTMLSelectElement>('book-sort').value = filters.sort;
  view = ['overlap','selected','winners'].includes(params.get('view') || '') ? params.get('view')! : 'all';
  filters.overlap = view === 'overlap';
  page = Number.parseInt(params.get('page') || '1', 10) || 1;
  render(false);
}
window.addEventListener('popstate', restoreURL);
restoreURL();
