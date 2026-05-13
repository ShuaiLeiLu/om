Component({
  options: { multipleSlots: true, styleIsolation: 'apply-shared' },
  properties: {
    intensity: { type: String, value: 'normal' }, // subtle | normal | strong
    padding: { type: String, value: '32rpx' },
    radius: { type: String, value: '32rpx' },
    glow: { type: Boolean, value: false },
    customClass: { type: String, value: '' }
  }
})
