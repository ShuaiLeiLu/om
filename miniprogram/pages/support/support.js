Page({
  copyEmail: function () {
    wx.setClipboardData({
      data: 'support@shuai.help',
      success: () => {
        wx.showToast({
          title: '邮箱已复制',
          icon: 'success'
        });
      }
    });
  }
});
