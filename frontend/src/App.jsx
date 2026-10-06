import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Clock3,
  Landmark,
  Menu,
  MessageCircle,
  Scale,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";

const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const practiceAreas = [
  {
    number: "01",
    icon: Landmark,
    title: "Civil disputes",
    description:
      "Property, contract, and commercial disagreements approached with careful preparation.",
  },
  {
    number: "02",
    icon: ShieldCheck,
    title: "Family matters",
    description:
      "Clear guidance for family proceedings, with privacy and a measured approach in mind.",
  },
  {
    number: "03",
    icon: BriefcaseBusiness,
    title: "Business counsel",
    description:
      "Practical document review and dispute support for independent businesses.",
  },
];

const sampleMatters = [
  {
    category: "CIVIL · DEMO MATTER",
    title: "A property boundary resolved",
    result: "A fictional mediation agreement reached in 2023.",
  },
  {
    category: "COMMERCIAL · DEMO MATTER",
    title: "A contract dispute clarified",
    result: "A fictional payment schedule agreed before trial.",
  },
];

function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isWaitingForFirstToken, setIsWaitingForFirstToken] = useState(false);
  const messagesEnd = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  async function sendMessage(event) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || isSending) return;

    const conversation = [...messages, { role: "user", content: question }];
    setMessages(conversation);
    setDraft("");
    setIsSending(true);
    setIsWaitingForFirstToken(true);

    try {
      const response = await fetch(`${apiBase}/api/v1/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          history: messages.slice(-10),
          page_url: window.location.href,
        }),
      });
      if (!response.ok || !response.body) throw new Error("The assistant is unavailable.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      let done = false;

      while (!done) {
        const result = await reader.read();
        done = result.done;
        buffer += decoder.decode(result.value, { stream: !done });
        const events = buffer.split(/\r\n\r\n|\n\n|\r\r/);
        buffer = events.pop() || "";
        if (done && buffer) events.push(buffer);

        for (const event of events) {
          const dataLine = event.split(/\r\n|\n|\r/).find((line) => line.startsWith("data: "));
          if (!dataLine) continue;
          const data = JSON.parse(dataLine.slice(6));
          if (data.type === "error") throw new Error(data.message);
          if (data.type === "token") {
            answer += data.text;
            setIsWaitingForFirstToken(false);
            setMessages([...conversation, { role: "assistant", content: answer }]);
          }
        }
      }
      if (!answer) throw new Error("The assistant returned an empty answer.");
    } catch {
      setMessages([
        ...conversation,
        {
          role: "assistant",
          content: "I could not reach the assistant. Check that the API is running and configured.",
        },
      ]);
    } finally {
      setIsSending(false);
      setIsWaitingForFirstToken(false);
    }
  }

  return (
    <>
      {isOpen && (
        <section className="chat-panel" role="dialog" aria-label="Website assistant">
          <header className="chat-header">
            <div className="chat-avatar"><Scale size={18} aria-hidden="true" /></div>
            <div>
              <strong>Website assistant</strong>
              <span><i /> Demo profile information only</span>
            </div>
            <button className="icon-button close-chat" onClick={() => setIsOpen(false)} aria-label="Close chat">
              <X size={19} />
            </button>
          </header>
          <div className="chat-messages" aria-live="polite">
            {messages.length === 0 && (
              <div className="chat-welcome">
                <p className="message-label">TAIMOOR RAKI · DEMO</p>
                <p>Hello. What would you like to know about this profile?</p>
              </div>
            )}
            {messages.map((message, index) => (
              <div className={`chat-message ${message.role}`} key={`${index}-${message.role}`}>
                {message.content}
              </div>
            ))}
            {isWaitingForFirstToken && <div className="chat-message assistant typing">Looking through the website...</div>}
            <div ref={messagesEnd} />
          </div>
          <form className="chat-compose" onSubmit={sendMessage}>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about the profile"
              aria-label="Your question"
              maxLength={2000}
              disabled={isSending}
            />
            <button className="send-button" type="submit" aria-label="Send message" disabled={isSending || !draft.trim()}>
              <Send size={17} />
            </button>
          </form>
          <p className="chat-disclaimer">Fictional portfolio. Not legal advice.</p>
        </section>
      )}
      <button
        className={`chat-launcher ${isOpen ? "is-open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close website assistant" : "Open website assistant"}
        title="Website assistant"
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </>
  );
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <div className="demo-ribbon">
        <span>FICTIONAL DEMO</span>
        <p>All profile details and sample matters are invented for chatbot testing.</p>
      </div>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Taimoor Raki home">
          <span className="wordmark-mark">TR</span>
          <span>TAIMOOR RAKI<small>ADVOCATE · DEMO PROFILE</small></span>
        </a>
        <button className="mobile-menu icon-button" aria-label="Toggle navigation" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <nav className={menuOpen ? "nav-open" : ""} aria-label="Main navigation">
          <a href="#practice" onClick={() => setMenuOpen(false)}>Practice</a>
          <a href="#approach" onClick={() => setMenuOpen(false)}>Approach</a>
          <a href="#contact" onClick={() => setMenuOpen(false)}>Contact</a>
          <button className="nav-chat" onClick={() => document.querySelector(".chat-launcher")?.click()}>
            Ask a question <ArrowUpRight size={16} />
          </button>
        </nav>
      </header>

      <main id="top">
        <section className="hero section-wrap">
          <div className="hero-copy">
            <p className="eyebrow"><span /> ADVOCATE · KARACHI, PAKISTAN</p>
            <h1>Taimoor<br /><em>Raki.</em></h1>
            <p className="hero-lede">Thoughtful counsel.<br />A steadier way forward.</p>
            <p className="hero-note">A fictional portfolio profile created for testing a website-grounded assistant.</p>
            <a className="text-link" href="#practice">Explore practice areas <ArrowDownRight size={17} /></a>
          </div>
          <div className="portrait-frame">
            <img
              src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1100&q=85"
              alt="Portrait used as fictional demo profile imagery"
            />
            <div className="portrait-caption"><span>01 / 03</span><span>PROFILE IMAGE · DEMO</span></div>
            <div className="portrait-stamp"><Scale size={22} /><span>Clear thinking<br />in difficult moments</span></div>
          </div>
          <div className="hero-index"><span>INDEPENDENT LEGAL PRACTICE</span><span>SCROLL TO EXPLORE ↓</span></div>
        </section>

        <section className="facts-strip" aria-label="Profile details">
          <div><span className="fact-icon"><Clock3 size={19} /></span><p><small>EXPERIENCE</small><strong>Since 2014 <i>· fictional</i></strong></p></div>
          <div><span className="fact-icon"><Landmark size={19} /></span><p><small>BASED IN</small><strong>Karachi, Pakistan</strong></p></div>
          <div><span className="fact-icon"><Scale size={19} /></span><p><small>FOCUS</small><strong>Civil · Family · Business</strong></p></div>
        </section>

        <section className="practice-section section-wrap" id="practice">
          <div className="section-heading">
            <div><p className="eyebrow">01 — AREAS OF PRACTICE</p><h2>Good counsel starts<br />with <em>listening.</em></h2></div>
            <p className="section-intro">Every matter is different. This fictional profile reflects a measured, prepared approach across a small number of practice areas.</p>
          </div>
          <div className="practice-grid">
            {practiceAreas.map(({ number, icon: Icon, title, description }) => (
              <article className="practice-item" key={number}>
                <div className="practice-top"><span>{number}</span><Icon size={22} strokeWidth={1.6} /></div>
                <h3>{title}</h3>
                <p>{description}</p>
                <span className="item-rule" />
              </article>
            ))}
          </div>
        </section>

        <section className="approach-section" id="approach">
          <div className="approach-inner section-wrap">
            <div className="approach-mark"><Scale size={34} strokeWidth={1.4} /><span>THE<br />APPROACH</span></div>
            <div className="approach-copy">
              <p className="eyebrow">02 — HOW I WORK</p>
              <h2>Clarity before<br /><em>complexity.</em></h2>
              <p>Listen carefully. Explain the options plainly. Prepare each matter with care. That is the simple framework behind this fictional practice.</p>
              <div className="approach-values"><span>01 / Listen first</span><span>02 / Explain clearly</span><span>03 / Prepare thoroughly</span></div>
            </div>
            <div className="approach-aside"><span className="aside-line" /><p>“People deserve to understand their options before they make a decision.”</p><small>TAIMOOR RAKI · FICTIONAL PROFILE</small></div>
          </div>
        </section>

        <section className="matters-section section-wrap">
          <div className="section-heading matters-heading">
            <div><p className="eyebrow">03 — SELECTED MATTERS</p><h2>Work built on<br /><em>careful detail.</em></h2></div>
            <p className="section-intro">These invented examples are included so the chatbot has profile content to retrieve. They do not describe real clients or cases.</p>
          </div>
          <div className="matter-list">
            {sampleMatters.map((matter, index) => (
              <article className="matter-row" key={matter.title}>
                <span className="matter-number">0{index + 1}</span>
                <div><p className="matter-category">{matter.category}</p><h3>{matter.title}</h3></div>
                <p className="matter-result">{matter.result}</p>
                <ArrowUpRight className="matter-arrow" size={20} />
              </article>
            ))}
          </div>
        </section>

        <section className="contact-section" id="contact">
          <div className="contact-inner section-wrap">
            <div><p className="eyebrow">04 — CONTACT · DEMO DETAILS</p><h2>Start with a<br /><em>conversation.</em></h2></div>
            <div className="contact-details">
              <p>For this fictional profile, use the details below to test chatbot answers.</p>
              <a href="mailto:taimoor.raki@example.com">taimoor.raki@example.com <ArrowUpRight size={16} /></a>
              <span>Suite 402, Crescent Chambers<br />Shahrah-e-Faisal, Karachi, Pakistan</span>
              <span>Monday–Friday · 9:00 AM–5:00 PM PKT</span>
              <span>Consultation: PKR 5,000 for 30 minutes <i>(fictional)</i></span>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer section-wrap">
        <a className="wordmark footer-wordmark" href="#top"><span className="wordmark-mark">TR</span><span>TAIMOOR RAKI<small>FICTIONAL PORTFOLIO DEMO</small></span></a>
        <p>All profile information is invented. This page is not legal advice.</p>
        <a className="back-top" href="#top">BACK TO TOP ↑</a>
      </footer>
      <ChatAssistant />
    </>
  );
}

export default App;