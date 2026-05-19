---
name: mineru-document-extractor
description: Use when extracting content from PDFs, scanned documents, Office files, images, or web pages into Markdown, HTML, LaTeX, DOCX, or JSON, especially when OCR, tables, formulas, or batch document conversion are required.
metadata: {"openclaw":{"homepage":"https://mineru.net","source":"https://github.com/opendatalab/MinerU-Ecosystem","author":"OpenDataLab","privacy":"Document content is transmitted to the MinerU API for server-side extraction. Use flash-extract for token-free quick extraction.","requires":{"bins":["mineru-open-api"]},"optional":{"env":["MINERU_TOKEN"],"config":["~/.mineru/config.yaml"]},"install":[{"id":"npm","kind":"node","package":"mineru-open-api","bins":["mineru-open-api"],"label":"Install via npm"},{"id":"go","kind":"go","package":"github.com/opendatalab/MinerU-Ecosystem/cli/mineru-open-api","bins":["mineru-open-api"],"label":"Install via go install","os":["darwin","linux"]}]}}
allowed-tools: Bash(mineru-open-api:*)
---

# MinerU Document Extraction

Use the `mineru-open-api` CLI for document extraction. Prefer the token-free quick path first, then switch to authenticated extraction when the user needs larger files, batch conversion, or non-Markdown output.

## Install and Verify

```bash
npm install -g mineru-open-api
mineru-open-api version
```

On macOS or Linux, Go installation is also supported:

```bash
go install github.com/opendatalab/MinerU-Ecosystem/cli/mineru-open-api@latest
```

## Quick Extraction

Use `flash-extract` by default when no token is configured or the user only needs Markdown.

```bash
mineru-open-api flash-extract report.pdf
mineru-open-api flash-extract report.pdf -o ./out/
mineru-open-api flash-extract https://example.com/doc.pdf
mineru-open-api flash-extract report.pdf --language en --pages 1-10
```

`flash-extract` is token-free and returns Markdown. It is intended for smaller files and quick conversion.

## Authenticated Extraction

Use `extract` when the user needs larger files, batch processing, model control, OCR/table/formula options, or output formats such as HTML, LaTeX, DOCX, or JSON.

```bash
mineru-open-api auth
export MINERU_TOKEN="your-token"
mineru-open-api extract report.pdf -f md,html,json -o ./out/
mineru-open-api extract *.pdf -o ./results/
mineru-open-api extract report.pdf --model pipeline --ocr --table --formula
```

Token lookup order is `--token`, `MINERU_TOKEN`, then `~/.mineru/config.yaml`.

## Web Pages

Use `crawl` for web content extraction.

```bash
mineru-open-api crawl https://example.com/article
mineru-open-api crawl https://example.com/article -o ./out/
```

## Operating Rules

- Quote file paths with spaces.
- Use `flash-extract` first for small, simple, token-free Markdown conversion.
- Use `extract` for batch work, larger files, non-Markdown formats, or explicit OCR/table/formula requirements.
- Use `--model pipeline` when reliability and no hallucination are more important than complex layout interpretation.
- If no output directory is specified for file-producing workflows, create one under `~/MinerU-Skill/`.
- For CLI reference and troubleshooting, see https://github.com/opendatalab/MinerU-Ecosystem/tree/main/cli.
