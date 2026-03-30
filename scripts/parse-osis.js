#!/usr/bin/env node
/**
 * parse-osis.js — Convert an OSIS XML Bible file to per-book JSON files.
 *
 * Usage:
 *   node scripts/parse-osis.js <input.osis.xml> <output-dir> <translation-id> <translation-name> <language> <year> <license> [attribution] [attributionUrl]
 *
 * Example:
 *   node scripts/parse-osis.js fra-ostervald.osis.xml ./ostervald ostervald "Bible Ostervald 1996" fr 1996 public-domain
 */

const fs = require("fs");
const path = require("path");

const [, , inputFile, outputDir, translationId, translationName, language, year, license, attribution, attributionUrl] = process.argv;

if (!inputFile || !outputDir || !translationId || !translationName || !language || !year || !license) {
  console.error(
    "Usage: node scripts/parse-osis.js <input.osis.xml> <output-dir> <translation-id> <translation-name> <language> <year> <license> [attribution] [attributionUrl]"
  );
  process.exit(1);
}

// OSIS book ID → USFM 3-letter code + English name
const BOOK_MAP = {
  Gen:    { id: "GEN", name: "Genesis" },
  Exod:   { id: "EXO", name: "Exodus" },
  Lev:    { id: "LEV", name: "Leviticus" },
  Num:    { id: "NUM", name: "Numbers" },
  Deut:   { id: "DEU", name: "Deuteronomy" },
  Josh:   { id: "JOS", name: "Joshua" },
  Judg:   { id: "JDG", name: "Judges" },
  Ruth:   { id: "RUT", name: "Ruth" },
  "1Sam": { id: "1SA", name: "1 Samuel" },
  "2Sam": { id: "2SA", name: "2 Samuel" },
  "1Kgs": { id: "1KI", name: "1 Kings" },
  "2Kgs": { id: "2KI", name: "2 Kings" },
  "1Chr": { id: "1CH", name: "1 Chronicles" },
  "2Chr": { id: "2CH", name: "2 Chronicles" },
  Ezra:   { id: "EZR", name: "Ezra" },
  Neh:    { id: "NEH", name: "Nehemiah" },
  Esth:   { id: "EST", name: "Esther" },
  Job:    { id: "JOB", name: "Job" },
  Ps:     { id: "PSA", name: "Psalms" },
  Prov:   { id: "PRO", name: "Proverbs" },
  Eccl:   { id: "ECC", name: "Ecclesiastes" },
  Song:   { id: "SNG", name: "Song of Songs" },
  Isa:    { id: "ISA", name: "Isaiah" },
  Jer:    { id: "JER", name: "Jeremiah" },
  Lam:    { id: "LAM", name: "Lamentations" },
  Ezek:   { id: "EZK", name: "Ezekiel" },
  Dan:    { id: "DAN", name: "Daniel" },
  Hos:    { id: "HOS", name: "Hosea" },
  Joel:   { id: "JOL", name: "Joel" },
  Amos:   { id: "AMO", name: "Amos" },
  Obad:   { id: "OBA", name: "Obadiah" },
  Jonah:  { id: "JON", name: "Jonah" },
  Mic:    { id: "MIC", name: "Micah" },
  Nah:    { id: "NAM", name: "Nahum" },
  Hab:    { id: "HAB", name: "Habakkuk" },
  Zeph:   { id: "ZEP", name: "Zephaniah" },
  Hag:    { id: "HAG", name: "Haggai" },
  Zech:   { id: "ZEC", name: "Zechariah" },
  Mal:    { id: "MAL", name: "Malachi" },
  Matt:   { id: "MAT", name: "Matthew" },
  Mark:   { id: "MRK", name: "Mark" },
  Luke:   { id: "LUK", name: "Luke" },
  John:   { id: "JHN", name: "John" },
  Acts:   { id: "ACT", name: "Acts" },
  Rom:    { id: "ROM", name: "Romans" },
  "1Cor": { id: "1CO", name: "1 Corinthians" },
  "2Cor": { id: "2CO", name: "2 Corinthians" },
  Gal:    { id: "GAL", name: "Galatians" },
  Eph:    { id: "EPH", name: "Ephesians" },
  Phil:   { id: "PHP", name: "Philippians" },
  Col:    { id: "COL", name: "Colossians" },
  "1Thess": { id: "1TH", name: "1 Thessalonians" },
  "2Thess": { id: "2TH", name: "2 Thessalonians" },
  "1Tim": { id: "1TI", name: "1 Timothy" },
  "2Tim": { id: "2TI", name: "2 Timothy" },
  Titus:  { id: "TIT", name: "Titus" },
  Phlm:   { id: "PHM", name: "Philemon" },
  Heb:    { id: "HEB", name: "Hebrews" },
  Jas:    { id: "JAS", name: "James" },
  "1Pet": { id: "1PE", name: "1 Peter" },
  "2Pet": { id: "2PE", name: "2 Peter" },
  "1John":{ id: "1JN", name: "1 John" },
  "2John":{ id: "2JN", name: "2 John" },
  "3John":{ id: "3JN", name: "3 John" },
  Jude:   { id: "JUD", name: "Jude" },
  Rev:    { id: "REV", name: "Revelation" },
};

