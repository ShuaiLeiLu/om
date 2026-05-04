const auth = require('../../utils/auth');
const request = require('../../utils/request');
const config = require('../../utils/config');

let rewardedVideoAd = null;
let activeAdUnitId = '';

Page({
  data: {
    loading: true,
    claiming: false,
    error: '',
    userInfo: null,
    rewardConfig: null,
    balanceText: '0',
    rewardText: '0',
    remainingText: '0',
    progressPercent: 0,
    actionText: '看广告领取 Token',
    actionDisabled: true,
    noticeText: '正在同步微信身份',
    loginScene: '',
    loginConfirming: false,
    loginStatus: '',
    loginPanelVisible: false
  },

  onLoad: function (options) {
    this.handleLaunchScene(options || {});
    this.refreshData();
  },

  onShow: function () {
    if (this.data.loginScene && !this.data.loginStatus) {
      this.markWebLoginScanned();
    }
  },

  onPullDownRefresh: function () {
    this.refreshData().finally(() => wx.stopPullDownRefresh());
  },

  handleLaunchScene: function (options) {
    const scene = this.extractLoginScene(options);
    if (!scene) return;
    this.setData({
      loginScene: scene,
      loginStatus: '',
      loginPanelVisible: true
    });
    this.markWebLoginScanned();
  },

  extractLoginScene: function (options) {
    const rawScene = decodeURIComponent(options.scene || options.q || '');
    if (!rawScene) return '';
    const match = rawScene.match(/login_[A-Za-z0-9_-]+/);
    return match ? match[0] : '';
  },

  markWebLoginScanned: async function () {
    if (!this.data.loginScene) return;
    try {
      await auth.ensureLogin();
      const token = wx.getStorageSync(config.STORAGE.TOKEN);
      await request({
        url: config.API.WEB_LOGIN_SCAN,
        method: 'POST',
        data: {
          scene: this.data.loginScene,
          miniappSessionToken: token
        }
      });
    } catch (error) {
      console.error('Mark web login scanned failed:', error);
    }
  },

  confirmWebLogin: async function () {
    if (this.data.loginConfirming || !this.data.loginScene) return;
    this.setData({ loginConfirming: true, loginStatus: '' });
    try {
      await auth.ensureLogin();
      const token = wx.getStorageSync(config.STORAGE.TOKEN);
      await request({
        url: config.API.WEB_LOGIN_CONFIRM,
        method: 'POST',
        data: {
          scene: this.data.loginScene,
          miniappSessionToken: token
        }
      });
      this.setData({ loginStatus: '已确认，请回到网页继续使用' });
      wx.showToast({ title: '网页登录已确认', icon: 'success' });
      setTimeout(() => {
        this.setData({ loginPanelVisible: false });
      }, 1800);
    } catch (error) {
      console.error('Confirm web login failed:', error);
      wx.showToast({ title: this.normalizeLoginError(error), icon: 'none' });
    } finally {
      this.setData({ loginConfirming: false });
    }
  },

  cancelWebLogin: function () {
    this.setData({
      loginPanelVisible: false,
      loginScene: '',
      loginStatus: ''
    });
  },

  refreshData: async function () {
    try {
      this.setData({ loading: true, error: '' });
      await auth.ensureLogin();
      const [userInfo, rewardConfig] = await Promise.all([
        auth.fetchUserInfo(),
        request({ url: config.API.REWARD_CONFIG })
      ]);
      this.setData({
        loading: false,
        userInfo,
        rewardConfig,
        ...this.buildViewModel(userInfo, rewardConfig)
      });
    } catch (error) {
      console.error('Load wallet failed:', error);
      if (this.isUnauthorized(error)) {
        wx.removeStorageSync(config.STORAGE.TOKEN);
      }
      this.setData({
        loading: false,
        error: '网络或账号同步失败，请下拉刷新'
      });
    }
  },

  watchAdAndClaim: async function () {
    if (this.data.claiming || this.data.actionDisabled) return;
    if (!wx.createRewardedVideoAd) {
      wx.showToast({ title: '当前微信版本不支持广告', icon: 'none' });
      return;
    }

    this.setData({ claiming: true });
    try {
      await auth.ensureLogin();
      const session = await request({
        url: config.API.REWARD_SESSIONS,
        method: 'POST'
      });

      const watched = await this.playRewardedVideo(session.adUnitId || config.REWARDED_VIDEO_AD_UNIT_ID);
      if (!watched) {
        wx.showToast({ title: '完整观看后才能领取', icon: 'none' });
        return;
      }

      const result = await request({
        url: config.API.REWARD_CLAIM,
        method: 'POST',
        data: { rewardSessionId: session.rewardSessionId }
      });

      wx.showModal({
        title: 'Token 已到账',
        content: `本次获得 ${this.formatNumber(result.rewardTokens || this.data.rewardConfig.rewardTokens || 0)} tokens`,
        showCancel: false
      });
      await this.refreshData();
    } catch (error) {
      console.error('Claim failed:', error);
      wx.showToast({ title: this.normalizeError(error), icon: 'none' });
    } finally {
      this.setData({ claiming: false });
    }
  },

  playRewardedVideo: function (adUnitId) {
    return new Promise((resolve, reject) => {
      if (!adUnitId) {
        reject(new Error('ad_unit_missing'));
        return;
      }

      if (!rewardedVideoAd || activeAdUnitId !== adUnitId) {
        activeAdUnitId = adUnitId;
        rewardedVideoAd = wx.createRewardedVideoAd({ adUnitId });
      }

      const cleanup = () => {
        if (rewardedVideoAd.offClose) rewardedVideoAd.offClose(onClose);
        if (rewardedVideoAd.offError) rewardedVideoAd.offError(onError);
      };
      const onClose = (res) => {
        cleanup();
        resolve(!res || res.isEnded !== false);
      };
      const onError = (error) => {
        cleanup();
        reject(error || new Error('ad_load_failed'));
      };

      rewardedVideoAd.onClose(onClose);
      if (rewardedVideoAd.onError) rewardedVideoAd.onError(onError);
      rewardedVideoAd.show().catch(() => {
        rewardedVideoAd.load()
          .then(() => rewardedVideoAd.show())
          .catch(onError);
      });
    });
  },

  buildViewModel: function (userInfo, rewardConfig) {
    const remaining = Number(rewardConfig?.remainingToday || 0);
    const limit = Number(rewardConfig?.dailyLimitPerUser || 0);
    const enabled = Boolean(rewardConfig?.enabled);
    const bound = Boolean(userInfo?.bound);
    const hasAdUnit = Boolean(rewardConfig?.adUnitId || config.REWARDED_VIDEO_AD_UNIT_ID);
    let actionText = '看广告领取 Token';
    let actionDisabled = false;
    let noticeText = '完整观看广告后，Token 会自动进入你的账户';

    if (!bound) {
      actionText = '账号绑定中';
      actionDisabled = true;
      noticeText = '正在使用微信身份绑定万模AI账号';
    } else if (!enabled) {
      actionText = '活动暂未开放';
      actionDisabled = true;
      noticeText = '广告领 Token 活动暂未开放';
    } else if (!hasAdUnit) {
      actionText = '广告位未配置';
      actionDisabled = true;
      noticeText = '广告位暂未配置，请稍后再试';
    } else if (remaining <= 0) {
      actionText = '今日已领完';
      actionDisabled = true;
      noticeText = '今日领取次数已用完，明天再来';
    }

    return {
      balanceText: this.formatNumber(userInfo?.tokenBalance || 0),
      rewardText: this.formatNumber(rewardConfig?.rewardTokens || 0),
      remainingText: this.formatNumber(remaining),
      progressPercent: this.progress(remaining, limit),
      actionText,
      actionDisabled,
      noticeText
    };
  },

  formatNumber: function (value) {
    const numberValue = Number(value || 0);
    if (!Number.isFinite(numberValue)) return String(value || 0);
    return numberValue.toLocaleString('en-US');
  },

  progress: function (remaining, limit) {
    if (!limit || limit <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((remaining / limit) * 100)));
  },

  isUnauthorized: function (error) {
    return error && error.statusCode === 401;
  },

  normalizeError: function (error) {
    const message = error?.data?.message || error?.data?.error || error?.message || '';
    const map = {
      wechat_not_bound: '账号绑定中，请稍后刷新',
      reward_disabled: '活动暂未开放',
      reward_daily_limit: '今日已领完',
      reward_session_expired: '领取已过期，请重试',
      reward_session_not_found: '领取已失效，请重试',
      reward_too_frequent: '操作太频繁，请稍后再试',
      ad_unit_missing: '广告位暂未配置',
      qr_session_not_found: '登录二维码已失效',
      qr_session_expired: '登录二维码已过期'
    };
    if (String(message).includes('ad')) {
      return '广告加载失败，请稍后重试';
    }
    return map[message] || '领取失败，请稍后重试';
  },

  normalizeLoginError: function (error) {
    const message = error?.data?.message || error?.data?.error || error?.message || '';
    const map = {
      qr_session_not_found: '登录二维码已失效',
      qr_session_expired: '登录二维码已过期',
      unauthorized: '微信身份失效，请重新进入'
    };
    return map[message] || '网页登录确认失败，请重试';
  }
});
