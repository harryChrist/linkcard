import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Themed toaster. Linkcard is dark-only (`<html class="dark">`), so the theme is
 * fixed instead of relying on a theme provider — `next-themes` injects a
 * blocking `<script>` that only makes sense when the HTML is server-rendered.
 */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-center"
      closeButton
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast border border-border bg-popover/95 text-popover-foreground backdrop-blur-md",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}
