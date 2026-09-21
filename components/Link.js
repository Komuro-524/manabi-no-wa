import NextLink from 'next/link'

// ★ 画面に出ているリンクを先読み（prefetch）しない。
//   Next.js は見えているリンク先を裏で読み込むが、この画面たちは毎回DBを読むので、
//   一覧にリンクが何十個もあると裏で何十回もDBを叩いて重くなり、固まる原因になっていた
export default function Link(props) {
  return <NextLink prefetch={false} {...props} />
}
