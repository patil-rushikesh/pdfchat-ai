import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),

  // Frontend URL for CORS
  FRONTEND_URL: process.env.FRONTEND_URL || '*',

  // Pinecone Configuration
  PINECONE_API_KEY: process.env.PINECONE_API_KEY,
  PINECONE_INDEX: process.env.PINECONE_INDEX,

  // Gemini / Ollama Configuration
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  OLLAMA_URL: process.env.OLLAMA_URL || 'http://localhost:11434',

  // PostgreSQL — document metadata
  DATABASE_URL: process.env.DATABASE_URL,          // full connection string (optional)
  PGHOST:     process.env.PGHOST     || 'localhost',
  PGPORT:     process.env.PGPORT     || '5432',
  PGDATABASE: process.env.PGDATABASE || 'pdfchat',
  PGUSER:     process.env.PGUSER     || 'postgres',
  PGPASSWORD: process.env.PGPASSWORD || '',

  // MongoDB — chat conversation history
  MONGODB_URI:     process.env.MONGODB_URI,
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'pdfchat',

  // AWS S3 — PDF file storage
  AWS_REGION:            process.env.AWS_REGION            || 'us-east-1',
  AWS_ACCESS_KEY_ID:     process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  S3_BUCKET_NAME:        process.env.S3_BUCKET_NAME,

  // Auth
  JWT_SECRET:   process.env.JWT_SECRET,
  REQUIRE_AUTH: process.env.REQUIRE_AUTH === 'true',

  // Signed URL TTL (seconds)
  SIGNED_URL_EXPIRES: parseInt(process.env.SIGNED_URL_EXPIRES || '3600', 10),

  // File Upload Limits
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10), // 50 MB

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS:    parseInt(process.env.RATE_LIMIT_WINDOW_MS    || '900000', 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100',    10),
} as const;

// Validate environment variables.
// Required vars are hard-blocked in production; optional vars log a warning.
export function validateEnvironment(): void {
  const requiredVars = ['PINECONE_API_KEY', 'PINECONE_INDEX', 'GEMINI_API_KEY'];
  const optionalVars = [
    { name: 'DATABASE_URL',          feature: 'PostgreSQL document metadata' },
    { name: 'MONGODB_URI',           feature: 'MongoDB chat history' },
    { name: 'S3_BUCKET_NAME',        feature: 'S3 file storage' },
    { name: 'AWS_ACCESS_KEY_ID',     feature: 'S3 file storage' },
    { name: 'AWS_SECRET_ACCESS_KEY', feature: 'S3 file storage' },
  ];

  const missingVars = requiredVars.filter((v) => !process.env[v]);
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach((v) => console.error(`   - ${v}`));
    console.error('\nPlease set these variables in your .env file or environment.');
    if (ENV.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn('⚠️  Continuing in development mode, but some features may not work.');
    }
  } else {
    console.log('✅ All required environment variables are set.');
  }

  const missingOptional = optionalVars.filter((v) => !process.env[v.name]);
  if (missingOptional.length > 0) {
    console.warn('⚠️  Optional environment variables not set (features disabled):');
    missingOptional.forEach((v) => console.warn(`   - ${v.name}  (${v.feature})`));
  }
}

// Check if we're in production
export const isProduction = ENV.NODE_ENV === 'production';
export const isDevelopment = ENV.NODE_ENV === 'development';
