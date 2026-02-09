// services/cloudbaseClient.ts
import cloudbase from '@cloudbase/js-sdk'

// 你的 CloudBase 环境 ID
const envId = 'lover-secret-9gdyk6cfbb4f313c'

export const app = cloudbase.init({
  env: envId
})

// 使用本地持久化保存登录态
const auth = app.auth({ persistence: 'local' })

// 确保当前有登录态（匿名登录）
export async function ensureLogin() {
  const loginState = await auth.getLoginState()
  if (!loginState) {
    await auth.anonymousAuthProvider().signIn()
  }
  return auth.currentUser
}
