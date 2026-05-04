Page({
  data: {
    activeTab: 0
  },

  switchTab: function (e) {
    const index = parseInt(e.currentTarget.dataset.index);
    this.setData({
      activeTab: index
    });
  }
});
