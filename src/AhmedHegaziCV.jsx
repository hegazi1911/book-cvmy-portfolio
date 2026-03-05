import { useState, useEffect, useRef, useCallback, forwardRef } from "react";
import HTMLFlipBook from "react-pageflip";

// ═══════════════════════════════════════════════════════════════════════════════
// SOUND ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
function createPageFlipSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    return async () => {
      if (ctx.state === "suspended") await ctx.resume();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / ctx.sampleRate, env = Math.exp(-t * 28);
        data[i] = (Math.random() * 2 - 1) * env * 0.55
          + Math.sin(2 * Math.PI * 320 * t) * env * 0.18
          + Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 18) * 0.12;
      }
      const src = ctx.createBufferSource(); src.buffer = buf;
      const gain = ctx.createGain(); gain.gain.value = 0.55;
      src.connect(gain); gain.connect(ctx.destination); src.start();
    };
  } catch { return () => Promise.resolve(); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED UI ATOMS
// ═══════════════════════════════════════════════════════════════════════════════
const inkLines = Array.from({ length: 18 }, (_, i) => i);

function PageDecor({ side = "left" }) {
  return (
    <div aria-hidden="true" style={{
      position: "absolute", top: 0, bottom: 0, [side]: 0, width: 32,
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "space-evenly", opacity: 0.11, pointerEvents: "none",
    }}>
      {inkLines.map(i => (
        <div key={i} style={{ width: 2, height: 16 + (i % 3) * 5, background: "#2d1a0e", borderRadius: 2 }} />
      ))}
    </div>
  );
}

function Para({ children, style }) {
  return <p style={{ fontFamily: "Georgia,serif", fontSize: 13.5, color: "#2d1a0e", lineHeight: 1.9, marginBottom: 14, ...style }}>{children}</p>;
}
function Highlight({ children }) {
  return <span style={{ background: "linear-gradient(180deg,transparent 58%,rgba(212,160,23,.38) 58%)", fontWeight: 600 }}>{children}</span>;
}
function Tag({ children, color = "#6c3fff" }) {
  return (
    <span style={{
      display: "inline-block", padding: "3px 9px", borderRadius: 20,
      background: `${color}18`, border: `1px solid ${color}50`,
      fontFamily: "monospace", fontSize: 10.5, color, marginRight: 5, marginBottom: 5
    }}>
      {children}
    </span>
  );
}
function TimelineItem({ year, title, desc }) {
  return (
    <div style={{ display: "flex", gap: 14, marginBottom: 18 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div aria-hidden="true" style={{ width: 9, height: 9, borderRadius: "50%", background: "#6c3fff", flexShrink: 0, marginTop: 3 }} />
        <div aria-hidden="true" style={{ width: 1, flex: 1, background: "rgba(108,63,255,.2)", marginTop: 3 }} />
      </div>
      <div>
        <div style={{ fontFamily: "monospace", fontSize: 9.5, color: "#9b7a4a", letterSpacing: 1 }}>{year}</div>
        <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 13.5, fontWeight: 700, color: "#1a0a2e", marginBottom: 3 }}>{title}</div>
        <div style={{ fontFamily: "Georgia,serif", fontSize: 11.5, color: "#5a3e28", lineHeight: 1.65 }}>{desc}</div>
      </div>
    </div>
  );
}
function ProjectCard({ name, emoji, desc, tags }) {
  return (
    <article style={{ background: "linear-gradient(135deg,#fdf6ee,#f5e8d0)", border: "1px solid rgba(45,26,14,.14)", borderRadius: 9, padding: "12px 14px", marginBottom: 12, boxShadow: "2px 3px 10px rgba(45,26,14,.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
        <span aria-hidden="true" style={{ fontSize: 18 }}>{emoji}</span>
        <span style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 14, fontWeight: 700, color: "#1a0a2e" }}>{name}</span>
      </div>
      <p style={{ fontFamily: "Georgia,serif", fontSize: 11.5, color: "#5a3e28", lineHeight: 1.65, marginBottom: 7 }}>{desc}</p>
      <div>{tags.map(t => <Tag key={t}>{t}</Tag>)}</div>
    </article>
  );
}
function SkillBar({ skill, level, color, animate }) {
  return (
    <div style={{ marginBottom: 11 }} role="meter" aria-valuenow={level} aria-valuemin={0} aria-valuemax={100} aria-label={`${skill}: ${level}%`}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontFamily: "Georgia,serif", fontSize: 11.5, color: "#2d1a0e" }}>{skill}</span>
        <span style={{ fontFamily: "monospace", fontSize: 9.5, color: "#9b7a4a" }} aria-hidden="true">{level}%</span>
      </div>
      <div style={{ height: 5, background: "rgba(45,26,14,.1)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ width: animate ? `${level}%` : "0%", height: "100%", background: `linear-gradient(90deg,${color},${color}cc)`, borderRadius: 10, transition: "width 1.4s cubic-bezier(.4,0,.2,1)" }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORY PAGE SHELL  (used by all inner pages)
// ═══════════════════════════════════════════════════════════════════════════════
function StoryPage({ chapter, title, subtitle, children }) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#fdf6ee", position: "relative", overflow: "hidden", boxSizing: "border-box" }}>
      <PageDecor side="left" />
      <PageDecor side="right" />
      <div style={{ padding: "16px 46px 0", borderBottom: "1px solid rgba(45,26,14,.12)", paddingBottom: 12 }}>
        <div style={{ fontFamily: "Georgia,serif", fontSize: 9.5, letterSpacing: 3, color: "#9b7a4a", textTransform: "uppercase" }}>
          Chapter {chapter} · {subtitle}
        </div>
        <h2 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 20, fontWeight: 700, color: "#1a0a2e", margin: "3px 0 0" }}>{title}</h2>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 46px 24px" }}>{children}</div>
      <div aria-hidden="true" style={{ padding: "0 46px 14px", borderTop: "1px solid rgba(45,26,14,.09)" }}>
        <div style={{ fontFamily: "Georgia,serif", fontSize: 8.5, color: "#c8a97e", letterSpacing: 2, textAlign: "center", paddingTop: 9 }}>
          ✦ Ahmed Hegazi · Flutter Developer ✦
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE COMPONENTS  — each wrapped in forwardRef (react-pageflip requires it)
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// SMOOTH TYPING COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function SmoothTyping({ text, speed = 50, delay = 0, style }) {
  const [displayedText, setDisplayedText] = useState("");
  const [started, setStarted] = useState(false);
  const [showCursor, setShowCursor] = useState(true);

  // Blinking cursor effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 500);
    return () => clearInterval(cursorInterval);
  }, []);

  // Typing effect
  useEffect(() => {
    let timeoutId;

    // Handle initial delay
    if (!started) {
      timeoutId = setTimeout(() => setStarted(true), delay);
      return () => clearTimeout(timeoutId);
    }

    // Handle typing
    if (displayedText.length < text.length) {
      timeoutId = setTimeout(() => {
        setDisplayedText(text.slice(0, displayedText.length + 1));
      }, speed);
    }

    return () => clearTimeout(timeoutId);
  }, [displayedText, text, speed, delay, started]);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        opacity: started ? 1 : 0,
        transition: "opacity 0.6s ease-in-out",
        ...style,
      }}
    >
      {displayedText}
      <span
        style={{
          opacity: showCursor ? 1 : 0,
          transition: "opacity 0.1s",
          marginLeft: "2px",
          fontWeight: "normal",
        }}
      >
        |
      </span>
    </span>
  );
}

