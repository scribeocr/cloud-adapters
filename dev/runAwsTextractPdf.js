#!/usr/bin/env node

import { OcrEngineAWSTextractPdf } from '../awsTextractPdf.js';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1 || args[0] === '-h' || args[0] === '--help') {
    console.error(`Usage: ./runAwsTextractPdf.js <filePath> [options]

Arguments:
  <filePath>              Path to the image or PDF file to process

Options:
  --layout               Analyze layout structure
  --tables               Analyze layout and tables
  --s3-bucket <bucket>   S3 bucket name (required for PDF files)
  --s3-key <key>         S3 key prefix (optional, auto-generated if not provided)
  --keep-s3-file         Keep the uploaded S3 file after processing
  --polling-interval <ms> Polling interval in milliseconds (default: 5000)
  --max-wait-time <ms>   Maximum wait time in milliseconds (default: 300000)
  -h, --help             Show this help message

Environment Variables:
  AWS_REGION             AWS region (default: us-east-1)
  AWS_ACCESS_KEY_ID      AWS access key ID
  AWS_SECRET_ACCESS_KEY  AWS secret access key

Examples:
  # Process an image file (synchronous)
  ./runAwsTextractPdf.js image.png

  # Process a PDF file with basic text detection
  ./runAwsTextractPdf.js document.pdf --s3-bucket my-bucket

  # Process a PDF with layout analysis
  ./runAwsTextractPdf.js document.pdf --s3-bucket my-bucket --layout

  # Process a PDF with table analysis
  ./runAwsTextractPdf.js document.pdf --s3-bucket my-bucket --tables

  # Keep the S3 file after processing
  ./runAwsTextractPdf.js document.pdf --s3-bucket my-bucket --keep-s3-file

  # Custom polling settings
  ./runAwsTextractPdf.js document.pdf --s3-bucket my-bucket --polling-interval 3000 --max-wait-time 600000
`);
    process.exit(1);
  }

  const filePath = args[0];

  const options = {
    analyzeLayout: false,
    analyzeLayoutTables: false,
    s3Bucket: null,
    s3Key: null,
    keepS3File: false,
    pollingInterval: 5000,
    maxWaitTime: 300000,
  };

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--layout':
        options.analyzeLayout = true;
        break;
      case '--tables':
        options.analyzeLayout = true;
        options.analyzeLayoutTables = true;
        break;
      case '--s3-bucket':
        if (i + 1 < args.length) {
          options.s3Bucket = args[++i];
        } else {
          console.error('Error: --s3-bucket requires a bucket name');
          process.exit(1);
        }
        break;
      case '--s3-key':
        if (i + 1 < args.length) {
          options.s3Key = args[++i];
        } else {
          console.error('Error: --s3-key requires a key value');
          process.exit(1);
        }
        break;
      case '--keep-s3-file':
        options.keepS3File = true;
        break;
      case '--polling-interval':
        if (i + 1 < args.length) {
          options.pollingInterval = parseInt(args[++i]);
          if (isNaN(options.pollingInterval) || options.pollingInterval < 1000) {
            console.error('Error: --polling-interval must be a number >= 1000');
            process.exit(1);
          }
        } else {
          console.error('Error: --polling-interval requires a number');
          process.exit(1);
        }
        break;
      case '--max-wait-time':
        if (i + 1 < args.length) {
          options.maxWaitTime = parseInt(args[++i]);
          if (isNaN(options.maxWaitTime) || options.maxWaitTime < 10000) {
            console.error('Error: --max-wait-time must be a number >= 10000');
            process.exit(1);
          }
        } else {
          console.error('Error: --max-wait-time requires a number');
          process.exit(1);
        }
        break;
      default:
        console.error(`Error: Unknown option ${args[i]}`);
        process.exit(1);
    }
  }

  try {
    console.log(`Processing file: ${filePath}`);
    if (options.s3Bucket) {
      console.log(`Using S3 bucket: ${options.s3Bucket}`);
    }

    const result = await OcrEngineAWSTextractPdf.recognizeFile(filePath, options);

    if (!result.success) {
      console.error(`Error (${result.errorCode || 'Unknown'}): ${result.error || 'Failed'}`);
      process.exit(2);
    }

    if (options.analyzeLayout || options.analyzeLayoutTables) {
      console.log('\n=== TEXTRACT ANALYSIS RESULTS ===');
      if (result.data.DocumentMetadata) {
        console.log(`Pages: ${result.data.DocumentMetadata.Pages}`);
      }
      if (result.data.Blocks) {
        console.log(`Total blocks found: ${result.data.Blocks.length}`);

        const blockTypes = {};
        result.data.Blocks.forEach((block) => {
          blockTypes[block.BlockType] = (blockTypes[block.BlockType] || 0) + 1;
        });
        console.log('Block types:', blockTypes);
      }
    }

    console.log('\n=== JSON OUTPUT ===');
    console.log(JSON.stringify(result.data, null, 2));
  } catch (err) {
    console.error(`Unexpected error: ${err.message || err}`);
    process.exit(99);
  }
}

main();
