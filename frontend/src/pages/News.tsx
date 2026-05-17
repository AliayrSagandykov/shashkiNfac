import Sidebar from '../components/Sidebar'
import { t, getLang } from '../i18n'

interface Post {
  id: string
  date: string
  title: { en: string; ru: string }
  body: { en: string; ru: string }
  emoji: string
}

const POSTS: Post[] = [
  {
    id: 'launch',
    date: '2026-05-15',
    emoji: '🚀',
    title: {
      en: 'Hello, world — Checkers is live!',
      ru: 'Всем привет — мы открылись!',
    },
    body: {
      en:
        "Today we're opening the doors. Sign in with Google, pick a level, and you'll be matched with players close to your rating. Bring a friend!\n\nWhat's in: international draughts (10×10), live clocks, ratings & a global leaderboard, in-game chat, rematch.\n\nGGs!",
      ru:
        'Сегодня открываемся для всех. Заходи через Google, выбирай уровень — подберём соперника близко по рейтингу. Зови друзей!\n\nЧто внутри: международные шашки (10×10), живые часы, рейтинг и мировой лидерборд, чат в игре, реванш.\n\nУдачных партий!',
    },
  },
]

export default function News() {
  const lang = getLang()

  return (
    <div className="min-h-screen bg-app flex">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 lg:px-6 pt-16 lg:pt-8 pb-8">
          <h1 className="text-fg text-3xl font-bold mb-6">{t('news')}</h1>

          <div className="space-y-4">
            {POSTS.map((post) => (
              <article
                key={post.id}
                className="bg-card border border-line rounded-2xl p-6"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-3xl">{post.emoji}</div>
                  <div>
                    <h2 className="text-fg text-xl font-bold leading-tight">
                      {post.title[lang]}
                    </h2>
                    <div className="text-faint text-xs">{post.date}</div>
                  </div>
                </div>
                <div className="text-fg2 whitespace-pre-line leading-relaxed">
                  {post.body[lang]}
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
