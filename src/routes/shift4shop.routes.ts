import express from 'express';
import {
  handleShift4ShopCallback,
  handleShift4ShopRedirect,
  getShift4ShopRegistrationInfo,
  handleShift4ShopWebhook,
} from '../controllers/shift4shop.controller';

const router = express.Router();

// Callback URL endpoints (both GET and POST supported for Shift4Shop handshake)
router.get('/', handleShift4ShopCallback);
router.post('/', handleShift4ShopCallback);
router.get('/callback', handleShift4ShopCallback);
router.post('/callback', handleShift4ShopCallback);

// Redirect URL endpoints (after merchant authorizes app)
router.get('/redirect', handleShift4ShopRedirect);
router.post('/redirect', handleShift4ShopRedirect);

// Webhook endpoints
router.get('/webhook', handleShift4ShopWebhook);
router.post('/webhook', handleShift4ShopWebhook);

// Registration & Info helper endpoint
router.get('/info', getShift4ShopRegistrationInfo);
router.get('/app', handleShift4ShopRedirect);

export default router;
