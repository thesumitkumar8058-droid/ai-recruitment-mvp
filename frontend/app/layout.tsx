import './styles.css'
export const metadata = { title: 'AI Recruitment MVP', description: 'Evidence-based candidate screening' }
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html> }