// ── Cover ─────────────────────────────────────────────────────────────────────

const CoverPage = forwardRef(function CoverPage(_, ref) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 500);
  }, []);

  return (
    <div ref={ref}>
      <div
        style={{
          width: "100%",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 30% 20%, #1e293b 0%, #0f172a 40%, #020617 100%)",
          position: "relative",
          overflow: "hidden",
          color: "#fff",
          fontFamily: "Georgia, serif",
        }}
      >
        {/* Floating Light Effect */}
        <div
          style={{
            position: "absolute",
            width: 600,
            height: 600,
            background:
              "radial-gradient(circle, rgba(59,130,246,0.15), transparent 70%)",
            animation: "floatLight 12s ease-in-out infinite alternate",
          }}
        />

        {/* Main Content */}
        <div
          style={{
            textAlign: "center",
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(30px)",
            transition: "all 1.5s ease",
            padding: 40,
            backdropFilter: "blur(6px)",
          }}
        >
          <p
            style={{
              letterSpacing: 6,
              fontSize: 12,
              textTransform: "uppercase",
              color: "#94a3b8",
              marginBottom: 20,
            }}
          >
            A Developer’s Journey
          </p>

          <h1
            style={{
              fontSize: "clamp(32px, 8vw, 52px)",
              margin: "0 0 15px",
              fontWeight: 700,
              background: "linear-gradient(90deg,#60a5fa,#a78bfa,#facc15)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            <SmoothTyping
              text="The Story of Ahmed Hegazi"
              speed={60}
              delay={2000}
            />
          </h1>

          <p
            style={{
              fontSize: 16,
              color: "#cbd5e1",
              marginBottom: 40,
              maxWidth: 500,
              marginInline: "auto",
              lineHeight: 1.7,
            }}
          >
            From curiosity to creation — building digital experiences,
            crafting mobile applications, and turning ideas into reality.
          </p>

          <div
            style={{
              width: 120,
              height: 2,
              margin: "0 auto",
              background:
                "linear-gradient(90deg, transparent, #facc15, transparent)",
            }}
          />
        </div>

        {/* Animations */}
        <style>
          {`
            @keyframes floatLight {
              0% { transform: translate(-50px, -50px); }
              100% { transform: translate(50px, 50px); }
            }
          `}
        </style>
      </div>
    </div>
  );
});



