import { Prompt, Montserrat } from 'next/font/google';
import { AuthProvider } from './context/AuthContext';
import { GuestProvider } from './context/GuestContext';
import { CredentialProvider } from './context/CredentialContext';
import GlobalErrorListener from './components/GlobalErrorListener';

const prompt = Prompt({
    subsets: ['thai', 'latin'],
    weight: ['300', '400', '500', '600', '700'],
    display: 'swap',
    variable: '--font-prompt',
});

const montserrat = Montserrat({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700'],
    display: 'swap',
    variable: '--font-montserrat',
});

export const metadata = {
    title: 'ระบบลงทะเบียนนักศึกษา - KMUTNB',
    description: 'KMUTNB Registration System Redesign',
}

export default function RootLayout({ children }) {
    return (
        <html lang="th" className={`${prompt.variable} ${montserrat.variable}`}>
            <head>
            </head>
            <body>
                <a href="#main-content" className="skip-to-content">
                    ข้ามไปยังเนื้อหาหลัก (Skip to content)
                </a>
                <GlobalErrorListener />
                <AuthProvider>
                    <GuestProvider>
                        <CredentialProvider>
                            {children}
                        </CredentialProvider>
                    </GuestProvider>
                </AuthProvider>
            </body>
        </html>
    )
}
