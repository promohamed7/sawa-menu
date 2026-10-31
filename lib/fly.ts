// A small photo token arcs from the tapped button into the cart bar.
// Two nested elements: the outer moves on X with ease-out, the inner on Y
// with an ease-in curve, which together trace a natural throw.
export function flyToCart(from: DOMRect, src: string, target: HTMLElement | null) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const size = 40;
  const sx = from.left + from.width / 2 - size / 2;
  const sy = from.top + from.height / 2 - size / 2;
  const t = target?.getBoundingClientRect();
  const tx = t ? t.left + t.width / 2 - size / 2 : window.innerWidth / 2 - size / 2;
  const ty = t ? t.top + t.height / 2 - size / 2 : window.innerHeight - 60;

  const outer = document.createElement("div");
  const inner = document.createElement("div");
  Object.assign(outer.style, {
    position: "fixed",
    left: `${sx}px`,
    top: `${sy}px`,
    width: `${size}px`,
    height: `${size}px`,
    zIndex: "60",
    pointerEvents: "none",
  });
  Object.assign(inner.style, {
    width: "100%",
    height: "100%",
    borderRadius: "0",
    backgroundColor: "#1c140f",
    backgroundImage: `url(${src})`,
    backgroundSize: "cover",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
    border: "2px solid #c9a35a",
    boxShadow: "0 10px 24px -8px rgb(10 5 2 / 0.8)",
  });
  outer.appendChild(inner);
  document.body.appendChild(outer);

  const dur = 620;
  outer.animate([{ transform: "translateX(0)" }, { transform: `translateX(${tx - sx}px)` }], {
    duration: dur,
    easing: "cubic-bezier(0.23, 1, 0.32, 1)",
    fill: "forwards",
  });
  const lift = Math.min(-70, (ty - sy) * -0.25);
  inner
    .animate(
      [
        { transform: "translateY(0) scale(0.6)", opacity: 0.4 },
        { transform: `translateY(${lift}px) scale(1.15)`, opacity: 1, offset: 0.28 },
        { transform: `translateY(${ty - sy}px) scale(0.45)`, opacity: 0.9 },
      ],
      { duration: dur, easing: "cubic-bezier(0.55, 0, 0.75, 0.4)", fill: "forwards" },
    )
    .finished.then(() => {
      outer.remove();
      target?.dispatchEvent(new CustomEvent("landed"));
    })
    .catch(() => outer.remove());
}

export function haptic(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}
