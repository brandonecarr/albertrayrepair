import SiteHeader from "@/components/SiteHeader";
import Work, { getGalleryImages } from "@/components/Work";
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

// Static + hourly refresh; photo add/remove also revalidates "/" on demand so
// gallery changes show up immediately.
export const revalidate = 3600;

export default async function Home() {
  const galleryImages = await getGalleryImages();
  return (
    <>
      <SiteHeader showWork={galleryImages.length > 0} />
      <main>
        <Hero />
        <TrustBar />
        <Services />
        <Work images={galleryImages} />
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
