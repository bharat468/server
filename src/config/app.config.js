import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

export function configureApp(app) {
	app.disable('x-powered-by');
	app.use(helmet());
	app.use(cors());
	app.use(express.json());

	if (process.env.NODE_ENV !== 'test') {
		app.use(morgan('combined'));
	}
}
