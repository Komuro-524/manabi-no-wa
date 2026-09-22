import Link from '@/components/Link'

// 人のアイコンや名前を押すと、その人のプロフィール（/people/[id]）へ。自分なら /profile へ（ページ側で振り分け）
export default function PersonLink({ id, children, style, title, className }) {
  if (!id) return children
  return <Link href={`/people/${id}`} title={title ?? 'プロフィールを見る'} className={className} style={{ color: 'inherit', ...style }}>{children}</Link>
}
