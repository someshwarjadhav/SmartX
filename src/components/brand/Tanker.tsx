import type * as React from "react";
import { useCallback, useEffect, useId, useRef } from "react";
import { cn } from "../../lib/cn";

interface Props {
  percent?: number;
  autoPlay?: boolean;
  caption?: string;
  className?: string;
}

const ENTER = 1700;
const FILL = 5600;
const HOLD = 1400;
const LEAVE = 1600;
const CYCLE = ENTER + FILL + HOLD + LEAVE;

const TOP = 62;
const BOTTOM = 202;
const OFFSCREEN = 680;

const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));
const easeOutCubic = (k: number): number => 1 - Math.pow(1 - k, 3);
const easeInCubic = (k: number): number => k * k * k;
const easeInOutSine = (k: number): number => -(Math.cos(Math.PI * k) - 1) / 2;

const WAVE =
  "M0 0 q20 -9 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 V260 H0 Z";

const Wheel: React.FC<{ cx: number }> = ({ cx }) => (
  <g>
    <path d={`M${cx - 33} 216 a33 33 0 0 1 66 0 z`} fill="#1a2440" />
    <g className="tk-spin">
      <circle cx={cx} cy={238} r={26} fill="#0f1527" />
      <circle cx={cx} cy={238} r={14} fill="#b4c0da" />
      <circle cx={cx} cy={238} r={4.5} fill="#1a2440" />
      <path
        d={`M${cx - 14} 238h28M${cx} 224v28`}
        stroke="#1a2440"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
  </g>
);

