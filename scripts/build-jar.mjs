#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUILD = path.join(ROOT, "build");
const CLASSES = path.join(BUILD, "classes");
const STUB = path.join(BUILD, "stub");
const DEX = path.join(BUILD, "dex");
const JAR = path.join(ROOT, "spider/kids.jar");

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walk(full));
    else result.push(full);
  }
  return result;
}

function byVersion(a, b) {
  const left = a.split(/[.-]/).map((part) => parseInt(part, 10) || 0);
  const right = b.split(/[.-]/).map((part) => parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function sdkRoot() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(process.env.HOME || "", "Library/Android/sdk"),
    "/usr/local/lib/android/sdk",
    "/opt/android-sdk",
  ];
  for (const dir of candidates) {
    if (dir && fs.existsSync(dir)) return dir;
  }
  return "";
}

function pick(base, prefix, suffix) {
  if (!fs.existsSync(base)) return "";
  const names = fs.readdirSync(base).filter((name) => name.startsWith(prefix)).sort(byVersion);
  for (let i = names.length - 1; i >= 0; i -= 1) {
    const candidate = path.join(base, names[i], suffix);
    if (fs.existsSync(candidate)) return candidate;
  }
  return "";
}

function toolchain() {
  const sdk = sdkRoot();
  if (!sdk) throw new Error("找不到 Android SDK，请设置 ANDROID_HOME");
  const d8 = pick(path.join(sdk, "build-tools"), "", "d8");
  const androidJar = pick(path.join(sdk, "platforms"), "android-", "android.jar");
  if (!d8) throw new Error("找不到 d8（Android SDK build-tools 未安装）");
  if (!androidJar) throw new Error("找不到 android.jar（Android SDK platforms 未安装）");
  return { sdk, d8, androidJar };
}

function java(script, args) {
  try {
    execFileSync(script, args, { cwd: ROOT, stdio: "inherit" });
  } catch (error) {
    throw new Error(script + " 执行失败：" + (error.message || error));
  }
}

export function buildJar() {
  const { d8, androidJar } = toolchain();
  fs.rmSync(BUILD, { recursive: true, force: true });
  fs.mkdirSync(CLASSES, { recursive: true });
  fs.mkdirSync(STUB, { recursive: true });
  fs.mkdirSync(DEX, { recursive: true });

  const stubs = walk(path.join(ROOT, "spider-stub")).filter((file) => file.endsWith(".java"));
  const sources = walk(path.join(ROOT, "spider-src")).filter((file) => file.endsWith(".java"));
  if (!sources.length) throw new Error("spider-src 下没有 Java 源码");

  java("javac", ["-encoding", "UTF-8", "--release", "11", "-cp", androidJar, "-d", STUB, ...stubs]);
  java("javac", ["-encoding", "UTF-8", "--release", "11", "-cp", [STUB, androidJar].join(path.delimiter), "-d", CLASSES, ...sources]);

  const classes = walk(CLASSES).filter((file) => file.endsWith(".class"));
  java(d8, [
    "--min-api", "21",
    "--lib", STUB,
    "--lib", androidJar,
    "--output", DEX,
    ...classes,
  ]);
  if (!fs.existsSync(path.join(DEX, "classes.dex"))) throw new Error("d8 没有输出 classes.dex");

  fs.mkdirSync(path.dirname(JAR), { recursive: true });
  fs.rmSync(JAR, { force: true });
  java("jar", ["cf", JAR, "-C", DEX, "classes.dex"]);

  const buffer = fs.readFileSync(JAR);
  return {
    file: JAR,
    bytes: buffer.length,
    md5: createHash("md5").update(buffer).digest("hex"),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = buildJar();
  console.log("jar：" + path.relative(ROOT, result.file) + "（" + result.bytes + " 字节）");
  console.log("md5：" + result.md5);
}
