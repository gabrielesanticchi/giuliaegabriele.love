"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Monogram } from "@/components/graphics/monogram";

const navigation = [
  ["Home", "#home"],
  ["Il matrimonio", "#matrimonio"],
  ["La nostra storia", "#storia"],
  ["Lista nozze", "#lista-nozze"]
] as const;

export function SiteHeader() {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header${solid ? " site-header--solid" : ""}`}>
      <nav className="site-nav" aria-label="Navigazione principale">
        <a
          className="brand-mark"
          href="#home"
          aria-label="Giulia e Gabriele, Home"
        >
          <Monogram className="monogram--mark" title="Giulia e Gabriele" />
        </a>
        <ul className="desktop-nav">
          {navigation.map(([label, href]) => (
            <li key={href}>
              <a href={href}>{label}</a>
            </li>
          ))}
        </ul>
        <a className="header-cta" href="#lista-nozze">
          Lista nozze
        </a>
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button
              className="menu-trigger"
              type="button"
              aria-label="Apri menu"
            >
              <Menu aria-hidden="true" />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content
              className="mobile-menu"
              aria-describedby={undefined}
            >
              <Dialog.Title className="mobile-menu-title">Menu</Dialog.Title>
              <Dialog.Close asChild>
                <button
                  className="menu-close"
                  type="button"
                  aria-label="Chiudi menu"
                >
                  <X aria-hidden="true" />
                </button>
              </Dialog.Close>
              <nav aria-label="Navigazione mobile">
                <ul>
                  {navigation.map(([label, href], index) => (
                    <li key={href}>
                      <a href={href} onClick={() => setOpen(false)}>
                        <span aria-hidden="true">0{index + 1}</span>
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </nav>
    </header>
  );
}
