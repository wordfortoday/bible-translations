#!/usr/bin/env node
/**
 * parse-scrollmapper-csv.js — Convert a scrollmapper-format CSV Bible to per-book JSON files.
 *
 * CSV format: Book,Chapter,Verse,Text
 *
 * Usage:
 *   node scripts/parse-scrollmapper-csv.js <input.csv> <output-dir> <translation-id> <translation-name> <language> <year> <license> [attribution] [attributionUrl]
 *
 * Example:
 *   node scripts/parse-scrollmapper-csv.js DRC.csv ./dra dra "Douay-Rheims Bible" en 1899 public-domain
 */

const fs = require("fs");
const path = require("path");

const [, , inputFile, outputDir, translationId, translationName, language, year, license, attribution, attributionUrl] = process.argv;

if (!inputFile || !outputDir || !translationId || !translationName || !language || !year || !license) {
  console.error(
    "Usage: node scripts/parse-scrollmapper-csv.js <input.csv> <output-dir> <translation-id> <translation-name> <language> <year> <license> [attribution] [attributionUrl]"
  );
  process.exit(1);
}

// Full book name → USFM ID + canonical English name
// Covers Protestant canon + Catholic deuterocanonical books
const BOOK_MAP = {
  // Old Testament
  "Genesis":          { id: "GEN", name: "Genesis" },
  "Exodus":           { id: "EXO", name: "Exodus" },
  "Leviticus":        { id: "LEV", name: "Leviticus" },
  "Numbers":          { id: "NUM", name: "Numbers" },
  "Deuteronomy":      { id: "DEU", name: "Deuteronomy" },
  "Joshua":           { id: "JOS", name: "Joshua" },
  "Judges":           { id: "JDG", name: "Judges" },
  "Ruth":             { id: "RUT", name: "Ruth" },
  "I Samuel":         { id: "1SA", name: "1 Samuel" },
  "II Samuel":        { id: "2SA", name: "2 Samuel" },
  "I Kings":          { id: "1KI", name: "1 Kings" },
  "II Kings":         { id: "2KI", name: "2 Kings" },
  "I Chronicles":     { id: "1CH", name: "1 Chronicles" },
  "II Chronicles":    { id: "2CH", name: "2 Chronicles" },
  "Ezra":             { id: "EZR", name: "Ezra" },
  "Nehemiah":         { id: "NEH", name: "Nehemiah" },
  "Esther":           { id: "EST", name: "Esther" },
  "Job":              { id: "JOB", name: "Job" },
  "Psalms":           { id: "PSA", name: "Psalms" },
  "Proverbs":         { id: "PRO", name: "Proverbs" },
  "Ecclesiastes":     { id: "ECC", name: "Ecclesiastes" },
  "Song of Solomon":  { id: "SNG", name: "Song of Solomon" },
  "Isaiah":           { id: "ISA", name: "Isaiah" },
  "Jeremiah":         { id: "JER", name: "Jeremiah" },
  "Lamentations":     { id: "LAM", name: "Lamentations" },
  "Ezekiel":          { id: "EZK", name: "Ezekiel" },
  "Daniel":           { id: "DAN", name: "Daniel" },
  "Hosea":            { id: "HOS", name: "Hosea" },
  "Joel":             { id: "JOL", name: "Joel" },
  "Amos":             { id: "AMO", name: "Amos" },
  "Obadiah":          { id: "OBA", name: "Obadiah" },
  "Jonah":            { id: "JON", name: "Jonah" },
  "Micah":            { id: "MIC", name: "Micah" },
  "Nahum":            { id: "NAM", name: "Nahum" },
  "Habakkuk":         { id: "HAB", name: "Habakkuk" },
  "Zephaniah":        { id: "ZEP", name: "Zephaniah" },
  "Haggai":           { id: "HAG", name: "Haggai" },
  "Zechariah":        { id: "ZEC", name: "Zechariah" },
  "Malachi":          { id: "MAL", name: "Malachi" },
  // Deuterocanonical
  "Tobit":            { id: "TOB", name: "Tobit" },
  "Judith":           { id: "JDT", name: "Judith" },
  "I Maccabees":      { id: "1MA", name: "1 Maccabees" },
  "II Maccabees":     { id: "2MA", name: "2 Maccabees" },
  "Wisdom":           { id: "WIS", name: "Wisdom" },
  "Sirach":           { id: "SIR", name: "Sirach" },
  "Baruch":           { id: "BAR", name: "Baruch" },
  // New Testament
  "Matthew":          { id: "MAT", name: "Matthew" },
  "Mark":             { id: "MRK", name: "Mark" },
  "Luke":             { id: "LUK", name: "Luke" },
  "John":             { id: "JHN", name: "John" },
  "Acts":             { id: "ACT", name: "Acts" },
  "Romans":           { id: "ROM", name: "Romans" },
  "I Corinthians":    { id: "1CO", name: "1 Corinthians" },
  "II Corinthians":   { id: "2CO", name: "2 Corinthians" },
  "Galatians":        { id: "GAL", name: "Galatians" },
  "Ephesians":        { id: "EPH", name: "Ephesians" },
  "Philippians":      { id: "PHP", name: "Philippians" },
  "Colossians":       { id: "COL", name: "Colossians" },
  "I Thessalonians":  { id: "1TH", name: "1 Thessalonians" },
  "II Thessalonians": { id: "2TH", name: "2 Thessalonians" },
  "I Timothy":        { id: "1TI", name: "1 Timothy" },
  "II Timothy":       { id: "2TI", name: "2 Timothy" },
  "Titus":            { id: "TIT", name: "Titus" },
  "Philemon":         { id: "PHM", name: "Philemon" },
  "Hebrews":          { id: "HEB", name: "Hebrews" },
  "James":            { id: "JAS", name: "James" },
  "I Peter":          { id: "1PE", name: "1 Peter" },
  "II Peter":         { id: "2PE", name: "2 Peter" },
  "I John":           { id: "1JN", name: "1 John" },
  "II John":          { id: "2JN", name: "2 John" },
  "III John":         { id: "3JN", name: "3 John" },
  "Jude":             { id: "JUD", name: "Jude" },
  "Revelation of John": { id: "REV", name: "Revelation" },
};

