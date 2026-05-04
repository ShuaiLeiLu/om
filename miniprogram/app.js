const auth = require('./utils/auth');

App({
  onLaunch: function () {
    auth.ensureLogin().catch((error) => {
      console.error('Miniapp auto login failed:', error);
    });
  },

  globalData: {}
});
