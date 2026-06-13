const pdfParse = require('pdf-parse');
const fs = require('fs');

async function run() {
  try {
    const filePath = process.argv[2];
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    console.log(data.text);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

run();
