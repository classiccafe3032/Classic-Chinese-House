import { useState } from "react";
import CategoryPlaceholder from "./CategoryPlaceholder";

interface Props {
  src?: string | null;
  alt: string;
  className?: string;
  category?: string;
}

export default function LazyImage({ src, alt, className, category }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Skeleton loader */}
      {!loaded && !error && !(!src || src.includes("placeholder.svg")) && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-muted via-muted/60 to-muted animate-pulse" />
      )}

      {error || !src || src.includes("placeholder.svg") ? (
        <CategoryPlaceholder category={category} />
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => {
            setError(true);
            setLoaded(true);
          }}
          className={`${className} transition-opacity duration-500 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}