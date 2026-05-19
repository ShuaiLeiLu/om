const auth = require('../../utils/auth');
const request = require('../../utils/request');
const config = require('../../utils/config');
const { translateLoginError } = require('../../utils/errors');

Page({
  data: {
    scene: '',
    status: 'ready', // ready | confirming | confirmed | failed
    statusText: '正在确认登录...',
    errorText: ''
  },

  onLoad(options) {
    const scene = this.extractScene(options || {});
    if (!scene) {
      this.setData({
        status: 'failed',
        statusText: '没有捕获到登录二维码信息',
        errorText: '请回到网页端重新生成二维码'
      });
      return;
    }
    this.setData({ scene });
    this.autoConfirm();
  },

  extractScene(options) {
    const raw = decodeURIComponent(options.scene || options.q || '');
    if (!raw) return '';
    const m = raw.match(/login_[A-Za-z0-9_-]+/);
    return m ? m[0] : '';
  },

  async autoConfirm() {
    if (!this.data.scene) return;
    this.setData({ status: 'confirming', statusText: '正在确认登录...' });
    try {
      await auth.ensureLogin();
      const token = wx.getStorageSync(config.STORAGE.TOKEN);
      await request({
        url: config.API.WEB_LOGIN_SCAN_AND_CONFIRM,
        method: 'POST',
        data: { scene: this.data.scene, miniappSessionToken: token }
      });
      this.setData({
        status: 'confirmed',
        statusText: '网页登录成功'
      });
      wx.showToast({ title: '已确认登录', icon: 'success' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/home/index' });
      }, 1200);
    } catch (error) {
      console.error('auto confirm failed:', error);
      this.setData({
        status: 'failed',
        statusText: '登录确认失败',
        errorText: translateLoginError(error)
      });
    }
  },

  retry() {
    this.setData({ errorText: '' });
    this.autoConfirm();
  },

  cancel() {
    wx.switchTab({ url: '/pages/home/index' });
  }
});
