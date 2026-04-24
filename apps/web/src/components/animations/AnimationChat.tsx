import { useRef, useEffect, useState, useCallback } from 'react'
import { Send, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAnimationMessages, useSendMessage } from '@/hooks/useAnimationChat'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { GlassCard } from '@/components/shared/GlassCard'
import { Skeleton } from '@/components/ui/skeleton'
import type { AnimationMessage } from '@/types/database'

const URL_REGEX = /(https?:\/\/[^\s]+)/g

function MessageContent({ content }: { content: string }) {
  const parts = content.split(URL_REGEX)
  return (
    <span>
      {parts.map((part, i) =>
        URL_REGEX.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300 break-all"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  )
}

function ChatMessage({ msg, isSelf }: { msg: AnimationMessage; isSelf: boolean }) {
  return (
    <div className={`flex gap-2.5 ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}>
      <UserAvatar
        avatarUrl={msg.user?.avatar_url ?? null}
        username={msg.user?.username ?? '?'}
        size="sm"
      />
      <div className={`max-w-[75%] space-y-0.5 ${isSelf ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isSelf && (
          <span className="text-[11px] text-white/40 px-1">{msg.user?.username}</span>
        )}
        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
            isSelf
              ? 'bg-cyan-500/20 border border-cyan-500/20 text-white/90 rounded-tr-sm'
              : 'bg-white/[0.05] border border-white/[0.08] text-white/80 rounded-tl-sm'
          }`}
        >
          <MessageContent content={msg.content} />
        </div>
        <span className="text-[10px] text-white/25 px-1">
          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: fr })}
        </span>
      </div>
    </div>
  )
}

export function AnimationChat({ animationId, currentUserId }: { animationId: string; currentUserId: string }) {
  const { data: messages, isLoading } = useAnimationMessages(animationId)
  const { mutateAsync: send, isPending } = useSendMessage(animationId)

  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const prevLengthRef = useRef(0)

  // Scroll to bottom only when new messages arrive
  useEffect(() => {
    const len = messages?.length ?? 0
    if (len !== prevLengthRef.current) {
      prevLengthRef.current = len
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages?.length])

  const handleSend = useCallback(async () => {
    const content = draft.trim()
    if (!content || isPending) return
    setDraft('')
    try {
      await send(content)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'envoi')
      setDraft(content)
    }
  }, [draft, isPending, send])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <GlassCard className="flex flex-col" style={{ height: '420px' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.06] shrink-0">
        <MessageSquare className="h-4 w-4 text-cyan-400" />
        <h2 className="text-sm font-semibold text-white/70">Chat</h2>
        {messages && messages.length > 0 && (
          <span className="ml-auto text-[11px] text-white/25">{messages.length} message{messages.length > 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-10 w-1/2 ml-auto" />
            <Skeleton className="h-10 w-3/4" />
          </div>
        ) : !messages || messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <MessageSquare className="h-8 w-8 text-white/10" />
            <p className="text-sm text-white/25">Aucun message. Commencez la conversation !</p>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessage key={msg.id} msg={msg} isSelf={msg.user_id === currentUserId} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-white/[0.06] shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message… (Shift+Entrée pour saut de ligne)"
            rows={1}
            maxLength={1000}
            className="flex-1 resize-none bg-white/[0.05] border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-cyan-500/40 transition-colors max-h-28 overflow-y-auto"
            style={{ lineHeight: '1.4' }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${Math.min(el.scrollHeight, 112)}px`
            }}
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || isPending}
            className="h-10 w-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        {draft.length > 800 && (
          <p className="text-[11px] text-amber-400/70 mt-1 text-right">{draft.length}/1000</p>
        )}
      </div>
    </GlassCard>
  )
}
