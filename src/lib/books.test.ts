import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groupBooks, selectBooks, defaults, institutions, selectionCount, bookSelections, renderBook, selectorKind, bookSelectionKey, selectedBooksCSV, renderSelectableBook, publicRecordNote } from './books.ts';
import type { BookRecord } from './books.ts';
const rows: BookRecord[] = JSON.parse(readFileSync(new URL('../data/books.json', import.meta.url), 'utf8'));
const groups = groupBooks(rows);

test('all source records survive grouping exactly once', () => {
  assert.ok(rows.length >= 1635);
  assert.equal(groups.reduce((n,g) => n+g.records.length,0), rows.length);
  assert.equal(new Set(groups.flatMap(g => g.records)).size, rows.length);
});
test('same-title books by different authors stay separate; volume and set stay separate', () => {
  assert.equal(groups.filter(g => g.title === '그릿 GRIT').length, 2);
  assert.ok(groups.some(g => g.title === '파친코 1'));
  assert.ok(groups.some(g => /파친코.*세트/.test(g.title)));
  assert.ok(groups.filter(g => /파친코/.test(g.title)).every(g => new Set(g.records.map(r => r.title)).size === 1));
});
test('known spacing and author-role variations merge', () => {
  assert.equal(groups.filter(g => g.title.includes('친절한 교회')).length, 1);
  assert.equal(groups.filter(g => g.title === '아버지의 해방일지').length, 1);
  assert.ok(institutions(groups.find(g => g.title === '아버지의 해방일지')!.records).length >= 3);
  assert.equal(groups.filter(g => g.title === '헤어질 결심 각본').length, 1);
});
test('editorial selections are separate from writer and reader selections', () => {
  assert.equal(selectorKind({...rows[0], selector:'책지성팀 기자'}), 'expert');
  assert.equal(selectorKind({...rows[0], selector:'문화부 편집팀'}), 'expert');
  assert.equal(selectorKind({...rows[0], selector:'출판인 50명'}), 'publisher');
  assert.equal(selectorKind({...rows[0], selector:'소설가 50인'}), 'writer');
});
test('overlap is recomputed within filters, not inherited from whole archive', () => {
  const sameOrg = selectBooks(groups, {...defaults, institution:'YES24', overlap:true});
  assert.ok(sameOrg.length > 0);
  assert.ok(sameOrg.every(g => institutions(g.records).length === 1 && selectionCount(g.records) > 1));
  assert.equal(selectBooks(groups, {...defaults, institution:'YES24', year:'2022', selector:'reader', overlap:true}).length, 0);
  const result = selectBooks(groups, {...defaults, year:'2022', selector:'reader'});
  assert.ok(result.length > 0);
  assert.ok(result.every(g => g.records.every(r => r.year === '2022' && r.selector.includes('독자'))));
});
test('search, safe rendering, and no invented aggregate vote total', () => {
  assert.ok(selectBooks(groups, {...defaults, query:'김애란'}).length > 0);
  assert.equal(selectBooks(groups, {...defaults, query:'없는책xyz'}).length, 0);
  const g = {...groups[0], title:'<script>alert(1)</script>'};
  const html = renderBook(g,g);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('총 득표'));
});
test('saved book choices survive list order changes and distinguish homonymous books', () => {
  const book = groups.find(g=>g.title === '아버지의 해방일지')!;
  const reordered = groupBooks([...rows].reverse()).find(g=>g.title === book.title)!;
  assert.equal(bookSelectionKey(book), bookSelectionKey(reordered));
  const homonyms = groups.filter(g=>g.title === '그릿 GRIT');
  assert.notEqual(bookSelectionKey(homonyms[0]), bookSelectionKey(homonyms[1]));
});
test('selection CSV preserves book facts, quotes and source links without styles', () => {
  const book = groups.find(g=>g.title === '아버지의 해방일지')!;
  const output = selectedBooksCSV([book]);
  assert.ok(output.startsWith('\ufeff"도서명"'));
  assert.equal(output.split('\r\n').length,3);
  assert.ok(output.includes('"5"'));
  assert.ok(output.includes('"선정 횟수","선정처 수"'));
  assert.ok(output.includes('"7","5"'));
  assert.ok(output.includes('2022 YES24 / 내 맘대로 올해의 책 / 작가 추천'));
  assert.ok(output.includes(book.records[0].source));
  const escaped = selectedBooksCSV([{...book,title:'책, "인용"'}]);
  assert.ok(escaped.includes('"책, ""인용"""'));
});
test('selection counts distinguish sections, years and campaigns, not recommenders or metadata', () => {
  const base = {...rows[0], year:'2022', institution:'YES24', campaign:'내 맘대로 올해의 책', type:'작가 추천'};
  const records = [base, {...base,recommender:'다른 추천자',category:'소설'}, {...base,type:'타사 도서 추천'}, {...base,type:'자사 도서 추천'}, {...base,year:'2023'}, {...base,campaign:'별도 기획'}];
  assert.equal(selectionCount(records),5);
  assert.equal(bookSelections(records).reduce((n,s)=>n+s.records.length,0),records.length);
});
test('real selection counts preserve separate YES24 sections and deduplicate Aladin aggregate', () => {
  const father = groups.find(g=>g.title==='아버지의 해방일지')!;
  assert.equal(selectionCount(father.records),7);
  assert.equal(institutions(father.records).length,5);
  assert.equal(selectionCount(father.records.filter(r=>r.institution==='YES24')),3);
  const fish = groups.find(g=>g.title==='물고기는 존재하지 않는다')!;
  const aladin = fish.records.filter(r=>r.institution==='알라딘');
  assert.equal(aladin.length,11);
  assert.equal(selectionCount(aladin),1);
  assert.equal(selectionCount(fish.records),4);
  const html = renderBook(father,father);
  assert.ok(html.includes('7<small>회</small>'));
  assert.equal((html.match(/<li>/g)||[]).length,7);
});
test('default sort ranks selection frequency; institution sort remains available', () => {
  const result = selectBooks(groups,defaults);
  assert.ok(result.every((g,i)=>!i || selectionCount(result[i-1].records)>=selectionCount(g.records)));
  const orgOrder = selectBooks(groups,{...defaults,sort:'institutions'});
  assert.ok(orgOrder.every((g,i)=>!i || institutions(orgOrder[i-1].records).length>=institutions(g.records).length));
});
test('selection checkbox is separate from the disclosure; only reader-relevant notes remain', () => {
  const book = groups[0];
  const html = renderSelectableBook(book,book,true);
  assert.ok(html.indexOf('</label>') < html.indexOf('<details'));
  assert.ok(html.includes('checked'));
  assert.equal(publicRecordNote('추천자 이름 미추출; 화면에 표시된 추천 카드 1번'),'');
  assert.equal(publicRecordNote('본문과 표의 득표 수 불일치; 개별 카드 1번'),'본문과 표의 득표 수 불일치');
});
