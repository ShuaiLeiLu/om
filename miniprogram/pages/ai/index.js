const auth = require('../../utils/auth');
const request = require('../../utils/request');
const config = require('../../utils/config');
const { formatNumber } = require('../../utils/format');
const { extractCode } = require('../../utils/errors');

const IMAGE_MODEL_MARKERS = [
  'image',
  'gpt-image',
  'dall-e',
  'imagen',
  'stable',
  'flux',
  'midjourney',
  'jimeng',
  'seedream',
  'qwen-image',
  'wanx'
];

function isImageModel(model) {
  const text = [
    model.provider,
    model.displayName,
    model.sub2apiModel,
    model.remark
  ].join(' ').toLowerCase();
  return IMAGE_MODEL_MARKERS.some((marker) => text.indexOf(marker) >= 0);
}

function firstImageModel(models) {
  return models.find((model) => isImageModel(model)) || null;
}

Page({
  data: {
    loading: true,
    generating: false,
    error: '',
    balanceText: '0',
    models: [],
    imageModel: null,
    imagePrompt: '一只透明玻璃质感的未来城市图标，深色背景，柔和霓虹光',
    imageResults: []
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
        request({ url: config.API.MODELS })
      ]);
      const userInfo = results[0];
      const models = results[1];
      const list = Array.isArray(models) ? models : [];
      this.setData({
        loading: false,
        models: list,
        imageModel: this.data.imageModel || firstImageModel(list),
        balanceText: formatNumber(userInfo.tokenBalance || 0)
      });
    } catch (error) {
      console.error('ai refresh failed:', error);
      if (extractCode(error) === 'unauthorized') auth.clearLocalSession();
      this.setData({ loading: false, error: 'AI 配置同步失败，请下拉刷新' });
    }
  },

  onImagePromptInput(e) {
    this.setData({ imagePrompt: e.detail.value });
  },

  async generateImage() {
    const prompt = String(this.data.imagePrompt || '').trim();
    if (!prompt || this.data.generating) return;
    if (!this.data.imageModel) {
      wx.showToast({ title: '暂无可用生图模型', icon: 'none' });
      return;
    }

    this.setData({ generating: true });
    try {
      const result = await request({
        url: config.API.IMAGE_GENERATIONS,
        method: 'POST',
        data: {
          model: this.data.imageModel.sub2apiModel,
          prompt,
          size: '1024x1024',
          quality: 'medium',
          output_format: 'png',
          n: 1
        }
      });
      const images = Array.isArray(result.images) ? result.images : [];
      this.setData({ imageResults: images.concat(this.data.imageResults).slice(0, 12) });
      wx.showToast({ title: images.length ? '图片已生成' : '没有生成结果', icon: 'none' });
      await this.refreshBalance();
    } catch (error) {
      console.error('miniapp image failed:', error);
      wx.showToast({ title: this.translateAiError(error), icon: 'none' });
    } finally {
      this.setData({ generating: false });
    }
  },

  async refreshBalance() {
    try {
      const userInfo = await auth.fetchUserInfo();
      this.setData({ balanceText: formatNumber(userInfo.tokenBalance || 0) });
    } catch (error) {}
  },

  translateAiError(error) {
    const code = extractCode(error);
    if (code === 'token_insufficient') return 'Token 余额不足，请先看广告领取';
    if (code === 'model_disabled') return '当前模型暂不可用';
    if (code === 'wechat_not_bound') return '微信账号绑定中，请稍后刷新';
    if (code === 'sub2api_config_incomplete') return '模型网关未配置';
    return 'AI 请求失败，请稍后重试';
  }
});
