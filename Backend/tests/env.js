// Variables de entorno exclusivas de las pruebas. Se cargan antes que la aplicación,
// por lo que tienen prioridad sobre el archivo .env.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'secreto-exclusivo-para-pruebas-automatizadas-0123456789';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.TRUST_PROXY = '0';
process.env.DOCUMENTOS_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
process.env.DOCUMENTOS_MAX_MB = '1';
