Page({
  data: {
    message: ''
  },

  onLoad: function (options) {
    if (options.msg) {
      this.setData({ message: decodeURIComponent(options.msg) });
    }
  },

  retry: function () {
    wx.reLaunch({
      url: '/pages/index/index'
    });
  }
});
