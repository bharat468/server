import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

export function configureApp(app) {
  app.disable('x-powered-by');
  app.use(helmet());

  app.use(
    cors({
      origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(express.json());

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
  }
}
