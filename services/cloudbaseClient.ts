// services/cloudbaseClient.ts
import cloudbase from '@cloudbase/js-sdk'

// 你的 CloudBase 环境 ID
const envId = 'lover-secret-9gdyk6cfbb4f313c'

export const app = cloudbase.init({
  env: envId
})

// 使用本地持久化保存登录态
export const auth = app.auth({ persistence: 'local' })

// 确保当前有登录态（匿名登录，兼容新版 SDK）
export async function ensureLogin() {
  // 1. 先看看有没有已有登录态
  let loginState = await auth.getLoginState()

  // 2. 没有的话就走匿名登录
  if (!loginState) {
    const res = await auth.signInAnonymously()
    loginState = res.loginState
  }

  return loginState
}