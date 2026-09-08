import { ArrowDown, ArrowUpRight } from "lucide-react";
import Image from "next/image";

import { EditorialArt } from "@/components/graphics/editorial-art";
import { Monogram } from "@/components/graphics/monogram";
import { SiteHeader } from "@/components/layout/site-header";
import { GiftRegistry } from "@/components/sections/gift-registry";
import { HeroMedia } from "@/components/sections/hero-media";
import { WeddingCountdown } from "@/components/sections/wedding-countdown";
import type { PublicContent, WeddingLocation } from "@/data/site-content";
import { isSafeExternalUrl } from "@/lib/domain/urls";

export interface PublicHomeProps {
  content: PublicContent;
  includeReception?: boolean;
  initialNow?: string;
}

export function PublicHome({
  content,
  includeReception = false,
  initialNow = new Date().toISOString()
}: PublicHomeProps) {
  const visibleLocations = includeReception
    ? content.locations
    : content.locations.filter((location) => location.kind === "ceremony");

  return (
    <div className="public-shell">
      <a className="skip-link" href="#contenuto">
        Vai al contenuto principale
      </a>
      <SiteHeader />
      <main id="contenuto">
        <Hero content={content} initialNow={initialNow} />
        <WeddingSection locations={visibleLocations} />
        <StorySection content={content} />
        <section
          className="registry-section section-pad"
          id="lista-nozze"
          aria-labelledby="registry-title"
        >
          <div className="section-heading registry-heading">
            <p className="eyebrow">Lista nozze · 03</p>
            <h2 id="registry-title">Costruiamo casa insieme</h2>
            <p className="lead">
              Abbiamo immaginato questa lista come la nostra futura casa: una
              stanza, un oggetto e un piccolo progetto alla volta. Se desiderate
              farci un regalo, potete aiutarci a costruirla insieme, mattone
              dopo mattone.
            </p>
          </div>
          <div className="registry-intro">
            <p>
              Nessun pagamento avviene su questo sito. Potrete acquistare il
              regalo dal negozio indicato oppure scegliere il bonifico. Saremo
              noi a verificare manualmente ogni acquisto o contributo.
            </p>
            <p>
              La vostra presenza sarà già il regalo più bello. Questa lista è
              soltanto per chi desidera aiutarci a costruire qualcosa che
              resterà con noi.
            </p>
          </div>
          <GiftRegistry gifts={content.gifts} />
        </section>
      </main>
      <footer className="site-footer">
        <Monogram />
        <p>Giulia & Gabriele</p>
        <p>24 · 10 · 2026</p>
        <a href="/privacy">Privacy</a>
      </footer>
    </div>
  );
}

function Hero({
  content,
  initialNow
}: {
  content: PublicContent;
  initialNow: string;
}) {
  return (
    <section className="hero" id="home" aria-labelledby="hero-title">
      <HeroMedia media={content.heroMedia} />
      <div className="hero-content">
        <Monogram className="hero-monogram" />
        <p className="hero-kicker">Ci sposiamo</p>
        <h1 id="hero-title">Giulia & Gabriele</h1>
        {content.displayDate ? (
          <p className="hero-details">
            <time dateTime={content.weddingDate ?? undefined}>
              {content.displayDate}
            </time>
            <span aria-hidden="true">·</span>
            <span>{content.place}</span>
          </p>
        ) : null}
        <WeddingCountdown
          weddingDate={content.weddingDate}
          initialNow={initialNow}
        />
      </div>
      <a className="scroll-cue" href="#matrimonio">
        <span>Scopri la giornata</span>
        <ArrowDown aria-hidden="true" />
      </a>
    </section>
  );
}

function WeddingSection({ locations }: { locations: WeddingLocation[] }) {
  const includesReception = locations.some(
    (location) => location.kind === "reception"
  );

  return (
    <section
      className="wedding-section section-pad"
      id="matrimonio"
      aria-labelledby="wedding-title"
    >
      <div className="section-heading">
        <p className="eyebrow">Il matrimonio · 01</p>
        <h2 id="wedding-title">
          {includesReception ? "Due luoghi," : "Un luogo,"}
          <br />
          un solo giorno
        </h2>
      </div>
      <div className="locations-layout">
        {locations.map((location) => (
          <article
            className={`location location--${location.kind}`}
            key={location.name}
          >
            <div className="location-copy">
              <p className="eyebrow">
                {location.kind === "ceremony"
                  ? "La cerimonia"
                  : "Il ricevimento"}
              </p>
              <h3>{location.name}</h3>
              <p>{location.address ?? location.place}</p>
              <p className="location-time">{location.time}</p>
              {location.mapsUrl && isSafeExternalUrl(location.mapsUrl) ? (
                <a
                  href={location.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Apri Maps per ${location.name}`}
                >
                  Apri Maps <ArrowUpRight aria-hidden="true" />
                </a>
              ) : null}
            </div>
            <div className="location-art">
              {location.kind === "ceremony" ? (
                <Image
                  className="location-photo"
                  src="/graphics/chiesa-caleppio.png"
                  alt={`${location.name}, ${location.place}`}
                  width={1516}
                  height={968}
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              ) : location.kind === "reception" ? (
                <Image
                  className="location-photo"
                  src="/graphics/villa-cavenago.png"
                  alt={`${location.name}, ${location.place}`}
                  width={1604}
                  height={981}
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              ) : (
                <EditorialArt
                  label={`Illustrazione originale per ${location.name}`}
                  variant="arch"
                />
              )}
            </div>
            {location.note ? (
              <p className="location-note">{location.note}</p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function StorySection({ content }: { content: PublicContent }) {
  return (
    <section
      className="story-section section-pad"
      id="storia"
      aria-labelledby="story-title"
      aria-label="La nostra storia"
    >
      <div className="section-heading">
        <p className="eyebrow">La nostra storia · 02</p>
        <h2 id="story-title">
          Un sentiero
          <br />
          da raccontare
        </h2>
      </div>
      <ol className="story-list">
        {content.story.map((moment) => (
          <li key={moment.title}>
            <div className="story-marker" aria-hidden="true">
              {moment.marker}
            </div>
            <div className="story-art">
              {moment.media ? (
                <Image
                  className="story-photo"
                  src={moment.media.url}
                  alt={moment.media.alt}
                  width={640}
                  height={720}
                  sizes="(max-width: 768px) 100vw, 33vw"
                  style={{
                    objectPosition: `${moment.media.focalPoint.x}% ${moment.media.focalPoint.y}%`
                  }}
                  // User-supplied media of arbitrary origin; the optimizer is
                  // bypassed so no per-host allowlist is required.
                  unoptimized
                />
              ) : (
                <EditorialArt
                  label={`Illustrazione originale per ${moment.title}`}
                  variant="path"
                />
              )}
            </div>
            <div>
              <p className="eyebrow">Capitolo {moment.marker}</p>
              <h3>{moment.title}</h3>
              <p>{moment.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
