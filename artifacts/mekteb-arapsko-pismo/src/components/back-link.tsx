import { forwardRef, type ButtonHTMLAttributes } from "react";
import { useLocation } from "wouter";
import { goBackOr } from "@/lib/back-navigation";

type BackLinkProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  fallback: string;
};

/**
 * Povratna navigacija za link-stilizovane kontrole.
 * Fallback se koristi samo za stranice otvorene direktnim URL-om.
 */
export const BackLink = forwardRef<HTMLButtonElement, BackLinkProps>(
  function BackLink({ fallback, onClick, type = "button", ...props }, ref) {
    const [, setLocation] = useLocation();

    return (
      <button
        {...props}
        ref={ref}
        type={type}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) {
            goBackOr(() => setLocation(fallback));
          }
        }}
      />
    );
  },
);