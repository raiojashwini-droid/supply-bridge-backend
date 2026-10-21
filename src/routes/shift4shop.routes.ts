import express from 'express';
import {
  handleShift4ShopCallback,
  handleShift4ShopRedirect,
  getShift4ShopRegistrationInfo,
  handleShift4ShopWebhook,
} from '../controllers/shift4shop.controller';

const router = express.Router();

// Callback URL endpoints (supports GET, POST, OPTIONS, HEAD etc.)
router.all('/', handleShift4ShopCallback);
router.all('/callback', handleShift4ShopCallback);

// Redirect URL endpoints (after merchant authorizes app)
router.all('/redirect', handleShift4ShopRedirect);

// Webhook endpoints
router.all('/webhook', handleShift4ShopWebhook);

// Registration & Info helper endpoint
router.get('/info', getShift4ShopRegistrationInfo);
router.all('/app', handleShift4ShopRedirect);

export default router;
