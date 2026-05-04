const config = require('./config');
const request = require('./request');

async function login() {
  const { code } = await new Promise((resolve, reject) => {
    wx.login({ success: resolve, fail: reject });
  });

  const res = await request({
    url: config.API.LOGIN,
    method: 'POST',
    data: { code }
  });

  if (!res.miniappSessionToken) {
    throw new Error('miniapp_session_missing');
  }

  wx.setStorageSync(config.STORAGE.TOKEN, res.miniappSessionToken);
  if (res.user) {
    wx.setStorageSync(config.STORAGE.USER, res.user);
  }
  return res;
}

async function ensureLogin() {
  const token = wx.getStorageSync(config.STORAGE.TOKEN);
  if (token) return true;
  return login();
}

async function fetchUserInfo() {
  const user = await request({ url: config.API.ME });
  wx.setStorageSync(config.STORAGE.USER, user);
  return user;
}

module.exports = {
  login,
  ensureLogin,
  fetchUserInfo
};
