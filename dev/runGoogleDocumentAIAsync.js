import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { OcrEngineGoogleDocumentAI } from '../ocrEngineGoogleDocumentAI.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, './assets/testocr_all_orientations.pdf');

const combineResponses = true;

const options = {
  // Enter your GCP project ID
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'your-project-id',
  // Enter your processor location (e.g., 'us', 'eu')
  location: process.env.DOCUMENT_AI_LOCATION || 'us',
  // Enter your Document AI processor ID
  processorId: process.env.DOCUMENT_AI_PROCESSOR_ID || 'your-processor-id',
  // Enter your GCS bucket name for batch processing
  gcsBucket: 'vision-test-misc-us-east-1',
};

if (options.projectId === 'your-project-id' || options.processorId === 'your-processor-id') {
  console.error('Please set your Google Cloud project ID and Document AI processor ID in the options.');
  process.exit(1);
}

const result = await OcrEngineGoogleDocumentAI.recognizeFileAsync(filePath, options);

if (!result.success) {
  console.error('Error:', result.error);
  process.exit(1);
}

const parsedPath = path.parse(filePath);
const suffix = 'GoogleDocumentAI.json';

if (combineResponses) {
  const outputFileName = `${parsedPath.name}-${suffix}`;
  const outputPath = path.join(parsedPath.dir, outputFileName);
  console.log(`Writing combined result to ${outputPath}`);
  await fs.promises.writeFile(outputPath, JSON.stringify(OcrEngineGoogleDocumentAI.combineDocumentAIAsyncResponses(result.data), null, 2));
} else {
  for (let i = 0; i < result.data.length; i++) {
    const outputFileName = `${parsedPath.name}-p${i}-${suffix}`;
    const outputPath = path.join(parsedPath.dir, outputFileName);
    console.log(`Writing result to ${outputPath}`);
    await fs.promises.writeFile(outputPath, JSON.stringify(result.data[i], null, 2));
  }
}
