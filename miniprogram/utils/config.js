const BASE_URL = 'https://aihelp.shuai.help/api';

module.exports = {
  BASE_URL,
  API: {
    LOGIN: `${BASE_URL}/wechat/miniapp/auth/login`,
    ME: `${BASE_URL}/wechat/miniapp/me`,
    REWARD_CONFIG: `${BASE_URL}/wechat/miniapp/rewards/config`,
    REWARD_SESSIONS: `${BASE_URL}/wechat/miniapp/rewards/sessions`,
    REWARD_CLAIM: `${BASE_URL}/wechat/miniapp/rewards/claim`,
  },
  STORAGE_KEYS: {
    SESSION_TOKEN: 'miniappSessionToken',
    USER_INFO: 'userInfo',
  }
};
