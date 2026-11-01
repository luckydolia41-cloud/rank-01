'use strict';
const mongoose = require('mongoose');

let gridBucket = null;

/* dbName always wins over the database named in the link, so this site never shares a database with another app. */
async function connect(uri, dbName) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, Object.assign({ serverSelectionTimeoutMS: 15000, maxPoolSize: 10 }, dbName ? { dbName } : {}));
  gridBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
  return mongoose.connection;
}

function bucket() {
  if (!gridBucket) throw new Error('Database is not connected yet.');
  return gridBucket;
}

function disconnect() {
  gridBucket = null;
  return mongoose.disconnect();
}

module.exports = { mongoose, connect, bucket, disconnect };
