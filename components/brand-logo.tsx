import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
  priority?: boolean;
};

export function BrandLogo({
  className,
  markClassName,
  showWordmark = true,
  priority,
}: Props) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src="/brand/logo.png"
        alt="OfficePulse"
        width={40}
        height={40}
        priority={priority}
        className={cn(
          "h-10 w-10 rounded-full object-cover ring-1 ring-slate-200",
          markClassName
        )}
      />
      {showWordmark ? (
        <span className="text-sm font-bold tracking-tight text-teal-800">
          OfficePulse
        </span>
      ) : null}
    </div>
  );
}
