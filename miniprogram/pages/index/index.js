// Legacy 路由：已重构为 pages/home/index。这里只做兜底跳转。
Page({
  onLoad() {
    wx.reLaunch({ url: '/pages/home/index' });
  }
});
