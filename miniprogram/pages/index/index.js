const auth = require('../../utils/auth');
const request = require('../../utils/request');
const config = require('../../utils/config');

let rewardedVideoAd = null;
let activeAdUnitId = '';

Page({
  data: {
    userInfo: null,
    rewardConfig: null,
    actionDisabled: true,
    actionText: '看广告领取 Token',
    statusText: '',
    loading: true,
    claiming: false,
    error: ''
  },

  onLoad: function () {
    this.refreshData();
  },

  onShow: function () {
    this.refreshData();
  },

  onPullDownRefresh: function () {
    this.refreshData().then(() => wx.stopPullDownRefresh());
  },

  refreshData: async function () {
    try {
      this.setData({ loading: true, error: '' });
      await auth.ensureLogin();
      const [userInfo, rewardConfig] = await this.fetchHomeData();
      const viewState = this.buildViewState(userInfo, rewardConfig);
      this.setData({ userInfo, rewardConfig, loading: false, ...viewState });
    } catch (error) {
      console.error('Refresh data error:', error);
      if (this.isUnauthorized(error)) {
        try {
          await auth.login();
          const [userInfo, rewardConfig] = await this.fetchHomeData();
          const viewState = this.buildViewState(userInfo, rewardConfig);
          this.setData({ userInfo, rewardConfig, loading: false, ...viewState });
          return;
        } catch (retryError) {
          console.error('Retry refresh data error:', retryError);
        }
      }
      this.setData({ loading: false, error: '加载失败，请下拉刷新重试' });
    }
  },

  watchAdAndClaim: async function () {
    if (this.data.claiming) return;
    if (!this.data.userInfo || !this.data.userInfo.bound) {
      wx.showToast({ title: '正在绑定账号，请稍后刷新', icon: 'none' });
      return;
    }
    if (!this.data.rewardConfig || !this.data.rewardConfig.enabled) {
      wx.showToast({ title: '活动暂未开放', icon: 'none' });
      return;
    }
    if (Number(this.data.rewardConfig.remainingToday || 0) <= 0) {
      wx.showToast({ title: '今日已领完', icon: 'none' });
      return;
    }
    if (!this.data.rewardConfig.adUnitId) {
      wx.showToast({ title: '广告位暂未配置', icon: 'none' });
      return;
    }
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

      const watched = await this.playRewardedVideo(session.adUnitId);
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
        title: '领取成功',
        content: `已获得 ${result.rewardTokens || this.data.rewardConfig.rewardTokens || 0} tokens`,
        showCancel: false
      });
      await this.refreshData();
    } catch (error) {
      console.error('Claim token error:', error);
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

  fetchHomeData: function () {
    return Promise.all([
      auth.fetchUserInfo(),
      request({ url: config.API.REWARD_CONFIG })
    ]);
  },

  buildViewState: function (userInfo, rewardConfig) {
    if (!userInfo || !userInfo.bound) {
      return {
        actionDisabled: true,
        actionText: '正在绑定账号',
        statusText: '正在用你的微信身份绑定万模AI账号，请稍后下拉刷新。'
      };
    }
    if (!rewardConfig || !rewardConfig.enabled) {
      return {
        actionDisabled: true,
        actionText: '活动暂未开放',
        statusText: '活动暂未开放，请稍后再来。'
      };
    }
    if (!rewardConfig.adUnitId) {
      return {
        actionDisabled: true,
        actionText: '广告位未配置',
        statusText: '广告位暂未配置，暂时不能领取。'
      };
    }
    if (Number(rewardConfig.remainingToday || 0) <= 0) {
      return {
        actionDisabled: true,
        actionText: '今日已领完',
        statusText: '今日领取次数已用完，明天再来。'
      };
    }
    return {
      actionDisabled: false,
      actionText: '看广告领取 Token',
      statusText: ''
    };
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
      reward_too_frequent: '操作太频繁，请稍后再试'
    };
    if (String(message).includes('advert') || String(message).includes('ad')) {
      return '广告加载失败，请稍后重试';
    }
    return map[message] || '领取失败，请稍后重试';
  }
});
