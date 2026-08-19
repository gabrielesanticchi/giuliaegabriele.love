"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef
} from "react";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    }
  ) => string;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstileWidgetHandle = { reset: () => void };

type TurnstileWidgetProps = {
  siteKey: string;
  onToken: (token: string) => void;
  resetSignal?: number;
};

export const TurnstileWidget = forwardRef<
  TurnstileWidgetHandle,
  TurnstileWidgetProps
>(function TurnstileWidget({ siteKey, onToken, resetSignal = 0 }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const callbackRef = useRef(onToken);
  const previousResetSignalRef = useRef(resetSignal);

  useEffect(() => {
    callbackRef.current = onToken;
  }, [onToken]);

  const reset = useCallback(() => {
    callbackRef.current("");
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {
        // Il token locale resta comunque invalidato.
      }
    }
  }, []);

  useImperativeHandle(ref, () => ({ reset }), [reset]);

  useEffect(() => {
    if (previousResetSignalRef.current === resetSignal) return;
    previousResetSignalRef.current = resetSignal;
    reset();
  }, [reset, resetSignal]);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const stopPolling = () => {
      if (timer) clearInterval(timer);
    };

    const render = () => {
      if (
        cancelled ||
        widgetIdRef.current ||
        !containerRef.current ||
        !window.turnstile
      ) {
        return;
      }
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => callbackRef.current(token),
        "expired-callback": () => callbackRef.current(""),
        "error-callback": () => callbackRef.current("")
      });
      stopPolling();
    };

    if (
      !window.turnstile &&
      process.env.NODE_ENV !== "test" &&
      !document.querySelector('script[data-wedding-turnstile="true"]')
    ) {
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.weddingTurnstile = "true";
      script.addEventListener("load", render, { once: true });
      document.head.append(script);
    }
    if (!window.turnstile && process.env.NODE_ENV !== "test") {
      timer = setInterval(render, 100);
    }
    render();

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [siteKey]);

  // role="group" makes the aria-label valid (aria-label on a plain div with no
  // role is prohibited) without changing the Turnstile mount behaviour.
  return (
    <div ref={containerRef} role="group" aria-label="Verifica anti-spam" />
  );
});
