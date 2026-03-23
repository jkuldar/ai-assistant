import { showToast } from './utils.js';

// Authentication component
export class Auth {
  constructor(container, api, onAuthenticated) {
    this.container = container;
    this.api = api;
    this.onAuthenticated = onAuthenticated;
    this.currentMode = 'login'; // 'login' | 'register' | 'forgot-password'
  }

  render() {
    this.container.innerHTML = `
      <div class="auth-page">
        <div class="auth-branding">
          <div class="auth-branding-inner">
            <div class="auth-brand-logo">
              <img src="/uvi-logo.svg" class="uvi-logo-img" alt="üVi logo"/>
              <h1>üVi</h1>
            </div>
            <p class="auth-brand-tagline">Your private wellness companion</p>
            <ul class="auth-features">
              <li>
                <span class="feature-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                </span>
                <div>
                  <strong>Track what matters</strong>
                  <span>Log weight, sleep, activity and body metrics in one place</span>
                </div>
              </li>
              <li>
                <span class="feature-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2z"/></svg>
                </span>
                <div>
                  <strong>Nutrition &amp; meal planning</strong>
                  <span>Build meals from recipes, log nutrients and auto-generate shopping lists</span>
                </div>
              </li>
              <li>
                <span class="feature-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.76-1.68 5.1-4 6.32V17a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-1.68C6.68 14.1 5 11.76 5 9a7 7 0 0 1 7-7z"/></svg>
                </span>
                <div>
                  <strong>AI-powered insights</strong>
                  <span>Personalised recommendations and answers based on your health data</span>
                </div>
              </li>
              <li>
                <span class="feature-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </span>
                <div>
                  <strong>Private by design</strong>
                  <span>Your data is end-to-end encrypted and never shared</span>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div class="auth-container">
          <button class="btn-icon btn-darkmode auth-theme-btn" id="auth-darkmode-btn" title="Toggle dark mode" aria-label="Toggle dark mode"></button>
          <div class="auth-card">
            <div class="auth-header">
              <div class="auth-mobile-logo">
                <img src="/uvi-logo.svg" class="uvi-logo-img uvi-logo-sm" alt="üVi logo"/>
                <h2>üVi</h2>
              </div>
              <p class="auth-subtitle">${this.currentMode === 'register' ? 'Create your account' : 'Welcome back'}</p>
            </div>

            <div class="auth-tabs">
              <button class="auth-tab ${this.currentMode === 'login' ? 'active' : ''}" data-mode="login">
                Sign in
              </button>
              <button class="auth-tab ${this.currentMode === 'register' ? 'active' : ''}" data-mode="register">
                Register
              </button>
            </div>

            <div class="auth-body">
              ${
                this.currentMode === 'login'
                  ? this.renderLoginForm()
                  : this.currentMode === 'forgot-password'
                  ? this.renderForgotPasswordForm()
                  : this.renderRegisterForm()
              }
            </div>

            <div class="auth-footer">
              <div class="auth-divider">
                <span>or</span>
              </div>
              <div class="oauth-buttons">
                <button class="btn-oauth btn-google" id="google-login">
                  <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd"><path d="M17.6 9.2l-.1-1.8H9v3.4h4.8C13.6 12 13 13 12 13.6v2.2h3a8.8 8.8 0 0 0 2.6-6.6z" fill="#4285F4" fill-rule="nonzero"/><path d="M9 18c2.4 0 4.5-.8 6-2.2l-3-2.2a5.4 5.4 0 0 1-8-2.9H1V13a9 9 0 0 0 8 5z" fill="#34A853" fill-rule="nonzero"/><path d="M4 10.7a5.4 5.4 0 0 1 0-3.4V5H1a9 9 0 0 0 0 8l3-2.3z" fill="#FBBC05" fill-rule="nonzero"/><path d="M9 3.6c1.3 0 2.5.4 3.4 1.3L15 2.3A9 9 0 0 0 1 5l3 2.4a5.4 5.4 0 0 1 5-3.7z" fill="#EA4335" fill-rule="nonzero"/></g></svg>
                  Google
                </button>
                <button class="btn-oauth btn-github" id="github-login">
                  <svg width="18" height="18" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M9 0C4 0 0 4 0 9c0 4 2.6 7.4 6.2 8.6.5.1.7-.2.7-.5v-1.7c-2.5.5-3-.6-3.2-1.2-.1-.3-.6-1.2-1-1.4-.4-.2-.9-.7 0-.7.8 0 1.4.7 1.6 1 .9 1.5 2.4 1.1 3 .8.1-.6.4-1.1.7-1.3-2.3-.3-4.7-1.1-4.7-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.8 0 0 .9-.3 2.8 1a9.5 9.5 0 0 1 5 0c2-1.3 2.8-1 2.8-1 .5 1.5.2 2.5.1 2.8.7.7 1 1.6 1 2.7 0 3.8-2.3 4.7-4.6 4.9.4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A9 9 0 0 0 9 0z"/></svg>
                  GitHub
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  renderForgotPasswordForm() {
    return `
      <form id="forgot-password-form" class="auth-form">
        <div class="auth-back">
          <a href="#" id="back-to-login-link">&larr; Back to sign in</a>
        </div>
        <h3 style="margin-bottom:0.5rem">Reset your password</h3>
        <p style="color:var(--muted);font-size:0.9rem;margin-bottom:1.5rem">
          Enter your email address and we'll send you a link to reset your password.
        </p>
        <div class="form-group">
          <label>E-mail</label>
          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            required
            autocomplete="email"
          />
        </div>

        <div id="auth-error" class="auth-error" style="display: none;"></div>
        <div id="auth-success" class="auth-success" style="display: none;"></div>

        <button type="submit" class="btn-primary btn-block">
          Send reset link
        </button>
      </form>
    `;
  }

  renderLoginForm() {
    return `
      <form id="login-form" class="auth-form">
        <div class="form-group">
          <label>E-mail</label>
          <input 
            type="email" 
            name="email" 
            placeholder="you@example.com"
            required 
            autocomplete="email"
          />
        </div>
        
        <div class="form-group">
          <label>Password</label>
          <input 
            type="password" 
            name="password" 
            placeholder="••••••••"
            required 
            autocomplete="current-password"
          />
        </div>

        <div id="auth-error" class="auth-error" style="display: none;"></div>
        <div id="auth-success" class="auth-success" style="display: none;"></div>

        <button type="submit" class="btn-primary btn-block">
          Sign in
        </button>

        <div class="auth-links">
          <a href="#" id="forgot-password">Forgot your password?</a>
        </div>
      </form>
    `;
  }

  renderRegisterForm() {
    return `
      <form id="register-form" class="auth-form">
        <div class="form-group">
          <label>E-mail</label>
          <input 
            type="email" 
            name="email" 
            placeholder="you@example.com"
            required 
            autocomplete="email"
          />
        </div>
        
        <div class="form-group">
          <label>Password</label>
          <input 
            type="password" 
            name="password" 
            placeholder="At least 8 characters"
            required 
            autocomplete="new-password"
            minlength="8"
          />
          <small class="form-hint">At least 8 characters</small>
        </div>
        
        <div class="form-group">
          <label>Confirm password</label>
          <input 
            type="password" 
            name="confirmPassword" 
            placeholder="••••••••"
            required 
            autocomplete="new-password"
          />
        </div>

        <div id="auth-error" class="auth-error" style="display: none;"></div>
        <div id="auth-success" class="auth-success" style="display: none;"></div>

        <button type="submit" class="btn-primary btn-block">
          Create account
        </button>
      </form>
    `;
  }

  attachEventListeners() {
    // Dark mode toggle
    const themBtn = this.container.querySelector('#auth-darkmode-btn');
    if (themBtn) {
      const updateThemeBtn = () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        themBtn.innerHTML = isDark
          ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/></svg>`
          : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
        themBtn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
      };
      updateThemeBtn();
      themBtn.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
          document.documentElement.removeAttribute('data-theme');
          localStorage.setItem('ndli_theme', 'light');
        } else {
          document.documentElement.setAttribute('data-theme', 'dark');
          localStorage.setItem('ndli_theme', 'dark');
        }
        updateThemeBtn();
      });
    }

    // Tab switching
    const tabs = this.container.querySelectorAll('.auth-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.currentMode = tab.dataset.mode;
        this.render();
      });
    });

    // Login form
    const loginForm = this.container.querySelector('#login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleLogin(e.target);
      });
    }

    // Register form
    const registerForm = this.container.querySelector('#register-form');
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleRegister(e.target);
      });
    }

    // OAuth buttons
    const googleBtn = this.container.querySelector('#google-login');
    const githubBtn = this.container.querySelector('#github-login');
    
    if (googleBtn) {
      googleBtn.addEventListener('click', () => this.handleOAuth('google'));
    }
    if (githubBtn) {
      githubBtn.addEventListener('click', () => this.handleOAuth('github'));
    }

    // Forgot password link (inside the login form)
    const forgotPassword = this.container.querySelector('#forgot-password');
    if (forgotPassword) {
      forgotPassword.addEventListener('click', (e) => {
        e.preventDefault();
        this.currentMode = 'forgot-password';
        this.render();
      });
    }

    // Forgot password form submission
    const forgotForm = this.container.querySelector('#forgot-password-form');
    if (forgotForm) {
      const backLink = this.container.querySelector('#back-to-login-link');
      backLink?.addEventListener('click', (e) => {
        e.preventDefault();
        this.currentMode = 'login';
        this.render();
      });

      forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleForgotPassword(e.target);
      });
    }
  }

  async handleForgotPassword(form) {
    const email = form.email.value.trim();
    const submitBtn = form.querySelector('button[type="submit"]');

    this.hideMessages();

    if (!email) {
      this.showError('Please enter your email address');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
      await this.api.forgotPassword(email);
      this.showSuccess('If that email is registered, a reset link has been sent. Check your inbox.');
      form.reset();
    } catch (error) {
      this.showError(error.message || 'Failed to send reset email');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send reset link';
    }
  }

  async handleLogin(form) {
    const email = form.email.value.trim();
    const password = form.password.value;
    const submitBtn = form.querySelector('button[type="submit"]');
    const errorEl = this.container.querySelector('#auth-error');
    const successEl = this.container.querySelector('#auth-success');

    this.hideMessages();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    try {
      const result = await this.api.login(email, password);
      
      if (result.requires2FA) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign in';
        this.show2FAPrompt(email, password);
        return;
      }

      if (result.accessToken) {
        this.showSuccess('Signed in successfully!');
        setTimeout(() => {
          this.onAuthenticated();
        }, 500);
      } else if (result.message && result.message.includes('verify')) {
        this.showUnverifiedError(email);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign in';
      }
    } catch (error) {
      const msg = (error.data && error.data.message) || error.message || '';
      if (msg.toLowerCase().includes('not verified') || msg.toLowerCase().includes('email not verified')) {
        this.showUnverifiedError(email);
      } else {
        this.showError(msg || 'Sign in failed');
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign in';
    }
  }

  async handleRegister(form) {
    const email = form.email.value.trim();
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;
    const submitBtn = form.querySelector('button[type="submit"]');

    this.hideMessages();

    if (password !== confirmPassword) {
      this.showError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      this.showError('Password must be at least 8 characters');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    try {
      await this.api.register(email, password);
      form.reset();
      this.showSuccess('Account created! Check your email to verify your account.');
      setTimeout(() => {
        this.showVerificationNotice(email);
      }, 2000);
      
    } catch (error) {
      this.showError(error.message || 'Registration failed');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create account';
    }
  }

  async handleOAuth(provider) {
    const oauthUrl = `${this.api.baseURL}/auth/${provider}`;
    try {
      // Quick pre-check: see if the server will redirect us or return an error
      const response = await fetch(oauthUrl, {
        redirect: 'manual',
        credentials: 'include',
      });
      // opaqueredirect (type) or status 0 means the server issued a redirect → go there
      if (response.type === 'opaqueredirect' || response.status === 0) {
        window.location.href = oauthUrl;
        return;
      }
      // Any other response (e.g. 501) is an error we can read
      let message = `${provider} sign-in is not available`;
      try {
        const data = await response.json();
        message = data.message || message;
      } catch {}
      showToast(message, 'error');
    } catch {
      // fetch itself failed (network error, CORS) → just try the navigation
      window.location.href = oauthUrl;
    }
  }

  show2FAPrompt(email, password) {
    this.container.querySelector('.auth-body').innerHTML = `
      <div class="twofa-prompt">
        <div class="verification-icon">🔐</div>
        <h3>Two-Factor Authentication</h3>
        <p>Enter the 6-digit code from your authenticator app.</p>
        <form id="twofa-form" class="auth-form">
          <div class="form-group">
            <label>Authentication Code</label>
            <input
              type="text"
              name="token"
              placeholder="000000"
              maxlength="6"
              inputmode="numeric"
              autocomplete="one-time-code"
              required
              style="letter-spacing: 0.3em; font-size: 1.3rem; text-align: center;"
            />
          </div>
          <div id="twofa-error" class="auth-error" style="display:none;"></div>
          <button type="submit" class="btn-primary btn-block">Verify</button>
          <button type="button" class="btn-secondary btn-block" id="twofa-back" style="margin-top:0.5rem;">Back to sign in</button>
        </form>
      </div>
    `;

    const form = this.container.querySelector('#twofa-form');
    const errorEl = this.container.querySelector('#twofa-error');

    this.container.querySelector('#twofa-back').addEventListener('click', () => {
      this.currentMode = 'login';
      this.render();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = form.token.value.trim();
      const submitBtn = form.querySelector('button[type="submit"]');

      errorEl.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying...';

      try {
        const result = await this.api.verify2FALogin(email, password, token);
        if (result.accessToken) {
          this.onAuthenticated();
        }
      } catch (error) {
        errorEl.textContent = error.message || 'Invalid code. Please try again.';
        errorEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Verify';
      }
    });
  }

  showVerificationNotice(email) {
    this.container.querySelector('.auth-body').innerHTML = `
      <div class="verification-notice">
        <div class="verification-icon">📧</div>
        <h3>Check your email</h3>
        <p>We sent a verification link to:</p>
        <strong>${email}</strong>
        <p class="verification-help">
          Click the link in the email to activate your account.
          You can then sign in.
        </p>
        <button class="btn-secondary" id="back-to-login">
          Back to sign in
        </button>
      </div>
    `;

    this.container.querySelector('#back-to-login')?.addEventListener('click', () => {
      this.currentMode = 'login';
      this.render();
    });
  }

  showUnverifiedError(email) {
    const errorEl = this.container.querySelector('#auth-error');
    if (!errorEl) return;

    errorEl.innerHTML = `
      <span>Email not verified.</span>
      <button id="resend-verification-btn" style="
        margin-left: 0.5rem;
        background: none;
        border: none;
        color: var(--primary);
        cursor: pointer;
        font-size: inherit;
        font-weight: 600;
        padding: 0;
        text-decoration: underline;
      ">Resend verification email</button>
    `;
    errorEl.style.display = 'block';

    const resendBtn = errorEl.querySelector('#resend-verification-btn');
    if (resendBtn) {
      resendBtn.addEventListener('click', async () => {
        resendBtn.disabled = true;
        resendBtn.textContent = 'Sending...';
        try {
          await this.api.resendVerification(email);
          errorEl.style.display = 'none';
          this.showSuccess('Verification email sent! Check your inbox.');
        } catch (err) {
          resendBtn.disabled = false;
          resendBtn.textContent = 'Resend verification email';
          this.showError(err.message || 'Failed to resend. Please try again.');
        }
      });
    }
  }

  showError(message) {
    const errorEl = this.container.querySelector('#auth-error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
  }

  showSuccess(message) {
    const successEl = this.container.querySelector('#auth-success');
    if (successEl) {
      successEl.textContent = message;
      successEl.style.display = 'block';
    }
  }

  hideMessages() {
    const errorEl = this.container.querySelector('#auth-error');
    const successEl = this.container.querySelector('#auth-success');
    if (errorEl) errorEl.style.display = 'none';
    if (successEl) successEl.style.display = 'none';
  }
}
