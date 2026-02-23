const express = require("express"); //Express helps us create a server easily.
const cors = require("cors"); //Our backend and frontend runs on diff. ports. Browser says:->Different origin! Not allowed!”
// So we use cors() to say: “It’s okay, allow frontend to talk to backend.”
const { Pool } = require("pg"); //Pool is connection manager. Instead of opening new connection every time, Pool reuses them.
const bcrypt = require("bcrypt"); // for password encryption.
const jwt = require("jsonwebtoken");

const app = express(); //We create our server app.

//  Middleware
app.use(cors()); // Enable cross-origin requests.
app.use(express.json()); // Whenever request comes, convert body into JSON automatically.

// This connects Node to your Docker PostgreSQL.
const pool = new Pool({
  user: "admin",
  host: "localhost",
  database: "swasthdb",
  password: "paras_admin123",
  port: 5432,
});

// 5️⃣ Auto-create users table
pool
  .query(
    `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    age INT,
    gender VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`,
  )
  .then(() => console.log("Users table ready"))
  .catch((err) => console.error("Table creation error:", err));

// 6️⃣ Register API
app.post("/register", async (req, res) => {
  //“When someone sends POST request to /register, run this code.”
  // When someone sends request to server: 1.req (Request) This contains:, data sent by user, headers, body , params . 2.res (Response) :This is how server sends reply back.
  const { email, password, age, gender, address } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO users (email, password, age, gender, address) VALUES ($1, $2, $3, $4, $5)",
      [email, hashedPassword, age, gender, address],
    );
    res.json({ message: "User registered successfully" });
  } catch (err) {
    res.status(400).json({ error: "User already exists" });
  }
});

// 7️⃣ Login API
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const result = await pool.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);

  if (result.rows.length === 0) {
    return res.status(400).json({ error: "User not found" });
  }

  const user = result.rows[0];

  const validPassword = await bcrypt.compare(password, user.password); //Compare plain password with encrypted password.

  if (!validPassword) {
    return res.status(400).json({ error: "Invalid password" });
  }

  //   if password matches ->create jwt token
  const token = jwt.sign(
    { userId: user.id }, //Inside token we store:userId
    "MY_SECRET_KEY", //Secret key signs it.
    { expiresIn: "1h" },
  );

  res.json({ token }); //Send token to frontend. Frontend stores it in localStorage.
});

// 8️⃣ Start server
app.listen(3000, () => {
  console.log("Server running on port 3000");
});

// To run backend-> node server.js
