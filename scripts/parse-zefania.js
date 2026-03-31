#!/usr/bin/env node
/**
 * parse-zefania.js — Convert a Zefania XML Bible file to per-book JSON files.
 *
 * Usage:
 *   node scripts/parse-zefania.js <input.zefania.xml> <output-dir> <translation-id> <translation-name> <language> <year> <license> [attribution] [attributionUrl]
 *
 * Example:
 *   node scripts/parse-zefania.js eng-dra.zefania.xml ./dra dra "Douay-Rheims Bible" en 1899 public-domain
 */

const fs = require("fs");
const path = require("path");

const [, , inputFile, outputDir, translationId, translationName, language, year, license, attribution, attributionUrl] = process.argv;

if (!inputFile || !outputDir || !translationId || !translationName || !language || !year || !license) {
  console.error(
    "Usage: node scripts/parse-zefania.js <input.zefania.xml> <output-dir> <translation-id> <translation-name> <language> <year> <license> [attribution] [attributionUrl]"
  );
  process.exit(1);
}

// bsname → USFM 3-letter code + English name
// Covers Protestant canon + Deuterocanonical books
const BOOK_MAP = {
  // Old Testament
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
  // Deuterocanonical / Apocrypha
  Tob:    { id: "TOB", name: "Tobit" },
  Jdt:    { id: "JDT", name: "Judith" },
  "1Macc":{ id: "1MA", name: "1 Maccabees" },
  "2Macc":{ id: "2MA", name: "2 Maccabees" },
  Wis:    { id: "WIS", name: "Wisdom" },
  Sir:    { id: "SIR", name: "Sirach" },
  Bar:    { id: "BAR", name: "Baruch" },
  // New Testament
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

// bnumber overrides — takes precedence over bsname lookup.
// Used to fix mislabeled books in specific Zefania files (e.g. eng-dra).
// Map: bnumber (string) → { id, name } or null to skip the book.
const BNUMBER_OVERRIDE = {
  // 2 Chronicles has bsname="1Chr" in some files (same as 1 Chr) — fix by bnumber
  "14": { id: "2CH", name: "2 Chronicles" },
  // Deuterocanonical books are mislabeled in the DRA Zefania file — actual content:
  "67": null,                                  // 1-chapter Baruch fragment — skip
  "68": { id: "BAR", name: "Baruch" },         // labeled "Wisdom", content is Baruch
  "69": { id: "SIR", name: "Sirach" },         // labeled "Tobit", content is Sirach (51 ch)
  "71": { id: "JDT", name: "Judith" },         // labeled "Baruch", content is Judith
  "73": { id: "1MA", name: "1 Maccabees" },    // labeled "2 Maccabees", content is 1 Macc
};

const xml = fs.readFileSync(inputFile, "utf8");
fs.mkdirSync(outputDir, { recursive: true });

const books = [];
let currentBook = null;  // { id, name, bsname }
let currentChapter = null;
let currentVerse = null;
let collectingVerse = false;
let verseBuffer = "";
let chapters = {};

const tokenRe = /<([^>]+)>|([^<]+)/g;
let match;

function flushVerse() {
  if (currentBook && currentChapter && currentVerse && collectingVerse) {
    if (!chapters[currentChapter]) chapters[currentChapter] = {};
    chapters[currentChapter][currentVerse] = verseBuffer.replace(/<[^>]+>/g, "").trim();
  }
  verseBuffer = "";
  collectingVerse = false;
  currentVerse = null;
}

function flushBook() {
  if (!currentBook) return;

  const chapterCount = Object.keys(chapters).length;
  if (chapterCount === 0) {
    chapters = {};
    currentBook = null;
    currentChapter = null;
    return;
  }

  const bookFile = path.join(outputDir, `${currentBook.id}.json`);
  fs.writeFileSync(
    bookFile,
    JSON.stringify({ book: currentBook.id, name: currentBook.name, chapters }, null, 2)
  );

  books.push({ id: currentBook.id, name: currentBook.name, chapters: chapterCount });
  console.log(`  ✓ ${currentBook.id} — ${currentBook.name} (${chapterCount} chapters)`);

  chapters = {};
  currentBook = null;
  currentChapter = null;
}

while ((match = tokenRe.exec(xml)) !== null) {
  const [, tag, text] = match;

  if (tag !== undefined) {
    // <BIBLEBOOK bnumber="1" bname="Genesis" bsname="Gen">
    if (tag.startsWith("BIBLEBOOK ")) {
      flushVerse();
      flushBook();
      const bnumMatch = tag.match(/bnumber=['"](\d+)['"]/);
      const bsnameMatch = tag.match(/bsname=['"]([^'"]+)['"]/);
      const bnameMatch = tag.match(/bname=['"]([^'"]+)['"]/);
      const bnumber = bnumMatch ? bnumMatch[1] : null;

      // Check bnumber override first
      if (bnumber && bnumber in BNUMBER_OVERRIDE) {
        const override = BNUMBER_OVERRIDE[bnumber];
        if (override === null) {
          currentBook = null; // explicitly skip
        } else {
          currentBook = { id: override.id, name: override.name };
        }
      } else if (bsnameMatch) {
        const bsname = bsnameMatch[1];
        const bookInfo = BOOK_MAP[bsname];
        if (bookInfo) {
          currentBook = { id: bookInfo.id, name: bookInfo.name };
        } else {
          const bnameVal = bnameMatch ? bnameMatch[1] : bsname;
          console.warn(`  ⚠ Unknown bsname: ${bsname} (${bnameVal}), skipping`);
          currentBook = null;
        }
      }
    }
    // </BIBLEBOOK>
    else if (tag === "/BIBLEBOOK") {
      flushVerse();
      flushBook();
    }
    // <CHAPTER cnumber="1">
    else if (tag.startsWith("CHAPTER ")) {
      flushVerse();
      const cnMatch = tag.match(/cnumber=['"](\d+)['"]/);
      if (cnMatch) currentChapter = cnMatch[1];
    }
    // </CHAPTER>
    else if (tag === "/CHAPTER") {
      flushVerse();
    }
    // <VERS vnumber="1">
    else if (tag.startsWith("VERS ")) {
      flushVerse();
      const vnMatch = tag.match(/vnumber=['"](\d+)['"]/);
      if (vnMatch && currentBook && currentChapter) {
        currentVerse = vnMatch[1];
        collectingVerse = true;
        verseBuffer = "";
      }
    }
    // </VERS>
    else if (tag === "/VERS") {
      flushVerse();
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
