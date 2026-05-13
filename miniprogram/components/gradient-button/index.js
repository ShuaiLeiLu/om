Component({
  externalClasses: ['button-class'],
  properties: {
    type: { type: String, value: 'primary' }, // primary | ghost | emerald | danger
    size: { type: String, value: 'md' }, // sm | md | lg
    disabled: { type: Boolean, value: false },
    loading: { type: Boolean, value: false },
    block: { type: Boolean, value: false },
    icon: { type: String, value: '' },
    openType: { type: String, value: '' }
  },
  methods: {
    onTap() {
      if (this.data.disabled || this.data.loading) return
      this.triggerEvent('tap')
    },
    onGetUserInfo(e) {
      this.triggerEvent('getuserinfo', e.detail)
    },
    onGetPhoneNumber(e) {
      this.triggerEvent('getphonenumber', e.detail)
    },
    onContact(e) {
      this.triggerEvent('contact', e.detail)
    }
  }
})
