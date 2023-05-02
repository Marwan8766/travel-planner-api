const { pathToFileURL } = require('url');
const path = require('path');
const dotenv = require('dotenv');
const cloudinary = require('cloudinary').v2;

{
  const __dirname = path.dirname(pathToFileURL(require.main.filename).pathname);
  dotenv.config({ path: path.join(__dirname, '../config.env') });

  cloudinary.config({
    cloud_name: process.env.cloud_name,
    api_key: process.env.api_key,
    api_secret: process.env.api_secret,
    secure: true,
  });
}

module.exports = cloudinary;



