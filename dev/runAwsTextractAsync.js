import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { OcrEngineAWSTextractPdf } from '../awsTextractPdf.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, '../../rotation_text_test.pdf');

const options = {
  analyzeLayout: false,
  analyzeLayoutTables: false,
  // Enter your S3 bucket name here to use asynchronous processing.
  // Sync processing does not require an S3 bucket.
  s3Bucket: 'textract-test-misc-us-east-1',
};

const result = await OcrEngineAWSTextractPdf.recognizeFileAsync(filePath, options);

if (!result.success) {
  console.error('Error:', result.error);
  process.exit(1);
}

const parsedPath = path.parse(filePath);
for (let i = 0; i < result.data.length; i++) {
  const outputFileName = `${parsedPath.name}-p${i}-AwsTextract.json`;
  const outputPath = path.join(parsedPath.dir, outputFileName);
  console.log(`Writing result to ${outputPath}`);
  await fs.promises.writeFile(outputPath, JSON.stringify(result.data[i], null, 2));
}
