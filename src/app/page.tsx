import SiteHeader from "@/components/SiteHeader";
import Hero from "@/components/Hero";
import TrustBar from "@/components/TrustBar";
import Services from "@/components/Services";
import Process from "@/components/Process";
import About from "@/components/About";
import Faith from "@/components/Faith";
import Testimonials from "@/components/Testimonials";
import Booking from "@/components/Booking";
import Contact from "@/components/Contact";
import SiteFooter from "@/components/SiteFooter";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <TrustBar />
        <Services />
        <Process />
        <About />
        <Faith />
        <Testimonials />
        <Booking />
        <Contact />
      </main>
      <SiteFooter />
    </>
  );
}