// ── Beginning ─────────────────────────────────────────────────────────────────
const BeginningPage = forwardRef(function BeginningPage(_, ref) {
  return (
    <div ref={ref} style={{ width: "100%", height: "100%", boxSizing: "border-box" }}>
      <StoryPage chapter={1} title="The Beginning" subtitle="Where it all started">
        <Para>My name is <Highlight>Ahmed Mohamed Eslaeid Hegazi</Highlight>, a graduate of <Highlight>Geographic Information Systems (GIS)</Highlight> — a field miles away from what I do today.</Para>
        <Para>When I first held my degree, I stared at a world of satellite maps and spatial data. It was fascinating, but something deeper called out — the desire to <Highlight>build things people could touch and use</Highlight>.</Para>
        <Para>That restlessness led me to a screen, a keyboard, and a question I'd ask every night: <em>"What if I could create apps that millions carry in their pockets?"</em></Para>
        <Para>That question changed everything. I didn't wait for a perfect moment. I opened my laptop and began rewriting my story from scratch.</Para>
        <Para style={{ color: "#9b7a4a", fontStyle: "italic", borderLeft: "3px solid #d4a017", paddingLeft: 12 }}>"The journey of a thousand apps begins with a single line of code."</Para>
      </StoryPage>
    </div>
  );
});

// ── First Steps ───────────────────────────────────────────────────────────────
const FirstStepsPage = forwardRef(function FirstStepsPage(_, ref) {
  return (
    <div ref={ref} style={{ width: "100%", height: "100%", boxSizing: "border-box" }}>
      <StoryPage chapter={2} title="The First Steps" subtitle="Laying the foundation">
        <Para>Learning didn't come with a roadmap. It came with <Highlight>scholarships, late nights, and relentless curiosity</Highlight>.</Para>
        <TimelineItem year="NTI · Web Development" title="Ministry of Communications Scholarship" desc="My first structured exposure to software. HTML, CSS, JavaScript — I learned to think in layers, structure, and logic." />
        <TimelineItem year="Orange · Android Development" title="Orange Digital Center Scholarship" desc="Dove deep into mobile. Java, XML, Android SDK. I built my first real app and felt the magic of holding it in my hands." />
        <TimelineItem year="Udemy · Flutter & Dart" title="Self-Driven Deep Dive" desc="Consumed course after course. Not just watching — building, breaking, debugging, rebuilding. Every error was a lesson I earned." />
        <Para style={{ fontStyle: "italic", color: "#6c3fff" }}>Each course wasn't a certificate. It was a chapter in my becoming.</Para>
      </StoryPage>
    </div>
  );
});

