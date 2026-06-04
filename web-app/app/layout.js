import './globals.css';
import { Prompt, Montserrat } from 'next/font/google';
import { LazyMotion, domAnimation } from 'framer-motion';

import { AuthProvider } from './context/AuthContext';
import { GuestProvider } from './context/GuestContext';
import { CredentialProvider } from './context/CredentialContext';
import GlobalErrorListener from './components/GlobalErrorListener';
import ReleaseConsistencyGuard from './components/ReleaseConsistencyGuard';

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

const criticalShellCss = `
  body {
    margin: 0;
    min-height: 100vh;
    overflow-x: hidden;
    background: #0f172a;
    color: #ffffff;
    font-family: var(--font-prompt), 'Prompt', sans-serif;
  }

  .skip-to-content {
    position: absolute;
    top: -100%;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2000;
    background: #ffffff;
    color: #111827;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    text-decoration: none;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  }

  .skip-to-content:focus {
    top: 1rem;
  }

  .bg-image {
    position: fixed;
    inset: 0;
    z-index: -2;
    background-image: url('/BG_image/loginpage.webp');
    background-size: cover;
    background-position: center;
  }

  .bg-overlay {
    position: fixed;
    inset: 0;
    z-index: -1;
    background: linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(15, 23, 42, 0.4) 100%);
    backdrop-filter: blur(2px);
  }

  .main-content {
    min-height: 100vh;
    width: 100%;
    position: relative;
  }

  .main-container {
    padding: 100px 20px 40px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .navbar {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    padding: 1rem 2rem;
    display: flex;
    justify-content: center;
    z-index: 1000;
  }

  .nav-container {
    width: 100%;
    max-width: 1440px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .nav-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: #ffffff;
  }

  .nav-menu {
    display: flex;
    align-items: center;
    gap: 1rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .nav-menu li {
    list-style: none;
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #ffffff;
    text-decoration: none;
  }

  .nav-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .nav-login-btn,
  .hamburger,
  button,
  input {
    font: inherit;
  }
`;

export const metadata = {
    title: 'ระบบลงทะเบียนนักศึกษา - KMUTNB',
    description: 'KMUTNB Registration System Redesign',
    icons: {
        icon: [
            { url: '/tab-icon.svg', type: 'image/svg+xml' },
            { url: '/favicon.ico', sizes: 'any' },
        ],
        shortcut: [{ url: '/favicon.ico' }],
        apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    },
};

export default function RootLayout({ children }) {
    return (
        <html
            lang="th"
            className={`${prompt.variable} ${montserrat.variable}`}
            suppressHydrationWarning
        >
            <head>
                <style dangerouslySetInnerHTML={{ __html: criticalShellCss }} />
            </head>
            <body>
                <a href="#main-content" className="skip-to-content">
                    ข้ามไปยังเนื้อหาหลัก (Skip to content)
                </a>
                <GlobalErrorListener />
                <ReleaseConsistencyGuard />
                <LazyMotion features={domAnimation}>
                    <AuthProvider>
                        <GuestProvider>
                            <CredentialProvider>
                                {children}
                            </CredentialProvider>
                        </GuestProvider>
                    </AuthProvider>
                </LazyMotion>
            </body>
        </html>
    );
}
