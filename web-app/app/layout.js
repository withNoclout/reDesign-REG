import { AuthProvider } from './context/AuthContext';
import { GuestProvider } from './context/GuestContext';
import GlobalErrorListener from './components/GlobalErrorListener';

export const metadata = {
    title: 'ระบบลงทะเบียนนักศึกษา - KMUTNB',
    description: 'KMUTNB Registration System Redesign',
}

export default function RootLayout({ children }) {
    return (
        <html lang="th">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
            </head>
            <body>
                <a href="#main-content" className="skip-to-content">
                    ข้ามไปยังเนื้อหาหลัก (Skip to content)
                </a>
                <GlobalErrorListener />
                <AuthProvider>
                    <GuestProvider>
                        {children}
                    </GuestProvider>
                </AuthProvider>
            </body>
        </html>
    )
}
