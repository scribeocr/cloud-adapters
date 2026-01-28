import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { Storage } from '@google-cloud/storage';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

export class OcrEngineGoogleDocumentAI {
  constructor() {
    this.name = 'google_document_ai';
  }

  /**
   * Recognize text from an image file synchronously (online processing).
   * @param {string} filePath - Path to the image file
   * @param {Object} options
   * @param {string} options.projectId - GCP project ID
   * @param {string} options.location - Processor location (e.g., 'us', 'eu')
   * @param {string} options.processorId - Document AI processor ID
   */
  static recognizeFileSync = async (filePath, options = {}) => {
    try {
      const fileExtension = extname(filePath).toLowerCase();
      if (!['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff', '.tif', '.pdf'].includes(fileExtension)) {
        return {
          success: false,
          error: `Unsupported file format: ${fileExtension}`,
          errorCode: 'UnsupportedFormat',
        };
      }
      const fileData = await readFile(filePath);
      return await this.recognizeDocumentSync(fileData, { ...options, fileExtension });
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: error.name,
      };
    }
  };

  /**
   * Recognize text from a PDF file asynchronously (batch processing).
   * @param {string} filePath - Path to the PDF file
   * @param {Object} options
   * @param {string} options.projectId - GCP project ID
   * @param {string} options.location - Processor location (e.g., 'us', 'eu')
   * @param {string} options.processorId - Document AI processor ID
   * @param {string} options.gcsBucket - GCS bucket name for input/output
   * @param {string} [options.gcsKey] - GCS key prefix (optional, auto-generated if not provided)
   * @param {boolean} [options.keepGcsFile] - Whether to keep the uploaded GCS file after processing
   */
  static recognizeFileAsync = async (filePath, {
    projectId,
    location,
    processorId,
    gcsBucket,
    gcsKey,
    keepGcsFile = false,
  } = {}) => {
    try {
      const fileExtension = extname(filePath).toLowerCase();
      if (!['.pdf', '.tiff', '.tif', '.gif'].includes(fileExtension)) {
        return {
          success: false,
          error: `Unsupported file format for batch processing: ${fileExtension}`,
          errorCode: 'UnsupportedFormat',
        };
      }

      if (!gcsBucket) {
        return {
          success: false,
          error: 'GCS bucket name is required for batch processing',
          errorCode: 'MissingGcsBucket',
        };
      }

      if (!projectId || !location || !processorId) {
        return {
          success: false,
          error: 'projectId, location, and processorId are required',
          errorCode: 'MissingConfiguration',
        };
      }

      const fileData = await readFile(filePath);
      return await this.recognizeDocumentAsync(fileData, {
        projectId,
        location,
        processorId,
        gcsBucket,
        gcsKey,
        keepGcsFile,
        fileExtension,
      });
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: error.name,
      };
    }
  };

  /**
   * Synchronous document recognition (online processing).
   * @param {Uint8Array} documentData
   * @param {Object} options
   * @param {string} options.projectId - GCP project ID
   * @param {string} options.location - Processor location (e.g., 'us', 'eu')
   * @param {string} options.processorId - Document AI processor ID
   * @param {string} options.fileExtension - File extension for MIME type detection
   */
  static recognizeDocumentSync = async (documentData, {
    projectId,
    location,
    processorId,
    fileExtension,
  } = {}) => {
    try {
      if (!projectId || !location || !processorId) {
        return {
          success: false,
          error: 'projectId, location, and processorId are required',
          errorCode: 'MissingConfiguration',
        };
      }

      const client = new DocumentProcessorServiceClient({
        apiEndpoint: `${location}-documentai.googleapis.com`,
      });

      const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
      const mimeType = this.getMimeType(fileExtension);

      const request = {
        name,
        rawDocument: {
          content: Buffer.from(documentData).toString('base64'),
          mimeType,
        },
      };

      const [result] = await client.processDocument(request);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: error.name,
      };
    }
  };

  /**
   * Asynchronous document recognition (batch processing).
   * @param {Uint8Array} fileData
   * @param {Object} options
   * @param {string} options.projectId - GCP project ID
   * @param {string} options.location - Processor location
   * @param {string} options.processorId - Document AI processor ID
   * @param {string} options.gcsBucket - GCS bucket name
   * @param {string} [options.gcsKey] - GCS key prefix
   * @param {boolean} [options.keepGcsFile] - Keep GCS files after processing
   * @param {string} options.fileExtension - File extension
   */
  static recognizeDocumentAsync = async (fileData, {
    projectId,
    location,
    processorId,
    gcsBucket,
    gcsKey,
    keepGcsFile = false,
    fileExtension,
  } = {}) => {
    const client = new DocumentProcessorServiceClient({
      apiEndpoint: `${location}-documentai.googleapis.com`,
    });
    const storage = new Storage();

    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substr(2, 9);
    const finalGcsKey = gcsKey || `documentai-temp/${timestamp}-${randomSuffix}${fileExtension}`;
    const outputPrefix = `documentai-output/${timestamp}-${randomSuffix}/`;
    const gcsUri = `gs://${gcsBucket}/${finalGcsKey}`;
    const outputGcsUri = `gs://${gcsBucket}/${outputPrefix}`;

    const mimeType = this.getMimeType(fileExtension);

    try {
      console.log(`Uploading file to GCS: ${gcsUri}`);
      await storage.bucket(gcsBucket).file(finalGcsKey).save(fileData, {
        contentType: mimeType,
      });

      const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

      const request = {
        name,
        inputDocuments: {
          gcsDocuments: {
            documents: [
              {
                gcsUri,
                mimeType,
              },
            ],
          },
        },
        documentOutputConfig: {
          gcsOutputConfig: {
            gcsUri: outputGcsUri,
          },
        },
      };

      console.log('Starting Document AI batch processing...');
      const [operation] = await client.batchProcessDocuments(request);

      console.log('Waiting for batch processing to complete...');
      await operation.promise();

      const [outputFiles] = await storage.bucket(gcsBucket).getFiles({ prefix: outputPrefix });

      const results = [];
      for (const file of outputFiles) {
        if (file.name.endsWith('.json')) {
          const [content] = await file.download();
          results.push(JSON.parse(content.toString()));
        }
      }

      if (!keepGcsFile) {
        console.log(`Cleaning up GCS output files with prefix: ${outputPrefix}`);
        await Promise.all(outputFiles.map((file) => file.delete()));
      }

      return { success: true, data: results };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: error.name,
      };
    } finally {
      if (!keepGcsFile) {
        try {
          console.log(`Cleaning up GCS file: ${gcsUri}`);
          await storage.bucket(gcsBucket).file(finalGcsKey).delete();
        } catch (cleanupError) {
          console.warn(`Failed to clean up GCS file: ${cleanupError.message}`);
        }
      }
    }
  };

  /**
   * Get MIME type from file extension.
   * @param {string} fileExtension
   * @returns {string}
   */
  static getMimeType = (fileExtension) => {
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      '.tiff': 'image/tiff',
      '.tif': 'image/tiff',
    };
    return mimeTypes[fileExtension.toLowerCase()] || 'application/octet-stream';
  };

  /**
   * Combines output from batch Document AI processing into a single object.
   * @param {Array<Object>} responses
   * @returns {Object}
   */
  static combineDocumentAIAsyncResponses = (responses) => {
    if (!responses || responses.length === 0) {
      throw new Error('No responses to combine.');
    }

    if (responses.length === 1) {
      return responses[0];
    }

    const combined = JSON.parse(JSON.stringify(responses[0]));

    for (let i = 1; i < responses.length; i++) {
      const response = responses[i];
      if (response.document?.pages) {
        combined.document.pages.push(...response.document.pages);
      }
      if (response.document?.entities) {
        combined.document.entities = combined.document.entities || [];
        combined.document.entities.push(...response.document.entities);
      }
    }

    return combined;
  };
}
