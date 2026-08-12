import { readFile, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import process from 'node:process';

const root = resolve(import.meta.dirname, '..');
const indexPath = resolve(root, 'docs/architecture/systems.json');

function parseArgs(argv) {
  const options = { systemId: null, list: false, maxChars: null, output: null };

  for (const arg of argv) {
    if (arg === '--list') options.list = true;
    else if (arg.startsWith('--max-chars=')) options.maxChars = Number(arg.slice(12));
    else if (arg.startsWith('--output=')) options.output = arg.slice(9);
    else if (!arg.startsWith('-') && !options.systemId) options.systemId = arg;
    else throw new Error(`未知参数: ${arg}`);
  }

  return options;
}

function formatContract(system) {
  return [
    '# 星尘殖民地系统上下文包',
    '',
    `系统: ${system.name} (${system.id})`,
    `实现状态: ${system.status}`,
    `职责: ${system.summary}`,
    `状态所有权: ${system.owns.join('；') || '无'}`,
    `事件: ${system.events.join('；') || '无'}`,
    `设计参考: ${system.designRefs.join('；') || '无'}`,
    '',
    '## 使用规则',
    '- 本包用于定位，不证明行为正确。修改前核对目标实现、直接调用方、状态迁移和测试。',
    '- 设计文档描述目标；实现状态和当前源码描述现状。',
    '- 跨系统修改请分别生成相关系统上下文包。',
    '- UI 和 AI 不拥有核心玩法状态；生成式 AI 不得决定数值结果。',
    '',
    '## 机器可读契约',
    '```json',
    JSON.stringify(system, null, 2),
    '```',
    '',
  ].join('\n');
}

function appendBounded(parts, text, budget) {
  const used = parts.reduce((sum, part) => sum + part.length, 0);
  const remaining = budget - used;
  if (remaining <= 0) return false;

  if (text.length <= remaining) {
    parts.push(text);
    return true;
  }

  const marker = '\n\n[上下文包达到字符上限，文件在此截断]\n';
  parts.push(text.slice(0, Math.max(0, remaining - marker.length)) + marker);
  return false;
}

async function fileSection(file) {
  const absolute = resolve(root, file);
  const content = await readFile(absolute, 'utf8');
  const extension = file.split('.').pop();
  return `\n## 文件: ${file}\n\n\`\`\`${extension}\n${content}\n\`\`\`\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const index = JSON.parse(await readFile(indexPath, 'utf8'));

  if (options.list) {
    for (const system of index.systems) {
      console.log(`${system.id.padEnd(22)} ${system.status.padEnd(14)} ${system.name}`);
    }
    return;
  }

  if (!options.systemId) {
    throw new Error('请指定系统 ID；运行 npm run context -- --list 查看可用系统。');
  }

  const system = index.systems.find((entry) => entry.id === options.systemId);
  if (!system) {
    throw new Error(`未知系统: ${options.systemId}；运行 npm run context -- --list 查看可用系统。`);
  }

  const maxChars = options.maxChars ?? index.generatedContextDefaultChars ?? 120000;
  if (!Number.isInteger(maxChars) || maxChars < 10000 || maxChars > 500000) {
    throw new Error('--max-chars 必须是 10000 到 500000 之间的整数。');
  }

  const parts = [formatContract(system)];
  const orderedFiles = [
    'CLAUDE.md',
    'docs/architecture/SYSTEMS.md',
    ...system.files,
    ...system.callers,
  ].filter((file, index, files) => files.indexOf(file) === index);

  for (const file of orderedFiles) {
    const section = await fileSection(file);
    if (!appendBounded(parts, section, maxChars)) break;
  }

  const output = parts.join('');
  if (options.output) {
    const outputPath = resolve(process.cwd(), options.output);
    await writeFile(outputPath, output, 'utf8');
    console.error(`已写入 ${relative(process.cwd(), outputPath)}（${output.length} 字符）`);
  } else {
    process.stdout.write(output);
  }
}

main().catch((error) => {
  console.error(`生成上下文失败: ${error.message}`);
  process.exitCode = 1;
});