// ── Choosing Flutter ──────────────────────────────────────────────────────────
const FlutterPage = forwardRef(function FlutterPage(_, ref) {
  return (
    <div ref={ref} style={{ width: "100%", height: "100%", boxSizing: "border-box" }}>
      <StoryPage chapter={3} title="Choosing Flutter" subtitle="Finding my language">
        <Para>After exploring Web and Android, I stood at a crossroads. Then <Highlight>Flutter walked in</Highlight> — and I haven't looked back since.</Para>
        <Para>What drew me wasn't just the beautiful UI or the single codebase. It was the <Highlight>philosophy</Highlight> — craft pixel-perfect, performant experiences with elegant, expressive code.</Para>
        <Para>I fell in love with <Highlight>Dart's clean syntax</Highlight>, Flutter's widget tree, the way I could see my imagination rendered on screen within seconds.</Para>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
          {["Flutter", "Dart", "Bloc & Cubit", "Firebase", "REST APIs", "Clean Architecture"].map(t => <Tag key={t} color="#6c3fff">{t}</Tag>)}
        </div>
        <Para>Flutter didn't just become my tool. It became my <Highlight>creative language</Highlight> — the way I express ideas, solve problems, and deliver value.</Para>
      </StoryPage>
    </div>
  );
});

// ── Experience ────────────────────────────────────────────────────────────────
const ExperiencePage = forwardRef(function ExperiencePage(_, ref) {
  const Section = ({ company, role, period, location, color, children, links }) => (
    <div
      style={{
        background: `${color}08`,
        border: `1px solid ${color}33`,
        borderRadius: 10,
        padding: "16px 18px",
        marginBottom: 18,
      }}
    >
      <h3
        style={{
          fontFamily: "'Playfair Display',Georgia,serif",
          fontSize: 15,
          fontWeight: 700,
          marginBottom: 4,
          color: "#1a0a2e",
        }}
      >
        🏢 {company}
      </h3>

      <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
        {role} | {period} | {location}
      </p>

      <div style={{ fontSize: 12, lineHeight: 1.6 }}>
        {children}
      </div>

      {links && (
        <div style={{ marginTop: 10 }}>
          <strong style={{ fontSize: 12, opacity: 0.85 }}>Apps / Downloads:</strong>
          <ul style={{ marginTop: 6, paddingLeft: 16, fontSize: 11 }}>
            {links.map((link) => (
              <li key={link.label} style={{ marginBottom: 4 }}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: color, textDecoration: "underline", fontWeight: 500 }}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <div ref={ref} style={{ width: "100%", height: "100%", boxSizing: "border-box" }}>
      <StoryPage chapter={4} title="Professional Experience" subtitle="Where theory met production">
        <Para>
          Books teach you to code. <Highlight>Production teaches you responsibility.</Highlight>
        </Para>

        {/* ROOT SOFT */}
        <Section
          company="Root Soft"
          role="Flutter Developer Intern"
          period="Jan 2024 – Jun 2024"
          location="Alexandria"
          color="#2d7a4a"
          links={[
            { label: "ElKhatma (Google Play)", url: "https://play.google.com/store/apps/details?id=dev.rootsoft.khatma" },
            { label: "Cliques (Google Play)", url: "https://play.google.com/store/apps/details?id=dev.rootsoft.cliques" },
          ]}
        >
          <ul>
            <li>Developed features for production Flutter apps using modular architecture.</li>
            <li>Implemented state management with <Highlight>Riverpod</Highlight>.</li>
            <li>Integrated RESTful APIs and handled async data streams.</li>
            <li>Managed Firebase (Firestore, Auth).</li>
            <li>Collaborated with backend & design teams.</li>
            <li>Fixed bugs and optimized performance.</li>
          </ul>
        </Section>

        {/* KAMN */}
        <Section
          company="Kamn"
          role="Flutter Developer"
          period="Jul 2024 – Jun 2025"
          location="Alexandria"
          color="#3f6cff"
        >
          <ul>
            <li>Built real-time chat module using Firebase.</li>
            <li>Implemented scalable state management with <Highlight>Cubit</Highlight>.</li>
            <li>Designed state flows for real-time updates & sync.</li>
            <li>Integrated Firebase services (Firestore, Auth, FCM).</li>
            <li>Developed full e-commerce module (products, cart, checkout).</li>
          </ul>
        </Section>

        {/* MOTOFIX */}
        <Section
          company="Motofix"
          role="Flutter Developer"
          period="Jul 2025 – Present"
          location="Remote"
          color="#b06fff"
          links={[
            { label: "Motofix (Google Play)", url: "https://play.google.com/store/apps/details?id=com.app.moto.fix" },
            { label: "Motofix (App Store)", url: "https://apps.apple.com/eg/app/moto-fix/id6478346391" },
            { label: "VW Garage (Google Play)", url: "https://play.google.com/store/apps/details?id=com.vwgarage.app" },
            { label: "VW Garage (App Store)", url: "https://apps.apple.com/us/app/vw-garage-service-center/id6756304877" },
          ]}
        >
          <ul>
            <li>Developed modules using <Highlight>BLoC</Highlight> architecture.</li>
            <li>Built real-time chat support system.</li>
            <li>Implemented SOS emergency assistance feature.</li>
            <li>Designed dynamic service packages & pricing logic.</li>
            <li>Developed cart system with multi-service booking.</li>
            <li>Built vehicle management (VIN, license templates).</li>
            <li>Implemented quotation & invoice PDF generation.</li>
            <li>Delivered customized white-label client variant.</li>
          </ul>
        </Section>

      </StoryPage>
    </div>
  );
});

// ── Projects ──────────────────────────────────────────────────────────────────
const ProjectsPage = forwardRef(function ProjectsPage(_, ref) {

  const ProjectCard = ({ name, emoji, desc, tags, links }) => (
    <div
      style={{
        background: "linear-gradient(135deg,#ffffff,#f8f9ff)",
        border: "1px solid rgba(0,0,0,.06)",
        borderRadius: 12,
        padding: "16px 18px",
        marginBottom: 18,
        boxShadow: "0 6px 18px rgba(0,0,0,.04)",
      }}
    >
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
        {emoji} {name}
      </h3>

      <Para style={{ fontSize: 12, marginBottom: 10 }}>
        {desc}
      </Para>

      <div style={{ marginBottom: 10 }}>
        {tags.map((t) => (
          <Tag key={t} color="#3f6cff">{t}</Tag>
        ))}
      </div>

      {links && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {links.map((link) => (
            <a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 11,
                padding: "6px 10px",
                borderRadius: 6,
                textDecoration: "none",
                background: "#0f172a",
                color: "#fff",
                transition: "0.3s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = 0.8)}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = 1)}
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div ref={ref} style={{ width: "100%", height: "100%", boxSizing: "border-box" }}>
      <StoryPage chapter={5} title="My Projects" subtitle="Ideas turned into reality">

        <Para>
          Every project carries a story — a problem I saw, a solution I built, a lesson I learned.
        </Para>

        {/* Gawla */}
        <ProjectCard
          name="Gawla · جولة"
          emoji="🗺️"
          desc="A smart tourism app connecting travelers with local experiences. Where GIS met Flutter."
          tags={["Flutter", "Firebase", "Google Maps", "Bloc"]}
        />

        {/* Kamn */}
        <ProjectCard
          name="Kamn"
          emoji="🛒"
          desc="A production e-commerce app with chat, product management, and real-time cart flows."
          tags={["Flutter", "Cubit", "Firebase", "E-commerce"]}
        />



        {/* El Khatema */}
        <ProjectCard
          name="ElKhatma · الخاتمة"
          emoji="📿"
          desc="Islamic daily tracker with Quran recitation, Adhkar and prayer tracking."
          tags={["Flutter", "Hive", "Notifications"]}
          links={[
            {
              label: "Google Play",
              url: "https://play.google.com/store/apps/details?id=dev.rootsoft.khatma"
            }
          ]}
        />

        {/* Cliques */}
        <ProjectCard
          name="Cliques"
          emoji="�"
          desc="Community-based social app built for engagement and group interaction."
          tags={["Flutter", "Firebase", "Social App"]}
          links={[
            {
              label: "Google Play",
              url: "https://play.google.com/store/apps/details?id=dev.rootsoft.cliques"
            }
          ]}
        />

        {/* Motofix */}
        <ProjectCard
          name="Motofix"
          emoji="🚗"
          desc="Car care companion app with booking system, chat, dynamic pricing and service flows."
          tags={["Flutter", "BLoC", "Firebase", "White Label"]}
          links={[
            {
              label: "Google Play",
              url: "https://play.google.com/store/apps/details?id=com.app.moto.fix"
            },
            {
              label: "App Store",
              url: "https://apps.apple.com/eg/app/moto-fix/id6478346391"
            }
          ]}
        />

        {/* VW Garage */}
        <ProjectCard
          name="VW Garage"
          emoji="🏎️"
          desc="White-label variant of MotoFix tailored for Volkswagen service operations."
          tags={["Flutter", "White Labeling", "BLoC", "Firebase"]}
          links={[
            {
              label: "Google Play",
              url: "https://play.google.com/store/apps/details?id=com.vwgarage.app"
            },
            {
              label: "App Store",
              url: "https://apps.apple.com/us/app/vw-garage-service-center/id6756304877"
            }
          ]}
        />

      </StoryPage>
    </div>
  );
});

// ── Skills ────────────────────────────────────────────────────────────────────
const SkillsPage = forwardRef(function SkillsPage({ isActive }, ref) {
  return (
    <div ref={ref} style={{ width: "100%", height: "100%", boxSizing: "border-box" }}>
      <StoryPage chapter={6} title="My Skills" subtitle="The tools of my craft">
        <Para>Skills aren't a list. They're a story of battles fought and won over time.</Para>
        <Para style={{ fontStyle: "italic", fontSize: 12, color: "#6c3fff", borderLeft: "3px solid #6c3fff", paddingLeft: 12, marginBottom: 18 }}>
          "Over time, I mastered state management using Bloc &amp; Cubit, built scalable Firebase backends, and implemented clean architecture that makes code a pleasure to maintain."
        </Para>
        <SkillBar skill="Flutter & Dart" level={88} color="#6c3fff" animate={isActive} />
        <SkillBar skill="Bloc / Cubit (State Mgmt)" level={82} color="#3f6cff" animate={isActive} />
        <SkillBar skill="Firebase (Auth, Firestore, Storage)" level={78} color="#d4a017" animate={isActive} />
        <SkillBar skill="REST API Integration" level={80} color="#2d7a4a" animate={isActive} />
        <SkillBar skill="Clean Architecture" level={75} color="#b06fff" animate={isActive} />
        <SkillBar skill="Git & Version Control" level={72} color="#9b4a4a" animate={isActive} />
        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap" }}>
          {["Hive", "Dio", "GetIt", "Retrofit", "Google Maps", "FCM", "Animations", "Responsive UI"].map(t => <Tag key={t} color="#9b7a4a">{t}</Tag>)}
        </div>
      </StoryPage>
    </div>
  );
});

// ── Future ────────────────────────────────────────────────────────────────────
const FuturePage = forwardRef(function FuturePage(_, ref) {
  return (
    <div ref={ref} style={{ width: "100%", height: "100%", boxSizing: "border-box" }}>
      <StoryPage chapter={7} title="The Future" subtitle="Where this story goes next">
        <Para>I've walked from GIS maps to Flutter apps. But the journey isn't close to over.</Para>
        <Para>In the next <Highlight>3 years</Highlight>, I see myself as a <Highlight>Senior Flutter Developer</Highlight> who doesn't just write code — but architects experiences, mentors juniors, and ships products that matter.</Para>
        <Para>I want to contribute to <Highlight>open-source Flutter packages</Highlight>, build tools that developers love, and eventually lead a mobile team that ships with both speed and quality.</Para>
        <Para style={{ borderLeft: "3px solid #d4a017", paddingLeft: 12, fontStyle: "italic", color: "#9b7a4a" }}>
          "The best Flutter developer I've ever met hasn't reached his peak yet. That person is me — three years from today."
        </Para>
        <div style={{ marginTop: 18, padding: 14, background: "linear-gradient(135deg,#1a0a2e0a,#6c3fff0a)", borderRadius: 9, border: "1px solid rgba(108,63,255,.15)" }}>
          <p style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 12.5, fontWeight: 700, color: "#1a0a2e", marginBottom: 9 }}>Let's build something together</p>
          <a href="https://github.com/hegazi1911" target="_blank" rel="noreferrer" aria-label="GitHub: hegazi1911" style={{ display: "block", fontFamily: "monospace", fontSize: 11, color: "#6c3fff", marginBottom: 4, textDecoration: "none" }}>⌥ github.com/hegazi1911</a>
          <a href="https://www.linkedin.com/in/hegazi97/" target="_blank" rel="noreferrer" aria-label="LinkedIn: hegazi97" style={{ display: "block", fontFamily: "monospace", fontSize: 11, color: "#d4a017", textDecoration: "none" }}>⌥ linkedin.com/in/hegazi97</a>
        </div>
      </StoryPage>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// PDF GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════════
// CHAPTERS META
// ═══════════════════════════════════════════════════════════════════════════════
const chapters = [
  { id: 0, label: "Cover", icon: "📖" },
  { id: 1, label: "Beginning", icon: "🌱" },
  { id: 2, label: "First Steps", icon: "👣" },
  { id: 3, label: "Flutter", icon: "💙" },
  { id: 4, label: "Experience", icon: "🏢" },
  { id: 5, label: "Projects", icon: "🚀" },
  { id: 6, label: "Skills", icon: "⚡" },
  { id: 7, label: "Future", icon: "🌟" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function BookCV() {
  const bookRef = useRef(null);
  const soundRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [kbHint, setKbHint] = useState(true);
  const [skillsActive, setSkillsActive] = useState(false);

  useEffect(() => {
    soundRef.current = createPageFlipSound();
    const t = setTimeout(() => setKbHint(false), 4500);
    return () => clearTimeout(t);
  }, []);

  // ── react-pageflip callbacks ───────────────────────────────────────────────
  const onFlip = useCallback((e) => {
    soundRef.current?.();
    const p = e.data;
    setCurrentPage(p);
    setSkillsActive(p === 6);
    setKbHint(false);
  }, []);

  const onInit = useCallback((e) => {
    setTotalPages(e.object.getPageCount());
  }, []);

  // ── Navigation helpers ────────────────────────────────────────────────────
  const goNext = useCallback(() => bookRef.current?.pageFlip().flipNext(), []);
  const goPrev = useCallback(() => bookRef.current?.pageFlip().flipPrev(), []);
  const goTo = useCallback((idx) => {
    if (idx === currentPage) return;
    bookRef.current?.pageFlip().flip(idx);
  }, [currentPage]);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  const canPrev = currentPage > 0;
  const canNext = totalPages === 0 || currentPage < totalPages - 1;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg,#0d0820 0%,#1a0a2e 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "20px 12px", fontFamily: "Georgia,serif",
      userSelect: "none"
    }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');
        
        @keyframes twinkle {
          0% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 0.4; }
        }
        
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        
        @keyframes pulseGlow {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1.4); opacity: 0; }
        }

        /* react-pageflip injects .stf__parent — add book shadow here */
        .stf__parent { 
          filter: drop-shadow(0 20px 50px rgba(0,0,0,0.8)); 
        }
        
        /* The book spine line */
        .stf__block { 
          background: #fdf6ee; 
          box-shadow: inset 0 0 15px rgba(0,0,0,0.05);
        }
        
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(108,63,255,0.3); border-radius: 2px; }
        
        button:hover:not(:disabled) { filter: brightness(1.2); transform: scale(1.02); }
        button:active:not(:disabled) { transform: scale(0.98); }
        
        .nav-btn:focus-visible { outline: 2px solid #d4a017; outline-offset: 3px; border-radius: 24px; }
        .ch-btn:focus-visible { outline: 2px solid #d4a017; outline-offset: 2px; border-radius: 20px; }
      `}</style>

      {/* Screen-reader live region */}
      <div aria-live="polite" aria-atomic="true" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap" }}>
        {`Page ${currentPage + 1} of ${totalPages || 8}: ${chapters[currentPage]?.label ?? ""}`}
      </div>

      {/* Header */}
      <p aria-hidden="true" style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 12.5, color: "#d4a017", letterSpacing: 4, marginBottom: 14, textTransform: "uppercase", opacity: .8, animation: "fadeUp .6s ease" }}>
        ✦ Interactive CV · Ahmed Hegazi ✦
      </p>

      {/* Keyboard / swipe hint */}
      {kbHint && (
        <div role="status" style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: "rgba(30,10,50,.88)", border: "1px solid rgba(212,160,23,.3)", borderRadius: 24, padding: "7px 18px", fontSize: 11, color: "rgba(255,255,255,.6)", letterSpacing: 1, backdropFilter: "blur(8px)", zIndex: 100, animation: "fadeUp .6s ease", whiteSpace: "nowrap" }}>
          ← → arrow keys · drag pages · swipe on mobile
        </div>
      )}

      {/* ── THE FLIPBOOK ── */}
      <div style={{ animation: "fadeUp .7s ease" }}>
        <HTMLFlipBook
          ref={bookRef}
          width={380}
          height={560}
          size="fixed"
          minWidth={280}
          maxWidth={500}
          minHeight={400}
          maxHeight={700}
          showCover={true}
          mobileScrollSupport={true}
          flippingTime={700}
          usePortrait={true}
          startPage={0}
          drawShadow={true}
          useMouseEvents={true}
          swipeDistance={30}
          clickEventForward={false}
          onFlip={onFlip}
          onInit={onInit}
          className="flipbook"
          style={{ margin: "0 auto" }}
        >
          {/* react-pageflip needs direct children — each is a forwardRef component */}
          <CoverPage />
          <BeginningPage />
          <FirstStepsPage />
          <FlutterPage />
          <ExperiencePage />
          <ProjectsPage />
          <SkillsPage isActive={skillsActive} />
          <FuturePage />
        </HTMLFlipBook>
      </div>

      {/* Chapter nav */}
      <nav aria-label="Chapter navigation" style={{ display: "flex", gap: 5, marginTop: 16, flexWrap: "wrap", justifyContent: "center", maxWidth: 500, animation: "fadeUp .8s ease" }}>
        {chapters.map(ch => (
          <button key={ch.id} className="ch-btn" onClick={() => goTo(ch.id)}
            aria-label={`Go to chapter ${ch.id + 1}: ${ch.label}`}
            aria-current={currentPage === ch.id ? "page" : undefined}
            style={{
              padding: "5px 10px", borderRadius: 20,
              background: currentPage === ch.id ? "rgba(212,160,23,.9)" : "rgba(255,255,255,.08)",
              border: currentPage === ch.id ? "1px solid #d4a017" : "1px solid rgba(255,255,255,.12)",
              color: currentPage === ch.id ? "#1a0a2e" : "rgba(255,255,255,.5)",
              fontFamily: "Georgia,serif", fontSize: 10, cursor: currentPage === ch.id ? "default" : "pointer",
              transition: "all .2s ease", letterSpacing: .5
            }}>
            <span aria-hidden="true">{ch.icon}</span> {ch.label}
          </button>
        ))}
      </nav>

      {/* Prev / Next / PDF */}
      <div style={{ display: "flex", gap: 10, marginTop: 13, alignItems: "center", flexWrap: "wrap", justifyContent: "center", animation: "fadeUp .9s ease" }}>
        <button className="nav-btn" onClick={goPrev} disabled={!canPrev}
          aria-label="Previous page" aria-disabled={!canPrev}
          style={{
            padding: "8px 20px", borderRadius: 24,
            background: canPrev ? "rgba(108,63,255,.2)" : "rgba(255,255,255,.04)",
            border: "1px solid rgba(108,63,255,.3)",
            color: canPrev ? "#b06fff" : "rgba(255,255,255,.2)",
            fontFamily: "Georgia,serif", fontSize: 12,
            cursor: canPrev ? "pointer" : "default", transition: "all .2s"
          }}>
          ← Prev
        </button>

        <span aria-hidden="true" style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,.3)", minWidth: 38, textAlign: "center" }}>
          {currentPage + 1} / {totalPages || 8}
        </span>

        <button className="nav-btn" onClick={goNext} disabled={!canNext}
          aria-label="Next page" aria-disabled={!canNext}
          style={{
            padding: "8px 20px", borderRadius: 24,
            background: canNext ? "rgba(212,160,23,.2)" : "rgba(255,255,255,.04)",
            border: "1px solid rgba(212,160,23,.3)",
            color: canNext ? "#d4a017" : "rgba(255,255,255,.2)",
            fontFamily: "Georgia,serif", fontSize: 12,
            cursor: canNext ? "pointer" : "default", transition: "all .2s"
          }}>
          Next →
        </button>

        <button className="nav-btn" onClick={() => window.open("/Ahmed Hegazi - Flutter Developer.pdf", "_blank")}
          aria-label="Download classic CV as PDF"
          style={{
            padding: "8px 18px", borderRadius: 24,
            background: "rgba(45,122,74,.2)", border: "1px solid rgba(45,122,74,.4)",
            color: "#6dba8a", fontFamily: "Georgia,serif", fontSize: 11,
            cursor: "pointer", transition: "all .2s", display: "flex", alignItems: "center", gap: 6
          }}>
          ⬇ Download PDF
        </button>
      </div>
    </div>
  );
}
