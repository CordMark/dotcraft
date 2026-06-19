import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  preload?: boolean;
  sizes?: string;
};

export function BrandLogo({
  className,
  preload = false,
  sizes = "(max-width: 640px) 132px, 162px",
}: BrandLogoProps) {
  const classNames = ["brand-logo", className].filter(Boolean).join(" ");

  return (
    <span className={classNames} aria-hidden="true" style={{ position: "relative" }}>
      <Image
        className="brand-logo-image"
        src="/assets/dotcraft-transparent.png"
        alt=""
        fill
        preload={preload}
        sizes={sizes}
      />
    </span>
  );
}
