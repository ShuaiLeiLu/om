const request = require('../../utils/request');
const config = require('../../utils/config');
const auth = require('../../utils/auth');

let videoAd = null;

Page({
  data: {
    rewardConfig: null,
    loading: false,
    rewardSessionId: ''
  },

  onLoad: function () {
    this.fetchRewardConfig();
    this.initVideoAd();
  },

  fetchRewardConfig: async function () {
    try {
      const res = await request({
        url: config.API.REWARD_CONFIG
      });
      this.setData({ rewardConfig: res });
    } catch (error) {
      console.error('Fetch reward config error:', error);
    }
  },

  initVideoAd: function () {
    if (wx.createRewardedVideoAd) {
      // 这里的 adUnitId 应该由后端返回或在 config 中配置
      // v1 先假定从 config 或等后端返回
    }
  },

  startAd: async function () {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      await auth.ensureLogin();
      
      // 1. 创建奖励会话
      const sessionRes = await request({
        url: config.API.REWARD_SESSIONS,
        method: 'POST'
      });

      const { rewardSessionId, adUnitId } = sessionRes;
      this.setData({ rewardSessionId });

      // 2. 初始化/更新广告位
      if (!videoAd || videoAd.adUnitId !== adUnitId) {
        videoAd = wx.createRewardedVideoAd({ adUnitId });
        
        videoAd.onLoad(() => {
          console.log('Video ad loaded');
        });

        videoAd.onError((err) => {
          console.error('Video ad error:', err);
          this.setData({ loading: false });
          wx.showToast({
            title: '广告加载失败',
            icon: 'none'
          });
        });

        videoAd.onClose((res) => {
          if (res && res.isEnded) {
            // 3. 领取奖励
            this.claimReward();
          } else {
            this.setData({ loading: false });
            wx.showModal({
              title: '提示',
              content: '需要完整观看广告后才能领取 Token',
              showCancel: false
            });
          }
        });
      }

      // 3. 播放广告
      videoAd.show().catch(() => {
        videoAd.load()
          .then(() => videoAd.show())
          .catch(err => {
            console.error('Ad show failed:', err);
            this.setData({ loading: false });
          });
      });

    } catch (error) {
      console.error('Start ad error:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: error.data?.message || '请求失败',
        icon: 'none'
      });
    }
  },

  claimReward: async function () {
    try {
      wx.showLoading({ title: '发放中...' });
      const res = await request({
        url: config.API.REWARD_CLAIM,
        method: 'POST',
        data: { rewardSessionId: this.data.rewardSessionId }
      });
      
      wx.hideLoading();
      wx.showModal({
        title: '领取成功',
        content: `恭喜获得 ${res.deltaTokens} tokens！`,
        showCancel: false,
        success: () => {
          this.fetchRewardConfig(); // 刷新次数
        }
      });
    } catch (error) {
      console.error('Claim reward error:', error);
      wx.hideLoading();
      wx.showModal({
        title: '领取失败',
        content: error.data?.message || '请联系客服',
        showCancel: false
      });
    } finally {
      this.setData({ loading: false });
    }
  }
});
