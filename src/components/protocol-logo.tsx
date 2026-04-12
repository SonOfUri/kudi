"use client";

import Image from "next/image";

import { protocolLogoPath } from "@/lib/protocol-logo";

type ProtocolLogoProps = {
  protocolName: string | undefined;
  /** Pixel width/height (square). */
  size?: number;
  className?: string;
};

export function ProtocolLogo({ protocolName, size = 16, className }: ProtocolLogoProps) {
  const src = protocolLogoPath(protocolName);
  if (!src) return null;
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      className={className ?? "shrink-0 object-contain"}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}
