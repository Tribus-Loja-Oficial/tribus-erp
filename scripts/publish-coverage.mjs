#!/usr/bin/env node

import { readFile } from 'node:fs/promises'

function getTotalsFromCoverageMap(coverageMap) {
  const totals = {
    lines: { covered: 0, total: 0 },
    functions: { covered: 0, total: 0 },
    branches: { covered: 0, total: 0 },
    statements: { covered: 0, total: 0 },
  }

  for (const file of Object.values(coverageMap)) {
    if (!file || typeof file !== 'object') continue
    const statementCounts = file.s ?? {}
    const statementKeys = Object.keys(statementCounts)
    totals.statements.total += statementKeys.length
    totals.statements.covered += statementKeys.reduce(
      (acc, key) => acc + (Number(statementCounts[key]) > 0 ? 1 : 0),
      0
    )

    const functionCounts = file.f ?? {}
    const functionKeys = Object.keys(functionCounts)
    totals.functions.total += functionKeys.length
    totals.functions.covered += functionKeys.reduce(
      (acc, key) => acc + (Number(functionCounts[key]) > 0 ? 1 : 0),
      0
    )

    const branchCounts = file.b ?? {}
    for (const branchValues of Object.values(branchCounts)) {
      if (!Array.isArray(branchValues)) continue
      totals.branches.total += branchValues.length
      totals.branches.covered += branchValues.reduce((acc, hits) => acc + (Number(hits) > 0 ? 1 : 0), 0)
    }

    const statementMap = file.statementMap ?? {}
    const lineHits = new Map()
    for (const [statementId, loc] of Object.entries(statementMap)) {
      const line = loc?.start?.line
      if (typeof line !== 'number') continue
      const hits = Number(statementCounts[statementId] ?? 0)
      lineHits.set(line, (lineHits.get(line) ?? 0) + hits)
    }
    totals.lines.total += lineHits.size
    totals.lines.covered += Array.from(lineHits.values()).reduce(
      (acc, hits) => acc + (Number(hits) > 0 ? 1 : 0),
      0
    )
  }

  return totals
}

function pct(covered, total) {
  if (!total) return 0
  return Math.round((covered / total) * 10000) / 100
}

async function main() {
  const apiBaseUrl = process.env.MONITOR_API_URL
  const token = process.env.MONITOR_COVERAGE_TOKEN
  if (!apiBaseUrl || !token) {
    throw new Error('Missing MONITOR_API_URL or MONITOR_COVERAGE_TOKEN.')
  }

  const reportPaths = process.argv.slice(2)
  if (reportPaths.length === 0) reportPaths.push('.vitest-coverage.json')

  const mergedCoverageMap = {}
  for (const reportPath of reportPaths) {
    const content = await readFile(reportPath, 'utf8')
    const parsed = JSON.parse(content)
    Object.assign(mergedCoverageMap, parsed.coverageMap ?? {})
  }
  const totals = getTotalsFromCoverageMap(mergedCoverageMap)

  const runUrl =
    process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : null

  const payload = {
    repoKey: 'tribus-erp',
    repoName: 'Tribus ERP',
    lines: pct(totals.lines.covered, totals.lines.total),
    functions: pct(totals.functions.covered, totals.functions.total),
    branches: pct(totals.branches.covered, totals.branches.total),
    statements: pct(totals.statements.covered, totals.statements.total),
    commitSha: process.env.GITHUB_SHA ?? null,
    runUrl,
    updatedAt: new Date().toISOString(),
  }

  const response = await fetch(`${apiBaseUrl}/coverage`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Coverage publish failed (${response.status}): ${text}`)
  }

  console.log(JSON.stringify({ event: 'coverage_published', payload }))
}

void main()
