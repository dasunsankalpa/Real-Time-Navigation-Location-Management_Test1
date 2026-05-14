const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const app = express();
const PORT = process.env.PORT || 5000;



dotenv.config(); //use to access the values in .env file
// Middleware
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Smart Virtual Tourist Guide API' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

//db connection
let mongoUrl = process.env.MONGO_URL;
mongoose.connect(mongoUrl);

let connection =  mongoose.connection
connection.once("open", ()=>{
    console.log("MongoDB connected successfully")
});

