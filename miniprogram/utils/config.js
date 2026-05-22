let localConfig = {};

try {
  localConfig = require('./config.local');
} catch (error) {
  localConfig = {};
}

const BASE_URL = localConfig.BASE_URL || 'https://aihelp-backend.shuai.help/api';
const WECHAT_APP_ID = localConfig.WECHAT_APP_ID || '';
const REWARDED_VIDEO_AD_UNIT_ID = localConfig.REWARDED_VIDEO_AD_UNIT_ID || 'adunit-3258e3a8e5773f65';
const WEB_URL = localConfig.WEB_URL || 'https://aihelp.shuai.help';

module.exports = {
  BASE_URL,
  WEB_URL,
  WECHAT_APP_ID,
  REWARDED_VIDEO_AD_UNIT_ID,
  API: {
    // 小程序登录
    LOGIN: `${BASE_URL}/wechat/miniapp/auth/login`,
    ME: `${BASE_URL}/wechat/miniapp/me`,
    MODELS: `${BASE_URL}/models`,

    // 奖励
    REWARD_CONFIG: `${BASE_URL}/wechat/miniapp/rewards/config`,
    REWARD_SESSIONS: `${BASE_URL}/wechat/miniapp/rewards/sessions`,
    REWARD_CLAIM: `${BASE_URL}/wechat/miniapp/rewards/claim`,

    // 客户端登录扫码确认
    WEB_LOGIN_SCAN: `${BASE_URL}/wechat/miniapp/sessions/scan`,
    WEB_LOGIN_CONFIRM: `${BASE_URL}/wechat/miniapp/sessions/confirm`,
    WEB_LOGIN_SCAN_AND_CONFIRM: `${BASE_URL}/wechat/miniapp/sessions/scan-and-confirm`,

    // 登录码
    CREATE_LOGIN_CODE: `${BASE_URL}/wechat/miniapp/auth/login-code`,

    // 邮箱绑定 / 解绑
    LINK_EMAIL: `${BASE_URL}/wechat/miniapp/auth/link-email`,
    UNLINK_EMAIL: `${BASE_URL}/wechat/miniapp/auth/unlink-email`,

    // 邮箱验证码
    SEND_CODE: `${BASE_URL}/auth/local/send-code`
  },
  STORAGE: {
    TOKEN: 'chatty_miniapp_session_token',
    USER: 'chatty_miniapp_user_info'
  }
};
