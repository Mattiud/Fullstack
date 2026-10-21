const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const config = require('../config/env');
const routes = require('../routes');
const verifyOrigin = require('../middleware/verifyOrigin');
const { apiLimiter } = require('../middleware/rateLimiters');
const { notFound, errorHandler } = require('../middleware/errorHandler');

const app = express();

app.set('trust proxy', config.trustProxy);

app.use(helmet());
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.use('/api', apiLimiter, verifyOrigin(config.clientOrigin), routes);
app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
