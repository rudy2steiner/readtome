import { Metadata } from 'next';

import { Hero } from '@/components/sections/Hero';
import { Benefits } from '@/components/sections/Benefits';
import { Features } from '@/components/sections/Features';
import { HowItWorks } from '@/components/sections/HowItWorks';
import { FAQ } from '@/components/sections/FAQ';
import { CallToAction } from '@/components/sections/CallToAction';

export const metadata: Metadata = {
  title: 'Read To Me: Turn text to speech in seconds | Free Online',
  description:
    'Transform any text into natural-sounding speech in seconds. Whether you are learning, multitasking, or making content accessible, ReadToMe converts your documents into crystal-clear audio with lifelike voices in over 50 language!',
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <Benefits />
      <Features />
      <HowItWorks />
      <FAQ />
      <CallToAction />
    </>
  );
}
