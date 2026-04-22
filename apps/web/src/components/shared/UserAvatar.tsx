import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils/cn'

interface UserAvatarProps {
  avatarUrl?: string | null
  username: string
  className?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

const SIZE_CLASSES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
}

function getInitials(username: string): string {
  const parts = username.replace(/#\d+$/, '').split(/[\s_-]/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return username.slice(0, 2).toUpperCase()
}

export function UserAvatar({ avatarUrl, username, className, size = 'md' }: UserAvatarProps) {
  return (
    <Avatar className={cn(SIZE_CLASSES[size], className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={username} />}
      <AvatarFallback className={SIZE_CLASSES[size]}>
        {getInitials(username)}
      </AvatarFallback>
    </Avatar>
  )
}
