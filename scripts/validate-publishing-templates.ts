#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type PublishingTemplateConfig = {
  id: string;
  kind: string;
  state: string;
  html_theme: string;
  css_file: string;
  latex_header: string;
  preferred_pdf_engine?: string;
  stable_pdf_engine?: string;
};

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatesRoot = path.join(appRoot, 'docs', 'publishing', 'templates');
const requiredTemplates = ['opl-guide', 'opl-whitepaper', 'opl-quickstart'];

function relativeToApp(filePath: string) {
  return path.relative(appRoot, filePath);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function assertFile(filePath: string) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`Missing publishing template file: ${relativeToApp(filePath)}`);
  }
}

function assertNoTemplatePlaceholder(filePath: string) {
  const text = fs.readFileSync(filePath, 'utf8');
  if (/\{\{[^}]+\}\}/.test(text)) {
    throw new Error(`Publishing template contains unresolved placeholder: ${relativeToApp(filePath)}`);
  }
}

function validateTemplate(templateId: string) {
  const templateDir = path.join(templatesRoot, templateId);
  const readmePath = path.join(templateDir, 'README.md');
  const configPath = path.join(templateDir, 'template.json');

  assertFile(readmePath);
  assertFile(configPath);

  const config = readJson<PublishingTemplateConfig>(configPath);
  if (config.id !== templateId) {
    throw new Error(`Publishing template id mismatch in ${relativeToApp(configPath)}: ${config.id}`);
  }
  if (config.kind !== 'quarto_book_template') {
    throw new Error(`Publishing template kind must be quarto_book_template: ${relativeToApp(configPath)}`);
  }
  if (config.state !== 'active') {
    throw new Error(`Publishing template must be active: ${relativeToApp(configPath)}`);
  }
  if (!config.html_theme || !config.css_file || !config.latex_header) {
    throw new Error(`Publishing template must declare html_theme, css_file, and latex_header: ${relativeToApp(configPath)}`);
  }
  if (config.css_file.includes('/') || config.css_file.includes('\\') || config.latex_header.includes('/') || config.latex_header.includes('\\')) {
    throw new Error(`Publishing template asset names must stay inside template dir: ${relativeToApp(configPath)}`);
  }

  const cssPath = path.join(templateDir, config.css_file);
  const headerPath = path.join(templateDir, config.latex_header);
  assertFile(cssPath);
  assertFile(headerPath);
  assertNoTemplatePlaceholder(readmePath);
  assertNoTemplatePlaceholder(cssPath);
  assertNoTemplatePlaceholder(headerPath);

  const readme = fs.readFileSync(readmePath, 'utf8');
  if (!readme.includes('State: `active`')) {
    throw new Error(`Publishing template README must declare State: active: ${relativeToApp(readmePath)}`);
  }
  if (/\breserved\b/i.test(readme)) {
    throw new Error(`Publishing template README must not describe an active template as reserved: ${relativeToApp(readmePath)}`);
  }

  return {
    id: config.id,
    kind: config.kind,
    state: config.state,
    html_theme: config.html_theme,
    css_file: relativeToApp(cssPath),
    latex_header: relativeToApp(headerPath),
    preferred_pdf_engine: config.preferred_pdf_engine ?? null,
    stable_pdf_engine: config.stable_pdf_engine ?? null,
  };
}

const templates = requiredTemplates.map(validateTemplate);

console.log(JSON.stringify({
  status: 'publishing_templates_ready',
  templates_root: relativeToApp(templatesRoot),
  templates,
}, null, 2));
