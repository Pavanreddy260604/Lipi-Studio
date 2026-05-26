import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { Sparkles, Layers, FileText, ArrowRight, PenTool, Zap, Shield, Globe, Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';
import { useAuthStore } from '../stores/authStore';

/* ─── Animation Variants ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0 },
};

const fadeScale = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

const stagger = {
  visible: {
    transition: { staggerChildren: 0.15 },
  },
};

const staggerFast = {
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

/* ─── Typewriter Hook — reveals words progressively for attention capture ─── */
function useTypewriter(text: string, speed = 80, startDelay = 600) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    let charIndex = 0;

    timeout = setTimeout(() => {
      const interval = setInterval(() => {
        charIndex++;
        setDisplayed(text.slice(0, charIndex));
        if (charIndex >= text.length) {
          clearInterval(interval);
          setDone(true);
        }
      }, speed);
    }, startDelay);

    return () => clearTimeout(timeout);
  }, [text, speed, startDelay]);

  return { displayed, done };
}

/* ─── Counting animation for metric numbers ─── */
function AnimatedNumber({ value, suffix = '', duration = 1.5 }: { value: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const steps = 40;
    const increment = value / steps;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setCurrent(Math.min(Math.round(increment * step), value));
      if (step >= steps) clearInterval(interval);
    }, (duration * 1000) / steps);
    return () => clearInterval(interval);
  }, [isInView, value, duration]);

  return <span ref={ref}>{current}{suffix}</span>;
}

/* ─── Screenplay Preview Mockup — shows actual product UI ─── */
function ScreenplayPreview() {
  const lines = [
    { type: 'header', text: 'INT. COFFEE SHOP — MORNING' },
    { type: 'action', text: 'Sunlight cuts through venetian blinds. MAYA (28) sits alone at a corner table, laptop open, coffee untouched.' },
    { type: 'character', text: 'MAYA' },
    { type: 'dialogue', text: '(to herself)' },
    { type: 'dialogue', text: "Okay. One more scene. That's all." },
    { type: 'action', text: 'She types furiously. The cursor blinks. Words flow.' },
  ];

  return (
    <div className="landing__preview">
      <div className="landing__preview-chrome">
        <div className="landing__preview-dots">
          <span /><span /><span />
        </div>
        <div className="landing__preview-tab">untitled-screenplay.lipi</div>
      </div>
      <div className="landing__preview-body">
        {lines.map((line, i) => (
          <motion.div
            key={i}
            className={`landing__preview-line landing__preview-line--${line.type}`}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.3 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            {line.text}
          </motion.div>
        ))}
        <motion.div
          className="landing__preview-cursor-line"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 1.2 }}
        />
      </div>
    </div>
  );
}


