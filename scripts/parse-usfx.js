#!/usr/bin/env node
/**
 * parse-usfx.js — Convert a USFX XML Bible file to per-book JSON files.
 *
 * Usage:
 *   node scripts/parse-usfx.js <input.usfx.xml> <output-dir> <translation-id> <translation-name> <language> <year> <license>
 *
 * Example:
 *   node scripts/parse-usfx.js eng-bbe.usfx.xml ./bbe bbe "Bible in Basic English" en 1949 public-domain
 */

const fs = require("fs");
const path = require("path");

const [, , inputFile, outputDir, translationId, translationName, language, year, license] = process.argv;

if (!inputFile || !outputDir || !translationId || !translationName || !language || !year || !license) {
  console.error(
    "Usage: node scripts/parse-usfx.js <input.usfx.xml> <output-dir> <translation-id> <translation-name> <language> <year> <license>"
  );
  process.exit(1);
}

const xml = fs.readFileSync(inputFile, "utf8");

fs.mkdirSync(outputDir, { recursive: true });

// --- Parser state ---
const books = []; // metadata list
let currentBookId = null;
let currentBookName = null;
let currentChapter = null;
let currentVerse = null;
let collectingText = false;
let collectingName = false;
let chapters = {}; // { "1": { "1": "...", "2": "..." }, ... }
let verseBuffer = "";

// Walk through the XML as a flat token stream using a simple regex scanner.
// USFX is well-structured enough that we don't need a full DOM parser.
const tokenRe = /<([^>]+)>|([^<]+)/g;
let match;

function flushVerse() {
  if (currentBookId && currentChapter && currentVerse && collectingText) {
    if (!chapters[currentChapter]) chapters[currentChapter] = {};
    chapters[currentChapter][currentVerse] = verseBuffer.trim();
  }
  verseBuffer = "";
  collectingText = false;
  currentVerse = null;
}

function flushBook() {
  if (!currentBookId) return;

  const bookFile = path.join(outputDir, `${currentBookId}.json`);
  const chapterCount = Object.keys(chapters).length;

  fs.writeFileSync(
    bookFile,
    JSON.stringify({ book: currentBookId, name: currentBookName, chapters }, null, 2)
  );

  books.push({ id: currentBookId, name: currentBookName, chapters: chapterCount });
  console.log(`  ✓ ${currentBookId} — ${currentBookName} (${chapterCount} chapters)`);

  chapters = {};
  currentBookId = null;
  currentBookName = null;
  currentChapter = null;
}

while ((match = tokenRe.exec(xml)) !== null) {
  const [, tag, text] = match;

  if (tag !== undefined) {
    // --- Tag token ---
    if (tag.startsWith("book ")) {
      // <book id="GEN">
      flushBook();
      const idMatch = tag.match(/id="([^"]+)"/);
      if (idMatch) currentBookId = idMatch[1];
    } else if (tag === "/book") {
      flushVerse();
      flushBook();
    } else if (tag === "h") {
      // <h> — book heading follows as text
      collectingName = true;
      currentBookName = "";
    } else if (tag === "/h") {
      collectingName = false;
    } else if (tag.startsWith("c ")) {
      // <c id="1"/> — chapter marker
      flushVerse();
      const idMatch = tag.match(/id="([^"]+)"/);
      if (idMatch) currentChapter = idMatch[1];
    } else if (tag.startsWith("v ")) {
      // <v id="1"/> — verse start
      flushVerse();
      const idMatch = tag.match(/id="([^"]+)"/);
      if (idMatch) {
        currentVerse = idMatch[1];
        collectingText = true;
        verseBuffer = "";
      }
    } else if (tag === "ve/") {
      // <ve/> — verse end
      flushVerse();
    }
    // All other tags (notes, formatting etc.) are ignored — we only want plain text
  } else if (text !== undefined) {
    // --- Text token ---
    if (collectingName) {
      currentBookName += text;
    } else if (collectingText) {
      verseBuffer += text;
    }
  }
}

// Flush the last book (no closing </book> tag needed)
flushVerse();
flushBook();

// Write metadata.json
const metadata = {
  id: translationId,
  name: translationName,
  language,
  year: parseInt(year, 10),
  license,
  books,
};

fs.writeFileSync(path.join(outputDir, "metadata.json"), JSON.stringify(metadata, null, 2));
console.log(`\nWrote metadata.json (${books.length} books)`);
