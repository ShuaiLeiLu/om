const auth = require('./utils/auth');
App({
  onLaunch: function () {
    auth.ensureLogin().catch(e => console.error('Auto login fail', e));
  }
});
