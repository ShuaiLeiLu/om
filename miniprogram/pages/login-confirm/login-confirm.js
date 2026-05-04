const request = require('../../utils/request');
const config = require('../../utils/config');
const auth = require('../../utils/auth');

Page({
  data: {
    sessionId: '',
    sessionInfo: null,
    loading: false,
    expired: false
  },

  onLoad: function (options) {
    let sessionId = options.sessionId || '';
    if (options.scene) {
      // 扫码进入，scene 是 sessionId
      sessionId = decodeURIComponent(options.scene);
    }

    if (!sessionId) {
      wx.showModal({
        title: '错误',
        content: '无效的登录会话',
        showCancel: false,
        success: () => {
          wx.reLaunch({ url: '/pages/index/index' });
        }
      });
      return;
    }

    this.setData({ sessionId });
    this.reportScan(sessionId);
  },

  reportScan: async function (sessionId) {
    try {
      await auth.ensureLogin();
      const res = await request({
        url: config.API.SESSION_SCAN,
        method: 'POST',
        data: { sessionId }
      });
      this.setData({ sessionInfo: res });
      if (res.status === 'expired') {
        this.setData({ expired: true });
      }
    } catch (error) {
      console.error('Report scan error:', error);
      if (error.data && error.data.code === 'qr_session_expired') {
        this.setData({ expired: true });
      }
    }
  },

  confirmLogin: async function () {
    this.setData({ loading: true });
    try {
      await request({
        url: config.API.SESSION_CONFIRM,
        method: 'POST',
        data: { sessionId: this.data.sessionId }
      });
      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 2000
      });
      setTimeout(() => {
        wx.reLaunch({ url: '/pages/index/index' });
      }, 2000);
    } catch (error) {
      console.error('Confirm login error:', error);
      wx.showModal({
        title: '登录失败',
        content: error.data?.message || '请重试',
        showCancel: false
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  cancelLogin: function () {
    wx.reLaunch({ url: '/pages/index/index' });
  }
});
