import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaults, formatHours, gamesCsv, included, plusLabel, plusState, renderGame, selectGames, type Game } from './games.ts';

const games = JSON.parse(readFileSync(new URL('../data/ps5-games.json', import.meta.url), 'utf8')) as Game[];
const before = new Date('2026-11-08T00:00:00Z');
const atEnd = new Date('2026-11-17T00:00:00Z');
const rdr = games.find(game => game.id === 'red-dead-redemption-2')!;

test('공개 자료는 확인한 833개 판본과 원문 출처를 유지한다', () => {
	assert.equal(games.length, 833);
	assert.equal(new Set(games.map(game => game.id)).size, 833);
	assert.equal(games.filter(game => game.languageEvidence === 'product').length, 15);
	assert.equal(games.filter(game => game.mainHours !== null).length, 812);
	assert.equal(games.filter(game => game.difficulty !== null).length, 596);
	assert.ok(games.every(game => game.score >= 70 && game.score === (game.scorePlatform === 'PS5' ? game.ps5Score : game.ps4Score)));
	assert.ok(games.every(game => game.sources.meta.startsWith('https://') && game.sources.language.startsWith('https://')));
});

test('공식 제공 종료 시각부터는 제공 확인 목록에서 제외한다', () => {
	assert.equal(plusState(rdr, before), 'ending');
	assert.equal(plusLabel(rdr, before), '11/17 제공 종료 예정');
	assert.equal(included(rdr, before), true);
	assert.equal(plusState(rdr, atEnd), 'expired');
	assert.equal(included(rdr, atEnd), false);
	assert.equal(plusLabel(rdr, atEnd), '11/17 제공 종료 안내');
	assert.equal(selectGames(games, { ...defaults, plus: 'included' }, before).length, 153);
	assert.equal(selectGames(games, { ...defaults, plus: 'included' }, atEnd).length, 150);
});

test('해외 제외 보도는 한국 공식 종료로 바뀌지 않는다', () => {
	const talos = games.find(game => game.id === 'the-talos-principle-2')!;
	assert.equal(plusState(talos, atEnd), 'reported');
	assert.equal(plusLabel(talos, atEnd), '11/17 해외 제외 보도');
	assert.ok(renderGame(talos, atEnd).includes('한국 계정의 종료 일정은 미확인'));
	assert.equal(selectGames(games, { ...defaults, plus: 'ending' }, before).length, 5);
});

test('한국어 제목 검색과 결합 필터가 원자료 조건을 지킨다', () => {
	assert.equal(selectGames(games, { ...defaults, query: '레드데드 리뎀션2' }, before)[0]?.id, rdr.id);
	const selected = selectGames(games, { ...defaults, score: '90', plus: 'included', time: 'short' }, before);
	assert.ok(selected.length > 0);
	assert.ok(selected.every(game => game.score >= 90 && game.mainHours !== null && game.mainHours <= 10 && included(game, before)));
	assert.equal(selectGames(games, { ...defaults, query: '존재하지않는게임zzxyz' }, before).length, 0);
});

test('미확인 시간은 짧은 게임에 들어가지 않고 1시간 미만은 분으로 표시한다', () => {
	assert.equal(formatHours(.95), '57분');
	assert.equal(formatHours(null), '미확인');
	assert.ok(selectGames(games, { ...defaults, time: 'short' }, before).every(game => game.mainHours !== null));
	assert.ok(selectGames(games, { ...defaults, time: 'unknown' }, before).every(game => game.mainHours === null));
});

test('제목 렌더링과 CSV는 마크업·수식으로 실행되지 않게 이스케이프한다', () => {
	const malicious = { ...rdr, localTitle: '<img src=x onerror=alert(1)>', title: '=1+1' };
	assert.ok(!renderGame(malicious, before).includes('<img src=x'));
	assert.ok(renderGame(malicious, before).includes('&lt;img'));
	const csv = gamesCsv([malicious], before);
	assert.ok(csv.startsWith('\ufeff'));
	assert.ok(csv.includes("\"'=1+1\""));
	assert.ok(csv.includes('종료 예정일'));
});
