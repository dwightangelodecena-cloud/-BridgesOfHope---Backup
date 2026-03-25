/**
 * GUIDE: landingpage.jsx
 * System Part: Public System Landing Page
 * 
 * This file supports the Public System Landing Page of the Bridges of Hope system.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Added for navigation
import { Phone, Globe, Smartphone, MapPin, Menu, X, Mail, Monitor } from 'lucide-react';
// Import Swiper components
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';

// Assets from your project folder
import logo from '@/assets/logo.png';
import heroImg from '@/assets/landingpage.png';
import gma from '@/assets/gmanewstv.png';
import tv5 from '@/assets/tv5.png';
import wsj from '@/assets/wsj.png';
import vice from '@/assets/vicenews.png';
import rappler from '@/assets/rappler.png';
import reaksyon from '@/assets/reaksyon.png';
import containerImg from '@/assets/Container.png';
import prog1 from '@/assets/landingpage1.png'; 
import prog2 from '@/assets/landingpage2.png';
import hopeLogo from '@/assets/hoperecoverylogo.png';

const LandingPage = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate(); // Hook to handle the redirection

  const partnerLinks = {
    [gma]: "https://bridgesofhope.com.ph/index.php/news-gma7s-brigada-features-bridges-of-hope-in-episode-on-alcoholism/",
    [tv5]: "https://bridgesofhope.com.ph/index.php/bridges-of-hope-program-director-gimo-gomez-on-tv5-the-evening-news/",
    [wsj]: "https://bridgesofhope.com.ph/index.php/wall-street-journals-trefor-moss-interviews-bridges-of-hope/",
    [vice]: "https://bridgesofhope.com.ph/index.php/vice-news-on-philippine-shabu-cartel/",
    [rappler]: "https://bridgesofhope.com.ph/index.php/rappler-goes-inside-bridges-of-hope/",
    [reaksyon]: "https://bridgesofhope.com.ph/index.php/program-director-gimo-gomez-appears-on-tv5-reaksyon/"
  };

  return (
    <div className="lp-wrapper">
      <style>{`
        /* 1. RESET STYLES */
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          overflow-x: hidden;
        }

        .lp-wrapper { 
          font-family: 'Inter', sans-serif; 
          color: #334155; 
          width: 100%;
          min-height: 100vh;
        }

        /* SWIPER PAGINATION COLOR */
        .swiper-pagination-bullet-active {
          background: #F54E25 !important;
        }

        .full-screen-section {
          width: 100vw;
          position: relative;
          left: 50%;
          right: 50%;
          margin-left: -50vw;
          margin-right: -50vw;
          display: flex;
          justify-content: center;
        }

        .content-limit {
          width: 80%;
          max-width: 1400px;
          margin: 0 auto;
        }

        .text-orange { color: #f24e1e; }
        
        /* 2. NAVIGATION */
        .nav-bar { 
          display: flex !important; 
          justify-content: space-between !important; 
          align-items: center !important; 
          padding: 0 10% !important;
          background: white !important;
          width: 100% !important;
          box-sizing: border-box !important;
          border-bottom: 1px solid #f1f5f9 !important;
          height: 100px !important; 
          position: sticky;
          top: 0;
          z-index: 1000;
        }

        .nav-links {
          display: flex !important;
          align-items: center !important;
          gap: 45px !important;
          position: absolute !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
        }

        .nav-links a { 
          text-decoration: none !important; 
          color: #475569 !important; 
          font-weight: 500 !important; 
          font-size: 1rem !important;
        }

        .login-btn { 
          background: #ff5733 !important; 
          color: white !important; 
          padding: 12px 35px !important; 
          border-radius: 12px !important; 
          border: none !important; 
          font-weight: 600 !important; 
          cursor: pointer !important; 
          white-space: nowrap !important;
        }

        .hamburger { 
          display: none; 
          background: none; 
          border: none; 
          cursor: pointer; 
          color: #334155; 
          position: relative;
          z-index: 5000 !important; 
        }

        /* 3. HERO */
        .hero { 
          position: relative; 
          height: 90vh; 
          display: flex; 
          align-items: center; 
          padding: 0 10%; 
          color: white;
          width: 100%;
          box-sizing: border-box;
        }
        .hero-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: -1; }
        .hero-content h1 { font-size: 5rem; line-height: 1.1; margin: 0; font-weight: 800; }
        .cta-btn { background: #f24e1e; color: white; padding: 18px 40px; border-radius: 8px; border: none; font-size: 1.2rem; font-weight: bold; margin-top: 30px; cursor: pointer; }

        /* 4. SLIDER SECTION */
        .programs-section { 
          padding: 100px 0; 
          text-align: center; 
          background: #fff; 
          width: 100vw;
          overflow: hidden; 
        }
        
        .slider-isolation-box {
          width: 90%; 
          max-width: 1600px; 
          margin: 0 auto;
          padding: 40px 0;
        }

        .program-card { 
          background: white; 
          border-radius: 30px; 
          border: 1px solid #eef2f6; 
          display: flex; 
          padding: 50px; 
          text-align: left; 
          gap: 40px; 
          box-shadow: 0 15px 40px rgba(0,0,0,0.06);
          height: 340px; 
          align-items: center;
          margin: 10px; 
          box-sizing: border-box;
        }

        .program-card img { 
          width: 260px; 
          height: 260px; 
          border-radius: 20px; 
          object-fit: cover; 
          flex-shrink: 0; 
        }

        .program-card h3 { color: #1e3a8a; margin: 0 0 15px 0; font-size: 2.2rem; font-weight: 700; }
        .program-card p { font-size: 1.2rem; color: #64748b; line-height: 1.7; }

        /* 5. FOOTER STYLES */
        .footer-cta-part {
          background: #1a2433;
          color: white;
          padding: 100px 0 80px 0;
          width: 100vw;
        }
        .footer-info-part {
          background: #161d29;
          color: white;
          padding: 60px 0 80px 0;
          width: 100vw;
        }
        .footer-cta-box {
          background: #f24e1e;
          border-radius: 10px;
          padding: 25px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 15px;
          font-weight: 600;
          font-size: 1.1rem;
          color: white;
          cursor: pointer;
          border: none;
          width: 100%;
        }
        .footer-contact-item {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 18px;
          color: #a0aec0;
          font-size: 1.1rem;
        }

        /* 6. MOBILE FIXES */
        @media (max-width: 1024px) {
          .hamburger { display: block !important; }
          .nav-links {
            position: fixed; top: 0; right: ${isMenuOpen ? '0' : '-100%'};
            height: 100vh; width: 80%; background: white;
            flex-direction: column !important; justify-content: center !important;
            transition: 0.3s ease-in-out; left: auto !important; transform: none !important;
            box-shadow: -10px 0 30px rgba(0,0,0,0.1);
            z-index: 4000 !important; 
          }
          
          .desktop-login { display: none !important; }
          .mobile-login { display: block !important; margin-top: 20px; }
          
          .hero-content h1 { font-size: 2.5rem !important; }
          .hero { height: 70vh; padding: 0 5%; justify-content: center; text-align: center; }

          .about-flex { flex-direction: column !important; padding: 60px 0 !important; gap: 40px !important; text-align: center; }
          .about-img { width: 300px !important; height: 300px !important; }
          .about-flex h2 { font-size: 2.2rem !important; }

          .program-card { flex-direction: column; height: auto; text-align: center; padding: 30px; gap: 20px; }
          .program-card img { width: 100%; height: 220px; }
          .program-card h3 { font-size: 1.8rem; }
          
          .cta-grid { grid-template-columns: 1fr !important; }
          .info-grid { grid-template-columns: 1fr !important; gap: 40px !important; text-align: center; }
          .footer-contact-item { justify-content: center; }
          .footer-info-part div { align-items: center !important; }
          
          .partners-grid { gap: 40px !important; padding: 40px 0 !important; }
          .partners-grid img { height: 40px !important; }
        }
        @media (min-width: 1025px) {
          .mobile-login { display: none !important; }
        }
      `}</style>

      {/* Nav */}
      <header className="nav-bar">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img src={logo} alt="Bridges of Hope" height="60" /> 
        </div>
        <nav className="nav-links">
          <a href="#" onClick={() => setIsMenuOpen(false)}>About Us</a>
          <a href="#" onClick={() => setIsMenuOpen(false)}>Programs</a>
          <a href="#" onClick={() => setIsMenuOpen(false)}>Testimonials</a>
          <a href="#" onClick={() => setIsMenuOpen(false)}>Contact</a>
          {/* Mobile login redirects to /login */}
          <button className="login-btn mobile-login" onClick={() => navigate('/login')}>Login</button>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* Desktop login redirects to /login */}
          <button className="login-btn desktop-login" onClick={() => navigate('/login')}>Login</button>
          <button className="hamburger" onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ marginLeft: '15px' }}>
            {isMenuOpen ? <X size={30} /> : <Menu size={30} />}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <img src={heroImg} className="hero-bg" alt="Hero Background" />
        <div className="hero-content">
          <h1>Start Your Journey to <br /><span className="text-orange">Recovery & Healing</span></h1>
          <button className="cta-btn" onClick={() => navigate('/login')}>Get Started Today →</button>
        </div>
      </section>

      {/* Partners */}
      <section className="partners-grid" style={{display:'flex', justifyContent:'center', gap:'200px', padding:'80px 0', flexWrap:'wrap'}}>
        {[gma, tv5, wsj, vice, rappler, reaksyon].map((img, i) => (
          <a key={i} href={partnerLinks[img]} target="_blank" rel="noopener noreferrer">
            <img src={img} height="75" style={{cursor:'pointer'}} alt="Partner Logo" />
          </a>
        ))}
      </section>

      {/* About */}
      <section className="full-screen-section" style={{background: '#fcfcfc'}}>
        <div className="content-limit about-flex" style={{display:'flex', padding:'120px 0', alignItems:'center', gap:'100px'}}>
          <img src={containerImg} className="about-img" style={{width:'500px', height:'500px', borderRadius:'50%', objectFit:'cover', flexShrink: 0}} alt="Circle About" />
          <div>
            <h2 style={{fontSize: '3.5rem', margin: '0 0 20px 0', lineHeight: 1.1}}>The <span className="text-orange">largest</span> and most <span className="text-orange">TRUSTED</span> addiction treatment center</h2>
            <p style={{fontSize: '1.3rem'}}><strong>We are <span className="text-orange">Bridges of Hope</span></strong></p>
            <p style={{fontSize: '1.2rem', lineHeight: 1.6}}>We provide professional and private treatment for those struggling with addiction through our world-class facilities.</p>
          </div>
        </div>
      </section>

      {/* Programs Slider */}
      <section className="programs-section">
        <h2 style={{fontSize: '3.5rem', marginBottom: '10px'}}>Our <span className="text-orange">Treatment Programs</span></h2>
        <p style={{fontSize: '1.3rem', color: '#64748b'}}>Comprehensive care tailored to your unique needs and recovery journey</p>
        <div className="slider-isolation-box">
          <Swiper
            modules={[Pagination]}
            spaceBetween={30}
            pagination={{ clickable: true }}
            breakpoints={{ 320: { slidesPerView: 1 }, 1024: { slidesPerView: 2 } }}
            style={{ padding: '30px 20px 80px' }}
          >
            {[
              { title: "Lifetime Aftercare", text: "Access to medical specialists and facilitators to support your sobriety long after the program ends.", img: prog1 },
              { title: "Counseling & Therapy", text: "Professional one-on-one and group sessions led by credentialed therapists.", img: prog1 },
              { title: "In-Patient Recovery", text: "A safe, world-class residential facility where you can focus entirely on healing.", img: prog2 }
            ].map((prog, i) => (
              <SwiperSlide key={i}>
                <div className="program-card">
                  <img src={prog.img} alt={prog.title} />
                  <div>
                    <h3>{prog.title}</h3>
                    <p>{prog.text}</p>
                  </div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </section>

      {/* Stories of Hope */}
      <section className="full-screen-section" style={{ padding: '100px 0', background: '#ffffff' }}>
        <div className="content-limit" style={{textAlign: 'center'}}> 
          <h2 style={{ fontSize: '3.5rem', fontWeight: '700', marginBottom: '10px' }}>Stories of <span className="text-orange">Hope & Recovery</span></h2>
          <p style={{ color: '#64748b', fontSize: '1.1rem', marginBottom: '60px' }}>Real stories from real people who found their path to sobriety</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap' }}>
            {[
              { initial: 'T', name: 'Tony S.', text: "Bridges of Hope has helped my recognize my destructive behaviors and patterns. I don't know where I would be if my family didn't make me go to this rehab. Today, I'm happy to say that I'm able to rebuild my life and commit to lifetime sobriety." },
              { initial: 'J', name: 'James M.', text: "Being a recovering addict has its challenges, but it's nice to have Bridges of Hope to continue to become my support system even after I got out of rehab. Now, I look forward to finishing my studies and getting a job." },
              { initial: 'J', name: 'James K.', text: "It was in 2013 when I thought, 'Enough!' and finally decided to call Bridges of Hope to treat my husband's addiction to meth. It was the best decision I have done. My husband is now 7 years sober and have turned his life around." }
            ].map((story, i) => (
              <div key={i} style={{ background: '#ffffff', padding: '40px', borderRadius: '20px', border: '1px solid #eef2f6', flex: '1', minWidth: '300px', textAlign: 'left', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                <p style={{ fontSize: '1.05rem', color: '#475569', lineHeight: '1.7', marginBottom: '30px' }}>"{story.text}"</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ background: '#f24e1e', color: 'white', width: '45px', height: '45px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{story.initial}</div>
                  <strong>{story.name}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <footer className="footer-cta-part full-screen-section">
        <div className="content-limit" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '3.2rem', fontWeight: '700', marginBottom: '15px' }}>Ready to Take the First Step?</h2>
          <p style={{ color: '#a0aec0', fontSize: '1.1rem', marginBottom: '60px' }}>Recovery is possible. Let us help you start your journey today.</p>
          
          <div className="cta-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            <button className="footer-cta-box"><Phone size={24} /> Call Now: (555) 123-4567</button>
            <button className="footer-cta-box"><Monitor size={24} /> Use our Website</button>
            <button className="footer-cta-box"><Smartphone size={24} /> Download our app</button>
          </div>
        </div>
      </footer>

      {/* Footer Info */}
      <footer className="footer-info-part full-screen-section">
        <div className="content-limit info-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '60px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <img src={hopeLogo} alt="Hope Recovery" style={{ height: '30px' }} />
              <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>Hope Recovery</h4>
            </div>
            <p style={{ color: '#a0aec0', lineHeight: '1.6', fontSize: '1.1rem', maxWidth: '350px' }}>
              Transforming lives through compassionate, evidence-based addiction treatment.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ marginBottom: '30px', color: '#a0aec0', fontSize: '1rem', fontWeight: '600', textTransform: 'uppercase' }}>Contact</h4>
            <div className="footer-contact-item"><Phone size={20} className="text-orange" /> (555) 123-4567</div>
            <div className="footer-contact-item"><Mail size={20} className="text-orange" /> info@hoperecovery.com</div>
            <div className="footer-contact-item" style={{ alignItems: 'flex-start' }}>
              <MapPin size={20} className="text-orange" style={{ marginTop: '4px' }} /> 
              <span>123 Recovery Way<br/>Cavite, Philippines</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ marginBottom: '30px', color: '#a0aec0', fontSize: '1rem', fontWeight: '600', textTransform: 'uppercase' }}>Legal</h4>
            <a href="#" style={{ color: '#a0aec0', textDecoration: 'none', fontSize: '0.9rem' }}>Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;