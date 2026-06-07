const auth = require('../../utils/auth');
const request = require('../../utils/request');
const config = require('../../utils/config');
const { formatNumber, progress } = require('../../utils/format');
const { translateRewardError, extractCode } = require('../../utils/errors');
const { playRewardedVideo } = require('../../utils/ad');

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
    limitText: '0',
    actionText: '看广告领取算力点',
    actionDisabled: true,
    noticeText: '完整观看广告后，算力点 会自动进入账户'
  },

  onLoad() {
    this.refreshData();
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
        request({ url: config.API.REWARD_CONFIG })
      ]);
      const userInfo = results[0];
      const rewardConfig = results[1];
      const viewModel = this.buildViewModel(userInfo, rewardConfig);
      this.setData({
        loading: false,
        userInfo,
        rewardConfig,
        balanceText: viewModel.balanceText,
        rewardText: viewModel.rewardText,
        remainingText: viewModel.remainingText,
        limitText: viewModel.limitText,
        progressPercent: viewModel.progressPercent,
        actionText: viewModel.actionText,
        actionDisabled: viewModel.actionDisabled,
        noticeText: viewModel.noticeText
      });
    } catch (error) {
      console.error('rewards refresh failed:', error);
      if (extractCode(error) === 'unauthorized') {
        auth.clearLocalSession();
      }
      this.setData({
        loading: false,
        error: '网络或账号同步失败，请下拉刷新'
      });
    }
  },

  buildViewModel(userInfo, rewardConfig) {
    const remaining = Number((rewardConfig && rewardConfig.remainingToday) || 0);
    const limit = Number((rewardConfig && rewardConfig.dailyLimitPerUser) || 0);
    const enabled = Boolean(rewardConfig && rewardConfig.enabled);
    const bound = Boolean(userInfo && userInfo.bound);
    const hasAdUnit = Boolean(
      (rewardConfig && rewardConfig.adUnitId) || config.REWARDED_VIDEO_AD_UNIT_ID
    );

    let actionText = '看广告领取算力点';
    let actionDisabled = false;
    let noticeText = '完整观看广告后，算力点 会自动进入你的账户';

    if (!bound) {
      actionText = '账号绑定中';
      actionDisabled = true;
      noticeText = '正在使用微信身份绑定万模AI账号';
    } else if (!enabled) {
      actionText = '活动暂未开放';
      actionDisabled = true;
      noticeText = '广告领算力点 活动暂未开放';
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
      balanceText: formatNumber((userInfo && userInfo.pointsBalance) || 0),
      rewardText: formatNumber((rewardConfig && rewardConfig.rewardPoints) || 0),
      remainingText: formatNumber(remaining),
      limitText: formatNumber(limit),
      progressPercent: progress(remaining, limit),
      actionText,
      actionDisabled,
      noticeText
    };
  },

  async watchAdAndClaim() {
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

      const adUnitId = session.adUnitId || config.REWARDED_VIDEO_AD_UNIT_ID;
      const watched = await playRewardedVideo(adUnitId);
      if (!watched) {
        wx.showToast({ title: '完整观看后才能领取', icon: 'none' });
        return;
      }

      const result = await request({
        url: config.API.REWARD_CLAIM,
        method: 'POST',
        data: { rewardSessionId: session.rewardSessionId }
      });

      const reward = result.rewardPoints || (this.data.rewardConfig && this.data.rewardConfig.rewardPoints) || 0;
      wx.showModal({
        title: '算力点 已到账',
        content: '本次获得 ' + formatNumber(reward) + ' 算力点',
        showCancel: false,
        confirmText: '好的',
        confirmColor: '#a855f7'
      });
      await this.refreshData();
    } catch (error) {
      console.error('claim failed:', error);
      wx.showToast({ title: translateRewardError(error), icon: 'none' });
    } finally {
      this.setData({ claiming: false });
    }
  }
});
