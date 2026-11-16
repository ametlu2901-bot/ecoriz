require('dotenv').config();

if (!process.env.JWT_SECRET) {
  throw new Error('Falta JWT_SECRET. Copia .env.example como .env y define un valor.');
}

module.exports = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  radioDuplicadoM: Number(process.env.RADIO_DUPLICADO_M || 100),
};
