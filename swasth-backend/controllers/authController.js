// const pool = require('../config/db');
// const bcrypt = require('bcrypt');
// const jwt = require('jsonwebtoken');

// // REGISTER
// exports.register = async (req, res) => {
//   const { email, password, age, gender, address } = req.body;

//   try {
//     const hashedPassword = await bcrypt.hash(password, 10);

//     await pool.query(
//       'INSERT INTO users (email, password, age, gender, address) VALUES ($1, $2, $3, $4, $5)',
//       [email, hashedPassword, age, gender, address]
//     );

//     res.json({ message: 'User registered successfully' });
//   } catch (err) {
//     res.status(400).json({ error: 'User already exists' });
//   }
// };


// // LOGIN
// exports.login = async (req, res) => {
//   const { email, password } = req.body;

//   const result = await pool.query(
//     'SELECT * FROM users WHERE email = $1',
//     [email]
//   );

//   if (result.rows.length === 0) {
//     return res.status(400).json({ error: 'User not found' });
//   }

//   const user = result.rows[0];

//   const validPassword = await bcrypt.compare(password, user.password);

//   if (!validPassword) {
//     return res.status(400).json({ error: 'Invalid password' });
//   }

//   const token = jwt.sign(
//     { userId: user.id },
//     'MY_SECRET_KEY',
//     { expiresIn: '1h' }
//   );

//   res.json({ token });
// };