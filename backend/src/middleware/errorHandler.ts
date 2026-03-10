import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction): void => {
  const status = err.status || err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    console.error('[error]', err);
  }

  res.status(status).json({
    error: isProduction ? 'Internal Server Error' : (err.message || 'Something went wrong'),
    ...(isProduction ? {} : { stack: err.stack }),
    timestamp: new Date().toISOString(),
  });
};
