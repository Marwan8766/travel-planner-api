const nodemailer = require('nodemailer');

const sendMail = async function (options) {
  // 1) create a transporter
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: { rejectUnauthorized: false },
  });
  // 2) Define email options
  const mailOptions = {
    from: 'Travel planner',
    to: options.email,
    subject: options.subject,
    text: options.text,
    html: options.html,
  };
  // 3) Send the EMAIL
  await transporter.sendMail(mailOptions);
};
module.exports = sendMail;
