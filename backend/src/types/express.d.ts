/**
 * Express Request augmentation.
 *
 * – req.user   populated by middleware/auth.ts after JWT validation
 * – req.file   populated by multer for single-file uploads
 * – req.files  populated by multer for multi-file uploads
 * – req.body   typed as `any`; individual controllers cast to their own shapes
 *
 * Note: req.user is also augmented in middleware/auth.ts; TypeScript merges both.
 */
declare global {
  namespace Express {
    interface Request {
      body: any;
      file?: {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        buffer: Buffer;
        destination?: string;
        filename?: string;
        path?: string;
      };
      files?: {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        buffer: Buffer;
        destination?: string;
        filename?: string;
        path?: string;
      }[];
    }
  }
}

export {};
