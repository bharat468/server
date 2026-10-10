import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

export function configureApp(app) {
  app.disable('x-powered-by');
  app.use(helmet());

  app.use(
    cors({
      origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'https://clint-two.vercel.app',
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-Id'],
    })
  );

  app.use(express.json());
  app.use(cookieParser());

  // Rate limiting (Skipped during automated tests to prevent false-positive test throttling)
  if (process.env.NODE_ENV !== 'test') {
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 60, // 60 requests per 15 minutes per IP
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        statusCode: 429,
        message: 'Too many authentication attempts. Please try again after 15 minutes.',
      },
    });

    app.use('/api/v1/auth/send-otp', authLimiter);
    app.use('/api/v1/auth/verify-otp', authLimiter);
    app.use('/api/v1/auth/refresh-token', authLimiter);
    app.use(morgan('combined'));
  }
}
