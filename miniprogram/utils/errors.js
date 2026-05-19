// 统一错误码翻译
const REWARD_ERRORS = {
  wechat_not_bound: '账号绑定中，请稍后刷新',
  reward_disabled: '活动暂未开放',
  reward_daily_limit: '今日已领完',
  reward_session_expired: '领取已过期，请重试',
  reward_session_not_found: '领取已失效，请重试',
  reward_too_frequent: '操作太频繁，请稍后再试',
  ad_unit_missing: '广告位暂未配置'
};

const LOGIN_ERRORS = {
  qr_session_not_found: '登录二维码已失效',
  qr_session_expired: '登录二维码已过期',
  unauthorized: '微信身份失效，请重新进入'
};

const EMAIL_BIND_ERRORS = {
  invalid_email: '邮箱格式不正确',
  password_too_short: '密码至少 8 位',
  password_too_long: '密码过长',
  password_too_weak: '密码需要包含字母与数字',
  email_already_set: '当前账号已绑定其他邮箱',
  email_already_bound_to_other: '该邮箱已被其他用户使用',
  invalid_credentials: '邮箱或密码不正确',
  wechat_not_bound: '账号绑定中，请稍后再试',
  invalid_code: '验证码不正确',
  code_expired: '验证码已过期，请重新获取',
  code_exhausted: '尝试次数过多，请重新获取',
  send_too_frequent: '发送太频繁，请稍候再试',
  send_rate_limited: '今日发送次数已达上限，请稍后再试'
};

function extractCode(error) {
  return (
    (error && (error.data && (error.data.message || error.data.error))) ||
    (error && error.message) ||
    ''
  );
}

function translateRewardError(error) {
  const code = extractCode(error);
  if (typeof code === 'string' && code.toLowerCase().includes('ad')) {
    return '广告加载失败，请稍后重试';
  }
  return REWARD_ERRORS[code] || '领取失败，请稍后重试';
}

function translateLoginError(error) {
  const code = extractCode(error);
  return LOGIN_ERRORS[code] || '网页登录确认失败，请重试';
}

function translateEmailBindError(error) {
  const code = extractCode(error);
  return EMAIL_BIND_ERRORS[code] || '操作失败，请稍后重试';
}

module.exports = {
  extractCode,
  translateRewardError,
  translateLoginError,
  translateEmailBindError
};