export const Tanker: React.FC<Props> = ({
  percent = 100,
  autoPlay = false,
  caption = "of daily target",
  className,
}) => {
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const truckRef = useRef<SVGGElement>(null);
  const fillRef = useRef<SVGGElement>(null);
  const pctRef = useRef<SVGTextElement>(null);
  const noteRef = useRef<SVGTextElement>(null);
  const levelRef = useRef(0);

  const apply = useCallback(
    (
      level: number,
      x: number,
      moving: boolean,
      filling: boolean,
      note: string,
    ) => {
      if (fillRef.current)
        fillRef.current.style.transform = `translateY(${BOTTOM - ((BOTTOM - TOP) * level) / 100}px)`;
      if (truckRef.current)
        truckRef.current.style.transform = `translateX(${x}px)`;
      if (svgRef.current) {
        svgRef.current.dataset.moving = moving ? "1" : "0";
        svgRef.current.dataset.filling = filling ? "1" : "0";
      }
      if (pctRef.current) pctRef.current.textContent = `${Math.round(level)}%`;
      if (noteRef.current) noteRef.current.textContent = note;
    },
    [],
  );

  useEffect(() => {
    const reduce =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let raf = 0;

    if (autoPlay) {
      if (reduce) {
        levelRef.current = 100;
        apply(100, 0, false, false, "Full · sealed");
        return;
      }
      const t0 = performance.now();
      const tick = (now: number) => {
        const t = (now - t0) % CYCLE;
        if (t < ENTER) {
          const x = -OFFSCREEN * (1 - easeOutCubic(t / ENTER));
          apply(0, x, true, false, "Arriving");
        } else if (t < ENTER + FILL) {
          const lv = 100 * easeInOutSine((t - ENTER) / FILL);
          apply(lv, 0, false, true, "Filling");
        } else if (t < ENTER + FILL + HOLD) {
          apply(100, 0, false, false, "Full · sealed");
        } else {
          const x = OFFSCREEN * easeInCubic((t - ENTER - FILL - HOLD) / LEAVE);
          apply(100, x, true, false, "Dispatching");
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }

    const from = levelRef.current;
    const to = clamp(percent, 0, 100);
    const t0 = performance.now();
    const dur = reduce ? 0 : 1500;
    const tick = (now: number) => {
      const k = dur === 0 ? 1 : Math.min(1, (now - t0) / dur);
      const lv = from + (to - from) * easeOutCubic(k);
      levelRef.current = lv;
      apply(lv, 0, false, k < 1 && to > from, caption);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoPlay, percent, caption, apply]);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 600 290"
      className={cn("block h-auto w-full", className)}
      role="img"
      aria-label={
        autoPlay
          ? "A milk tanker filling up and driving away"
          : `Tanker ${Math.round(percent)} percent full`
      }
      data-moving="0"
      data-filling="0"
    >
      <defs>
        <clipPath id={`in-${uid}`}>
          <rect x="34" y={TOP} width="342" height={BOTTOM - TOP} rx="70" />
        </clipPath>
        <linearGradient id={`steel-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F4F8FF" />
          <stop offset="0.55" stopColor="#C9D5EC" />
          <stop offset="1" stopColor="#8E9FC2" />
        </linearGradient>
        <linearGradient id={`milk-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop
            offset="1"
            style={{ stopColor: "rgb(var(--glow))" }}
            stopOpacity="0.75"
          />
        </linearGradient>
        <linearGradient id={`cab-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "rgb(var(--glow))" }} />
          <stop offset="1" style={{ stopColor: "rgb(var(--brand))" }} />
        </linearGradient>
      </defs>

      <ellipse cx="300" cy="268" rx="285" ry="8" fill="#000" opacity=".22" />
      <line
        className="tk-road"
        x1="-40"
        x2="640"
        y1="272"
        y2="272"
        stroke="#fff"
        strokeOpacity=".28"
        strokeWidth="3"
        strokeDasharray="18 18"
        strokeLinecap="round"
      />

      <g>
        <rect x="196" y="-4" width="18" height="22" rx="3" fill="#9DB0D3" />
        <rect x="190" y="14" width="30" height="8" rx="3" fill="#7F93BA" />
        <line
          className="tk-stream"
          x1="205"
          x2="205"
          y1="22"
          y2="40"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </g>

      <g ref={truckRef} style={{ transform: `translateX(${-OFFSCREEN}px)` }}>
        <rect x="14" y="210" width="534" height="14" rx="7" fill="#1a2440" />

        <rect
          x="24"
          y="52"
          width="362"
          height="160"
          rx="80"
          fill={`url(#steel-${uid})`}
        />
        <rect
          x="34"
          y={TOP}
          width="342"
          height={BOTTOM - TOP}
          rx="70"
          fill="#0A1A4D"
          opacity=".92"
        />

        <g clipPath={`url(#in-${uid})`}>
          <g ref={fillRef} style={{ transform: `translateY(${BOTTOM}px)` }}>
            <g className="tk-wave-b" opacity=".5">
              <path d={WAVE} transform="translate(-30 -5)" fill="#fff" />
            </g>
            <g className="tk-wave-a">
              <path d={WAVE} fill={`url(#milk-${uid})`} />
            </g>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <circle
                key={i}
                cx={70 + i * 52}
                cy={30 + (i % 3) * 28}
                r={2 + (i % 2)}
                fill="#fff"
                opacity=".35"
              />
            ))}
          </g>
          <rect
            x="52"
            y="70"
            width="300"
            height="9"
            rx="4.5"
            fill="#fff"
            opacity=".28"
          />
        </g>
        <rect
          x="34"
          y={TOP}
          width="342"
          height={BOTTOM - TOP}
          rx="70"
          fill="none"
          stroke="#fff"
          strokeOpacity=".5"
          strokeWidth="2"
        />

        {[140, 270].map((x) => (
          <line
            key={x}
            x1={x}
            x2={x}
            y1="52"
            y2="62"
            stroke="#6F82A8"
            strokeWidth="4"
            strokeLinecap="round"
          />
        ))}
        {[140, 270].map((x) => (
          <line
            key={`b${x}`}
            x1={x}
            x2={x}
            y1="202"
            y2="212"
            stroke="#6F82A8"
            strokeWidth="4"
            strokeLinecap="round"
          />
        ))}
        <rect x="175" y="38" width="60" height="16" rx="6" fill="#7F93BA" />
        <rect x="186" y="31" width="38" height="10" rx="4" fill="#5E7199" />

        <rect
          x="150"
          y="128"
          width="110"
          height="52"
          rx="12"
          fill="#07123A"
          opacity=".94"
        />
        <text
          ref={pctRef}
          x="205"
          y="154"
          textAnchor="middle"
          fontSize="24"
          fontWeight="800"
          fill="#fff"
          fontFamily="Sora, system-ui, sans-serif"
        >
          0%
        </text>
        <text
          ref={noteRef}
          x="205"
          y="170"
          textAnchor="middle"
          fontSize="10.5"
          fontWeight="600"
          fill="#BBD0FF"
          fontFamily="'DM Sans', system-ui, sans-serif"
        >
          {caption}
        </text>

        <path
          d="M396 212V100a14 14 0 0 1 14-14h70a14 14 0 0 1 11 5l37 49a14 14 0 0 1 3 9v63z"
          fill={`url(#cab-${uid})`}
        />
        <path d="M414 104h62l33 42H414z" fill="#D6E8FF" opacity=".92" />
        <path d="M424 108h24l-18 34h-14z" fill="#fff" opacity=".35" />
        <path
          d="M446 152v52"
          stroke="#fff"
          strokeOpacity=".35"
          strokeWidth="2"
        />
        <rect
          x="452"
          y="168"
          width="14"
          height="4"
          rx="2"
          fill="#fff"
          opacity=".7"
        />
        <circle cx="423" cy="186" r="9" fill="#fff" />
        <path
          d="M418.8 181.8l8.4 8.4M427.2 181.8l-8.4 8.4"
          style={{ stroke: "rgb(var(--brand))" }}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <rect x="396" y="62" width="9" height="40" rx="3" fill="#8294B8" />
        <rect x="526" y="190" width="24" height="22" rx="5" fill="#1a2440" />
        <circle cx="534" cy="170" r="6" fill="#FDE68A" />
        <circle cx="534" cy="170" r="12" fill="#FDE68A" opacity=".25" />

        <Wheel cx={100} />
        <Wheel cx={164} />
        <Wheel cx={448} />
        <Wheel cx={506} />
      </g>
    </svg>
  );
};
