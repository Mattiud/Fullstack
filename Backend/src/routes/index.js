const express = require('express');
const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const auditRoutes = require('./audit.routes');
const menoresRoutes = require('./menores.routes');
const diagnosticosRoutes = require('./diagnosticos.routes');
const tiposDiagnosticoRoutes = require('./tiposDiagnostico.routes');
const sesionesRoutes = require('./sesiones.routes');
const configuracionInformesRoutes = require('./configuracionInformes.routes');
const informesRoutes = require('./informes.routes');
const actividadRoutes = require('./actividad.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/menores', menoresRoutes);
router.use('/diagnosticos', diagnosticosRoutes);
router.use('/tipos-diagnostico', tiposDiagnosticoRoutes);
router.use('/sesiones', sesionesRoutes);
router.use('/configuracion-informes', configuracionInformesRoutes);
router.use('/informes', informesRoutes);
router.use('/actividad-reciente', actividadRoutes);

module.exports = router;
