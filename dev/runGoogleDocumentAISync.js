import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { OcrEngineGoogleDocumentAI } from '../ocrEngineGoogleDocumentAI.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Note: Sync (online) processing supports images and small PDFs (up to 15 pages).
const filePath = path.join(__dirname, './assets/testocr.png');

const options = {
  // Enter your GCP project ID
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'your-project-id',
  // Enter your processor location (e.g., 'us', 'eu')
  location: process.env.DOCUMENT_AI_LOCATION || 'us',
  // Enter your Document AI processor ID
  processorId: process.env.DOCUMENT_AI_PROCESSOR_ID || 'your-processor-id',
};

const result = await OcrEngineGoogleDocumentAI.recognizeFileSync(filePath, options);

if (!result.success) {
  console.error('Error:', result.error);
  process.exit(1);
}

const parsedPath = path.parse(filePath);
const suffix = 'GoogleDocumentAISync.json';

const outputFileName = `${parsedPath.name}-${suffix}`;
const outputPath = path.join(parsedPath.dir, outputFileName);
console.log(`Writing result to ${outputPath}`);
await fs.promises.writeFile(outputPath, JSON.stringify(result.data, null, 2));
