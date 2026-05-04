const auth = require('../../utils/auth');
const request = require('../../utils/request');
const config = require('../../utils/config');

let rewardedVideoAd = null;
let activeAdUnitId = '';

Page({
  data: {
    userInfo: null,
    rewardConfig: null,
    rewardState: {
      canClaim: false,
      buttonText: '看广告领取 Token',
      statusText: ''
    },
    loading: true,
    claiming: false,
    error: ''
  },

  onLoad: function () {
    this.refreshData();
  },

  onPullDownRefresh: function () {
    this.refreshData().then(() => {
      wx.stopPullDownRefresh();
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
        userInfo,
        rewardConfig,
        rewardState: this.buildRewardState(userInfo, rewardConfig),
        loading: false
      });
    } catch (error) {
      console.error('Refresh data error:', error);
      this.setData({
        loading: false,
        error: '加载失败，请下拉刷新重试'
      });
    }
  },

  watchAdAndClaim: async function () {
    if (this.data.claiming) return;
    if (!this.data.userInfo || !this.data.userInfo.bound) {
      wx.showToast({ title: '请先在网页端完成微信登录', icon: 'none' });
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
        this.setData({ claiming: false });
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
      wx.showToast({
        title: this.normalizeError(error),
        icon: 'none'
      });
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

      const onClose = (res) => {
        cleanup();
        resolve(!res || res.isEnded !== false);
      };
      const onError = (error) => {
        cleanup();
        reject(error || new Error('ad_load_failed'));
      };
      const cleanup = () => {
        if (rewardedVideoAd.offClose) rewardedVideoAd.offClose(onClose);
        if (rewardedVideoAd.offError) rewardedVideoAd.offError(onError);
      };

      rewardedVideoAd.onClose(onClose);
      rewardedVideoAd.onError(onError);
      rewardedVideoAd.show().catch(() => {
        rewardedVideoAd.load()
          .then(() => rewardedVideoAd.show())
          .catch(onError);
      });
    });
  },

  buildRewardState: function (userInfo, rewardConfig) {
    if (!userInfo || !userInfo.bound) {
      return {
        canClaim: false,
        buttonText: '请先完成网页版微信登录',
        statusText: '请先在网页版完成微信登录后再领取 Token'
      };
    }
    if (!rewardConfig || !rewardConfig.enabled) {
      return {
        canClaim: false,
        buttonText: '活动暂未开放',
        statusText: '广告领 Token 活动暂未开放'
      };
    }
    if (Number(rewardConfig.remainingToday || 0) <= 0) {
      return {
        canClaim: false,
        buttonText: '今日已领完',
        statusText: '今日领取次数已用完'
      };
    }
    return {
      canClaim: true,
      buttonText: '看广告领取 Token',
      statusText: ''
    };
  },

  normalizeError: function (error) {
    const message = error?.data?.message || error?.data?.error || error?.message || '';
    const map = {
      wechat_not_bound: '请先在网页端完成微信登录',
      reward_disabled: '活动暂未开放',
      reward_daily_limit: '今日已领完',
      reward_session_expired: '领取已过期，请重试',
      reward_too_frequent: '操作太频繁，请稍后再试'
    };
    return map[message] || '领取失败，请稍后重试';
  }
});
