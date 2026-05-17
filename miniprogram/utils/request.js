const config = require('./config');

function request(options) {
  const token = wx.getStorageSync(config.STORAGE.TOKEN);
  const extraHeader = options.header || {};
  const header = {
    'content-type': 'application/json'
  };
  Object.keys(extraHeader).forEach((key) => {
    header[key] = extraHeader[key];
  });

  if (token) {
    header.Authorization = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        if (res.statusCode === 401) {
          wx.removeStorageSync(config.STORAGE.TOKEN);
        }
        reject(res);
      },
      fail: reject
    });
  });
}

module.exports = request;
