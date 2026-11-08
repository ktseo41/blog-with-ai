import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gamesCsv, type Game } from '../src/lib/games.ts';

const games = JSON.parse(readFileSync(new URL('../src/data/ps5-games.json', import.meta.url), 'utf8')) as Game[];
if (games.length !== 833 || new Set(games.map(game => game.id)).size !== games.length) throw new Error('게임 수 또는 고유 ID 검증 실패');
for (const game of games) {
	if (game.score < 70 || game.score > 100) throw new Error(`메타스코어 범위 오류: ${game.id}`);
	if (game.mainHours !== null && game.mainHours <= 0) throw new Error(`본편 시간 오류: ${game.id}`);
	if (!/^https:\/\//.test(game.sources.meta) || !/^https:\/\//.test(game.sources.language)) throw new Error(`출처 누락: ${game.id}`);
}
const output = new URL('../public/games/', import.meta.url);
mkdirSync(output, { recursive: true });
writeFileSync(new URL('ps5-korean-games-2026-11-08.csv', output), gamesCsv(games).replace(/\r\n/g, '\n') + '\n');
writeFileSync(new URL('ps5-korean-games-2026-11-08.json', output), JSON.stringify(games));
console.log(`게임 ${games.length}개 작품·판본 CSV 생성: ${fileURLToPath(output)}`);
