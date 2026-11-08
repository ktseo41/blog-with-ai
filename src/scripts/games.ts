import { defaults, gamesCsv, PAGE_SIZE, renderGame, selectGames, type Game, type GameFilters } from '../lib/games';

async function initializeGames() {
	const root = document.querySelector<HTMLElement>('[data-game-explorer]');
	if (!root || root.dataset.initialized) return;
	root.dataset.initialized = 'loading';
	const form = root.querySelector<HTMLFormElement>('#game-filters')!;
	const results = root.querySelector<HTMLElement>('#game-results')!;
	const count = root.querySelector<HTMLElement>('#game-result-count')!;
	const pageStatus = root.querySelector<HTMLElement>('#game-page-status')!;
	const previous = root.querySelector<HTMLButtonElement>('#game-prev')!;
	const next = root.querySelector<HTMLButtonElement>('#game-next')!;
	const download = root.querySelector<HTMLButtonElement>('#game-export')!;
	const sort = root.querySelector<HTMLSelectElement>('#game-sort')!;
	const error = root.querySelector<HTMLElement>('#game-data-error')!;
	const controls = root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('[data-game-preset], #game-filters input, #game-filters select, #game-filters button, #game-sort, #game-prev, #game-next, #game-export');
	controls.forEach(control => { control.disabled = true; });
	root.setAttribute('aria-busy', 'true');
	let games: Game[];
	try {
		const response = await fetch('/games/ps5-korean-games-2026-11-08.json');
		if (!response.ok) throw new Error('Game data unavailable');
		games = await response.json();
		if (!Array.isArray(games) || !games.length) throw new Error('Invalid game data');
	} catch {
		root.dataset.initialized = 'error';
		error.hidden = false;
		count.textContent = '검색 자료를 불러오지 못했습니다.';
		root.setAttribute('aria-busy', 'false');
		error.querySelector('button')?.addEventListener('click', () => {
			delete root.dataset.initialized;
			error.hidden = true;
			void initializeGames();
		}, { once: true });
		return;
	}
	if (!root.isConnected) return;
	root.dataset.initialized = 'true';
	root.setAttribute('aria-busy', 'false');
	controls.forEach(control => { control.disabled = false; });
	let page = 1;
	let filtered = games;
	const parameters = new URLSearchParams(location.search);
	for (const key of Object.keys(defaults)) {
		const element = key === 'sort' ? sort : form.elements.namedItem(key);
		const value = parameters.get(key);
		if (value !== null && (element instanceof HTMLInputElement || element instanceof HTMLSelectElement)) {
			if (element instanceof HTMLInputElement || [...element.options].some(option => option.value === value)) element.value = value;
		}
	}

	function render(updateUrl = true) {
		const values = Object.fromEntries(new FormData(form)) as unknown as GameFilters;
		values.sort = sort.value;
		filtered = selectGames(games, values);
		const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
		page = Math.min(page, pages);
		const start = (page - 1) * PAGE_SIZE;
		results.innerHTML = filtered.length ? filtered.slice(start, start + PAGE_SIZE).map(game => renderGame(game)).join('') : '<div class="game-empty"><p>조건에 맞는 게임이 없습니다.</p><p>검색어를 짧게 쓰거나 ‘초기화’를 눌러 전체 목록을 확인하세요.</p></div>';
		count.textContent = `${filtered.length.toLocaleString('ko-KR')}개 작품·판본`;
		pageStatus.textContent = filtered.length ? `${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} / ${filtered.length.toLocaleString('ko-KR')}개 · ${page} / ${pages}페이지` : '검색 결과 없음';
		previous.disabled = page === 1;
		next.disabled = page === pages;
		download.disabled = filtered.length === 0;
		root.querySelectorAll<HTMLButtonElement>('[data-game-preset]').forEach(button => button.setAttribute('aria-pressed', String(values[button.dataset.filter as keyof GameFilters] === button.dataset.value)));
		if (updateUrl) {
			const url = new URL(location.href);
			for (const [key, value] of Object.entries(values)) {
				if (value && value !== defaults[key as keyof GameFilters]) url.searchParams.set(key, value);
				else url.searchParams.delete(key);
			}
			history.replaceState(null, '', url);
		}
	}
	form.addEventListener('submit', event => event.preventDefault());
	form.addEventListener('input', event => {
		if (event.target instanceof HTMLInputElement) { page = 1; render(); }
	});
	form.addEventListener('change', event => {
		if (event.target instanceof HTMLSelectElement) { page = 1; render(); }
	});
	sort.addEventListener('change', () => { page = 1; render(); });
	form.addEventListener('reset', event => {
		event.preventDefault();
		for (const [key, value] of Object.entries(defaults)) {
			const element = form.elements.namedItem(key);
			if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) element.value = value;
		}
		sort.value = defaults.sort;
		page = 1;
		render();
	});
	root.querySelectorAll<HTMLButtonElement>('[data-game-preset]').forEach(button => button.addEventListener('click', () => {
		const element = form.elements.namedItem(button.dataset.filter!);
		if (element instanceof HTMLSelectElement) {
			element.value = element.value === button.dataset.value ? defaults[button.dataset.filter as keyof GameFilters] : button.dataset.value!;
			page = 1;
			render();
		}
	}));
	function turnPage(direction: number) {
		page += direction;
		render(false);
		root.querySelector<HTMLElement>('.game-results-toolbar')?.scrollIntoView({ block: 'start' });
		root.querySelector<HTMLElement>('#game-result-count')?.focus({ preventScroll: true });
	}
	previous.addEventListener('click', () => turnPage(-1));
	next.addEventListener('click', () => turnPage(1));
	download.addEventListener('click', () => {
		const url = URL.createObjectURL(new Blob([gamesCsv(filtered)], { type: 'text/csv;charset=utf-8' }));
		const link = document.createElement('a');
		link.href = url;
		link.download = `PS5_한국어게임_${filtered.length}개_2026-11-08.csv`;
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	});
	// Recompute dated offers on an already-open page as well as on a fresh visit.
	document.addEventListener('visibilitychange', () => { if (!document.hidden) render(false); });
	render(false);
}

initializeGames();
document.addEventListener('astro:page-load', initializeGames);
