import Header from '../components/Header';
import Hero from '../components/Hero';
import About from '../components/About';
import Specialties from '../components/Specialties';
import Scheduling from '../components/Scheduling';
import ContactSection from '../components/ContactSection';
import Footer from '../components/Footer';

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <About />
        <Specialties />
        <Scheduling />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}
