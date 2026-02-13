import { app, ensureLogin } from './cloudbaseClient'

export type PushSender = 'me' | 'her'
export type PushMessageType = 'text' | 'image' | 'video' | 'emoji' | 'audio'

export interface NotifyPeerMessageInput {
  senderId: PushSender
  senderLabel?: string
  messageType: PushMessageType
  preview?: string
  privateMedia?: boolean
}

const DEFAULT_FUNCTION_NAME = 'sendWebPushNotification'

function getFunctionName() {
  const configured = (import.meta.env.VITE_PUSH_NOTIFY_FUNCTION_NAME || '').trim()
  return configured || DEFAULT_FUNCTION_NAME
}

export async function notifyPeerNewMessage(input: NotifyPeerMessageInput): Promise<void> {
  const name = getFunctionName()
  const maybeCallFunction = (app as any).callFunction

  if (typeof maybeCallFunction !== 'function') {
    throw new Error('CloudBase SDK does not support callFunction in this runtime')
  }

  await ensureLogin()

  await maybeCallFunction.call(app, {
    name,
    data: {
      senderId: input.senderId,
      senderLabel: input.senderLabel || '',
      messageType: input.messageType,
      preview: input.preview || '',
      privateMedia: Boolean(input.privateMedia)
    }
  })
}
