export const AUTH_SHELL_STYLES = `
  @keyframes loginFadeIn {
    from { opacity: 0; transform: translateY(18px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes loginFloat {
    0%, 100% { transform: translateY(0) translateX(0); }
    50% { transform: translateY(-12px) translateX(4px); }
  }

  @keyframes loginFloatSlow {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-8px) rotate(3deg); }
  }

  @keyframes loginPulse {
    0%, 100% { opacity: 0.35; transform: scale(1); }
    50% { opacity: 0.55; transform: scale(1.05); }
  }

  .login-container {
    min-height: 100vh;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background:
      radial-gradient(ellipse 70% 55% at 0% 0%, rgba(245, 78, 37, 0.06) 0%, transparent 55%),
      radial-gradient(ellipse 60% 50% at 100% 100%, rgba(245, 78, 37, 0.05) 0%, transparent 50%),
      radial-gradient(ellipse 40% 35% at 100% 0%, rgba(26, 43, 74, 0.04) 0%, transparent 45%),
      linear-gradient(160deg, #F6F8FB 0%, #EEF2F7 100%);
    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
    margin: 0;
    padding: clamp(24px, 4vh, 48px) clamp(32px, 5vw, 64px);
    overflow-x: hidden;
    box-sizing: border-box;
    position: relative;
    --brand-orange: #F54E25;
    --brand-navy: #1a2b4a;
    --auth-shell: min(1120px, calc(100vw - 64px));
    --auth-brand-col: min(420px, 100%);
    --auth-form-col: min(480px, 100%);
    --auth-gap: clamp(64px, 9vw, 128px);
    --space-1: 8px;
    --space-2: 16px;
    --space-3: 24px;
    --space-4: 32px;
  }

  .login-container.auth-page--wide {
    --auth-shell: min(1240px, calc(100vw - 64px));
    --auth-form-col: min(680px, 100%);
  }

  .login-bg-pattern {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.35;
    background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 30 Q15 15 30 30 T60 30' fill='none' stroke='%23F54E25' stroke-width='0.4' opacity='0.15'/%3E%3Cpath d='M0 45 Q20 30 40 45' fill='none' stroke='%231a2b4a' stroke-width='0.3' opacity='0.08'/%3E%3C/svg%3E");
    background-size: 60px 60px;
  }

  .login-bg-shape {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
  }

  .login-bg-shape--1 {
    width: 380px;
    height: 380px;
    top: -100px;
    left: -80px;
    background: radial-gradient(circle, rgba(245, 78, 37, 0.14) 0%, transparent 68%);
    filter: blur(40px);
    animation: loginFloat 9s ease-in-out infinite;
  }

  .login-bg-shape--2 {
    width: 300px;
    height: 300px;
    bottom: 8%;
    right: 3%;
    background: radial-gradient(circle, rgba(26, 43, 74, 0.07) 0%, transparent 68%);
    filter: blur(36px);
    animation: loginFloat 11s ease-in-out infinite reverse;
  }

  .login-bg-shape--3 {
    width: 220px;
    height: 220px;
    top: 38%;
    right: 18%;
    background: radial-gradient(circle, rgba(245, 78, 37, 0.1) 0%, transparent 68%);
    filter: blur(32px);
    animation: loginFloat 13s ease-in-out infinite;
  }

  .login-bg-shape--4 {
    width: 140px;
    height: 140px;
    bottom: 22%;
    left: 6%;
    background: rgba(255, 106, 61, 0.08);
    filter: blur(28px);
    animation: loginFloatSlow 10s ease-in-out infinite;
  }

  .login-bg-geo {
    position: absolute;
    pointer-events: none;
    border: 1px solid rgba(245, 78, 37, 0.08);
    opacity: 0.5;
  }

  .login-bg-geo--1 {
    width: 64px;
    height: 64px;
    top: 18%;
    right: 12%;
    border-radius: 16px;
    transform: rotate(18deg);
    animation: loginFloatSlow 14s ease-in-out infinite;
  }

  .login-bg-geo--2 {
    width: 40px;
    height: 40px;
    bottom: 28%;
    left: 10%;
    border-radius: 50%;
    background: rgba(245, 78, 37, 0.04);
    animation: loginFloat 12s ease-in-out infinite reverse;
  }

  .login-bg-geo--3 {
    width: 24px;
    height: 24px;
    top: 12%;
    left: 42%;
    border-radius: 6px;
    transform: rotate(45deg);
    animation: loginPulse 8s ease-in-out infinite;
  }

  .login-corner-glow {
    position: absolute;
    pointer-events: none;
    border-radius: 50%;
  }

  .login-corner-glow--tl {
    width: 480px;
    height: 480px;
    top: -200px;
    left: -200px;
    background: radial-gradient(circle, rgba(255, 106, 61, 0.07) 0%, transparent 65%);
  }

  .login-corner-glow--br {
    width: 400px;
    height: 400px;
    bottom: -160px;
    right: -160px;
    background: radial-gradient(circle, rgba(26, 43, 74, 0.05) 0%, transparent 65%);
  }

  .login-content-wrapper {
    display: grid;
    grid-template-columns: var(--auth-brand-col) var(--auth-form-col);
    gap: var(--auth-gap);
    align-items: center;
    justify-content: center;
    width: fit-content;
    max-width: var(--auth-shell);
    margin: 0 auto;
    position: relative;
    z-index: 1;
    box-sizing: border-box;
  }

  .brand-side {
    min-width: 0;
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0;
    align-self: center;
    width: var(--auth-brand-col);
  }

  .brand-panel {
    position: relative;
    width: 100%;
    max-width: 420px;
    padding: 0;
    animation: loginFadeIn 0.6s ease-out;
  }

  .brand-watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(300px, 88%);
    opacity: 0.04;
    pointer-events: none;
    user-select: none;
    z-index: 0;
  }

  .brand-accent {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
  }

  .brand-accent--1 {
    width: 56px;
    height: 56px;
    top: 18%;
    right: 14%;
    background: linear-gradient(135deg, rgba(245, 78, 37, 0.12), rgba(245, 78, 37, 0.03));
    animation: loginFloatSlow 11s ease-in-out infinite;
  }

  .brand-accent--2 {
    width: 40px;
    height: 40px;
    bottom: 28%;
    left: 10%;
    background: linear-gradient(135deg, rgba(245, 78, 37, 0.08), transparent);
    animation: loginFloat 9s ease-in-out infinite reverse;
  }

  .brand-accent--3 {
    display: none;
  }

  .brand-particle {
    position: absolute;
    border-radius: 50%;
    background: rgba(245, 78, 37, 0.14);
    pointer-events: none;
  }

  .brand-particle--1 {
    width: 5px;
    height: 5px;
    top: 20%;
    right: 20%;
    animation: loginPulse 6s ease-in-out infinite;
  }

  .brand-particle--2 {
    width: 4px;
    height: 4px;
    top: 32%;
    left: 14%;
    animation: loginPulse 7s ease-in-out infinite 1s;
  }

  .brand-particle--3 {
    width: 4px;
    height: 4px;
    top: 26%;
    right: 28%;
    animation: loginPulse 8s ease-in-out infinite 0.5s;
  }

  .brand-content {
    position: relative;
    z-index: 1;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .brand-eyebrow {
    display: inline-block;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--brand-orange);
    margin: 0 0 20px;
    padding: 4px 12px;
    background: rgba(245, 78, 37, 0.07);
    border-radius: 20px;
    border: 1px solid rgba(245, 78, 37, 0.1);
    line-height: 1.4;
  }

  .brand-logo-zone {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    margin: 0 0 24px;
  }

  .brand-logo-wrap {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    width: fit-content;
    padding: 20px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 247, 244, 0.9) 0%, rgba(255, 255, 255, 0.4) 55%, transparent 72%);
    box-shadow:
      0 0 0 1px rgba(245, 78, 37, 0.06),
      0 8px 32px rgba(245, 78, 37, 0.1);
    line-height: 0;
    z-index: 1;
  }

  .brand-logo-wrap::before {
    content: "";
    position: absolute;
    inset: 8%;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(245, 78, 37, 0.14) 0%, transparent 70%);
    filter: blur(16px);
    z-index: 0;
    animation: loginPulse 5s ease-in-out infinite;
  }

  .brand-logo {
    position: relative;
    z-index: 1;
    display: block;
    width: auto;
    max-width: 252px;
    height: auto;
    object-fit: contain;
    object-position: center center;
    filter: drop-shadow(0 12px 24px rgba(245, 78, 37, 0.16));
  }

  .brand-title {
    font-size: clamp(1.75rem, 3vw, 2.25rem);
    font-weight: 800;
    color: var(--brand-navy);
    line-height: 1.2;
    margin: 0 0 16px;
    letter-spacing: -0.03em;
    width: 100%;
  }

  .brand-description {
    font-size: clamp(0.95rem, 1.5vw, 1.05rem);
    color: #5a6a85;
    line-height: 1.65;
    margin: 0 0 28px;
    max-width: 400px;
    font-weight: 400;
  }

  .brand-features {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: fit-content;
  }

  .brand-feature {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--brand-navy);
    letter-spacing: -0.01em;
    line-height: 1.4;
    min-height: 28px;
    text-align: left;
  }

  .brand-feature-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(245, 78, 37, 0.1);
    color: var(--brand-orange);
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(245, 78, 37, 0.08);
    transition: transform 0.25s ease, box-shadow 0.25s ease;
  }

  .brand-feature:hover .brand-feature-icon {
    transform: scale(1.08);
    box-shadow: 0 3px 12px rgba(245, 78, 37, 0.14);
  }

  .form-side {
    width: var(--auth-form-col);
    min-width: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    align-self: center;
  }

  @media (max-width: 900px) {
    .login-bg-geo,
    .login-bg-shape--4 {
      display: none;
    }

    .login-content-wrapper {
      grid-template-columns: 1fr;
      gap: var(--space-4);
      width: 100%;
      max-width: min(680px, 100%);
    }

    .brand-side,
    .form-side {
      width: 100%;
    }

    .brand-panel {
      max-width: 100%;
      padding: 0;
    }

    .brand-content {
      text-align: center;
      align-items: center;
    }

    .brand-logo {
      max-width: 180px;
    }

    .brand-logo-wrap {
      padding: 16px;
    }

    .brand-logo-zone {
      margin-bottom: 24px;
    }

    .brand-description {
      max-width: 100%;
      margin-bottom: 28px;
    }

    .brand-features {
      align-items: flex-start;
      margin: 0 auto;
    }

    .brand-accent--1,
    .brand-accent--2 {
      display: none;
    }

    .brand-watermark {
      opacity: 0.035;
      width: min(240px, 80%);
    }
  }
`;
