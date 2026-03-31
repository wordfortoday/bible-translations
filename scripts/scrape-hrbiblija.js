#!/usr/bin/env node
/**
 * scrape-hrbiblija.js — Scrape hrbiblija.cc Croatian KJV Bible translation.
 *
 * Usage:
 *   node scripts/scrape-hrbiblija.js <output-dir>
 *
 * Example:
 *   node scripts/scrape-hrbiblija.js ./hrbiblija
 *
 * License: Free for non-commercial use, text unaltered.
 * Attribution: UDRUGA STABLO ŽIVOTA (https://hrbiblija.cc)
 */

const fs = require("fs");
const path = require("path");

const [, , outputDir = "./hrbiblija"] = process.argv;

fs.mkdirSync(outputDir, { recursive: true });

// URL pattern: https://hrbiblija.cc/Bible/{slug}/{chapter}/dbr/2026/90
const BASE_URL = "https://hrbiblija.cc/Bible";

const BOOKS = [
  { id: "GEN", slug: "postanak",          name: "Postanak",             chapters: 50 },
  { id: "EXO", slug: "izlazak",           name: "Izlazak",              chapters: 40 },
  { id: "LEV", slug: "levitski_zakonik",  name: "Levitski zakonik",     chapters: 27 },
  { id: "NUM", slug: "brojevi",           name: "Brojevi",              chapters: 36 },
  { id: "DEU", slug: "ponovljeni_zakon",  name: "Ponovljeni zakon",     chapters: 34 },
  { id: "JOS", slug: "josua",             name: "Josua",                chapters: 24 },
  { id: "JDG", slug: "suci",             name: "Suci",                 chapters: 21 },
  { id: "RUT", slug: "ruta",             name: "Ruta",                 chapters: 4  },
  { id: "1SA", slug: "1_samuelova",      name: "1. Samuelova",         chapters: 31 },
  { id: "2SA", slug: "2_samuelova",      name: "2. Samuelova",         chapters: 24 },
  { id: "1KI", slug: "1_kraljevima",     name: "1. Kraljevima",        chapters: 22 },
  { id: "2KI", slug: "2_kraljevima",     name: "2. Kraljevima",        chapters: 25 },
  { id: "1CH", slug: "1_ljetopisa",      name: "1. Ljetopisa",         chapters: 29 },
  { id: "2CH", slug: "2_ljetopisa",      name: "2. Ljetopisa",         chapters: 36 },
  { id: "EZR", slug: "ezra",             name: "Ezra",                 chapters: 10 },
  { id: "NEH", slug: "nehemija",         name: "Nehemija",             chapters: 13 },
  { id: "EST", slug: "estera",           name: "Estera",               chapters: 10 },
  { id: "JOB", slug: "job",             name: "Job",                  chapters: 42 },
  { id: "PSA", slug: "psalmi",           name: "Psalmi",               chapters: 150 },
  { id: "PRO", slug: "izreke",           name: "Izreke",               chapters: 31 },
  { id: "ECC", slug: "propovjednika",    name: "Propovjednika",        chapters: 12 },
  { id: "SNG", slug: "pjesma_nad_pjesmama", name: "Pjesma nad pjesmama", chapters: 8 },
  { id: "ISA", slug: "izaija",           name: "Izaija",               chapters: 66 },
  { id: "JER", slug: "jeremija",         name: "Jeremija",             chapters: 52 },
  { id: "LAM", slug: "tuzaljke",         name: "Tužaljke",             chapters: 5  },
  { id: "EZK", slug: "ezekiel",          name: "Ezekiel",              chapters: 48 },
  { id: "DAN", slug: "daniel",           name: "Daniel",               chapters: 12 },
  { id: "HOS", slug: "hosea",            name: "Hosea",                chapters: 14 },
  { id: "JOL", slug: "joel",             name: "Joel",                 chapters: 3  },
  { id: "AMO", slug: "amos",             name: "Amos",                 chapters: 9  },
  { id: "OBA", slug: "obadija",          name: "Obadija",              chapters: 1  },
  { id: "JON", slug: "jona",             name: "Jona",                 chapters: 4  },
  { id: "MIC", slug: "mihej",            name: "Mihej",                chapters: 7  },
  { id: "NAM", slug: "nahum",            name: "Nahum",                chapters: 3  },
  { id: "HAB", slug: "habakuk",          name: "Habakuk",              chapters: 3  },
  { id: "ZEP", slug: "sefanija",         name: "Sefanija",             chapters: 3  },
  { id: "HAG", slug: "hagaj",            name: "Hagaj",                chapters: 2  },
  { id: "ZEC", slug: "zaharija",         name: "Zaharija",             chapters: 14 },
  { id: "MAL", slug: "malahija",         name: "Malahija",             chapters: 4  },
  { id: "MAT", slug: "matej",            name: "Matej",                chapters: 28 },
  { id: "MRK", slug: "marko",            name: "Marko",                chapters: 16 },
  { id: "LUK", slug: "luka",             name: "Luka",                 chapters: 24 },
  { id: "JHN", slug: "ivan",             name: "Ivan",                 chapters: 21 },
  { id: "ACT", slug: "djela_apostolska", name: "Djela apostolska",     chapters: 28 },
  { id: "ROM", slug: "rimljanima",       name: "Rimljanima",           chapters: 16 },
  { id: "1CO", slug: "1_korincanima",    name: "1. Korinćanima",       chapters: 16 },
  { id: "2CO", slug: "2_korincanima",    name: "2. Korinćanima",       chapters: 13 },
  { id: "GAL", slug: "galacanima",       name: "Galaćanima",           chapters: 6  },
  { id: "EPH", slug: "efezanima",        name: "Efežanima",            chapters: 6  },
  { id: "PHP", slug: "filipljanima",     name: "Filipljanima",         chapters: 4  },
  { id: "COL", slug: "kolosanima",       name: "Kološanima",           chapters: 4  },
  { id: "1TH", slug: "1_solunjanima",    name: "1. Solunjanima",       chapters: 5  },
  { id: "2TH", slug: "2_solunjanima",    name: "2. Solunjanima",       chapters: 3  },
  { id: "1TI", slug: "1_timoteju",       name: "1. Timoteju",          chapters: 6  },
  { id: "2TI", slug: "2_timoteju",       name: "2. Timoteju",          chapters: 4  },
  { id: "TIT", slug: "titu",             name: "Titu",                 chapters: 3  },
  { id: "PHM", slug: "filemonu",         name: "Filemonu",             chapters: 1  },
  { id: "HEB", slug: "hebrejima",        name: "Hebrejima",            chapters: 13 },
  { id: "JAS", slug: "jakovu",           name: "Jakovu",               chapters: 5  },
  { id: "1PE", slug: "1_petrova",        name: "1. Petrova",           chapters: 5  },
  { id: "2PE", slug: "2_petrova",        name: "2. Petrova",           chapters: 3  },
  { id: "1JN", slug: "1_ivanova",        name: "1. Ivanova",           chapters: 5  },
  { id: "2JN", slug: "2_ivanova",        name: "2. Ivanova",           chapters: 1  },
  { id: "3JN", slug: "3_ivanova",        name: "3. Ivanova",           chapters: 1  },
  { id: "JUD", slug: "judina",           name: "Judina",               chapters: 1  },
  { id: "REV", slug: "otkrivenje",       name: "Otkrivenje",           chapters: 22 },
];

