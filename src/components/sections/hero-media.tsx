"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { EditorialArt } from "@/components/graphics/editorial-art";
import type { HeroMediaContent } from "@/data/demo-content";

export interface HeroMediaProps {
  media: HeroMediaContent;
}

function focalPointStyle(focalPoint: { x: number; y: number }) {
  return { objectPosition: `${focalPoint.x}% ${focalPoint.y}%` };
}

export function HeroMedia({ media }: HeroMediaProps) {
  const [reducedMotion, setReducedMotion] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  if (media.kind === "art") {
    return (
      <div className="hero-media">
        <EditorialArt label={media.label} variant="arch" />
      </div>
    );
  }

  if (media.kind === "image" || reducedMotion) {
    const src = media.kind === "image" ? media.src : media.posterSrc;
    const alt = media.kind === "image" ? media.alt : media.posterAlt;
    return (
      <div className="hero-media">
        {/* Production media URLs are validated server-side before reaching this component. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} style={focalPointStyle(media.focalPoint)} />
      </div>
    );
  }

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      video.pause();
      return;
    }
    setPlaybackError(false);
    try {
      await video.play();
    } catch {
      setPlaying(false);
      setPlaybackError(true);
    }
  };

  return (
    <div className="hero-media">
      <video
        ref={videoRef}
        src={media.src}
        poster={media.posterSrc}
        style={focalPointStyle(media.focalPoint)}
        muted
        loop
        playsInline
        autoPlay
        aria-label={media.posterAlt}
        onPlay={() => {
          setPlaying(true);
          setPlaybackError(false);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          setPlaying(false);
          setPlaybackError(true);
        }}
      />
      <button className="video-control" type="button" onClick={togglePlayback}>
        {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        {playing ? "Pausa video" : "Riprendi video"}
      </button>
      {playbackError ? (
        <p
          className="media-status"
          role="status"
          aria-label="Il video non può essere avviato"
        >
          Il video non può essere avviato. Il poster resta disponibile.
        </p>
      ) : null}
    </div>
  );
}
