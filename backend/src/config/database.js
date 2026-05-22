const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const connectionString = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/smart-virtual-tourist';
    const databaseName = process.env.MONGODB_DB_NAME || 'tourismGuideDB';

    const connection = await mongoose.connect(connectionString, {
      dbName: databaseName,
    });

    logger.info('MongoDB connected successfully');
    return connection;
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
