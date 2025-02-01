'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { UploadArea } from './UploadArea';
import { GenerationOptions } from './GenerationOptions';
import { GeneratedImages } from './GeneratedImages';
import { useImageGeneration } from '@/lib/hooks/use-image-generation';
import { useToast } from '@/hooks/use-toast';
import { usePhotoMakerStore } from '@/lib/store';
import { PHOTOMAKER_CONFIG } from '@/lib/config/constants';
import Script from "next/script";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'gradio-app': any;
    }
  }
}

export function PhotoMaker() {
  const t = useTranslations();
  const { toast } = useToast();
  const { files, options, setFiles, setOptions } = usePhotoMakerStore();
  const { isGenerating, generatedImages, generateImages, startTime } = useImageGeneration();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;

    try {
      await generateImages({
        upload_images: files,
        prompt: options.prompt,
        negative_prompt: options.negativePrompt,
        aspect_ratio_name: options.aspectRatio,
        style_name: options.style,
        num_steps: options.numSteps,
        style_strength_ratio: options.styleStrength,
        num_outputs: PHOTOMAKER_CONFIG.DEFAULT_PARAMS.num_outputs,
        guidance_scale: PHOTOMAKER_CONFIG.DEFAULT_PARAMS.guidance_scale,
        seed: Math.floor(Math.random() * 1000),
        use_doodle: options.useDoodle,
        sketch_image: null,
        adapter_conditioning_scale: PHOTOMAKER_CONFIG.DEFAULT_PARAMS.adapter_conditioning_scale,
        adapter_conditioning_factor: PHOTOMAKER_CONFIG.DEFAULT_PARAMS.adapter_conditioning_factor,
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: String(error),
        variant: 'destructive',
      });
    }
  };

  return (


    <div id="photo-maker" >
        <Script
                  type="module"
                  src="https://gradio.s3-us-west-2.amazonaws.com/4.29.0/gradio.js"
        ></Script>
        <div className="mx-auto max-w-full h-1337px ml-50">
           <gradio-app src="https://parler-tts-parler-tts.hf.space"></gradio-app>
        </div>
    </div>
  );
}