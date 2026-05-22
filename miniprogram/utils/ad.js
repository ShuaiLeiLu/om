// 激励视频广告封装
let rewardedVideoAd = null;
let activeAdUnitId = '';

function playRewardedVideo(adUnitId) {
  return new Promise((resolve, reject) => {
    if (!adUnitId) {
      reject(new Error('ad_unit_missing'));
      return;
    }
    if (!wx.createRewardedVideoAd) {
      reject(new Error('ad_not_supported'));
      return;
    }

    if (!rewardedVideoAd || activeAdUnitId !== adUnitId) {
      activeAdUnitId = adUnitId;
      rewardedVideoAd = wx.createRewardedVideoAd({ adUnitId });
      if (rewardedVideoAd.onError) {
        rewardedVideoAd.onError((err) => {
          console.warn('RewardedVideoAd preload warning/error:', err);
        });
      }
    }

    const cleanup = () => {
      if (rewardedVideoAd.offClose) rewardedVideoAd.offClose(onClose);
      if (rewardedVideoAd.offError) rewardedVideoAd.offError(onError);
    };
    const onClose = (res) => {
      cleanup();
      // res.isEnded === true 表示完整观看；false 表示未看完；undefined 当老版本兼容也算完成
      resolve(!res || res.isEnded !== false);
    };
    const onError = (error) => {
      cleanup();
      console.error('rewarded video ad error:', error);
      reject(error || new Error('ad_load_failed'));
    };

    rewardedVideoAd.onClose(onClose);
    if (rewardedVideoAd.onError) rewardedVideoAd.onError(onError);

    rewardedVideoAd.show().catch(() => {
      rewardedVideoAd
        .load()
        .then(() => rewardedVideoAd.show())
        .catch(onError);
    });
  });
}

module.exports = { playRewardedVideo };
