import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, Heart, Plus, Trash2 } from 'lucide-react'
import type { Sender } from '../services/chatService'
import { AnniversaryItem, createAnniversary, fetchAnniversaries, removeAnniversary } from '../services/anniversaryService'

interface AnniversaryPageProps {
  currentSender: Sender
}

const REMINDER_OPTIONS = [0, 1, 3, 7, 14]

function getNextOccurrence(dateStr: string) {
  const source = new Date(dateStr)
  if (Number.isNaN(source.getTime())) {
    return null
  }

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const next = new Date(now.getFullYear(), source.getMonth(), source.getDate())
  if (next.getTime() < now.getTime()) {
    next.setFullYear(next.getFullYear() + 1)
  }

  const diffDays = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return { next, diffDays }
}

const AnniversaryPage: React.FC<AnniversaryPageProps> = ({ currentSender }) => {
  const [items, setItems] = useState<AnniversaryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [reminderDays, setReminderDays] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  const loadItems = useCallback(async (withLoading = false) => {
    try {
      if (withLoading) {
        setLoading(true)
      }
      const data = await fetchAnniversaries()
      setItems(data)
      setError('')
    } catch (err) {
      console.error('[Anniversary] load failed', err)
      setError('纪念日加载失败，请检查网络或云开发配置')
    } finally {
      if (withLoading) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    loadItems(true)
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadItems(false)
      }
    }, 15000)

    return () => window.clearInterval(timer)
  }, [loadItems])

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const nextA = getNextOccurrence(a.date)?.next.getTime() || Number.MAX_SAFE_INTEGER
        const nextB = getNextOccurrence(b.date)?.next.getTime() || Number.MAX_SAFE_INTEGER
        return nextA - nextB
      }),
    [items]
  )

  const handleSubmit = async () => {
    if (!title.trim() || !date) {
      setError('请填写名称和日期')
      return
    }

    try {
      setSubmitting(true)
      await createAnniversary(currentSender, title, date, reminderDays)
      setTitle('')
      setDate('')
      setReminderDays(1)
      setShowAdd(false)
      await loadItems(false)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增纪念日失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await removeAnniversary(id)
      await loadItems(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  return (
    <div className="ios-page ios-scroll ios-safe-top page-stack space-y-3">
      <div className="ios-card p-4 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(255,237,244,0.9))]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="ios-title text-2xl">纪念日</h2>
            <p className="text-sm ios-soft-text mt-1">为重要时刻保留仪式感</p>
            <div className="mt-2 ios-feature-badge">
              <Heart size={11} /> 爱情计时器
            </div>
          </div>
          <button type="button" className="ios-button-primary h-10 w-10 flex items-center justify-center" onClick={() => setShowAdd(true)}>
            <Plus size={18} />
          </button>
        </div>
      </div>

      {loading && <div className="text-center text-sm text-gray-400">加载中...</div>}
      {error && <div className="text-center text-sm text-red-500">{error}</div>}

      {!loading && sortedItems.length === 0 && <div className="ios-card p-5 text-center text-gray-500 text-sm">还没有纪念日，点右上角添加。</div>}

      <div className="space-y-3">
        {sortedItems.map(item => {
          const nextInfo = getNextOccurrence(item.date)
          return (
            <article key={item._id} className="ios-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-rose-100 text-rose-500 flex items-center justify-center">
                    <CalendarClock size={22} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{item.title}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">初始日期：{item.date}</p>
                    <p className="text-xs text-gray-500 mt-1">提醒：提前 {item.reminderDays} 天</p>
                  </div>
                </div>
                <button type="button" className="text-gray-400" onClick={() => handleDelete(item._id)}>
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="text-xs text-gray-500">下一次纪念日</div>
                  <div className="text-sm font-semibold text-gray-800 mt-1">{nextInfo ? nextInfo.next.toLocaleDateString() : '--'}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">倒计时</div>
                  <div className="text-2xl font-bold text-rose-500 mt-1">{nextInfo ? `${nextInfo.diffDays} 天` : '--'}</div>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/35 flex items-end p-3" onClick={() => setShowAdd(false)}>
          <div className="ios-card w-full p-5 space-y-4 animate__animated animate__slideInUp sheet-container" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="ios-title text-lg">新增纪念日</h3>
              <button type="button" className="text-sm text-gray-500" onClick={() => setShowAdd(false)}>
                取消
              </button>
            </div>

            <input className="ios-input px-3 py-2" placeholder="名称（如：第一次见面）" value={title} onChange={e => setTitle(e.target.value)} />
            <input className="ios-input px-3 py-2" type="date" value={date} onChange={e => setDate(e.target.value)} />

            <select className="ios-input px-3 py-2" value={reminderDays} onChange={e => setReminderDays(Number(e.target.value))}>
              {REMINDER_OPTIONS.map(day => (
                <option key={day} value={day}>
                  提前 {day} 天提醒
                </option>
              ))}
            </select>

            <button type="button" className="ios-button-primary w-full py-3" onClick={handleSubmit} disabled={submitting}>
              {submitting ? '保存中...' : '保存纪念日'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AnniversaryPage
