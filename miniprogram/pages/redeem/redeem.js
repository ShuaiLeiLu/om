const request = require('../../utils/request');
const config = require('../../utils/config');
const auth = require('../../utils/auth');

Page({
  data: {
    code: '',
    loading: false
  },

  onInput: function (e) {
    this.setData({
      code: e.detail.value.trim()
    });
  },

  redeem: async function () {
    if (!this.data.code || this.data.loading) return;

    this.setData({ loading: true });
    try {
      await auth.ensureLogin();
      const res = await request({
        url: config.API.REDEEM,
        method: 'POST',
        data: { code: this.data.code }
      });

      wx.showModal({
        title: '兑换成功',
        content: `已成功兑换 ${res.deltaTokens} tokens！`,
        showCancel: false,
        success: () => {
          this.setData({ code: '' });
          // 返回上一页或刷新
        }
      });
    } catch (error) {
      console.error('Redeem error:', error);
      wx.showModal({
        title: '兑换失败',
        content: error.data?.message || '兑换码无效或已过期',
        showCancel: false
      });
    } finally {
      this.setData({ loading: false });
    }
  }
});
