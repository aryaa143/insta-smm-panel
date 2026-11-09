// Generic client for the de-facto "SMM Panel API" standard that most
// upstream providers (the companies that actually fulfil orders) speak.
// It's a single HTTP endpoint that takes POST form data with an `action`
// field. This file does not know or care which provider you use - point
// PROVIDER_API_URL / PROVIDER_API_KEY (Admin -> Settings) at your real
// provider account and these calls will work against it.
//
// Reference actions (common across providers like the ones listed on
// most "SMM panel script" docs):
//   action=services                -> list of sellable services
//   action=add     + service,link,quantity -> place an order
//   action=status  + order                 -> single order status
//   action=status  + orders (csv)          -> multi order status
//   action=balance                         -> your provider account balance
//   action=refill  + order                 -> request a refill
//   action=cancel  + order(s)              -> request a cancellation
//
// If your specific provider deviates from this (field names etc.), this
// is the only file you need to edit.

const fetch = require('node-fetch');
const settingsModel = require('../models/settings');

function getCreds() {
  const url = settingsModel.get('provider_api_url', process.env.PROVIDER_API_URL || '');
  const key = settingsModel.get('provider_api_key', process.env.PROVIDER_API_KEY || '');
  return { url, key };
}

function isConfigured() {
  const { url, key } = getCreds();
  return Boolean(url && key);
}

async function call(params = {}) {
  const { url, key } = getCreds();
  if (!url || !key) {
    const err = new Error('Upstream provider API is not configured yet (Admin -> Settings).');
    err.code = 'PROVIDER_NOT_CONFIGURED';
    throw err;
  }

  const body = new URLSearchParams({ key, ...params });

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      timeout: 20000,
    });
  } catch (networkErr) {
    const err = new Error(`Could not reach provider API: ${networkErr.message}`);
    err.code = 'PROVIDER_UNREACHABLE';
    throw err;
  }

  let data;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    const err = new Error(`Provider API returned a non-JSON response (HTTP ${res.status}).`);
    err.code = 'PROVIDER_BAD_RESPONSE';
    throw err;
  }

  if (data && data.error) {
    const err = new Error(`Provider error: ${data.error}`);
    err.code = 'PROVIDER_ERROR';
    throw err;
  }

  return data;
}

const getServices = () => call({ action: 'services' });

const getBalance = () => call({ action: 'balance' });

const addOrder = ({ serviceId, link, quantity, extra = {} }) =>
  call({ action: 'add', service: serviceId, link, quantity, ...extra });

const getOrderStatus = (providerOrderId) => call({ action: 'status', order: providerOrderId });

const getMultiStatus = (providerOrderIds = []) =>
  call({ action: 'status', orders: providerOrderIds.join(',') });

const requestRefill = (providerOrderId) => call({ action: 'refill', order: providerOrderId });

const requestCancel = (providerOrderIds = []) =>
  call({ action: 'cancel', orders: providerOrderIds.join(',') });

module.exports = {
  isConfigured,
  getServices,
  getBalance,
  addOrder,
  getOrderStatus,
  getMultiStatus,
  requestRefill,
  requestCancel,
};