export function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 80]);

  const { displayed, done } = useTypewriter("Write screenplays with AI.", 70, 500);
  const { effectiveTheme, toggleTheme } = useThemeStore();
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="landing">
      {/* ─── Fixed navigation bar ─── */}
      <motion.nav
        className="landing__nav"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="landing__nav-inner">
          <div className="landing__nav-brand">
            <div className="landing__nav-icon">
              <PenTool size={14} />
            </div>
            <span className="landing__brand-lipi" style={{ fontSize: '1.1rem' }}>Lipi</span>
            <span className="landing__brand-studio" style={{ fontSize: '0.65rem' }}>Studio</span>
          </div>
          <div className="landing__nav-actions">
            <button
              onClick={toggleTheme}
              className="landing__nav-theme-toggle focus-ring"
              aria-label={`Switch to ${effectiveTheme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {effectiveTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {isAuthenticated ? (
              <Link to="/dashboard" className="landing__nav-cta focus-ring">Go to App</Link>
            ) : (
              <>
                <Link to="/login" className="landing__nav-link">Sign in</Link>
                <Link to="/register" className="landing__nav-cta focus-ring">Get started</Link>
              </>
            )}
          </div>
        </div>
      </motion.nav>

      {/* ─── Hero ─── */}
      <section className="landing__hero" ref={heroRef}>
        <div className="landing__hero-ambient" />

        <motion.div
          className="landing__hero-content"
          style={{ opacity: heroOpacity, y: heroY }}
        >
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="landing__hero-inner"
          >
            {/* Brand mark — prominent with icon */}
            <motion.div className="landing__hero-brand" variants={fadeUp} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
              <div className="landing__hero-brand-icon">
                <PenTool size={18} strokeWidth={2.5} />
              </div>
              <div className="landing__brand">
                <span className="landing__brand-lipi landing__brand-lipi--hero">Lipi</span>
                <span className="landing__brand-studio landing__brand-studio--hero">Studio</span>
              </div>
            </motion.div>

            {/* Headline — typewriter effect for attention lock */}
            <motion.h1
              className="landing__headline"
              variants={fadeUp}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="landing__headline-text">{displayed}</span>
              <span className={`landing__cursor ${done ? 'landing__cursor--idle' : ''}`} aria-hidden="true" />
            </motion.h1>

            {/* Subtitle */}
            <motion.p className="landing__subtitle" variants={fadeUp} transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}>
              An intelligent writing studio that helps you craft, structure, and polish professional screenplays — scene by scene. Powered by AI. Free to use.
            </motion.p>

            {/* CTA — large, dominant, with micro-interaction */}
            <motion.div className="landing__cta-group" variants={fadeUp} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
              <Link to={isAuthenticated ? "/dashboard" : "/register"} className="landing__cta-primary landing__cta-primary--hero focus-ring">
                {isAuthenticated ? "Go to App" : "Start writing — it's free"}
                <ArrowRight size={18} />
              </Link>
              {!isAuthenticated && (
                <Link to="/login" className="landing__cta-secondary focus-ring">
                  Sign in
                </Link>
              )}
            </motion.div>

            {/* Trust signals — real, verifiable facts only */}
            <motion.div className="landing__trust" variants={fadeUp} transition={{ duration: 0.6 }}>
              <span className="landing__trust-item">
                <Shield size={13} />
                No credit card
              </span>
              <span className="landing__trust-divider" />
              <span className="landing__trust-item">
                <Zap size={13} />
                Instant setup
              </span>
              <span className="landing__trust-divider" />
              <span className="landing__trust-item">
                <Globe size={13} />
                lipistudio.me
              </span>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Scroll hint */}
        <div className="landing__scroll-hint">
          <div className="landing__scroll-line" />
        </div>
      </section>

      {/* ─── Product Preview — show, don't tell ─── */}
      <section className="landing__section landing__section--preview">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
        >
          <motion.p className="landing__kicker" variants={fadeUp} transition={{ duration: 0.5 }}>
            See it in action
          </motion.p>
          <motion.h2 className="landing__section-title" variants={fadeUp} transition={{ duration: 0.5 }}>
            Your screenplay takes shape in real time.
          </motion.h2>
          <motion.div variants={fadeScale} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
            <ScreenplayPreview />
          </motion.div>
        </motion.div>
      </section>

      {/* ─── What It Does — feature showcase ─── */}
      <section className="landing__section">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
        >
          <motion.p className="landing__kicker" variants={fadeUp} transition={{ duration: 0.5 }}>
            What you get
          </motion.p>
          <motion.h2 className="landing__section-title" variants={fadeUp} transition={{ duration: 0.5 }}>
            Everything you need to write your screenplay.
          </motion.h2>

          <div className="landing__features">
            {[
              {
                icon: <Sparkles size={22} />,
                title: 'AI Scene Writer',
                desc: 'Describe your scene in plain language. The AI writes industry-formatted screenplay — complete with sluglines, action, character cues, and dialogue.',
                accent: true,
              },
              {
                icon: <Layers size={22} />,
                title: 'Infinite Canvas',
                desc: 'Drag, reorder, and restructure scenes on a visual canvas. See your entire story at once. Rearrange freely.',
              },
              {
                icon: <FileText size={22} />,
                title: 'Master Script Export',
                desc: 'Compile all scenes into a single, formatted master script document. Ready for production. One click.',
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                className={`landing__feature-card ${feature.accent ? 'landing__feature-card--accent' : ''}`}
                variants={fadeUp}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileInView="visible"
                initial="hidden"
                viewport={{ once: true, margin: "-40px" }}
              >
                <div className={`landing__feature-icon ${feature.accent ? 'landing__feature-icon--accent' : ''}`}>
                  {feature.icon}
                </div>
                <h3 className="landing__feature-title">{feature.title}</h3>
                <p className="landing__feature-desc">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ─── How It Works — progressive disclosure ─── */}
      <section className="landing__section">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
        >
          <motion.p className="landing__kicker" variants={fadeUp} transition={{ duration: 0.5 }}>
            How it works
          </motion.p>
          <motion.h2 className="landing__section-title" variants={fadeUp} transition={{ duration: 0.5 }}>
            Three steps. That's it.
          </motion.h2>

          <div className="landing__steps">
            {[
              {
                num: '1',
                title: 'Create a project',
                desc: 'Give your screenplay a name and start with a blank canvas. No templates, no restrictions — just you and your story.',
              },
              {
                num: '2',
                title: 'Write scenes with AI',
                desc: 'Describe what happens in each scene. The AI drafts it in proper industry format — sluglines, action lines, dialogue, parentheticals.',
              },
              {
                num: '3',
                title: 'Export your master script',
                desc: 'One click compiles every scene into a single production-ready screenplay document. Share it. Submit it. Ship it.',
              },
            ].map((step, i) => (
              <motion.div
                key={step.num}
                className="landing__step"
                variants={fadeUp}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                whileInView="visible"
                initial="hidden"
                viewport={{ once: true, margin: "-40px" }}
              >
                <div className="landing__step-number">{step.num}</div>
                <div className="landing__step-content">
                  <h3 className="landing__step-title">{step.title}</h3>
                  <p className="landing__step-desc">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ─── Product Truth — genuine metrics ─── */}
      <section className="landing__section">
        <motion.div
          className="landing__metrics"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={staggerFast}
        >
          {[
            { value: 100, suffix: '%', label: 'Free to use' },
            { value: 60, suffix: 's', label: 'To get started' },
            { value: 0, suffix: '', label: 'Credit cards required', display: 'Zero' },
          ].map((metric) => (
            <motion.div key={metric.label} className="landing__metric" variants={fadeUp} transition={{ duration: 0.5 }}>
              <span className="landing__metric-value">
                {metric.display || <AnimatedNumber value={metric.value} suffix={metric.suffix} />}
              </span>
              <span className="landing__metric-label">{metric.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="landing__close">
        <motion.div
          className="landing__close-card"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="landing__close-brand">
            <div className="landing__hero-brand-icon">
              <PenTool size={16} strokeWidth={2.5} />
            </div>
          </div>
          <h2 className="landing__close-headline">
            Your screenplay starts with a blank page.<br />
            We'll help you fill it.
          </h2>
          <p className="landing__close-sub">
            Free to use. No credit card. No strings attached.
          </p>
          <Link to={isAuthenticated ? "/dashboard" : "/register"} className="landing__cta-primary landing__cta-primary--hero focus-ring">
            {isAuthenticated ? "Go to App" : "Create your free account"}
            <ArrowRight size={18} />
          </Link>
          {!isAuthenticated && (
            <p className="landing__close-link">
              Already have an account?{' '}
              <Link to="/login">Sign in</Link>
            </p>
          )}
        </motion.div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="landing__footer">
        <div className="landing__footer-brand">
          <span className="landing__brand-lipi" style={{ fontSize: '1.1rem' }}>Lipi</span>
          <span className="landing__brand-studio" style={{ fontSize: '0.6rem' }}>Studio</span>
        </div>
        <p className="landing__footer-copy">© 2026 Lipi Studio. All rights reserved.</p>
        <p className="landing__footer-domain">lipistudio.me</p>
      </footer>
    </div>
  );
}

export default LandingPage;