// Polite delay between requests (ms)
const DELAY_MS = 300;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchChapter(slug, chapter) {
  const url = `${BASE_URL}/${slug}/${chapter}/dbr/2026/90`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function decodeHtml(str) {
  return str
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&[a-z]+;/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseVerses(html) {
  // Structure: <DT><a id="N">ref</a></DT><DD>verse text (may contain <i> etc.)</DD>
  const verses = {};

  const pairRe = /<dt[^>]*>\s*<a[^>]+id="(\d+)"[^>]*>[\s\S]*?<\/a>\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
  let m;
  while ((m = pairRe.exec(html)) !== null) {
    const num = m[1];
    const text = decodeHtml(m[2]);
    if (text) verses[num] = text;
  }

  return verses;
}

async function scrapeBook(book) {
  const chapters = {};
  process.stdout.write(`  Scraping ${book.id} (${book.name})...`);

  for (let ch = 1; ch <= book.chapters; ch++) {
    let html;
    try {
      html = await fetchChapter(book.slug, ch);
    } catch (err) {
      console.error(`\n    ✗ Failed ${book.slug}/${ch}: ${err.message}`);
      await sleep(DELAY_MS * 3);
      // Retry once
      try {
        html = await fetchChapter(book.slug, ch);
      } catch (err2) {
        console.error(`    ✗ Retry failed: ${err2.message}`);
        continue;
      }
    }

    const verses = parseVerses(html);
    if (Object.keys(verses).length === 0) {
      console.warn(`\n    ⚠ No verses found for ${book.slug}/${ch} — check HTML structure`);
    }
    chapters[String(ch)] = verses;

    process.stdout.write(".");
    await sleep(DELAY_MS);
  }

  console.log(` ✓ (${book.chapters} chapters)`);

  const bookFile = path.join(outputDir, `${book.id}.json`);
  fs.writeFileSync(
    bookFile,
    JSON.stringify({ book: book.id, name: book.name, chapters }, null, 2)
  );
  return { id: book.id, name: book.name, chapters: book.chapters };
}

async function main() {
  console.log(`Scraping hrbiblija.cc → ${outputDir}`);
  const books = [];

  for (const book of BOOKS) {
    const meta = await scrapeBook(book);
    books.push(meta);
  }

  const metadata = {
    id: "hrbiblija",
    name: "Biblija kralja Jakova (Hrvatski)",
    language: "hr",
    year: 2005,
    license: "free-noncommercial",
    attribution: "UDRUGA STABLO ŽIVOTA",
    attributionUrl: "https://hrbiblija.cc",
    books,
  };

  fs.writeFileSync(
    path.join(outputDir, "metadata.json"),
    JSON.stringify(metadata, null, 2)
  );
  console.log(`\nWrote metadata.json (${books.length} books)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
