const config = require('./config');

/**
 * 封装微信请求
 * @param {Object} options 请求配置
 */
function request(options) {
  const { url, method = 'GET', data = {}, header = {} } = options;
  const sessionToken = wx.getStorageSync(config.STORAGE_KEYS.SESSION_TOKEN);

  const defaultHeader = {
    'content-type': 'application/json',
  };

  if (sessionToken) {
    defaultHeader['Authorization'] = `Bearer ${sessionToken}`;
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data,
      header: { ...defaultHeader, ...header },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          // Session expired, clear and re-login
          wx.removeStorageSync(config.STORAGE_KEYS.SESSION_TOKEN);
          // Trigger global re-login logic if needed
          reject(res);
        } else {
          reject(res);
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
}

module.exports = request;
