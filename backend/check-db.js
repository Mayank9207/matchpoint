const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGO_URI;
(async () => {
  try {
    console.log('Checking MONGO_URI present:', !!uri);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('OK: connected to MongoDB');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('CONNECT ERROR:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
