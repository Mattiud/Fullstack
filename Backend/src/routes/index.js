const express = require('express');
const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const auditRoutes = require('./audit.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/audit-logs', auditRoutes);

module.exports = router;
