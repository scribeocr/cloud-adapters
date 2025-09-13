import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { OcrEngineAWSTextract } from '../ocrEngineAwsTextract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, '../../rotation_text_test.pdf');

const options = {
  analyzeLayout: true,
  analyzeLayoutTables: false,
  // Enter your S3 bucket name here to use asynchronous processing.
  // Sync processing does not require an S3 bucket.
  s3Bucket: 'textract-test-misc-us-east-1',
};

const result = await OcrEngineAWSTextract.recognizeFileAsync(filePath, options);

if (!result.success) {
  console.error('Error:', result.error);
  process.exit(1);
}

const parsedPath = path.parse(filePath);
let suffix = 'AwsTextract.json';
if (options.analyzeLayout) {
  suffix = 'AwsTextractLayout.json';
}
for (let i = 0; i < result.data.length; i++) {
  const outputFileName = `${parsedPath.name}-p${i}-${suffix}`;
  const outputPath = path.join(parsedPath.dir, outputFileName);
  console.log(`Writing result to ${outputPath}`);
  await fs.promises.writeFile(outputPath, JSON.stringify(result.data[i], null, 2));
}
