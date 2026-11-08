export interface Game {
	id: string;
	title: string;
	localTitle: string;
	aliases: string[];
	score: number;
	scorePlatform: string;
	ps5Score: number | null;
	ps4Score: number | null;
	platforms: string[];
	languageEvidence: string;
	mainHours: number | null;
	extraHours: number | null;
	difficulty: number | null;
	difficultyNote: string;
	trophyTime: string;
	otherTime: string;
	timeNote: string;
	requirements: string;
	plus: {
		kind: string;
		plan: string;
		ending: { date: string; at: string | null; kind: string; source: string } | null;
		variant: string;
	};
	sources: { meta: string; language: string; time: string; trophy: string; plus: string };
	checkedAt: string;
}

export interface GameFilters {
	query: string;
	score: string;
	time: string;
	platform: string;
	difficulty: string;
	plus: string;
	sort: string;
}

export const PAGE_SIZE = 24;
export const defaults: GameFilters = {
	query: '', score: '70', time: '', platform: '', difficulty: '', plus: '', sort: 'score',
};

const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({
	'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]!));

export function normalize(value: string): string {
	return value.normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}

export function formatHours(value: number | null): string {
	if (value === null) return '미확인';
	return value < 1 ? `${Math.round(value * 60)}분` : `${Number(value.toFixed(1)).toLocaleString('ko-KR')}시간`;
}

export function plusState(game: Game, now = new Date()): 'included' | 'monthly' | 'ending' | 'expired' | 'reported' | 'trial' | 'unknown' {
	const ending = game.plus.ending;
	if (ending?.kind === 'official') {
		return ending.at && new Date(ending.at).getTime() <= now.getTime() ? 'expired' : 'ending';
	}
	if (ending) return 'reported';
	if (['included', 'monthly', 'trial'].includes(game.plus.kind)) return game.plus.kind as 'included' | 'monthly' | 'trial';
	return 'unknown';
}

export function included(game: Game, now = new Date()): boolean {
	return ['included', 'monthly'].includes(game.plus.kind) && plusState(game, now) !== 'expired';
}

export function plusLabel(game: Game, now = new Date()): string {
	const state = plusState(game, now);
	const date = game.plus.ending?.date.slice(5).replace('-', '/');
	if (state === 'ending') return `${date} 제공 종료 예정`;
	if (state === 'expired') return `${date} 제공 종료 안내`;
	if (state === 'reported') return `${date} 해외 제외 보도`;
	if (state === 'monthly') return '에센셜 월간 게임';
	if (state === 'included') return game.plus.plan;
	if (state === 'trial') return '시간 제한 체험판';
	return '포함 여부 미확인';
}

export function selectGames(games: Game[], filters: GameFilters, now = new Date()): Game[] {
	const query = normalize(filters.query);
	const selected = games.filter(game => {
		if (game.score < Number(filters.score)) return false;
		if (query && !normalize([game.title, game.localTitle, ...game.aliases].join(' ')).includes(query)) return false;
		if (filters.platform && !game.platforms.includes(filters.platform)) return false;
		const hours = game.mainHours;
		if (filters.time === 'short' && !(hours !== null && hours <= 10)) return false;
		if (filters.time === 'medium' && !(hours !== null && hours > 10 && hours <= 30)) return false;
		if (filters.time === 'long' && !(hours !== null && hours > 30 && hours <= 60)) return false;
		if (filters.time === 'epic' && !(hours !== null && hours > 60)) return false;
		if (filters.time === 'unknown' && hours !== null) return false;
		const difficulty = game.difficulty;
		if (filters.difficulty === 'easy' && !(difficulty !== null && difficulty <= 3)) return false;
		if (filters.difficulty === 'medium' && !(difficulty !== null && difficulty > 3 && difficulty <= 6)) return false;
		if (filters.difficulty === 'hard' && !(difficulty !== null && difficulty > 6)) return false;
		if (filters.difficulty === 'unknown' && difficulty !== null) return false;
		const state = plusState(game, now);
		if (filters.plus === 'included' && !included(game, now)) return false;
		if (filters.plus === 'ending' && !game.plus.ending) return false;
		if (filters.plus === 'trial' && state !== 'trial') return false;
		if (filters.plus === 'unknown' && (included(game, now) || state === 'trial')) return false;
		return true;
	});
	const byName = (a: Game, b: Game) => a.localTitle.localeCompare(b.localTitle, 'ko');
	return selected.sort((a, b) => {
		if (filters.sort === 'title') return byName(a, b);
		if (filters.sort === 'time') return (a.mainHours ?? Infinity) - (b.mainHours ?? Infinity) || b.score - a.score || byName(a, b);
		if (filters.sort === 'difficulty') return (a.difficulty ?? Infinity) - (b.difficulty ?? Infinity) || b.score - a.score || byName(a, b);
		return b.score - a.score || byName(a, b);
	});
}

function sourceLink(label: string, url: string): string {
	return /^https?:\/\//.test(url) ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>` : '';
}

export function renderGame(game: Game, now = new Date()): string {
	const state = plusState(game, now);
	const product = game.languageEvidence === 'product';
	const ending = game.plus.ending;
	const sourceLinks = [sourceLink('메타크리틱', game.sources.meta), sourceLink(product ? '한국어 패키지 제품 명세' : '한국어 공식 근거', game.sources.language), sourceLink('플레이 시간', game.sources.time), sourceLink('트로피 난도', game.sources.trophy), sourceLink('PS Plus', game.sources.plus), sourceLink('종료 일정', ending?.source ?? '')].filter(Boolean).join('');
	const definition = (label: string, value: string) => `<div><dt>${label}</dt><dd>${escape(value)}</dd></div>`;
	const variant = game.plus.variant ? `<p>${escape(game.plus.variant)}</p>` : '';
	const endingNote = ending ? `<p class="game-ending-note">${ending.kind === 'official' ? `${escape(ending.date)} ${ending.at ? '오전 9시(한국 시간)' : ''} PS Store 제공 안내 종료. 구매 할인 기간과 구분한 일정입니다.` : `${escape(ending.date)} 해외 제외 보도가 있습니다. 한국 계정의 종료 일정은 미확인입니다.`}</p>` : '';
	const languageNote = product ? '<p>한국어 근거는 국내 패키지 제품 명세입니다. 디스크 실행에는 드라이브가 있는 PS5가 필요하며, 디지털·구독 제공판의 언어는 별도로 확인하세요.</p>' : '';
	return `<details class="game-item" data-game-id="${escape(game.id)}"><summary class="game-summary"><span class="game-name"><span class="game-local-title">${escape(game.localTitle)}</span>${game.localTitle !== game.title ? `<span class="game-original-title">${escape(game.title)}</span>` : ''}<span class="game-edition">${escape(game.platforms.join(' · '))}${product ? ' · 한국어 패키지판' : ''}${game.requirements ? ' · '+escape(game.requirements) : ''}</span></span><span class="game-value game-score"><span class="game-mobile-label">메타</span><strong>${game.score}</strong><small>${escape(game.scorePlatform)} 평가</small></span><span class="game-value"><span class="game-mobile-label">본편</span><strong>${formatHours(game.mainHours)}</strong>${game.mainHours === null && (game.otherTime || game.extraHours !== null) ? '<small>다른 집계 있음</small>' : ''}</span><span class="game-value"><span class="game-mobile-label">트로피 난도</span><strong>${game.difficulty === null ? '미확인' : `${game.difficulty}<small class="game-denominator">/ 10</small>`}</strong></span><span class="game-value game-plus game-plus-${state}"><span class="game-mobile-label">PS Plus</span><strong>${escape(plusLabel(game, now))}</strong>${['ending','expired'].includes(state) ? `<small>${escape(game.plus.plan)}</small>` : state === 'reported' ? '<small>한국 일정 미확인</small>' : ''}<span class="game-disclosure">상세·출처 <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></span></span></summary><div class="game-details"><dl>${definition('수록 플랫폼별 메타스코어', `PS5 ${game.ps5Score ?? '미수록'} / PS4 ${game.ps4Score ?? '미수록'}`)}${definition('본편 / 본편+부가', `${formatHours(game.mainHours)} / ${formatHours(game.extraHours)}`)}${definition('시간 집계', game.timeNote)}${definition('트로피 완료 난도', game.difficultyNote || '미확인')}${definition('트로피 완료 시간', game.trophyTime || '미확인')}${game.otherTime ? definition('기타 플레이 시간', game.otherTime) : ''}${definition('한국어 근거', product ? '국내 한국어 패키지판 제품 명세' : '공식 스토어 또는 개발사·유통사 공지')}${definition('PS Plus', plusLabel(game, now))}${definition('자료 확인일', game.checkedAt)}</dl>${endingNote}${variant}${languageNote}<nav class="game-sources" aria-label="${escape(game.localTitle)} 출처">${sourceLinks}</nav></div></details>`;
}

export function gamesCsv(games: Game[], now = new Date()): string {
	const headers = ['게임명','영문명','메타스코어','평가 기종','PS5 점수','PS4 점수','실행판','한국어 근거','본편 시간','본편+부가 시간','트로피 완료 난도','트로피 완료 시간','PS Plus 표기','제공 플랜','제공 판본 참고','종료 예정일','종료 시각','종료 근거 구분','자료 확인일','메타 출처','한국어 출처','시간 출처','트로피 출처','PS Plus 출처','종료 출처'];
	const quote = (value: unknown) => { const text = String(value ?? ''); return '"'+(/^[=+\-@]/.test(text) ? "'"+text : text).replace(/"/g,'""')+'"'; };
	const lines = games.map(game => [game.localTitle, game.title, game.score, game.scorePlatform, game.ps5Score, game.ps4Score, game.platforms.join('/'), game.languageEvidence === 'product' ? '한국어 패키지 제품 명세' : '공식 자료', formatHours(game.mainHours), formatHours(game.extraHours), game.difficultyNote || '미확인', game.trophyTime || '미확인', plusLabel(game, now), game.plus.plan, game.plus.variant, game.plus.ending?.date || '미확인', game.plus.ending?.at || '미확인', game.plus.ending?.kind === 'official' ? '한국 공식 제공 안내' : game.plus.ending ? '해외 보도·한국 미확인' : '미확인', game.checkedAt, game.sources.meta, game.sources.language, game.sources.time, game.sources.trophy, game.sources.plus, game.plus.ending?.source || '']);
	return '\ufeff'+[headers, ...lines].map(row => row.map(quote).join(',')).join('\r\n');
}
