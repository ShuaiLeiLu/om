const request = require('../../utils/request');
const config = require('../../utils/config');

Page({
  data: {
    list: [],
    page: 1,
    limit: 20,
    hasMore: true,
    loading: false
  },

  onLoad: function () {
    this.fetchLedger(true);
  },

  onPullDownRefresh: function () {
    this.fetchLedger(true).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.fetchLedger();
    }
  },

  fetchLedger: async function (isRefresh = false) {
    if (this.data.loading) return;

    const page = isRefresh ? 1 : this.data.page;
    this.setData({ loading: true });

    try {
      const res = await request({
        url: config.API.LEDGER,
        data: {
          page,
          limit: this.data.limit
        }
      });

      const processedList = (res.items || []).map(item => ({
        ...item,
        typeText: this.getTypeText(item.type)
      }));

      this.setData({
        list: isRefresh ? processedList : this.data.list.concat(processedList),
        page: page + 1,
        hasMore: processedList.length === this.data.limit,
        loading: false
      });
    } catch (error) {
      console.error('Fetch ledger error:', error);
      this.setData({ loading: false });
      if (isRefresh) {
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    }
  },

  getTypeText: function (type) {
    const types = {
      'redeem_code': '兑换码',
      'ad_reward': '广告奖励',
      'manual_adjustment': '管理员调整',
      'model_usage': 'AI 消耗',
      'grant_expired': '额度过期',
      'refund': '退款'
    };
    return types[type] || '其他';
  }
});
