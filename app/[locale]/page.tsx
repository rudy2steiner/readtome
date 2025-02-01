import { Hero } from '@/components/sections/Hero';
import { SocialProof } from '@/components/sections/SocialProof';
import { Benefits } from '@/components/sections/Benefits';
import { Features } from '@/components/sections/Features';
import { HowItWorks } from '@/components/sections/HowItWorks';
import { PhotoMaker } from '@/components/photo-maker/PhotoMaker';
import { ExampleList } from '@/components/photo-maker/ExampleList';
import { Testimonials } from '@/components/sections/Testimonials';
import { CallToAction } from '@/components/sections/CallToAction';
import { FAQ } from '@/components/sections/FAQ';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Read To Me: Turn text to speech in seconds | Free Online',
  description: 'Transform any text into natural-sounding speech in seconds. Whether you are learning, multitasking, or making content accessible, ReadToMe converts your documents into crystal-clear audio with lifelike voices in over 50 language!',
  keywords: [
  ],
}
export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <Hero />
      <SocialProof />
      <div className="container mx-auto py-12 space-y-12">
        <PhotoMaker />
      </div>
      <Benefits />
      <Features />
      <HowItWorks />
      <Testimonials />
      <FAQ />
      <CallToAction />
    </main>
  );
}