#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOplWhitepaper } from './opl-whitepaper-builder.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

buildOplWhitepaper({
  repoRoot,
  sourceMarkdown: 'docs/whitepapers/opl-app-whitepaper.md',
  outputName: 'opl-app-whitepaper',
  status: 'opl_app_whitepaper_ready',
  owner: 'one-person-lab-app',
  coverLine: 'OPL App / Docker WebUI / OPL Workspace / Foundry Agents',
  headerTitle: 'OPL App Whitepaper',
  minPdfPages: 6,
  requiredSections: [
    '## 定位摘要',
    '## 为什么不是再做一个聊天框',
    '## OPL App 的答案：可信专业工作台',
    '## 一个工作台，不用跳工具',
    '## 专业智能体：用户先看到工作目的',
    '## 结果带来路',
    '## 工作台跟着工作走',
    '## 用已有资源，不重建世界',
    '## 为什么用户可以相信 OPL App 专业',
    '## 与 Framework、Cloud 和 Foundry Agents 的关系',
    '## 用户会如何感知 OPL App',
    '## 本文边界',
    '## 结语',
  ],
  requiredTerms: [
    'OPL App 白皮书',
    '可信专业工作台',
    '本地优先',
    '云端连续',
    '一个工作台，不用跳工具',
    '结果带来路',
    '工作台跟着工作走',
    'Docker/WebUI',
    'OPL Workspace',
    'OPL Framework',
    'OPL Cloud',
    'Foundry Agents',
    'Med Auto Science',
    'Med Auto Grant',
    'RedCube AI',
    'OPL Book Forge',
    'OPL Meta Agent',
    '为什么用户可以相信 OPL App 专业',
    '本文边界',
    '结语',
  ],
});
