const express = require('express');
const chatbotAPIController = require('../controllers/chatbotAPIController');
///////////////////////////////////////////////////////

const router = express.Router();

router.post('/webhook', chatbotAPIController.chatbotWebhookHandler);

module.exports = router;

//   The response must occur within 10 seconds for Google Assistant applications or 5 seconds for all other applications, otherwise the request will time out.

//  The response must be less than or equal to 64 KiB in size.
