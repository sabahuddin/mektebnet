const fs = require('fs');
const path = require('path');

const rawText = fs.readFileSync(path.join(__dirname, 'ilmihal2-raw.txt'), 'utf8');
const lines = rawText.split('\n');

const pageLineMap = {};
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^\s*(\d+)\s*$/);
  if (m) {
    const pn = parseInt(m[1]);
    if (pn >= 5 && pn <= 128 && !pageLineMap[pn]) {
      pageLineMap[pn] = i;
    }
  }
}

const lessonDefs = [
  { slug: 'adem-as', startPage: 7, endPage: 8 },
  { slug: 'mentu-billahi', startPage: 9, endPage: 9 },
  { slug: 'sifatuz-zatijje', startPage: 10, endPage: 10 },
  { slug: 'sifatus-subutijje', startPage: 11, endPage: 12 },
  { slug: 've-melaikethi', startPage: 13, endPage: 14 },
  { slug: 've-kutubihi', startPage: 15, endPage: 15 },
  { slug: 've-rusulihi', startPage: 16, endPage: 17 },
  { slug: 'vel-jevmil-ahiri', startPage: 18, endPage: 18 },
  { slug: 've-bil-kaderi', startPage: 19, endPage: 19 },
  { slug: 'el-kafirun', startPage: 20, endPage: 20 },
  { slug: 'islamski-sarti', startPage: 21, endPage: 22 },
  { slug: 'namaz', startPage: 23, endPage: 24 },
  { slug: 'sta-kvari-namaz', startPage: 25, endPage: 25 },
  { slug: 'sehvi-sedzda', startPage: 26, endPage: 26 },
  { slug: 'naklanjavanje', startPage: 27, endPage: 28 },
  { slug: 'namaz-u-dzematu', startPage: 29, endPage: 30 },
  { slug: 'prispijevanje', startPage: 31, endPage: 32 },
  { slug: 'post', startPage: 33, endPage: 34 },
  { slug: 'zekat', startPage: 35, endPage: 36 },
  { slug: 'hadz', startPage: 37, endPage: 38 },
  { slug: 'urednost', startPage: 42, endPage: 43 },
  { slug: 'cistoca', startPage: 44, endPage: 44 },
  { slug: 'zdravlje', startPage: 45, endPage: 45 },
  { slug: 'ishrana', startPage: 46, endPage: 47 },
  { slug: 'ponasanje-jela', startPage: 48, endPage: 48 },
  { slug: 'dova-poslije-jela', startPage: 49, endPage: 49 },
  { slug: 'ljubav-poslusnost-roditelji', startPage: 50, endPage: 51 },
  { slug: 'braca-sestre', startPage: 52, endPage: 52 },
  { slug: 'rodbina', startPage: 53, endPage: 54 },
  { slug: 'halal-haram', startPage: 55, endPage: 55 },
  { slug: 'namaz-cuva', startPage: 56, endPage: 56 },
  { slug: 'podne-namaz', startPage: 57, endPage: 58 },
  { slug: 'tejemum', startPage: 59, endPage: 59 },
  { slug: 'mesh', startPage: 60, endPage: 60 },
  { slug: 'el-kevser', startPage: 61, endPage: 61 },
  { slug: 'mali-grijesi', startPage: 64, endPage: 64 },
  { slug: 'veliki-grijesi', startPage: 65, endPage: 66 },
  { slug: 'teski-grijesi', startPage: 67, endPage: 67 },
  { slug: 'posljedice-grijeha', startPage: 67, endPage: 68 },
  { slug: 'tevba', startPage: 69, endPage: 70 },
  { slug: 'cestitost', startPage: 71, endPage: 71 },
  { slug: 'iskrenost', startPage: 72, endPage: 74 },
  { slug: 'skromnost', startPage: 75, endPage: 76 },
  { slug: 'ikindija-namaz', startPage: 77, endPage: 78 },
  { slug: 'namaz-putnika', startPage: 79, endPage: 80 },
  { slug: 'namaz-bolesnika', startPage: 81, endPage: 81 },
  { slug: 'jacija-namaz', startPage: 82, endPage: 84 },
  { slug: 'kunut-dova', startPage: 82, endPage: 83 },
  { slug: 'namaska-dova', startPage: 84, endPage: 85 },
  { slug: 'el-maun', startPage: 86, endPage: 86 },
  { slug: 'radne-navike', startPage: 87, endPage: 88 },
  { slug: 'srednji-put', startPage: 89, endPage: 90 },
  { slug: 'dzuma-namaz', startPage: 91, endPage: 93 },
  { slug: 'bajram-namaz', startPage: 94, endPage: 96 },
  { slug: 'el-kurejs', startPage: 97, endPage: 97 },
  { slug: 'teravih-namaz', startPage: 98, endPage: 98 },
  { slug: 'istina', startPage: 98, endPage: 99 },
  { slug: 'prevara', startPage: 99, endPage: 100 },
  { slug: 'ponasanje-drustvo', startPage: 101, endPage: 102 },
  { slug: 'elif-lam-mim', startPage: 103, endPage: 103 },
  { slug: 'mubarek-noci', startPage: 104, endPage: 105 },
  { slug: 'nafila', startPage: 106, endPage: 108 },
  { slug: 'alimi', startPage: 109, endPage: 111 },
  { slug: 'bih', startPage: 112, endPage: 113 },
  { slug: 'bosanski-jezik', startPage: 114, endPage: 115 },
  { slug: 'kultura', startPage: 116, endPage: 117 },
  { slug: 'bosnjak', startPage: 118, endPage: 119 },
  { slug: 'lekad-dzaekum', startPage: 120, endPage: 121 },
];

