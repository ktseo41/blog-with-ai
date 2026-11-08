import { mkdir, readFile, writeFile } from 'node:fs/promises';

const data = JSON.parse(await readFile(new URL('../src/data/model-benchmarks.json', import.meta.url), 'utf8'));
const directory = new URL('../public/benchmarks/', import.meta.url);
await mkdir(directory, { recursive: true });

const rows = [['series', 'model', 'version_month', 'type', 'mode', 'benchmark', 'score', 'unit', 'condition', 'source_url', 'retrieved']];
for (const model of data.models) {
  for (const [metric, value] of Object.entries(model.scores)) {
    rows.push(['historical', model.name, model.date, model.kind, model.mode, data.metrics[metric].label, value, '%', model.condition, data.sources[model.source].url, data.asOf]);
  }
}
for (const model of data.current.models) {
  rows.push(['current_index', model.name, data.asOf, '', '', data.current.version, model.value, 'index', '같은 평가 기관·같은 지수 버전', data.sources[data.current.source].url, data.asOf]);
}
rows.push(['current_index', 'Gemma 4 E4B', data.asOf, 'open', '', data.current.version, '', 'index', 'N/A; not zero', data.sources[data.current.source].url, data.asOf]);
for (const model of data.currentTasks.models) {
  rows.push(['current_coding', model.name, data.asOf, '', '', data.currentTasks.label, model.value, '%', data.currentTasks.note, data.sources[data.currentTasks.source].url, data.asOf]);
}
rows.push(['current_coding', 'Gemma 4 E4B', data.asOf, 'open', '', data.currentTasks.label, '', '%', 'Not verified; not zero', data.sources[data.currentTasks.source].url, data.asOf]);

const cell = (value) => `"${String(value).replaceAll('"', '""')}"`;
await writeFile(new URL('records.csv', directory), `\uFEFF${rows.map((row) => row.map(cell).join(',')).join('\n')}\n`);
await writeFile(new URL('models.json', directory), `${JSON.stringify(data, null, 2)}\n`);
console.log(`Exported ${rows.length - 1} observations, including two missing values.`);
