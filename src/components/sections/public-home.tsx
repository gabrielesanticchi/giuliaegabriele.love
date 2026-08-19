import { ArrowDown, ArrowUpRight } from "lucide-react";

import { EditorialArt } from "@/components/graphics/editorial-art";
import { Monogram } from "@/components/graphics/monogram";
import { SiteHeader } from "@/components/layout/site-header";
import { GiftRegistry } from "@/components/sections/gift-registry";
import { HeroMedia } from "@/components/sections/hero-media";
import { WeddingCountdown } from "@/components/sections/wedding-countdown";
import type { PublicContent } from "@/data/demo-content";
import { isSafeExternalUrl } from "@/lib/domain/urls";

export interface PublicHomeProps {
  content: PublicContent;
  demoMode?: boolean;
  allowDemoSubmission?: boolean;
  turnstileSiteKey?: string;
  initialNow?: string;
}

export function PublicHome({
  content,
  demoMode = false,
  allowDemoSubmission = false,
  turnstileSiteKey = "",
  initialNow = new Date().toISOString()
}: PublicHomeProps) {
  return (
    <div className="public-shell">
      <a className="skip-link" href="#contenuto">
        Vai al contenuto principale
      </a>
      <SiteHeader />
      <main id="contenuto">
        <Hero content={content} initialNow={initialNow} />
        <WeddingSection content={content} />
        <ScheduleSection content={content} />
        <StorySection content={content} demoMode={demoMode} />
        <DressCodeSection content={content} />
        <section
          className="registry-section section-pad"
          id="lista-nozze"
          aria-labelledby="registry-title"
        >
          <div className="section-heading registry-heading">
            <p className="eyebrow">Lista nozze · 05</p>
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
          <GiftRegistry
            gifts={content.gifts}
            demoMode={demoMode}
            allowDemoSubmission={allowDemoSubmission}
            turnstileSiteKey={turnstileSiteKey}
          />
        </section>
      </main>
      <footer className="site-footer">
        <Monogram />
        <p>Gabriele & Giulia</p>
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
        <h1 id="hero-title">Gabriele & Giulia</h1>
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

function WeddingSection({ content }: { content: PublicContent }) {
  return (
    <section
      className="wedding-section section-pad"
      id="matrimonio"
      aria-labelledby="wedding-title"
    >
      <div className="section-heading">
        <p className="eyebrow">Il matrimonio · 01</p>
        <h2 id="wedding-title">
          Due luoghi,
          <br />
          un solo giorno
        </h2>
      </div>
      <div className="locations-layout">
        {content.locations.map((location, index) => (
          <article
            className={`location location--${location.kind}`}
            key={location.name}
          >
            <div className="location-art">
              <EditorialArt
                label={`Illustrazione originale per ${location.name}`}
                variant={location.kind === "ceremony" ? "arch" : "leaf"}
              />
              <span aria-hidden="true">0{index + 1}</span>
            </div>
            <div className="location-copy">
              <p className="eyebrow">
                {location.kind === "ceremony"
                  ? "La cerimonia"
                  : "Il ricevimento"}
              </p>
              <h3>{location.name}</h3>
              <p>{location.place}</p>
              {location.address ? <p>{location.address}</p> : null}
              <p className="location-time">{location.time}</p>
              <p>{location.note}</p>
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
          </article>
        ))}
      </div>
    </section>
  );
}

function ScheduleSection({ content }: { content: PublicContent }) {
  return (
    <section
      className="schedule-section section-pad"
      id="programma"
      aria-labelledby="schedule-title"
    >
      <div className="section-heading section-heading--light">
        <p className="eyebrow">Programma · 02</p>
        <h2 id="schedule-title">Il ritmo della giornata</h2>
        <p>Tre momenti essenziali, tutto il resto lo vivremo insieme.</p>
      </div>
      <ol className="schedule-list">
        {content.schedule.map((item, index) => (
          <li key={item.title}>
            <span className="schedule-index" aria-hidden="true">
              0{index + 1}
            </span>
            {item.dateTime ? (
              <time dateTime={item.dateTime}>{item.time}</time>
            ) : (
              <span className="schedule-time">{item.time}</span>
            )}
            <div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StorySection({
  content,
  demoMode
}: {
  content: PublicContent;
  demoMode: boolean;
}) {
  return (
    <section
      className="story-section section-pad"
      id="storia"
      aria-labelledby="story-title"
      aria-label="La nostra storia"
    >
      <div className="section-heading">
        <p className="eyebrow">La nostra storia · 03</p>
        <h2 id="story-title">
          Un sentiero
          <br />
          da raccontare
        </h2>
        {demoMode ? <p className="demo-label">Contenuti dimostrativi</p> : null}
      </div>
      <ol className="story-list">
        {content.story.map((moment) => (
          <li key={moment.title}>
            <div className="story-marker" aria-hidden="true">
              {moment.marker}
            </div>
            <div className="story-art">
              <EditorialArt
                label={`Segnaposto demo: ${moment.title}`}
                variant="path"
              />
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

function DressCodeSection({ content }: { content: PublicContent }) {
  return (
    <section
      className="dress-section section-pad"
      id="dress-code"
      aria-labelledby="dress-title"
    >
      <div className="dress-copy">
        <p className="eyebrow">Dress code · 04</p>
        <h2 id="dress-title">{content.dressCode.name}</h2>
        <p className="lead">{content.dressCode.description}</p>
        <p>{content.dressCode.note}</p>
      </div>
      <ul className="swatches" aria-label="Palette suggerita">
        {content.dressCode.colors.map((color) => (
          <li key={color.name}>
            <span style={{ backgroundColor: color.value }} aria-hidden="true" />
            <span>{color.name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
