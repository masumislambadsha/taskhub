"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contactSchema, ContactFormData } from "@/lib/validators/contact";
import {
  MdCheckCircle,
  MdEmail,
  MdForum,
  MdLocationOn,
  MdSend,
  MdSchedule,
} from "react-icons/md";
import axios from "axios";

const CONTACT_CARDS = [
  {
    icon: MdEmail,
    label: "Email us",
    value: "hello@taskhub.dev",
    hint: "For general questions and partnerships",
  },
  {
    icon: MdForum,
    label: "Support hub",
    value: "Support center",
    hint: "Browse FAQs and support categories",
    href: "/support",
  },
  {
    icon: MdSchedule,
    label: "Response time",
    value: "Within 24 hours",
    hint: "On business days, usually much faster",
  },
  {
    icon: MdLocationOn,
    label: "Office",
    value: "Dhaka, Bangladesh",
    hint: "Fully remote team worldwide",
  },
];

function ContactForm() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  async function onSubmit(data: ContactFormData) {
    setLoading(true);
    try {
      await axios.post("/api/v1/contact", data);
      setSent(true);
      reset();
    } catch {
      setSent(false);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="bg-white rounded-2xl border border-primary/5 shadow-sm p-10 md:p-16 text-center">
        <div className="w-16 h-16 rounded-full bg-secondary/10 text-secondary flex items-center justify-center mx-auto mb-6">
          <MdCheckCircle className="text-3xl" />
        </div>
        <h2 className="font-headline text-2xl font-bold text-primary mb-2">
          Message sent!
        </h2>
        <p className="text-primary/60 text-sm mb-6 max-w-sm mx-auto">
          Thank you for reaching out. Our team will get back to you within 24
          hours on business days.
        </p>
        <button
          onClick={() => setSent(false)}
          className="text-sm font-semibold text-secondary hover:underline"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white rounded-2xl border border-primary/5 shadow-sm p-6 md:p-10 space-y-6"
      noValidate
    >
      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <label
            htmlFor="contact-name"
            className="block text-sm font-semibold text-primary mb-2"
          >
            Full Name
          </label>
          <input
            id="contact-name"
            {...register("name")}
            type="text"
            autoComplete="name"
            className="w-full px-4 py-3 rounded-xl border border-primary/10 bg-background focus:outline-none focus:ring-2 focus:ring-secondary/40 text-primary"
            placeholder="Jane Cooper"
          />
          {errors.name && (
            <p className="text-red-500 text-xs mt-1.5">{errors.name.message}</p>
          )}
        </div>
        <div>
          <label
            htmlFor="contact-email"
            className="block text-sm font-semibold text-primary mb-2"
          >
            Email Address
          </label>
          <input
            id="contact-email"
            {...register("email")}
            type="email"
            autoComplete="email"
            className="w-full px-4 py-3 rounded-xl border border-primary/10 bg-background focus:outline-none focus:ring-2 focus:ring-secondary/40 text-primary"
            placeholder="jane@example.com"
          />
          {errors.email && (
            <p className="text-red-500 text-xs mt-1.5">{errors.email.message}</p>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor="contact-subject"
          className="block text-sm font-semibold text-primary mb-2"
        >
          Subject
        </label>
        <input
          id="contact-subject"
          {...register("subject")}
          type="text"
          className="w-full px-4 py-3 rounded-xl border border-primary/10 bg-background focus:outline-none focus:ring-2 focus:ring-secondary/40 text-primary"
          placeholder="What can we help you with?"
        />
        {errors.subject && (
          <p className="text-red-500 text-xs mt-1.5">
            {errors.subject.message}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="contact-message"
          className="block text-sm font-semibold text-primary mb-2"
        >
          Message
        </label>
        <textarea
          id="contact-message"
          {...register("message")}
          rows={6}
          className="w-full px-4 py-3 rounded-xl border border-primary/10 bg-background focus:outline-none focus:ring-2 focus:ring-secondary/40 text-primary resize-none"
          placeholder="Tell us a little more about your question or issue…"
        />
        {errors.message && (
          <p className="text-red-500 text-xs mt-1.5">
            {errors.message.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        <MdSend className="text-base" />
        {loading ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}

export default function ContactPage() {
  return (
    <div className="py-15 md:py-20">
      <section className="max-w-4xl mx-auto px-4 text-center mb-14 md:mb-20">
        <span className="inline-block bg-secondary/10 text-secondary px-4 py-1 text-[10px] font-bold uppercase tracking-[0.2em] rounded mb-5">
          Contact Us
        </span>
        <h1 className="font-headline text-4xl sm:text-5xl font-extrabold text-primary tracking-tight leading-tight">
          Let&apos;s talk about your project
        </h1>
        <p className="text-primary/60 text-base sm:text-lg font-light max-w-2xl mx-auto mt-4">
          Whether you have a question about earning, posting tasks, payments, or
          something completely different — we&apos;re here to help.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-4 md:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {CONTACT_CARDS.map((card) => {
            const Icon = card.icon;
            const inner = (
              <div className="bg-white rounded-2xl border border-primary/5 shadow-sm p-6 h-full">
                <div className="w-11 h-11 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary mb-4">
                  <Icon className="text-xl" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary/40 mb-1.5">
                  {card.label}
                </p>
                <p className="font-bold text-primary">{card.value}</p>
                <p className="text-xs text-primary/40 mt-1">{card.hint}</p>
              </div>
            );
            return card.href ? (
              <Link key={card.label} href={card.href} className="h-full block">
                {inner}
              </Link>
            ) : (
              <div key={card.label}>{inner}</div>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <div className="mb-6">
              <h2 className="font-headline text-2xl font-extrabold text-primary tracking-tight">
                Send us a message
              </h2>
              <p className="text-primary/60 text-sm mt-1">
                We typically respond within 24 hours on business days.
              </p>
            </div>
            <Suspense>
              <ContactForm />
            </Suspense>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-primary rounded-2xl p-8 text-white space-y-6">
              <MdSchedule className="text-secondary text-3xl" />
              <div>
                <p className="font-headline font-bold text-lg mb-1">
                  Prefer self-service?
                </p>
                <p className="text-white/60 text-sm leading-relaxed">
                  Most common questions are already answered in our support hub
                  and FAQ pages — no waiting required.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <Link
                  href="/support"
                  className="bg-white text-primary text-sm font-bold px-5 py-3 rounded-xl text-center hover:bg-secondary hover:text-white transition-colors"
                >
                  Visit Support Hub
                </Link>
                <Link
                  href="/faq"
                  className="bg-white/10 text-white text-sm font-bold px-5 py-3 rounded-xl text-center hover:bg-white/20 transition-colors"
                >
                  Browse FAQ
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}