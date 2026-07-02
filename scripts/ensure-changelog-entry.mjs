#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const [latestVersion, version] = process.argv.slice(2);

if (!latestVersion || !version) {
  throw new Error("用法：node scripts/ensure-changelog-entry.mjs <latestVersion> <version>");
}

const changelogPath = "CHANGELOG.md";
const changelog = readFileSync(changelogPath, "utf8");
const lines = changelog.split(/\r?\n/);
const headingIndex = lines.findIndex((line) => {
  return line.startsWith(`## ${version} `) || line.startsWith(`## [${version}]`);
});

if (headingIndex === -1) {
  throw new Error(`没有找到 CHANGELOG.md 里的版本标题：${version}`);
}

const nextHeadingIndex = lines.findIndex((line, index) => {
  return index > headingIndex && line.startsWith("## ");
});
const bodyStart = headingIndex + 1;
const bodyEnd = nextHeadingIndex === -1 ? lines.length : nextHeadingIndex;
const body = lines.slice(bodyStart, bodyEnd).join("\n").trim();

if (body.length > 0) {
  process.exit(0);
}

const groups = collectCommitGroups(latestVersion, version);
const fallback = groups.length > 0 ? groups : [{ title: "Other", items: ["无"] }];
const insertion = [
  "",
  ...fallback.flatMap((group) => ["", `### ${group.title}`, "", ...group.items.map((item) => `- ${item}`)]),
  "",
];

const nextLines = [...lines.slice(0, bodyStart), ...insertion, ...lines.slice(bodyEnd)];
writeFileSync(changelogPath, `${nextLines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`);

function collectCommitGroups(previous, current) {
  const previousTag = tagName(previous);
  const currentTag = tagName(current);
  const range = buildRange(previousTag, currentTag);
  const subjects = execFileSync("git", ["log", "--format=%s", "--reverse", range], { encoding: "utf8" })
    .split("\n")
    .map((subject) => subject.trim())
    .filter(Boolean)
    .filter((subject) => !/^chore\(release\): v\d+\.\d+\.\d+/.test(subject));

  const sections = new Map([
    ["Features", []],
    ["Bug Fixes", []],
    ["Performance", []],
    ["Other", []],
  ]);

  for (const subject of subjects) {
    const item = formatCommitSubject(subject);
    if (!item) {
      continue;
    }

    sections.get(item.section)?.push(item.text);
  }

  return [...sections.entries()]
    .filter(([, items]) => items.length > 0)
    .map(([title, items]) => ({ title, items }));
}

function formatCommitSubject(subject) {
  const match = subject.match(/^(\w+)(?:\(([^)]+)\))?!?: (.+)$/);
  if (!match) {
    return { section: "Other", text: subject };
  }

  const [, type, scope, summary] = match;
  const section = sectionForType(type);
  const text = scope ? `**${scope}:** ${summary}` : summary;
  return { section, text };
}

function sectionForType(type) {
  if (type === "feat") {
    return "Features";
  }

  if (type === "fix") {
    return "Bug Fixes";
  }

  if (type === "perf") {
    return "Performance";
  }

  return "Other";
}

function tagName(rawVersion) {
  return rawVersion.startsWith("v") ? rawVersion : `v${rawVersion}`;
}

function tagExists(name) {
  try {
    execFileSync("git", ["rev-parse", "--verify", "--quiet", name], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function buildRange(previousTag, currentTag) {
  if (tagExists(previousTag) && tagExists(currentTag)) {
    return `${previousTag}..${currentTag}`;
  }

  if (tagExists(previousTag)) {
    return `${previousTag}..HEAD`;
  }

  if (tagExists(currentTag)) {
    return currentTag;
  }

  return "HEAD";
}
