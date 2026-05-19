const auth = require('../../utils/auth');
const request = require('../../utils/request');
const config = require('../../utils/config');
const { formatNumber } = require('../../utils/format');
const { extractCode } = require('../../utils/errors');

Page({
  data: {
    loading: true,
    error: '',
    userInfo: null,
    rewardConfig: null,
    balanceText: '0',
    rewardText: '0',
    remainingText: '0',
    webUrl: config.WEB_URL,
    bound: false,
    emailLinked: false
  },

  onLoad() {
    this.refreshData();
  },

  onShow() {
    if (this.data.userInfo) {
      // 静默刷新余额与邮箱状态
      this.silentRefresh();
    }
  },

  onPullDownRefresh() {
    this.refreshData().finally(() => wx.stopPullDownRefresh());
  },

  async refreshData() {
    try {
      this.setData({ loading: true, error: '' });
      await auth.ensureLogin();
      const results = await Promise.all([
        auth.fetchUserInfo(),
        request({ url: config.API.REWARD_CONFIG }).catch(() => null)
      ]);
      const userInfo = results[0];
      const rewardConfig = results[1];
      this.setData({
        loading: false,
        userInfo,
        rewardConfig,
        balanceText: formatNumber(userInfo.tokenBalance || 0),
        rewardText: formatNumber(rewardConfig ? rewardConfig.rewardTokens || 0 : 0),
        remainingText: formatNumber(rewardConfig ? rewardConfig.remainingToday || 0 : 0),
        bound: Boolean(userInfo.bound),
        emailLinked: Boolean(userInfo.email)
      });
    } catch (error) {
      console.error('home refresh failed:', error);
      if (extractCode(error) === 'unauthorized') {
        auth.clearLocalSession();
      }
      this.setData({
        loading: false,
        error: '同步失败，请下拉刷新'
      });
    }
  },

  async silentRefresh() {
    try {
      const userInfo = await auth.fetchUserInfo();
      this.setData({
        userInfo,
        balanceText: formatNumber(userInfo.tokenBalance || 0),
        bound: Boolean(userInfo.bound),
        emailLinked: Boolean(userInfo.email)
      });
    } catch (error) {
      // 静默失败
    }
  },

  goRewards() {
    wx.switchTab({ url: '/pages/rewards/index' });
  },

  goProfile() {
    wx.switchTab({ url: '/pages/profile/index' });
  },

  copyWebUrl() {
    wx.setClipboardData({
      data: this.data.webUrl,
      success: () => wx.showToast({ title: '链接已复制', icon: 'success' })
    });
  }
});
