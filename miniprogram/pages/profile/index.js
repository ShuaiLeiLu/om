const auth = require('../../utils/auth');
const config = require('../../utils/config');
const { formatNumber, maskEmail } = require('../../utils/format');
const { translateEmailBindError, extractCode } = require('../../utils/errors');

Page({
  data: {
    loading: true,
    userInfo: null,
    avatarInitial: '微',
    balanceText: '0',
    emailMasked: '',
    sheetVisible: false,
    sheetMode: 'bind', // bind | unbind
    sheetSubmitting: false,
    bindEmail: '',
    bindPassword: '',
    bindCode: '',
    bindError: '',
    sendingCode: false,
    codeCooldown: 0
  },

  onLoad() {
    this.refreshData();
  },

  onPullDownRefresh() {
    this.refreshData().finally(() => wx.stopPullDownRefresh());
  },

  getAvatarInitial(userInfo) {
    const displayName = String((userInfo && userInfo.displayName) || '微').trim();
    return displayName ? displayName.slice(0, 1) : '微';
  },

  async refreshData() {
    try {
      this.setData({ loading: true });
      await auth.ensureLogin();
      const userInfo = await auth.fetchUserInfo();
      this.setData({
        loading: false,
        userInfo,
        avatarInitial: this.getAvatarInitial(userInfo),
        balanceText: formatNumber(userInfo.pointsBalance || 0),
        emailMasked: userInfo.email ? maskEmail(userInfo.email) : ''
      });
    } catch (error) {
      console.error('profile refresh failed:', error);
      if (extractCode(error) === 'unauthorized') {
        auth.clearLocalSession();
      }
      this.setData({ loading: false });
      wx.showToast({ title: '同步失败，请重试', icon: 'none' });
    }
  },

  openBindSheet() {
    this.stopCooldown();
    this.setData({
      sheetVisible: true,
      sheetMode: 'bind',
      bindEmail: '',
      bindPassword: '',
      bindCode: '',
      bindError: '',
      sendingCode: false,
      codeCooldown: 0
    });
  },

  openUnbindSheet() {
    this.setData({
      sheetVisible: true,
      sheetMode: 'unbind',
      bindError: ''
    });
  },

  closeSheet() {
    if (this.data.sheetSubmitting) return;
    this.stopCooldown();
    this.setData({ sheetVisible: false });
  },

  onEmailInput(e) {
    this.setData({ bindEmail: e.detail.value, bindError: '' });
  },

  onPasswordInput(e) {
    this.setData({ bindPassword: e.detail.value, bindError: '' });
  },

  onCodeInput(e) {
    const value = String(e.detail.value || '').replace(/\D/g, '').slice(0, 6);
    this.setData({ bindCode: value, bindError: '' });
  },

  isValidEmail(email) {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(String(email || '').trim());
  },

  async sendBindCode() {
    if (this.data.sendingCode || this.data.codeCooldown > 0) return;
    const email = (this.data.bindEmail || '').trim().toLowerCase();
    if (!this.isValidEmail(email)) {
      return this.setData({ bindError: '请先输入有效的邮箱' });
    }
    this.setData({ sendingCode: true, bindError: '' });
    try {
      const result = await auth.sendEmailCode(email, 'bind_email');
      const wait = Number((result && result.resendIntervalSeconds) || 60);
      this.startCooldown(wait);
      wx.showToast({ title: '验证码已发送', icon: 'success' });
    } catch (error) {
      console.error('send code failed:', error);
      const code = (error && error.data && error.data.message) || '';
      if (code === 'send_too_frequent' && error.data.waitSeconds) {
        this.startCooldown(Number(error.data.waitSeconds));
      }
      this.setData({ bindError: translateEmailBindError(error) });
    } finally {
      this.setData({ sendingCode: false });
    }
  },

  startCooldown(seconds) {
    this.stopCooldown();
    this.setData({ codeCooldown: seconds });
    this._cooldownTimer = setInterval(() => {
      const next = Math.max(0, this.data.codeCooldown - 1);
      this.setData({ codeCooldown: next });
      if (next <= 0) this.stopCooldown();
    }, 1000);
  },

  stopCooldown() {
    if (this._cooldownTimer) {
      clearInterval(this._cooldownTimer);
      this._cooldownTimer = null;
    }
  },

  onUnload() {
    this.stopCooldown();
  },

  async submitBind() {
    const email = (this.data.bindEmail || '').trim().toLowerCase();
    const password = this.data.bindPassword || '';
    const code = this.data.bindCode || '';
    if (!this.isValidEmail(email)) return this.setData({ bindError: '请输入有效的邮箱' });
    if (password.length < 8) return this.setData({ bindError: '密码至少 8 位' });
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return this.setData({ bindError: '密码需要包含字母与数字' });
    }
    if (code.length !== 6) return this.setData({ bindError: '请输入 6 位验证码' });
    this.setData({ sheetSubmitting: true, bindError: '' });
    try {
      await auth.linkEmail(email, password, code);
      wx.showToast({ title: '邮箱绑定成功', icon: 'success' });
      this.stopCooldown();
      this.setData({ sheetVisible: false });
      await this.refreshData();
    } catch (error) {
      console.error('link email failed:', error);
      this.setData({ bindError: translateEmailBindError(error) });
    } finally {
      this.setData({ sheetSubmitting: false });
    }
  },

  async submitUnbind() {
    this.setData({ sheetSubmitting: true });
    try {
      await auth.unlinkEmail();
      wx.showToast({ title: '已解除绑定', icon: 'success' });
      this.setData({ sheetVisible: false });
      await this.refreshData();
    } catch (error) {
      console.error('unlink email failed:', error);
      wx.showToast({ title: translateEmailBindError(error), icon: 'none' });
    } finally {
      this.setData({ sheetSubmitting: false });
    }
  },

  openWebLoginCode() {
    wx.navigateTo({ url: '/pages/web-login-code/index' });
  },

  copyWebUrl() {
    wx.setClipboardData({
      data: config.WEB_URL,
      success: () => wx.showToast({ title: '链接已复制', icon: 'success' })
    });
  },

  async logout() {
    const choice = await new Promise((resolve) =>
      wx.showModal({
        title: '退出登录',
        content: '退出后会清除本地缓存，下次进入会重新创建一次性会话。',
        confirmText: '确认退出',
        cancelText: '取消',
        confirmColor: '#f43f5e',
        success: (res) => resolve(res.confirm)
      })
    );
    if (!choice) return;
    auth.clearLocalSession();
    wx.reLaunch({ url: '/pages/home/index' });
  }
});
