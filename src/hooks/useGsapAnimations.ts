"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function useGsapAnimations() {
  useEffect(() => {
    
    gsap.config({ force3D: true, nullTargetWarn: false });
    gsap.ticker.lagSmoothing(0);

    const ctx = gsap.context(() => {
      
      gsap.set("[data-gsap='hero-visual']", {
        willChange: "transform",
        force3D: true,
        transformPerspective: 1000,
      });

      
      const heroTl = gsap.timeline({ delay: 0.1 });

      heroTl
        .from("[data-gsap='hero-title']", {
          y: 70,
          opacity: 0,
          duration: 1,
          ease: "power3.out",
        })
        .from(
          "[data-gsap='hero-sub']",
          {
            y: 40,
            opacity: 0,
            duration: 0.9,
            ease: "power3.out",
          },
          "-=0.6",
        )
        .from(
          "[data-gsap='hero-cta']",
          {
            y: 30,
            opacity: 0,
            duration: 0.8,
            ease: "power3.out",
          },
          "-=0.6",
        )
        .from(
          "[data-gsap='hero-visual']",
          {
            x: 80,
            opacity: 0,
            duration: 1.1,
            ease: "power3.out",
          },
          "-=1",
        );

      
      gsap.to("[data-gsap='hero-visual-wrapper']", {
        yPercent: 4,
        duration: 2.5,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });

      
      gsap.from("[data-gsap='trusted-by']", {
        scrollTrigger: {
          trigger: "[data-gsap='trusted-by']",
          start: "top 90%",
        },
        opacity: 0,
        y: 20,
        duration: 0.8,
        ease: "power2.out",
      });

      gsap.utils
        .toArray<HTMLElement>("[data-gsap='trusted-logo']")
        .forEach((el, i) => {
          gsap.from(el, {
            scrollTrigger: { trigger: el, start: "top 92%" },
            opacity: 0,
            y: 15,
            duration: 0.5,
            delay: i * 0.08,
            ease: "power2.out",
          });
        });

      
      gsap.from("[data-gsap='fade-up']", {
        scrollTrigger: {
          trigger: "[data-gsap='fade-up']",
          start: "top 85%",
        },
        y: 50,
        opacity: 0,
        duration: 0.9,
        ease: "power2.out",
      });

      gsap.utils
        .toArray<HTMLElement>("[data-gsap='how-card']")
        .forEach((el, i) => {
          gsap.from(el, {
            scrollTrigger: { trigger: el, start: "top 88%" },
            x: i % 2 === 0 ? -40 : 40,
            opacity: 0,
            duration: 0.7,
            ease: "power2.out",
          });
        });

      
      gsap.utils.toArray<HTMLElement>("[data-gsap='stat']").forEach((el, i) => {
        gsap.from(el, {
          scrollTrigger: { trigger: el, start: "top 90%" },
          scale: 0.6,
          opacity: 0,
          duration: 0.7,
          delay: i * 0.1,
          ease: "back.out(1.7)",
        });
      });

      
      gsap.utils
        .toArray<HTMLElement>("[data-gsap='feature-text']")
        .forEach((el) => {
          gsap.from(el, {
            scrollTrigger: { trigger: el, start: "top 82%" },
            x: -50,
            opacity: 0,
            duration: 0.9,
            ease: "power3.out",
          });
        });

      gsap.utils
        .toArray<HTMLElement>("[data-gsap='feature-visual']")
        .forEach((el) => {
          gsap.from(el, {
            scrollTrigger: { trigger: el, start: "top 82%" },
            x: 50,
            opacity: 0,
            duration: 0.9,
            ease: "power3.out",
          });
        });

      gsap.utils
        .toArray<HTMLElement>("[data-gsap='feature-item']")
        .forEach((el, i) => {
          gsap.from(el, {
            scrollTrigger: { trigger: el, start: "top 88%" },
            x: -30,
            opacity: 0,
            duration: 0.6,
            delay: i * 0.1,
            ease: "power2.out",
          });
        });

      
      gsap.utils
        .toArray<HTMLElement>("[data-gsap='coin-card']")
        .forEach((el, i) => {
          gsap.from(el, {
            scrollTrigger: { trigger: el, start: "top 88%" },
            y: 40,
            opacity: 0,
            duration: 0.6,
            delay: i * 0.1,
            ease: "back.out(1.4)",
          });
        });

      
      gsap.utils
        .toArray<HTMLElement>("[data-gsap='worker-card']")
        .forEach((el, i) => {
          gsap.from(el, {
            scrollTrigger: { trigger: el, start: "top 90%" },
            y: 50,
            opacity: 0,
            duration: 0.65,
            delay: i * 0.12,
            ease: "power2.out",
          });
        });

      
      gsap.from("[data-gsap='testimonial-quote']", {
        scrollTrigger: {
          trigger: "[data-gsap='testimonial-quote']",
          start: "top 82%",
        },
        x: -60,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
      });

      gsap.utils
        .toArray<HTMLElement>("[data-gsap='testimonial-card']")
        .forEach((el, i) => {
          gsap.from(el, {
            scrollTrigger: { trigger: el, start: "top 88%" },
            x: 50,
            opacity: 0,
            duration: 0.7,
            delay: i * 0.15,
            ease: "power2.out",
          });
        });

      
      gsap.from("[data-gsap='impact-heading']", {
        scrollTrigger: {
          trigger: "[data-gsap='impact-heading']",
          start: "top 85%",
        },
        y: 40,
        opacity: 0,
        duration: 0.8,
        ease: "power2.out",
      });

      gsap.utils
        .toArray<HTMLElement>("[data-gsap='impact-stat']")
        .forEach((el, i) => {
          gsap.from(el, {
            scrollTrigger: { trigger: el, start: "top 90%" },
            scale: 0.7,
            opacity: 0,
            duration: 0.6,
            delay: i * 0.12,
            ease: "back.out(1.7)",
          });
        });

      
      gsap.utils
        .toArray<HTMLElement>("[data-gsap='faq-item']")
        .forEach((el, i) => {
          gsap.from(el, {
            scrollTrigger: { trigger: el, start: "top 90%" },
            y: 25,
            opacity: 0,
            duration: 0.55,
            delay: i * 0.08,
            ease: "power2.out",
          });
        });

      
      gsap.from("[data-gsap='cta-box']", {
        scrollTrigger: {
          trigger: "[data-gsap='cta-box']",
          start: "top 85%",
        },
        scale: 0.95,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
      });

      
      gsap.utils
        .toArray<HTMLElement>("[data-gsap='stagger-cards']")
        .forEach((container) => {
          const cards =
            container.querySelectorAll<HTMLElement>("[data-gsap='card']");

          gsap.from(cards, {
            scrollTrigger: { trigger: container, start: "top 85%" },
            y: 40,
            opacity: 0,
            duration: 0.7,
            ease: "power2.out",
            stagger: 0.12,
          });
        });
    });

    return () => ctx.revert();
  }, []);
}
