import backgroundImage from '@/assets/background-image.jpg';

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
    /* Background now lives on ::before (photo) / ::after (wash + vignette) below,
       so it can be softened with filters without blurring real content. */
    background-color: #f6f8fb;
    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
    margin: 0;
    /* vh-based (not just vw): shrinks on short/laptop monitors so the two-column
       layout never has to force a page scroll just to show a taller screen's
       worth of spacing. */
    padding: clamp(16px, 3vh, 48px) clamp(32px, 5vw, 64px);
    overflow: hidden;
    box-sizing: border-box;
    position: relative;
    /* Brand + neutral colours now flow from the global token layer (styles/tokens.css)
       so every auth page shares one canonical brand orange / navy. */
    --brand-orange: var(--bh-brand);
    /* Auth navy matches the mobile login (CapstoneMobile/app/login.tsx C.navy). */
    --brand-navy: #1a2b4a;
    --auth-shell: min(1120px, calc(100vw - 64px));
    --auth-brand-col: min(420px, 100%);
    --auth-form-col: min(480px, 100%);
    --auth-gap: clamp(64px, 9vw, 128px);
    --space-1: var(--bh-space-1);
    --space-2: var(--bh-space-2);
    --space-3: var(--bh-space-3);
    --space-4: var(--bh-space-4);
    /* Shared auth control geometry — pages reference these instead of hardcoding */
    --auth-radius-card: var(--bh-radius-3xl);
    --auth-radius-field: var(--bh-radius-lg);
    --auth-input-h: var(--bh-control-h-lg);
    --auth-field-border: var(--bh-slate-200);
    --auth-field-bg: var(--bh-slate-50);
    --auth-shadow-card: var(--bh-shadow-card);
    --auth-shadow-card-hover: var(--bh-shadow-card-hover);
  }

  /*
   * Background photo (src/assets/background-image.jpg) — a warm, golden-hour path
   * toward water. Kept vivid and colourful — just a touch of blur/softening so
   * it reads as ambient scenery rather than a sharp foreground image competing
   * with the card and brand copy.
   */
  .login-container::before {
    content: '';
    position: absolute;
    inset: -20px;
    z-index: 0;
    background: url(${backgroundImage}) center 42% / cover no-repeat;
    filter: saturate(1.02) brightness(1.02) contrast(1) blur(2px);
    transform: scale(1.04);
    pointer-events: none;
  }

  /* A faint overall wash (barely-there) plus vignette — the readability
     spotlight lives on .brand-panel::before instead (anchored to the actual
     content, so it stays correctly centred at any viewport width). Corners
     stay clearly vivid either way; this is a light touch, not a wash-out. */
  .login-container::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background:
      radial-gradient(ellipse 90% 70% at 50% 50%, transparent 60%, rgba(26, 43, 74, 0.05) 100%),
      rgba(255, 255, 255, 0.08);
  }

  .login-container.auth-page--wide {
    --auth-shell: min(1240px, calc(100vw - 64px));
    --auth-form-col: min(680px, 100%);
  }

  /*
   * Warm decorative colour accents — large soft corner glows plus a few small
   * floating shapes, sitting on top of the photo (z-index 1, same layer as the
   * vignette) so they read as intentional colour rather than being lost behind
   * it. Boosted from their original flat-gradient opacities so they stay
   * clearly visible against the photo. The thin wavy line pattern stays
   * retired — it was tuned for a flat background and reads as noise over a
   * photograph; the corner glows and floating shapes do the same job better.
   */
  .login-bg-pattern {
    display: none;
  }

  .login-bg-pattern,
  .login-bg-shape,
  .login-bg-geo,
  .login-corner-glow {
    z-index: 1;
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
    background: radial-gradient(circle, rgba(245, 78, 37, 0.24) 0%, transparent 68%);
    filter: blur(40px);
    animation: loginFloat 9s ease-in-out infinite;
  }

  .login-bg-shape--2 {
    width: 300px;
    height: 300px;
    bottom: 8%;
    right: 3%;
    background: radial-gradient(circle, rgba(26, 43, 74, 0.1) 0%, transparent 68%);
    filter: blur(36px);
    animation: loginFloat 11s ease-in-out infinite reverse;
  }

  .login-bg-shape--3 {
    width: 220px;
    height: 220px;
    top: 38%;
    right: 18%;
    background: radial-gradient(circle, rgba(245, 78, 37, 0.16) 0%, transparent 68%);
    filter: blur(32px);
    animation: loginFloat 13s ease-in-out infinite;
  }

  .login-bg-shape--4 {
    width: 140px;
    height: 140px;
    bottom: 22%;
    left: 6%;
    background: rgba(255, 106, 61, 0.14);
    filter: blur(28px);
    animation: loginFloatSlow 10s ease-in-out infinite;
  }

  .login-bg-geo {
    position: absolute;
    pointer-events: none;
    border: 1px solid rgba(245, 78, 37, 0.14);
    opacity: 0.6;
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
    background: rgba(245, 78, 37, 0.08);
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

  /* Small dot-grid accents — a quiet premium detail tucked into two corners,
     well clear of the card and brand copy. */
  .login-dot-grid {
    position: absolute;
    width: 120px;
    height: 120px;
    pointer-events: none;
    background-image: radial-gradient(rgba(245, 78, 37, 0.35) 1.5px, transparent 1.5px);
    background-size: 16px 16px;
    -webkit-mask-image: radial-gradient(circle, rgba(0, 0, 0, 0.9) 0%, transparent 75%);
    mask-image: radial-gradient(circle, rgba(0, 0, 0, 0.9) 0%, transparent 75%);
  }

  .login-dot-grid--tr {
    top: 6%;
    right: 4%;
  }

  .login-dot-grid--bl {
    bottom: 5%;
    left: 3%;
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
    background: radial-gradient(circle, rgba(255, 106, 61, 0.14) 0%, transparent 65%);
  }

  .login-corner-glow--br {
    width: 400px;
    height: 400px;
    bottom: -160px;
    right: -160px;
    background: radial-gradient(circle, rgba(26, 43, 74, 0.09) 0%, transparent 65%);
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
    /* Above both background layers: ::before (photo, z-index 0) and
       ::after (wash + vignette, z-index 1). */
    z-index: 2;
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

  /* Readability spotlight — anchored to the panel itself (not a fixed % of the
     viewport), so the logo/title/description stay legible over the vivid photo
     at any screen width, while the corners of the page stay fully colourful. */
  .brand-panel::before {
    content: '';
    position: absolute;
    inset: -15% -20%;
    z-index: 0;
    border-radius: 50%;
    background: radial-gradient(
      ellipse 60% 55% at 50% 42%,
      rgba(255, 255, 255, 0.72) 0%,
      rgba(255, 255, 255, 0.46) 45%,
      transparent 75%
    );
    pointer-events: none;
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
    margin: 0 0 clamp(10px, 2.2vh, 20px);
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
    margin: 0 0 clamp(10px, 2.4vh, 24px);
  }

  .brand-logo-wrap {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    width: fit-content;
    padding: clamp(10px, 1.8vh, 20px);
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 247, 244, 0.92) 0%, rgba(255, 255, 255, 0.45) 55%, transparent 72%);
    box-shadow:
      0 0 0 1px rgba(245, 78, 37, 0.07),
      0 0 0 8px rgba(255, 255, 255, 0.35),
      0 12px 36px rgba(245, 78, 37, 0.14);
    line-height: 0;
    z-index: 1;
    transition: box-shadow 0.3s ease;
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
    /* Scales with viewport HEIGHT (not just a fixed px cap) so a short/laptop
       monitor gets a smaller logo instead of forcing the page to scroll. */
    max-width: clamp(140px, 24vh, 252px);
    height: auto;
    object-fit: contain;
    object-position: center center;
    filter: drop-shadow(0 12px 24px rgba(245, 78, 37, 0.16));
  }

  .brand-title {
    font-size: clamp(1.85rem, 3.2vw, 2.4rem);
    font-weight: 800;
    color: var(--brand-navy);
    line-height: 1.18;
    margin: 0 0 clamp(8px, 1.8vh, 18px);
    letter-spacing: -0.035em;
    width: 100%;
    /* Soft halo — guarantees legibility over the photo regardless of how much
       colour/detail happens to sit behind the text at any given viewport size. */
    text-shadow: 0 1px 24px rgba(255, 255, 255, 0.9), 0 1px 3px rgba(255, 255, 255, 0.8);
  }

  .brand-description {
    font-size: clamp(0.95rem, 1.5vw, 1.08rem);
    color: #5a6a85;
    line-height: 1.7;
    margin: 0 0 clamp(14px, 3vh, 32px);
    max-width: 400px;
    font-weight: 400;
    text-shadow: 0 1px 16px rgba(255, 255, 255, 0.85), 0 1px 2px rgba(255, 255, 255, 0.7);
  }

  .brand-features {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 1.2vh, 10px);
    width: 100%;
    max-width: 340px;
  }

  /* Feature rows read as soft glass "cards" rather than bare bullet text —
     the same layered-shadow language as the auth card itself, at a lighter
     weight. Vertical padding is vh-clamped so the row height itself compacts
     on short viewports instead of pushing the layout past 100vh. */
  .brand-feature {
    display: flex;
    align-items: center;
    gap: 14px;
    font-size: 0.925rem;
    font-weight: 600;
    color: var(--brand-navy);
    letter-spacing: -0.01em;
    line-height: 1.4;
    min-height: 28px;
    text-align: left;
    padding: clamp(6px, 1.2vh, 10px) 14px clamp(6px, 1.2vh, 10px) 10px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.6);
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03), 0 4px 14px rgba(15, 23, 42, 0.04);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    transition: transform 0.25s var(--bh-ease, ease), box-shadow 0.25s ease, background-color 0.25s ease;
  }

  .brand-feature:hover {
    transform: translateY(-1px) translateX(2px);
    background: rgba(255, 255, 255, 0.72);
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
  }

  .brand-feature-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 11px;
    background: linear-gradient(145deg, rgba(245, 78, 37, 0.14), rgba(245, 78, 37, 0.06));
    color: var(--brand-orange);
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(245, 78, 37, 0.1);
    transition: transform 0.25s ease, box-shadow 0.25s ease;
  }

  .brand-feature:hover .brand-feature-icon {
    transform: scale(1.08);
    box-shadow: 0 3px 12px rgba(245, 78, 37, 0.16);
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
    /* Stacked layout: a left-to-right wash no longer lines up with the content
       flow (brand copy sits ABOVE the card, not beside it), so switch to a
       uniform top-to-bottom wash strong enough to keep both legible. */
    .login-container::before {
      background-position: center 35%;
    }

    .login-container::after {
      background:
        radial-gradient(ellipse 90% 60% at 50% 50%, transparent 55%, rgba(26, 43, 74, 0.08) 100%),
        linear-gradient(
          180deg,
          rgba(247, 249, 252, 0.94) 0%,
          rgba(240, 244, 248, 0.9) 55%,
          rgba(255, 247, 244, 0.82) 100%
        );
    }

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
