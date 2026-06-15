/**
 * Extracts a normalized signal payload from any Telegram update structure.
 * Handles: text, photo, document (image), captions, forwarded messages.
 * Called by both the live webhook and the /test/telegram-raw debug endpoint.
 */

import { downloadPhotoAsBase64, downloadDocumentAsBase64 } from './telegram'
import { logger } from './logger'

// ── Telegram API types ────────────────────────────────────────────────────────

export interface TelegramPhotoSize {
  file_id: string
  file_unique_id: string
  width: number
  height: number
  file_size?: number
}

export interface TelegramDocument {
  file_id: string
  file_unique_id: string
  file_name?: string
  mime_type?: string
  file_size?: number
}

export interface TelegramUser {
  id: number
  first_name?: string
  username?: string
}

export interface TelegramChat {
  id: number
  type: string
  title?: string
  username?: string
}

export interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: TelegramChat
  date?: number
  text?: string
  caption?: string
  photo?: TelegramPhotoSize[]
  document?: TelegramDocument
  sticker?: unknown
  video?: unknown
  audio?: unknown
  forward_date?: number
  forward_from?: TelegramUser
  forward_from_chat?: TelegramChat
  forward_from_message_id?: number
  media_group_id?: string
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
  channel_post?: TelegramMessage
  edited_channel_post?: TelegramMessage
}

// ── Payload returned to callers ───────────────────────────────────────────────

export type TelegramSourceType =
  | 'text'
  | 'image'
  | 'image_with_caption'
  | 'document_image'
  | 'unknown'

export interface TelegramSignalPayload {
  source_type: TelegramSourceType
  text: string | null
  caption: string | null
  image_base64: string | null
  mime_type: string | null
  telegram_file_id: string | null
  image_bytes: number | null
  forwarded_from: string | null
  media_group_id: string | null
  chat_id: number
  message_id: number
  update_id: number
  detected: {
    has_text: boolean
    has_caption: boolean
    has_photo: boolean
    has_document: boolean
    is_forwarded: boolean
    document_mime: string | null
  }
  download_error?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLargestPhoto(photos: TelegramPhotoSize[]): TelegramPhotoSize {
  return photos.reduce((best, p) =>
    (p.file_size ?? 0) > (best.file_size ?? 0) ? p : best,
  )
}

function forwardedFromLabel(msg: TelegramMessage): string | null {
  if (msg.forward_from_chat) {
    return (
      msg.forward_from_chat.title ??
      msg.forward_from_chat.username ??
      `chat_${msg.forward_from_chat.id}`
    )
  }
  if (msg.forward_from) {
    const u = msg.forward_from
    return u.username ? `@${u.username}` : (u.first_name ?? `user_${u.id}`)
  }
  return null
}

function isImageMime(mime?: string | null): boolean {
  return !!mime && mime.startsWith('image/')
}

// ── Main extractor ────────────────────────────────────────────────────────────

export async function extractTelegramSignalPayload(
  update: TelegramUpdate,
): Promise<TelegramSignalPayload> {
  const msg =
    update.message ??
    update.edited_message ??
    update.channel_post ??
    update.edited_channel_post

  const update_id = update.update_id

  if (!msg) {
    return {
      source_type: 'unknown',
      text: null, caption: null,
      image_base64: null, mime_type: null,
      telegram_file_id: null, image_bytes: null,
      forwarded_from: null, media_group_id: null,
      chat_id: 0, message_id: 0, update_id,
      detected: {
        has_text: false, has_caption: false,
        has_photo: false, has_document: false,
        is_forwarded: false, document_mime: null,
      },
    }
  }

  const chat_id     = msg.chat.id
  const message_id  = msg.message_id
  const hasText     = typeof msg.text === 'string' && msg.text.trim().length > 0
  const hasCaption  = typeof msg.caption === 'string' && msg.caption.trim().length > 0
  const hasPhoto    = Array.isArray(msg.photo) && msg.photo.length > 0
  const hasDoc      = !!msg.document
  const docMime     = msg.document?.mime_type ?? null
  const isDocImage  = hasDoc && isImageMime(docMime)
  const isForwarded = !!(msg.forward_date || msg.forward_from || msg.forward_from_chat)

  const detected = {
    has_text: hasText,
    has_caption: hasCaption,
    has_photo: hasPhoto,
    has_document: hasDoc,
    is_forwarded: isForwarded,
    document_mime: docMime,
  }

  logger.info('TgPayload', [
    `update_id=${update_id}`,
    `chat=${chat_id}`,
    `msg_id=${message_id}`,
    `text=${hasText}`,
    `caption=${hasCaption}`,
    `photo=${hasPhoto}`,
    `doc=${hasDoc}(${docMime ?? '-'})`,
    `fwd=${isForwarded}`,
    `media_group=${msg.media_group_id ?? '-'}`,
  ].join(' | '))

  const forwarded_from = forwardedFromLabel(msg)
  const caption        = hasCaption ? msg.caption!.trim() : null
  const text           = hasText    ? msg.text!.trim()    : null

  // ── Pure text — no image ──────────────────────────────────────────────────
  if (!hasPhoto && !isDocImage) {
    return {
      source_type: 'text',
      text, caption: null,
      image_base64: null, mime_type: null,
      telegram_file_id: null, image_bytes: null,
      forwarded_from, media_group_id: msg.media_group_id ?? null,
      chat_id, message_id, update_id,
      detected,
    }
  }

  // ── Photo or document-image: resolve file_id then download ────────────────
  let file_id: string
  let downloadFn: (id: string) => Promise<{ base64: string; mediaType: string; bytes: number }>

  if (hasPhoto) {
    const largest = getLargestPhoto(msg.photo!)
    file_id    = largest.file_id
    downloadFn = downloadPhotoAsBase64
    logger.info('TgPayload', `Photo: file_id=${file_id} file_size=${largest.file_size ?? '?'}`)
  } else {
    file_id    = msg.document!.file_id
    downloadFn = downloadDocumentAsBase64
    logger.info('TgPayload', `Document image: file_id=${file_id} mime=${docMime}`)
  }

  try {
    const { base64, mediaType, bytes } = await downloadFn(file_id)
    logger.info('TgPayload', `Downloaded ${bytes} bytes as ${mediaType}`)

    const source_type: TelegramSourceType = hasPhoto
      ? (hasCaption ? 'image_with_caption' : 'image')
      : 'document_image'

    return {
      source_type,
      text: null, caption,
      image_base64: base64, mime_type: mediaType,
      telegram_file_id: file_id, image_bytes: bytes,
      forwarded_from, media_group_id: msg.media_group_id ?? null,
      chat_id, message_id, update_id,
      detected,
    }
  } catch (err) {
    const download_error = String(err)
    logger.error('TgPayload', `Download failed file_id=${file_id}`, download_error)
    return {
      source_type: hasPhoto ? 'image' : 'document_image',
      text: null, caption,
      image_base64: null, mime_type: null,
      telegram_file_id: file_id, image_bytes: null,
      forwarded_from, media_group_id: msg.media_group_id ?? null,
      chat_id, message_id, update_id,
      detected, download_error,
    }
  }
}
