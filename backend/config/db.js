const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

// no external parameters will be used here as all the stuff is being fetched from .env file
// this function attempts to connect to MongoDB using the MONGO_URI env var.
// It now fails fast if the URI is missing and rethrows connection errors so
// the caller (server bootstrap) can decide not to start the HTTP server.
async function connectdb() {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI not set in environment');
    }
    try {
        console.log('Connecting to MongoDB at', process.env.MONGO_URI ? 'URI found ✅' : '❌ Missing URI');
        // Set some mongoose defaults to avoid deprecation warnings and make connection fail faster when unreachable
        mongoose.set('strictQuery', false);
        const connectOptions = {
            // modern driver options; serverSelectionTimeoutMS makes connection attempts fail faster
            serverSelectionTimeoutMS: 5000,
        };
        const res = await mongoose.connect(process.env.MONGO_URI, connectOptions);
        console.log('Mongodb succesfully connected');
        return res;
    } catch (err) {
        console.log('error', err.message);
        throw err;
    }
}

module.exports = connectdb;