function getPageLines(startPage, endPage) {
  const startLine = pageLineMap[startPage];
  let endLine;
  for (let p = endPage + 1; p <= 130; p++) {
    if (pageLineMap[p] !== undefined) { endLine = pageLineMap[p]; break; }
  }
  if (startLine === undefined) return [];
  if (endLine === undefined) endLine = Math.min(startLine + 300, lines.length);
  return lines.slice(startLine + 1, endLine);
}

function isArabicLine(line) {
  const ac = (line.match(/[\u0600-\u06FF\uFE70-\uFEFF\uFB50-\uFDFF\u0750-\u077F]/g) || []).length;
  const tc = line.replace(/\s/g, '').length;
  return tc > 0 && ac / tc > 0.3;
}

function isTransliterationLine(line) {
  const t = line.trim();
  if (t.length < 10) return false;
  const upper = (t.match(/[A-Z\u0100-\u024F]/g) || []).length;
  const total = t.replace(/[\s\-'.,!:;()"]/g, '').length;
  return total > 0 && upper / total > 0.7;
}

function isSectionMarker(t) {
  if (isPitanjaMarker(t)) return true;
  if (isZadacaMarker(t)) return true;
  if (isSkipMarker(t)) return true;
  if (/^HADIS$/i.test(t)) return true;
  if (/^ZAPAMTI/i.test(t)) return true;
  return false;
}

function isSkippableLine(t) {
  if (!t) return true;
  if (/^\d+$/.test(t) && parseInt(t) >= 5 && parseInt(t) <= 130) return true;
  if (isArabicLine(t)) return true;
  if (isSectionMarker(t)) return false;
  if (isTransliterationLine(t)) return true;
  if (/^[\u0600-\u06FF]/.test(t)) return true;
  if (/^﷽/.test(t)) return true;
  return false;
}

function isPitanjaMarker(t) {
  if (/^PITANJA\s*(I\s*ZADACI)?/i.test(t)) return true;
  if (/^PONOVI\s*I\s*ODGOVORI/i.test(t)) return true;
  if (/^Odgovori\s*na\s*pitanja/i.test(t)) return true;
  return false;
}

function isZadacaMarker(t) {
  if (/^IZABERI\s*ZADA[CĆ]/i.test(t)) return true;
  if (/^URADI\s*ZADA[CĆ]/i.test(t)) return true;
  if (/^ZA\s*DOMA[CĆ]/i.test(t)) return true;
  return false;
}

function isSkipMarker(t) {
  if (/^RAZGOVOR\s*S[A]?\s*(MUALLIMOM|DEDOM|NENOM)/i.test(t)) return true;
  if (/^DOPUNI\s*SLIJED/i.test(t)) return true;
  if (/^NAPOMENA/i.test(t)) return true;
  if (/^PONOVIMO\s*(NAUČENO|ZAJEDNO)/i.test(t)) return true;
  if (/^Dopuni!$/i.test(t)) return true;
  if (/^PRIMIJENI\s*NAUČENO/i.test(t)) return true;
  if (/^TABELA\s*SEDMIČNIH/i.test(t)) return true;
  if (/^AREFAT\s*[–\-]/i.test(t)) return true;
  if (/^Popuni\s*tabel/i.test(t)) return true;
  if (/^Pravilno\s*poredaj/i.test(t)) return true;
  if (/^Opiši\s*i\s*argumentiraj/i.test(t)) return true;
  if (/^Zaokruži/i.test(t)) return true;
  if (/^Dodatno\s*opiši/i.test(t)) return true;
  if (/^STVARANJE\s/i.test(t)) return true;
  if (/^NEPOKORNOST/i.test(t)) return true;
  if (/^POKAJANJE/i.test(t)) return true;
  if (/^DOLAZAK\s*NA$/i.test(t)) return true;
  if (/^ŽIVOT$/i.test(t)) return true;
  if (/^NA\s*DUNJALUKU$/i.test(t)) return true;
  if (/^\.{3,}/.test(t)) return true;
  if (/^_{3,}/.test(t)) return true;
  if (/^REKATI\s*I\s*SJEDENJE/i.test(t)) return true;
  if (/^(PRVI|DRUGI|TREĆI|ČETVRTI)\s*REKAT$/i.test(t)) return true;
  if (/^(PRVO|POSLJEDNJE)\s*SJEDENJE$/i.test(t)) return true;
  if (/^SUNNET$/i.test(t)) return true;
  if (/^SUNSUNNET$/i.test(t)) return true;
  if (/^FARZ$/i.test(t)) return true;
  if (/^(Sunnet|Farz|Sunsunnet)\s*se\s*zanijeti/i.test(t)) return true;
  if (/^Što\s*znači:\s*"Odlučih/i.test(t)) return true;
  if (/^\d+\.\s*rekat$/i.test(t)) return true;
  if (/^(Et-Tehijatu|Bismilla|Subhaneke|Fatiha)/i.test(t)) return true;
  return false;
}

function isQuestionLine(t) {
  return /^\d+\.\s/.test(t);
}

function isBulletLine(t) {
  return /^[•\-]\s/.test(t);
}

function extractContent(lesson) {
  const sectionLines = getPageLines(lesson.startPage, lesson.endPage);
  if (sectionLines.length === 0) return { ilmihal: [], pitanja: [], zadaca: [] };

  const pitanjaLineIndices = new Set();
  const zadacaLineIndices = new Set();
  const skipLineIndices = new Set();

  for (let i = 0; i < sectionLines.length; i++) {
    const t = sectionLines[i].trim();
    if (isSkippableLine(t)) { skipLineIndices.add(i); continue; }

    if (isPitanjaMarker(t)) {
      skipLineIndices.add(i);
      const scanEnd = Math.min(i + 40, sectionLines.length);
      for (let j = i + 1; j < scanEnd; j++) {
        const lt = sectionLines[j].trim();
        if (!lt) continue;
        if (isSkippableLine(lt)) continue;
        if (isSkipMarker(lt)) continue;
        if (isQuestionLine(lt)) {
          pitanjaLineIndices.add(j);
          let k = j + 1;
          while (k < scanEnd) {
            const ct = sectionLines[k].trim();
            if (!ct) { k++; continue; }
            if (isSkippableLine(ct)) { k++; continue; }
            if (isQuestionLine(ct)) { pitanjaLineIndices.add(k); k++; continue; }
            if (isPitanjaMarker(ct) || isZadacaMarker(ct) || isSkipMarker(ct)) break;
            if (/^[A-ZŠĐČĆŽ][a-zšđčćž]/.test(ct) && ct.length > 35 && !/^ZADATAK/i.test(ct)) break;
            pitanjaLineIndices.add(k);
            k++;
          }
        }
      }
      continue;
    }

    if (isZadacaMarker(t)) {
      skipLineIndices.add(i);
      const scanEnd = Math.min(i + 40, sectionLines.length);
      for (let j = i + 1; j < scanEnd; j++) {
        const lt = sectionLines[j].trim();
        if (!lt) continue;
        if (isSkippableLine(lt)) continue;
        if (isSkipMarker(lt)) continue;
        if (isQuestionLine(lt)) {
          zadacaLineIndices.add(j);
          let k = j + 1;
          while (k < scanEnd) {
            const ct = sectionLines[k].trim();
            if (!ct) { k++; continue; }
            if (isSkippableLine(ct)) { k++; continue; }
            if (isQuestionLine(ct)) { zadacaLineIndices.add(k); k++; continue; }
            if (isPitanjaMarker(ct) || isZadacaMarker(ct) || isSkipMarker(ct)) break;
            if (/^[A-ZŠĐČĆŽ][a-zšđčćž]/.test(ct) && ct.length > 35 && !/^ZADATAK/i.test(ct)) break;
            zadacaLineIndices.add(k);
            k++;
          }
        }
      }
      continue;
    }

    if (isSkipMarker(t)) {
      skipLineIndices.add(i);
      let j = i + 1;
      while (j < sectionLines.length) {
        const lt = sectionLines[j].trim();
        if (!lt) { j++; continue; }
        if (isPitanjaMarker(lt) || isZadacaMarker(lt)) break;
        if (/^[A-ZŠĐČĆŽ][a-zšđčćž]/.test(lt) && lt.length > 40 && !isSkipMarker(lt)) break;
        skipLineIndices.add(j);
        j++;
      }
      i = j - 1;
      continue;
    }
  }

  const ilmihal = [];
  const pitanja = [];
  const zadaca = [];

  for (let i = 0; i < sectionLines.length; i++) {
    const t = sectionLines[i].trim();
    if (!t) continue;
    if (isSkippableLine(t)) continue;

    if (pitanjaLineIndices.has(i)) {
      pitanja.push(t);
    } else if (zadacaLineIndices.has(i)) {
      zadaca.push(t);
    } else if (skipLineIndices.has(i)) {
      continue;
    } else {
      ilmihal.push(t);
    }
  }

  return { ilmihal, pitanja, zadaca };
}

function formatAsHtml(textLines) {
  if (!textLines || textLines.length === 0) return '';

  const paragraphs = [];
  let currentPara = [];
  let listItems = [];

  function flushPara() {
    if (currentPara.length > 0) {
      const text = currentPara.join(' ').replace(/\s+/g, ' ').trim();
      if (text) paragraphs.push('<p class="lesson-text">' + text + '</p>');
      currentPara = [];
    }
  }
  function flushList() {
    if (listItems.length > 0) {
      const isNumbered = /^\d+\./.test(listItems[0]);
      const tag = isNumbered ? 'ol' : 'ul';
      const items = listItems.map(item => {
        const cleaned = item.replace(/^[\d]+\.\s*/, '').replace(/^[•\-]\s*/, '');
        return '<li>' + cleaned + '</li>';
      }).join('\n');
      paragraphs.push('<' + tag + '>\n' + items + '\n</' + tag + '>');
      listItems = [];
    }
  }

  for (let i = 0; i < textLines.length; i++) {
    const line = textLines[i];

    if (/^ZAPAMTI/i.test(line)) {
      flushPara(); flushList();
      const content = line.replace(/^ZAPAMTI!?\s*/i, '').trim();
      let zapText = content;
      let j = i + 1;
      while (j < textLines.length && !/^[A-ZŠĐČĆŽ][a-z]/.test(textLines[j]) && !isQuestionLine(textLines[j]) && !isBulletLine(textLines[j])) {
        zapText += ' ' + textLines[j];
        j++;
      }
      if (zapText) paragraphs.push('<div class="info-box">\n<strong>ZAPAMTI!</strong> ' + zapText.trim() + '\n</div>');
      i = j - 1;
      continue;
    }

    if (/^HADIS$/i.test(line)) {
      flushPara(); flushList();
      let hText = '';
      let j = i + 1;
      while (j < textLines.length) {
        hText += ' ' + textLines[j];
        if (/\([A-Za-zšđčćžŠĐČĆŽ\-\s]+\)\s*$/.test(textLines[j])) { j++; break; }
        j++;
        if (j - i > 8) break;
      }
      if (hText.trim()) paragraphs.push('<div class="arabic-card">\n<p style="font-style: italic; color: var(--primary); font-weight: 700;">' + hText.trim() + '</p>\n</div>');
      i = j - 1;
      continue;
    }

    if (/^Allah,\s*dž\.š\.,?\s*kaže/i.test(line)) {
      flushPara(); flushList();
      let aText = line;
      let j = i + 1;
      while (j < textLines.length) {
        if (/\([A-Za-zšđčćžŠĐČĆŽʼ\-\s,'āãĩũ]+,?\s*\d+[\-\d]*\)\s*$/.test(aText)) break;
        aText += ' ' + textLines[j];
        if (/\([A-Za-zšđčćžŠĐČĆŽʼ\-\s,'āãĩũ]+,?\s*\d+[\-\d]*\)\s*$/.test(textLines[j])) { j++; break; }
        j++;
        if (j - i > 10) break;
      }
      paragraphs.push('<div class="arabic-card">\n<p style="font-style: italic; color: var(--primary); font-weight: 700;">' + aText.trim() + '</p>\n</div>');
      i = j - 1;
      continue;
    }

    if (/^Poslanik,\s*a\.s\.,?\s*(je\s+)?(rekao|kaže)/i.test(line)) {
      flushPara(); flushList();
      let hText = line;
      let j = i + 1;
      while (j < textLines.length) {
        if (/\([A-Za-zšđčćžŠĐČĆŽ\-\s]+\)\s*$/.test(hText)) break;
        hText += ' ' + textLines[j];
        if (/\([A-Za-zšđčćžŠĐČĆŽ\-\s]+\)\s*$/.test(textLines[j])) { j++; break; }
        j++;
        if (j - i > 8) break;
      }
      paragraphs.push('<div class="arabic-card">\n<p style="font-style: italic; color: var(--primary); font-weight: 700;">' + hText.trim() + '</p>\n</div>');
      i = j - 1;
      continue;
    }

    if (isQuestionLine(line) || isBulletLine(line)) {
      flushPara();
      listItems.push(line);
      continue;
    } else if (listItems.length > 0) {
      if (!/^[A-ZŠĐČĆŽ]/.test(line) && !isQuestionLine(line) && !isBulletLine(line)) {
        listItems[listItems.length - 1] += ' ' + line;
        continue;
      }
      flushList();
    }

    currentPara.push(line);
  }

  flushList();
  flushPara();

  return paragraphs.join('\n\n');
}

const results = {};
let stats = { total: 0, withIlmihal: 0, withPitanja: 0, emptyIlmihal: [], emptyPitanja: [] };

for (const lesson of lessonDefs) {
  const sections = extractContent(lesson);
  const ilmihalHtml = formatAsHtml(sections.ilmihal);
  const pitanjaHtml = formatAsHtml(sections.pitanja);
  const zadacaHtml = formatAsHtml(sections.zadaca);

  let fullPitanja = pitanjaHtml;
  if (zadacaHtml) {
    fullPitanja += (fullPitanja ? '\n\n' : '') + '<h3>IZABERI ZADACU!</h3>\n' + zadacaHtml;
  }

  results[lesson.slug] = {
    startPage: lesson.startPage,
    endPage: lesson.endPage,
    ilmihal_html: ilmihalHtml,
    pitanja_html: fullPitanja,
    ilmihal_chars: ilmihalHtml.length,
    pitanja_chars: fullPitanja.length,
    raw_ilmihal_lines: sections.ilmihal.length,
    raw_pitanja_lines: sections.pitanja.length,
    raw_zadaca_lines: sections.zadaca.length,
  };

  stats.total++;
  if (ilmihalHtml.length > 50) stats.withIlmihal++;
  else stats.emptyIlmihal.push(lesson.slug + ' (pp' + lesson.startPage + '-' + lesson.endPage + ')');
  if (fullPitanja.length > 10) stats.withPitanja++;
  else stats.emptyPitanja.push(lesson.slug);
}

fs.writeFileSync(path.join(__dirname, 'extracted-content.json'), JSON.stringify(results, null, 2), 'utf8');

console.log('\n=== EXTRACTION SUMMARY ===');
console.log('Total lessons: ' + stats.total);
console.log('With ilmihal content: ' + stats.withIlmihal + '/' + stats.total);
console.log('With pitanja content: ' + stats.withPitanja + '/' + stats.total);
if (stats.emptyIlmihal.length > 0) console.log('\nEmpty ilmihal (' + stats.emptyIlmihal.length + '): ' + stats.emptyIlmihal.join(', '));
if (stats.emptyPitanja.length > 0) console.log('\nEmpty pitanja (' + stats.emptyPitanja.length + '): ' + stats.emptyPitanja.join(', '));
console.log('\n=== PER-LESSON STATS ===');
for (const [slug, data] of Object.entries(results)) {
  const s1 = data.ilmihal_chars > 50 ? 'OK' : '--';
  const s2 = data.pitanja_chars > 10 ? 'OK' : '--';
  console.log(s1 + '/' + s2 + ' ' + slug + ': ilm=' + data.ilmihal_chars + '/' + data.raw_ilmihal_lines + 'ln, pit=' + data.pitanja_chars + '/' + data.raw_pitanja_lines + 'ln, zad=' + data.raw_zadaca_lines + 'ln');
}
