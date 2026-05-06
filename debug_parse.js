const { parseBlanks } = require('./src/utils/documentGenerator');
const path = require('path');

// Quick pattern test
const DOTS_RAW = /[.…]{3,}|…+/g;
const tests = [
  'Thành viên có mặt:…… người.',
  'Thành viên vắng mặt:…….( Có lý do)',
  'ngày … tháng … năm 20…',
  'Số: ....../202.../BBH-NĐT',
  'cổ phần...',
  'theo quy định...',
];
for (const t of tests) {
  const regex = new RegExp(DOTS_RAW.source, 'g');
  const matches = [];
  let m;
  while ((m = regex.exec(t)) !== null) matches.push(`"${m[0]}"(${m[0].length})`);
  console.log(matches.length ? `MATCH ${matches.join(', ')}` : 'SKIP', '|', t);
}

// Full parse
async function main() {
  const filePath = path.join(__dirname, 'uploads/templates/NHÀ-ĐẦU-T1.docx');
  const blanks = await parseBlanks(filePath, 'docx');
  console.log(`\n=== ${blanks.length} blanks ===\n`);
  blanks.forEach((b, i) => {
    const cont = b.continuationDots?.length ? ` (+${b.continuationDots.length} dòng tiếp)` : '';
    console.log(`${String(i+1).padStart(2)}. "${b.label}"${cont}`);
  });
}
main();
