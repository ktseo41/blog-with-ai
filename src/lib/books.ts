export interface BookRecord {
  year: string; institution: string; campaign: string; selector: string;
  type: string; title: string; author: string; publisher: string;
  recommender: string; rank: string; votes: string; category: string;
  unit: string; source: string; bookUrl: string; note: string;
}
export interface BookGroup {
  id: string; title: string; author: string; records: BookRecord[];
}
export interface Filters {
  query: string; year: string; institution: string; selector: string;
  overlap: boolean; sort: string;
}
export const defaults: Filters = { query: '', year: '', institution: '', selector: '', overlap: false, sort: 'overlap' };
export const PAGE_SIZE = 20;
const clean = (s: string) => s.normalize('NFKC').replace(/\s+/g, ' ').trim();
const aliases: Record<string, string> = {
  '누구에게나 친절한 교회오빠 강민호': '누구에게나 친절한 교회 오빠 강민호',
  '너의 췌장을 먹고 싶어 (노블판)': '너의 췌장을 먹고 싶어 노블판',
  '연년세세 年年歲歲': '연년세세', '절창 切創': '절창',
};
export function titleKey(title: string) { const t = clean(title); return aliases[t] || t; }
export function authorKey(author: string) {
  return clean(author).replace('움베르트 에코', '움베르토 에코')
    .replace(/^.*? 기획\//, '').split('/')[0].split(/\s+지음/)[0]
    .replace(/\s*(?:공저|저|글,?\s*그림|글)$/, '')
    .split(/[,·]/).map(clean).filter(Boolean).sort().join(' · ');
}
export function groupBooks(records: BookRecord[]): BookGroup[] {
  const candidates = new Map<string, BookRecord[]>();
  for (const r of records) {
    const title = titleKey(r.title);
    candidates.set(title, [...(candidates.get(title) || []), r]);
  }
  const grouped = new Map<string, BookGroup>();
  for (const r of records) {
    const title = titleKey(r.title);
    let author = authorKey(r.author);
    // Missing authors are matched only with evidence from the same publisher.
    // In particular, the two books titled 그릿 GRIT must remain separate.
    if (!author && r.publisher) {
      const matches = new Set((candidates.get(title) || [])
        .filter(other => clean(other.publisher) === clean(r.publisher) && other.author)
        .map(other => authorKey(other.author)));
      if (matches.size === 1) author = [...matches][0];
    }
    const key = `${title}\u0000${author || `미상:${r.publisher}`}`;
    if (!grouped.has(key)) grouped.set(key, { id: `book-${grouped.size + 1}`, title, author, records: [] });
    grouped.get(key)!.records.push(r);
  }
  return [...grouped.values()];
}
export const institutions = (rs: BookRecord[]) => [...new Set(rs.map(r => r.institution))];
export const years = (rs: BookRecord[]) => [...new Set(rs.map(r => r.year))].sort();
export function selectionSection(r: BookRecord) {
  // Aladin's individual recommendations and their aggregate describe one poll.
  // Genre metadata (e.g. 소설) is not an additional selection category.
  if (r.institution === '알라딘' && r.campaign === '출판인이 선정한 올해의 책') return '출판인 추천';
  if (r.type === '편집선정' && r.category) return `편집선정 · ${clean(r.category)}`;
  return clean(r.type || r.selector);
}
export function bookSelections(records: BookRecord[]) {
  const selections = new Map<string, { year: string; institution: string; campaign: string; section: string; records: BookRecord[] }>();
  for (const r of records) {
    const section = selectionSection(r);
    const key = JSON.stringify([r.year, r.institution, r.campaign, section]);
    if (!selections.has(key)) selections.set(key, { year: r.year, institution: r.institution, campaign: r.campaign, section, records: [] });
    selections.get(key)!.records.push(r);
  }
  return [...selections.values()].sort((a,b) => Number(b.year)-Number(a.year) || a.institution.localeCompare(b.institution, 'ko') || a.section.localeCompare(b.section, 'ko'));
}
export const selectionCount = (records: BookRecord[]) => bookSelections(records).length;
export function selectorKind(r: BookRecord) {
  if (r.selector.includes('독자')) return 'reader';
  if (r.selector.includes('출판')) return 'publisher';
  if (/작가|소설가|시인/.test(r.selector)) return 'writer';
  return 'expert';
}
export function selectBooks(groups: BookGroup[], filters: Filters): BookGroup[] {
  const terms = clean(filters.query).toLocaleLowerCase('ko').split(' ').filter(Boolean);
  return groups.map(g => ({ ...g, records: g.records.filter(r =>
    (!filters.year || r.year === filters.year) &&
    (!filters.institution || r.institution === filters.institution) &&
    (!filters.selector || selectorKind(r) === filters.selector) &&
    terms.every(term => `${g.title} ${g.author} ${r.title} ${r.author} ${r.publisher} ${r.recommender}`.toLocaleLowerCase('ko').includes(term))
  ) })).filter(g => g.records.length && (!filters.overlap || selectionCount(g.records) > 1))
    .sort((a, b) => {
      if (filters.sort === 'title') return a.title.localeCompare(b.title, 'ko');
      if (filters.sort === 'latest') return Number(years(b.records).at(-1)) - Number(years(a.records).at(-1)) || a.title.localeCompare(b.title, 'ko');
      if (filters.sort === 'institutions') return institutions(b.records).length - institutions(a.records).length || selectionCount(b.records) - selectionCount(a.records) || a.title.localeCompare(b.title, 'ko');
      return selectionCount(b.records) - selectionCount(a.records) || institutions(b.records).length - institutions(a.records).length || years(b.records).length - years(a.records).length || a.title.localeCompare(b.title, 'ko');
    });
}
export const escapeHtml = (s: string | number) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const e = escapeHtml;
export function sourceLink(url: string, label: string) {
  return /^https?:\/\//.test(url) ? `<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(label)} ↗</a>` : '';
}
export function publicRecordNote(note: string) {
  return note.split(';').map(part=>part.trim()).filter(part=>/오자|탈자|정정|불일치|상이|원문 표기/.test(part)).join('; ');
}
export function renderBook(g: BookGroup, all: BookGroup) {
  const orgs = institutions(g.records);
  const selections = bookSelections(g.records);
  const ys = years(g.records);
  const publishers = [...new Set(g.records.map(r => r.publisher).filter(Boolean))];
  return `<details class="book-row" id="${g.id}"><summary>
    <div class="book-main"><h3>${e(g.title)}</h3><p>${e(g.author || '저자 정보 미수록')}<span class="dot">·</span>${e(publishers.join(' / ') || '출판사 정보 미수록')}</p></div>
    <div class="book-presence"><div>${orgs.map(o => `<span class="org" data-org="${e(o)}">${e(o)}</span>`).join('')}</div><p>${e(ys.join(' · '))}</p></div>
    <div class="book-count"><strong>${selections.length}<small>회</small></strong><span>${orgs.length}곳 · ${g.records.length}기록</span></div><span class="expand" aria-hidden="true">+</span>
    </summary><div class="book-detail"><div class="detail-heading"><strong>선정 내역</strong><span>현재 조건 ${selections.length}회 / 이 책 전체 ${selectionCount(all.records)}회</span></div>
    <ul class="selection-breakdown">${selections.map(s => `<li>${e(s.year)} ${e(s.institution)} · ${e(s.campaign)} · ${e(s.section)} <span>1회 · ${s.records.length}개 기록</span></li>`).join('')}</ul>
    ${[...g.records].sort((a,b) => Number(b.year)-Number(a.year) || a.institution.localeCompare(b.institution)).map(r => `<article class="selection"><div class="selection-date"><b>${e(r.year)}</b><span>${e(r.institution)}</span></div><div class="selection-body"><strong>${e(r.campaign)}</strong><p>${e(r.selector)} · ${e(r.type)}${r.recommender ? ` · ${e(r.recommender)}` : ''}</p><p class="original">${e(r.title)} · ${e(r.author || '저자 미수록')}${r.publisher ? ` · ${e(r.publisher)}` : ''}</p>${publicRecordNote(r.note) ? `<p class="record-note">${e(publicRecordNote(r.note))}</p>` : ''}</div><div class="selection-result">${r.rank ? `<b>${e(r.rank)}위</b>` : ''}${r.votes ? `<span>추천·득표 ${e(r.votes)}</span>` : ''}<span>${e(r.unit)}</span>${sourceLink(r.source, '출처')}${sourceLink(r.bookUrl, '도서')}</div></article>`).join('')}
    </div></details>`;
}

export const bookSelectionKey = (g: BookGroup) => JSON.stringify([g.title, g.author]);
export function renderSelectableBook(g: BookGroup, all: BookGroup, selected: boolean) {
  return `<div class="book-item"><label class="book-pick"><input type="checkbox" data-select-book="${e(g.id)}" aria-label="${e(g.title)} 선택" ${selected ? 'checked' : ''} /></label>${renderBook(g,all)}</div>`;
}
export function selectedBooksCSV(groups: BookGroup[]) {
  const cell = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const rows = [['도서명','저자','선정 횟수','선정처 수','선정처','선정연도','선정 부문별 내역','수록 기록 수','출처URL'], ...groups.map(g => [
    g.title, g.author, String(selectionCount(g.records)), String(institutions(g.records).length), institutions(g.records).join(' · '),
    years(g.records).join(' · '), bookSelections(g.records).map(s=>`${s.year} ${s.institution} / ${s.campaign} / ${s.section}`).join(' | '), String(g.records.length), [...new Set(g.records.map(r=>r.source))].join(' '),
  ])];
  return '\ufeff' + rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
