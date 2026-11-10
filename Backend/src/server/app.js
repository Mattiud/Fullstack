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
// Límite general reducido. Los informes psicopedagógicos admiten textos extensos,
// varias tablas y áreas con apartados, por lo que sus rutas aceptan un cuerpo mayor.
const jsonGeneral = express.json({ limit: '10kb' });
const jsonInformes = express.json({ limit: '2mb' });
const RUTAS_INFORMES = /^\/api\/menores\/[^/]+\/informes(\/|$)/;
app.use((req, res, next) =>
  (RUTAS_INFORMES.test(req.path) ? jsonInformes : jsonGeneral)(req, res, next)
);
app.use(cookieParser());

app.use('/api', apiLimiter, verifyOrigin(config.clientOrigin), routes);
app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
