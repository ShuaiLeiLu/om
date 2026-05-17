const auth = require('../../utils/auth');
const request = require('../../utils/request');
const config = require('../../utils/config');
const { formatNumber } = require('../../utils/format');
const { extractCode } = require('../../utils/errors');

const IMAGE_MODEL_MARKERS = [
  'image',
  'gpt-image',
  'dall-e',
  'imagen',
  'stable',
  'flux',
  'midjourney',
  'jimeng',
  'seedream',
  'qwen-image',
  'wanx'
];

let streamDecoder = null;

function isImageModel(model) {
  const text = [
    model.provider,
    model.displayName,
    model.sub2apiModel,
    model.remark
  ].join(' ').toLowerCase();
  return IMAGE_MODEL_MARKERS.some((marker) => text.indexOf(marker) >= 0);
}

function firstModel(models, image) {
  return models.find((model) => isImageModel(model) === image) || null;
}

function parseSseEvent(text) {
  const lines = text.split('\n');
  const event = (lines.find((line) => line.indexOf('event:') === 0) || '').slice(6).trim() || 'message';
  const dataText = lines
    .filter((line) => line.indexOf('data:') === 0)
    .map((line) => line.slice(5).trim())
    .join('\n');
  if (!dataText) return null;
  try {
    return { event, data: JSON.parse(dataText) };
  } catch (error) {
    return null;
  }
}

