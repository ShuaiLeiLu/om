const config = require('./config');
const request = require('./request');

/**
 * 执行微信登录并换取后端 Session
 */
async function login() {
  try {
    const { code } = await new Promise((resolve, reject) => {
      wx.login({
        success: resolve,
        fail: reject
      });
    });

    const res = await request({
      url: config.API.LOGIN,
      method: 'POST',
      data: { code }
    });

    if (res.miniappSessionToken) {
      wx.setStorageSync(config.STORAGE_KEYS.SESSION_TOKEN, res.miniappSessionToken);
      if (res.user) {
        wx.setStorageSync(config.STORAGE_KEYS.USER_INFO, res.user);
      }
      return res;
    } else {
      throw new Error('Login failed: No session token returned');
    }
  } catch (error) {
    console.error('Auth login error:', error);
    throw error;
  }
}

/**
 * 检查并确保已登录
 */
async function ensureLogin() {
  const token = wx.getStorageSync(config.STORAGE_KEYS.SESSION_TOKEN);
  if (!token) {
    return await login();
  }
  return true;
}

/**
 * 获取最新的用户信息
 */
async function fetchUserInfo() {
  try {
    const res = await request({
      url: config.API.ME,
      method: 'GET'
    });
    wx.setStorageSync(config.STORAGE_KEYS.USER_INFO, res);
    return res;
  } catch (error) {
    console.error('Fetch user info error:', error);
    throw error;
  }
}

module.exports = {
  login,
  ensureLogin,
  fetchUserInfo
};