fs.mkdirSync(outputDir, { recursive: true });

const csv = fs.readFileSync(inputFile, "utf8");
const lines = csv.split("\n");

// State
const bookData = {}; // bookId → { name, chapters: { "1": { "1": "text" } } }
const skipped = new Set();

// Simple CSV field splitter that handles quoted fields
function splitCSVLine(line) {
  const fields = [];
  let inQuote = false;
  let field = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === "," && !inQuote) {
      fields.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

// Skip header line
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const [bookName, chapterStr, verseStr, ...textParts] = splitCSVLine(line);
  const text = textParts.join(",").trim(); // rejoin in case text had commas

  const bookInfo = BOOK_MAP[bookName];
  if (!bookInfo) {
    if (!skipped.has(bookName)) {
      console.warn(`  ⚠ Skipping unknown book: "${bookName}"`);
      skipped.add(bookName);
    }
    continue;
  }

  if (!bookData[bookInfo.id]) {
    bookData[bookInfo.id] = { name: bookInfo.name, chapters: {} };
  }
  const b = bookData[bookInfo.id];
  if (!b.chapters[chapterStr]) b.chapters[chapterStr] = {};
  b.chapters[chapterStr][verseStr] = text;
}

// Write per-book JSON files
const books = [];
const bookOrder = Object.values(BOOK_MAP).map(b => b.id);
// Write in canonical order
for (const id of bookOrder) {
  if (!bookData[id]) continue;
  const { name, chapters } = bookData[id];
  const chapterCount = Object.keys(chapters).length;
  const bookFile = path.join(outputDir, `${id}.json`);
  fs.writeFileSync(bookFile, JSON.stringify({ book: id, name, chapters }, null, 2));
  books.push({ id, name, chapters: chapterCount });
  console.log(`  ✓ ${id} — ${name} (${chapterCount} chapters)`);
}

// Write metadata.json
const metadata = {
  id: translationId,
  name: translationName,
  language,
  year: parseInt(year, 10),
  license,
  ...(attribution && { attribution }),
  ...(attributionUrl && { attributionUrl }),
  books,
};

fs.writeFileSync(path.join(outputDir, "metadata.json"), JSON.stringify(metadata, null, 2));
console.log(`\nWrote metadata.json (${books.length} books)`);
