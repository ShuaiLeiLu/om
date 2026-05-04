const config = require('./config');

function request(opt) {
  const token = wx.getStorageSync(config.STORAGE.TOKEN);
  const header = { ...opt.header };
  if (token) header['Authorization'] = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    wx.request({
      url: opt.url,
      method: opt.method || 'GET',
      data: opt.data || {},
      header,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data);
        else if (res.statusCode === 401) {
          wx.removeStorageSync(config.STORAGE.TOKEN);
          reject(res);
        } else reject(res);
      },
      fail: reject
    });
  });
}

module.exports = request;
