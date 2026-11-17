import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-3" aria-label="研墨 AI 首页">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-jade text-white transition-colors group-hover:bg-jade-deep">
        <span className="text-[19px] font-medium leading-none">墨</span>
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[22px] font-medium leading-none tracking-tight text-ink">
          研墨
          <span className="ml-1 align-top text-[12px] font-medium tracking-[0.06em] text-jade">AI</span>
        </span>
        <span className="mt-1.5 hidden text-[12px] font-medium uppercase tracking-[0.18em] text-ink-mute sm:block">
          Yanmo Writing
        </span>
      </span>
    </Link>
  );
}
