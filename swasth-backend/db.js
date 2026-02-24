// Pool = PostgreSQL connection manager.
// It connects Node → PostgreSQL.

const { Pool } = require("pg");

// This connects Node to your Docker PostgreSQL.
const pool = new Pool({
  user: "admin",
  host: "localhost",
  database: "swasthdb",
  password: "paras_admin123",
  port: 5432,
});

module.exports = pool;//We export it so other files can use it.