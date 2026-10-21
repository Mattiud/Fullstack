const config = require('./config/env');
const { connectDB } = require('./config/db');
const app = require('./server/app');

async function start() {
  await connectDB(config.mongodbUri);
  app.listen(config.port, () => {
    console.log(`Servidor escuchando en el puerto ${config.port}`);
  });
}

start().catch((err) => {
  console.error(`No se pudo iniciar el servidor: ${err.message}`);
  process.exit(1);
});