const xml = fs.readFileSync(inputFile, "utf8");
fs.mkdirSync(outputDir, { recursive: true });

const books = [];
let currentOsisBook = null;
let currentChapter = null;
let currentVerse = null;
let collectingVerse = false;
let verseBuffer = "";
let chapters = {};

const tokenRe = /<([^>]+)>|([^<]+)/g;
let match;

function flushVerse() {
  if (currentChapter && currentVerse && collectingVerse) {
    if (!chapters[currentChapter]) chapters[currentChapter] = {};
    // Strip any remaining inner XML tags and trim
    chapters[currentChapter][currentVerse] = verseBuffer.replace(/<[^>]+>/g, "").trim();
  }
  verseBuffer = "";
  collectingVerse = false;
  currentVerse = null;
}

function flushBook() {
  if (!currentOsisBook) return;

  const bookInfo = BOOK_MAP[currentOsisBook];
  if (!bookInfo) {
    console.warn(`  ⚠ Unknown OSIS book ID: ${currentOsisBook}, skipping`);
    chapters = {};
    currentOsisBook = null;
    currentChapter = null;
    return;
  }

  const chapterCount = Object.keys(chapters).length;
  if (chapterCount === 0) {
    chapters = {};
    currentOsisBook = null;
    return;
  }

  const bookFile = path.join(outputDir, `${bookInfo.id}.json`);
  fs.writeFileSync(
    bookFile,
    JSON.stringify({ book: bookInfo.id, name: bookInfo.name, chapters }, null, 2)
  );

  books.push({ id: bookInfo.id, name: bookInfo.name, chapters: chapterCount });
  console.log(`  ✓ ${bookInfo.id} — ${bookInfo.name} (${chapterCount} chapters)`);

  chapters = {};
  currentOsisBook = null;
  currentChapter = null;
}

while ((match = tokenRe.exec(xml)) !== null) {
  const [, tag, text] = match;

  if (tag !== undefined) {
    // <div type='book' osisID='Gen'> — container format
    if ((tag.includes("type='book'") || tag.includes('type="book"')) && tag.match(/osisID=['"]([^'"]+)['"]/)) {
      flushVerse();
      flushBook();
      const idMatch = tag.match(/osisID=['"]([^'"]+)['"]/);
      if (idMatch) currentOsisBook = idMatch[1];
    }
    // <chapter ...> — container (osisID) or milestone (sID with n attribute)
    else if (tag.startsWith("chapter ")) {
      flushVerse();
      const containerMatch = tag.match(/osisID=['"]([^'"]+)['"]/);
      const milestoneMatch = tag.match(/\bn=['"](\d+)['"]/);
      if (containerMatch) {
        currentChapter = containerMatch[1].split(".")[1];
      } else if (milestoneMatch) {
        currentChapter = milestoneMatch[1];
      }
    }
    // <verse osisID='Gen.1.1'> — container format (no sID, no self-close)
    else if (tag.startsWith("verse ") && tag.includes("osisID") && !tag.includes("sID") && !tag.endsWith("/")) {
      flushVerse();
      const idMatch = tag.match(/osisID=['"]([^'"]+)['"]/);
      if (idMatch) {
        currentVerse = idMatch[1].split(".")[2];
        collectingVerse = true;
        verseBuffer = "";
      }
    }
    // <verse osisID='Gen.1.1' sID='...' /> — milestone format start
    else if (tag.startsWith("verse ") && tag.includes("sID")) {
      flushVerse();
      const idMatch = tag.match(/osisID=['"]([^'"]+)['"]/);
      if (idMatch) {
        currentVerse = idMatch[1].split(".")[2];
        collectingVerse = true;
        verseBuffer = "";
      }
    }
    // <verse eID='...' /> — milestone format end
    else if (tag.startsWith("verse ") && tag.includes("eID")) {
      flushVerse();
    }
    // </verse> — container format end
    else if (tag === "/verse") {
      flushVerse();
    }
    // </div> — only flush book for actual book divs, not bookGroup
    else if (tag === "/div" && currentOsisBook) {
      flushVerse();
      flushBook();
    }
  } else if (text !== undefined) {
    if (collectingVerse) {
      verseBuffer += text;
    }
  }
}

flushVerse();
flushBook();

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
