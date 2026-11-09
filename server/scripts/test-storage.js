import assert from 'assert';
import { isValidPdf, normalizeStorageKey, storageService } from '../src/storage.js';

console.log('--- Testing Storage Service & Utilities ---\n');

// 1. PDF Magic Bytes Validation
console.log('1. Testing isValidPdf()...');
const validPdfBuffer = Buffer.from('%PDF-1.4 sample content');
const invalidPdfBuffer = Buffer.from('Not a PDF');
const shortBuffer = Buffer.from('%PD');
const emptyBuffer = Buffer.alloc(0);

assert.strictEqual(isValidPdf(validPdfBuffer), true, 'Valid PDF buffer must return true');
assert.strictEqual(isValidPdf(invalidPdfBuffer), false, 'Non-PDF buffer must return false');
assert.strictEqual(isValidPdf(shortBuffer), false, 'Short buffer must return false');
assert.strictEqual(isValidPdf(emptyBuffer), false, 'Empty buffer must return false');
assert.strictEqual(isValidPdf(null), false, 'null buffer must return false');
console.log('  ✓ isValidPdf passed');

// 2. Storage Key Normalization
console.log('2. Testing normalizeStorageKey()...');
assert.strictEqual(normalizeStorageKey('/uploads/papers/123.pdf'), 'papers/123.pdf');
assert.strictEqual(normalizeStorageKey('uploads/papers/123.pdf'), 'papers/123.pdf');
assert.strictEqual(normalizeStorageKey('/api/files/papers/123.pdf'), 'papers/123.pdf');
assert.strictEqual(normalizeStorageKey('/papers/123.pdf'), 'papers/123.pdf');
assert.strictEqual(normalizeStorageKey('/uploads/answers/test.pdf?v=123'), 'answers/test.pdf');
assert.strictEqual(normalizeStorageKey('papers/123.pdf'), 'papers/123.pdf');
console.log('  ✓ normalizeStorageKey passed');

// 3. Upload, FileExists, GetFile, Delete
console.log('3. Testing Storage CRUD operations...');
const testKey = `papers/test-unit-${Date.now()}.pdf`;
const testContent = Buffer.from('%PDF-1.4 test document content for verification');

// Upload
const uploadRes = await storageService.uploadFile({
  key: testKey,
  buffer: testContent,
  contentType: 'application/pdf',
  metadata: { test: 'true' },
});
assert.strictEqual(uploadRes.key, testKey);
console.log('  ✓ uploadFile passed');

// FileExists
const exists = await storageService.fileExists(testKey);
assert.strictEqual(exists, true, 'File must exist after upload');
console.log('  ✓ fileExists passed');

// Helper to consume a stream
async function consumeStream(stream) {
  if (!stream) return;
  for await (const _ of stream) {}
}

// GetFile (Full)
const file = await storageService.getFile(testKey);
assert.ok(file, 'getFile must return an object');
assert.strictEqual(file.contentType, 'application/pdf');
await consumeStream(file.stream);
console.log('  ✓ getFile (full) passed');

// GetFile (Range)
const rangeFile = await storageService.getFile(testKey, { range: 'bytes=0-10' });
assert.ok(rangeFile, 'getFile with range must return an object');
await consumeStream(rangeFile.stream);
console.log('  ✓ getFile (range) passed');

// Replace File
const replaceKey = `papers/test-unit-replaced-${Date.now()}.pdf`;
const newContent = Buffer.from('%PDF-1.4 replacement content');
const { key: newKey, cleanupOld, rollback } = await storageService.replaceFile({
  oldKey: testKey,
  newKey: replaceKey,
  buffer: newContent,
  contentType: 'application/pdf',
});
assert.strictEqual(newKey, replaceKey);
assert.strictEqual(await storageService.fileExists(replaceKey), true);

// Execute cleanup of old file
await cleanupOld();
assert.strictEqual(await storageService.fileExists(testKey), false, 'Old file must be cleaned up');
console.log('  ✓ replaceFile passed');

// Delete replacement file
await storageService.deleteFile(replaceKey);
assert.strictEqual(await storageService.fileExists(replaceKey), false, 'New file must be deleted');
console.log('  ✓ deleteFile passed');

console.log('\n=======================================');
console.log('ALL STORAGE TESTS PASSED SUCCESSFULLY!');
console.log('=======================================\n');



