import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

const root = resolve(import.meta.dirname, '..');
const indexPath = resolve(root, 'docs/architecture/systems.json');

function hasExport(source, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const direct = new RegExp(`export\\s+(?:async\\s+)?(?:class|function|const|let|var)\\s+${escaped}\\b`);
  const list = new RegExp(`export\\s*\\{[^}]*\\b${escaped}\\b[^}]*\\}`, 's');
  return direct.test(source) || list.test(source);
}

async function main() {
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  const errors = [];
  const ids = new Set();

  if (index.schemaVersion !== 1) errors.push('systems.json schemaVersion 必须为 1');
  if (!Array.isArray(index.systems) || index.systems.length === 0) {
    errors.push('systems.json 必须包含非空 systems 数组');
  }

  for (const system of index.systems ?? []) {
    if (!system.id || ids.has(system.id)) errors.push(`系统 ID 缺失或重复: ${system.id ?? '<empty>'}`);
    ids.add(system.id);

    for (const key of ['name', 'status', 'summary']) {
      if (!system[key]) errors.push(`${system.id}: 缺少 ${key}`);
    }

    const referencedFiles = [...(system.files ?? []), ...(system.callers ?? [])];
    for (const file of new Set(referencedFiles)) {
      try {
        await access(resolve(root, file));
      } catch {
        errors.push(`${system.id}: 文件不存在 ${file}`);
      }
    }

    for (const declaration of system.exports ?? []) {
      const absolute = resolve(root, declaration.file);
      let source;
      try {
        source = await readFile(absolute, 'utf8');
      } catch {
        errors.push(`${system.id}: 导出来源不存在 ${declaration.file}`);
        continue;
      }

      for (const name of declaration.names ?? []) {
        if (!hasExport(source, name)) {
          errors.push(`${system.id}: ${declaration.file} 未找到导出 ${name}`);
        }
      }
    }
  }

  if (errors.length) {
    console.error('架构索引校验失败:');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`架构索引有效：${index.systems.length} 个系统，路径与公共导出均存在。`);
}

main().catch((error) => {
  console.error(`架构索引校验失败: ${error.message}`);
  process.exitCode = 1;
});
