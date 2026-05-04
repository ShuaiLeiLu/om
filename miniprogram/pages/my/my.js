const auth = require('../../utils/auth');
const config = require('../../utils/config');

Page({
  data: {
    userInfo: null
  },

  onShow: function () {
    this.refreshUserInfo();
  },

  refreshUserInfo: async function () {
    try {
      const userInfo = await auth.fetchUserInfo();
      this.setData({ userInfo });
    } catch (error) {
      console.error('Refresh user info error:', error);
      // 如果报错，尝试从缓存拿
      const cached = wx.getStorageSync(config.STORAGE_KEYS.USER_INFO);
      if (cached) {
        this.setData({ userInfo: cached });
      }
    }
  },

  goToLedger: function () {
    wx.navigateTo({ url: '/pages/ledger/ledger' });
  },

  goToRedeem: function () {
    wx.navigateTo({ url: '/pages/redeem/redeem' });
  },

  goToHelp: function () {
    wx.navigateTo({ url: '/pages/help/help' });
  },

  goToAgreement: function () {
    wx.navigateTo({ url: '/pages/agreement/agreement' });
  },

  logout: function () {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync();
          wx.reLaunch({ url: '/pages/index/index' });
        }
      }
    });
  }
});