Page({
  data: {
    loading: true,
    sending: false,
    generating: false,
    error: '',
    balanceText: '0',
    models: [],
    chatModel: null,
    imageModel: null,
    chatInput: '你好，帮我用一句话介绍万模AI',
    imagePrompt: '一只透明玻璃质感的未来城市图标，深色背景，柔和霓虹光',
    conversationId: '',
    messages: [],
    imageResults: []
  },

  onLoad() {
    this.refreshData();
  },

  onPullDownRefresh() {
    this.refreshData().finally(() => wx.stopPullDownRefresh());
  },

  async refreshData() {
    try {
      this.setData({ loading: true, error: '' });
      await auth.ensureLogin();
      const [userInfo, models] = await Promise.all([
        auth.fetchUserInfo(),
        request({ url: config.API.MODELS })
      ]);
      const list = Array.isArray(models) ? models : [];
      this.setData({
        loading: false,
        models: list,
        chatModel: this.data.chatModel || firstModel(list, false),
        imageModel: this.data.imageModel || firstModel(list, true),
        balanceText: formatNumber(userInfo.tokenBalance || 0)
      });
    } catch (error) {
      console.error('ai refresh failed:', error);
      if (extractCode(error) === 'unauthorized') auth.clearLocalSession();
      this.setData({ loading: false, error: 'AI 配置同步失败，请下拉刷新' });
    }
  },

  onChatInput(e) {
    this.setData({ chatInput: e.detail.value });
  },

  onImagePromptInput(e) {
    this.setData({ imagePrompt: e.detail.value });
  },

  async sendChat() {
    const text = String(this.data.chatInput || '').trim();
    if (!text || this.data.sending) return;
    if (!this.data.chatModel) {
      wx.showToast({ title: '暂无可用对话模型', icon: 'none' });
      return;
    }

    const userMsg = { role: 'user', content: text };
    const assistantMsg = { role: 'assistant', content: '思考中...' };
    const nextMessages = this.data.messages.concat([userMsg, assistantMsg]);
    this.setData({ sending: true, messages: nextMessages, chatInput: '' });

    try {
      const result = await this.streamChat({
        conversationId: this.data.conversationId || undefined,
        model: this.data.chatModel.sub2apiModel,
        messages: this.data.messages.concat([userMsg]).map((item) => ({
          role: item.role,
          content: item.content
        }))
      });
      const finalMessages = this.data.messages.slice();
      finalMessages[finalMessages.length - 1] = {
        role: 'assistant',
        content: result.content || '已完成'
      };
      this.setData({
        messages: finalMessages,
        conversationId: result.conversationId || this.data.conversationId
      });
      await this.refreshBalance();
    } catch (error) {
      console.error('miniapp chat failed:', error);
      const finalMessages = this.data.messages.slice();
      finalMessages[finalMessages.length - 1] = {
        role: 'assistant',
        content: this.translateAiError(error)
      };
      this.setData({ messages: finalMessages });
    } finally {
      this.setData({ sending: false });
    }
  },

  streamChat(payload) {
    const token = wx.getStorageSync(config.STORAGE.TOKEN);
    return new Promise((resolve, reject) => {
      let content = '';
      let conversationId = '';
      const task = wx.request({
        url: config.API.CHAT_COMPLETIONS,
        method: 'POST',
        data: payload,
        header: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        enableChunked: true,
        responseType: 'text',
        success: (res) => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(res);
            return;
          }
          resolve({ content, conversationId });
        },
        fail: reject
      });

      if (!task || !task.onChunkReceived) {
        reject(new Error('chunked_request_unsupported'));
        return;
      }

      let buffer = '';
      task.onChunkReceived((res) => {
        const chunk = this.decodeChunk(res.data);
        buffer += chunk;
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        events.forEach((eventText) => {
          const event = parseSseEvent(eventText);
          if (!event) return;
          if (event.event === 'message.meta') {
            conversationId = event.data && event.data.conversationId;
          } else if (event.event === 'message.delta') {
            content += (event.data && event.data.content) || '';
            this.updateAssistantDraft(content || '思考中...');
          } else if (event.event === 'message.done') {
            conversationId = (event.data && event.data.conversationId) || conversationId;
          } else if (event.event === 'message.error') {
            reject(new Error((event.data && event.data.error) || 'chat_failed'));
          }
        });
      });
    });
  },

  decodeChunk(data) {
    if (typeof data === 'string') return data;
    if (typeof TextDecoder !== 'undefined') {
      if (!streamDecoder) streamDecoder = new TextDecoder('utf-8');
      return streamDecoder.decode(data, { stream: true });
    }
    try {
      return decodeURIComponent(
        Array.prototype.map
          .call(new Uint8Array(data), (byte) => '%' + byte.toString(16).padStart(2, '0'))
          .join('')
      );
    } catch (error) {
      return '';
    }
  },

  updateAssistantDraft(content) {
    const messages = this.data.messages.slice();
    messages[messages.length - 1] = { role: 'assistant', content };
    this.setData({ messages });
  },

  async generateImage() {
    const prompt = String(this.data.imagePrompt || '').trim();
    if (!prompt || this.data.generating) return;
    if (!this.data.imageModel) {
      wx.showToast({ title: '暂无可用生图模型', icon: 'none' });
      return;
    }

    this.setData({ generating: true });
    try {
      const result = await request({
        url: config.API.IMAGE_GENERATIONS,
        method: 'POST',
        data: {
          model: this.data.imageModel.sub2apiModel,
          prompt,
          size: '1024x1024',
          quality: 'medium',
          output_format: 'png',
          n: 1
        }
      });
      const images = Array.isArray(result.images) ? result.images : [];
      this.setData({ imageResults: images.concat(this.data.imageResults).slice(0, 12) });
      wx.showToast({ title: images.length ? '图片已生成' : '没有生成结果', icon: 'none' });
      await this.refreshBalance();
    } catch (error) {
      console.error('miniapp image failed:', error);
      wx.showToast({ title: this.translateAiError(error), icon: 'none' });
    } finally {
      this.setData({ generating: false });
    }
  },

  async refreshBalance() {
    try {
      const userInfo = await auth.fetchUserInfo();
      this.setData({ balanceText: formatNumber(userInfo.tokenBalance || 0) });
    } catch (error) {}
  },

  translateAiError(error) {
    const code = extractCode(error);
    if (code === 'token_insufficient') return 'Token 余额不足，请先看广告领取';
    if (code === 'model_disabled') return '当前模型暂不可用';
    if (code === 'wechat_not_bound') return '微信账号绑定中，请稍后刷新';
    if (code === 'sub2api_config_incomplete') return '模型网关未配置';
    if (code === 'chunked_request_unsupported') return '当前微信版本不支持流式对话';
    return 'AI 请求失败，请稍后重试';
  }
});
