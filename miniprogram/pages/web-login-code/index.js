const auth = require('../../utils/auth');
const request = require('../../utils/request');
const config = require('../../utils/config');

Page({
  data: {
    loading: false,
    code: '',
    countdown: 0,
    error: ''
  },

  onLoad() {
    this.generateCode();
  },

  onUnload() {
    this.stopCountdown();
  },

  async generateCode() {
    if (this.data.loading) return;
    this.setData({ loading: true, error: '', code: '' });
    this.stopCountdown();

    try {
      await auth.ensureLogin();
      const token = wx.getStorageSync(config.STORAGE.TOKEN);
      const result = await request({
        url: config.API.CREATE_LOGIN_CODE,
        method: 'POST',
        data: { miniappSessionToken: token }
      });
      const expiresAt = new Date(result.expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      this.setData({ code: result.code, countdown: remaining });
      this.startCountdown();
    } catch (error) {
      console.error('generate login code failed:', error);
      const msg = (error && error.data && error.data.message) || '';
      this.setData({
        error: msg === 'unauthorized' ? '请先登录小程序' : '生成登录码失败，请重试'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  startCountdown() {
    this.stopCountdown();
    this._timer = setInterval(() => {
      const next = Math.max(0, this.data.countdown - 1);
      this.setData({ countdown: next });
      if (next <= 0) {
        this.stopCountdown();
        this.setData({ code: '', error: '登录码已过期' });
      }
    }, 1000);
  },

  stopCountdown() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },

  refresh() {
    this.generateCode();
  },

  goBack() {
    wx.navigateBack({ delta: 1 });
  }
});
