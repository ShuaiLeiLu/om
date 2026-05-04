const config = require('./config');
const request = require('./request');

async function login() {
  const { code } = await new Promise((rs, rj) => wx.login({ success: rs, fail: rj }));
  const res = await request({
    url: config.API.LOGIN,
    method: 'POST',
    data: { code }
  });
  if (res.miniappSessionToken) {
    wx.setStorageSync(config.STORAGE.TOKEN, res.miniappSessionToken);
    if (res.user) wx.setStorageSync(config.STORAGE.USER, res.user);
    return res;
  }
  throw new Error('AUTH_FAIL');
}

async function ensureLogin() {
  if (!wx.getStorageSync(config.STORAGE.TOKEN)) return await login();
  return true;
}

async function fetchUserInfo() {
  const res = await request({ url: config.API.ME });
  wx.setStorageSync(config.STORAGE.USER, res);
  return res;
}

module.exports = { login, ensureLogin, fetchUserInfo };
