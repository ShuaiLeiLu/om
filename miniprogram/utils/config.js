let localConfig = {};

try {
  localConfig = require('./config.local');
} catch (error) {
  localConfig = {};
}

const BASE_URL = localConfig.BASE_URL || 'https://aihelp-backend.shuai.help/api';
const WECHAT_APP_ID = localConfig.WECHAT_APP_ID || '';
const REWARDED_VIDEO_AD_UNIT_ID = localConfig.REWARDED_VIDEO_AD_UNIT_ID || 'adunit-3258e3a8e5773f65';

module.exports = {
  BASE_URL,
  WECHAT_APP_ID,
  REWARDED_VIDEO_AD_UNIT_ID,
  API: {
    LOGIN: `${BASE_URL}/wechat/miniapp/auth/login`,
    ME: `${BASE_URL}/wechat/miniapp/me`,
    REWARD_CONFIG: `${BASE_URL}/wechat/miniapp/rewards/config`,
    REWARD_SESSIONS: `${BASE_URL}/wechat/miniapp/rewards/sessions`,
    REWARD_CLAIM: `${BASE_URL}/wechat/miniapp/rewards/claim`,
    WEB_LOGIN_SCAN: `${BASE_URL}/wechat/miniapp/sessions/scan`,
    WEB_LOGIN_CONFIRM: `${BASE_URL}/wechat/miniapp/sessions/confirm`
  },
  STORAGE: {
    TOKEN: 'chatty_miniapp_session_token',
    USER: 'chatty_miniapp_user_info'
  }
};
