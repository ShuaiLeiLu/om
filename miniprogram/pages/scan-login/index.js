const auth = require('../../utils/auth');
const request = require('../../utils/request');
const config = require('../../utils/config');
const { translateLoginError } = require('../../utils/errors');

Page({
  data: {
    scene: '',
    status: 'ready', // ready | scanning | scanned | confirmed | failed
    confirming: false,
    statusText: '请确认是否登录万模AI网页端',
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
    this.markScanned();
  },

  extractScene(options) {
    const raw = decodeURIComponent(options.scene || options.q || '');
    if (!raw) return '';
    const m = raw.match(/login_[A-Za-z0-9_-]+/);
    return m ? m[0] : '';
  },

  async markScanned() {
    if (!this.data.scene) return;
    this.setData({ status: 'scanning', statusText: '正在向网页发送扫码状态...' });
    try {
      await auth.ensureLogin();
      const token = wx.getStorageSync(config.STORAGE.TOKEN);
      await request({
        url: config.API.WEB_LOGIN_SCAN,
        method: 'POST',
        data: { scene: this.data.scene, miniappSessionToken: token }
      });
      this.setData({
        status: 'scanned',
        statusText: '已扫码，请点击下方确认登录'
      });
    } catch (error) {
      console.error('mark scanned failed:', error);
      this.setData({
        status: 'failed',
        statusText: '二维码状态同步失败',
        errorText: translateLoginError(error)
      });
    }
  },

  async confirmLogin() {
    if (this.data.confirming || !this.data.scene) return;
    this.setData({ confirming: true, errorText: '' });
    try {
      await auth.ensureLogin();
      const token = wx.getStorageSync(config.STORAGE.TOKEN);
      await request({
        url: config.API.WEB_LOGIN_CONFIRM,
        method: 'POST',
        data: { scene: this.data.scene, miniappSessionToken: token }
      });
      this.setData({
        status: 'confirmed',
        statusText: '网页登录已确认，可以回到网页继续使用'
      });
      wx.showToast({ title: '已确认登录', icon: 'success' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/home/index' });
      }, 1500);
    } catch (error) {
      console.error('confirm login failed:', error);
      this.setData({ errorText: translateLoginError(error) });
    } finally {
      this.setData({ confirming: false });
    }
  },

  cancel() {
    wx.switchTab({ url: '/pages/home/index' });
  }
});
