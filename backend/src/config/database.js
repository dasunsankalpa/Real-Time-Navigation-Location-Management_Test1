const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const connection = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-virtual-tourist', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    logger.info('MongoDB connected successfully');
    return connection;
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
