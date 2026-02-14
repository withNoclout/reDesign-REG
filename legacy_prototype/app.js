// DOM Elements
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const navToggle = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');
const errorMsg = document.getElementById('errorMsg');
const submitBtn = document.getElementById('submitBtn');
const btnLoader = document.getElementById('btnLoader');
const btnText = document.querySelector('.btn-text');

// Toggle Mobile Menu
function toggleMenu() {
    navMenu.classList.toggle('active');
}

// Toggle Password Visibility
function togglePassword() {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);

    // Update Eye Icon
    const eyeIcon = document.getElementById('eyeIcon');
    if (type === 'text') {
        eyeIcon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`;
    } else {
        eyeIcon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
    }
}

// Focus Login (Scroll to box)
function focusLogin() {
    document.getElementById('loginBox').scrollIntoView({ behavior: 'smooth' });
    usernameInput.focus();
}

// Handle Login Submission
async function handleLogin(e) {
    e.preventDefault();

    // Reset State
    errorMsg.style.display = 'none';
    submitBtn.disabled = true;
    btnLoader.style.display = 'block';

    const username = usernameInput.value;
    const password = passwordInput.value;

    try {
        // Prepare Proxy API Call (Implementation Pending Backend)
        // const response = await fetch('/api/proxy/login', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ username, password })
        // });

        // Simulating API Delay for Prototype
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Mock Validation
        if (username === 'admin' && password === '1234') {
            // Success
            // alert('Login Successful! Redirecting...');
            window.location.href = 'landing.html';
        } else {
            throw new Error('รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        }

    } catch (error) {
        // Handle Error
        errorMsg.style.display = 'flex';
        document.getElementById('errorText').textContent = error.message;

        // Shake Animation
        const loginBox = document.getElementById('loginBox');
        loginBox.style.animation = 'shake 0.5s';
        setTimeout(() => loginBox.style.animation = '', 500);

    } finally {
        submitBtn.disabled = false;
        btnLoader.style.display = 'none';
    }
}

// Sticky Navbar Effect on Scroll
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 50) {
        navbar.style.background = 'rgba(255, 255, 255, 0.1)';
        navbar.style.backdropFilter = 'blur(15px)';
    } else {
        navbar.style.background = 'rgba(255, 255, 255, 0.05)';
        navbar.style.backdropFilter = 'blur(10px)';
    }
});

// Add Shake Animation to CSS dynamically
const styleSheet = document.createElement("style");
styleSheet.innerText = `
@keyframes shake {
    0% { transform: translateX(0); }
    25% { transform: translateX(-10px); }
    50% { transform: translateX(10px); }
    75% { transform: translateX(-10px); }
    100% { transform: translateX(0); }
}`;
document.head.appendChild(styleSheet);
