const auth = require('./utils/auth');

App({
  onLaunch: function () {
    // 自动登录
    this.autoLogin();
  },

  autoLogin: async function () {
    try {
      await auth.ensureLogin();
      console.log('Auto login successful');
    } catch (error) {
      console.error('Auto login failed:', error);
    }
  },

  globalData: {
    userInfo: null
  }
});
