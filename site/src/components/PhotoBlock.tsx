import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

export function PhotoBlock({
  src,
  alt,
  className = "",
  imgClassName = "",
  style,
  priority,
  sizes = "(max-width: 768px) 100vw, 60vw",
  children,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  style?: CSSProperties;
  priority?: boolean;
  sizes?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className={`object-cover ${imgClassName}`}
      />
      {/* `relative` here (not just a plain static div) matters: without it, this
          wrapper paints in the same layer as normal in-flow content, which sits
          *below* the absolutely-positioned Image in paint order regardless of
          DOM order — any overlay content would be invisible behind the photo. */}
      <div className="relative flex h-full w-full flex-col justify-between">
        {children}
      </div>
    </div>
  );
}
