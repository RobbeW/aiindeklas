import * as React from "react";
import { cn } from "@/lib/utils";

const part = (name: string, Tag: "div" | "article" | "h3" | "p") =>
  React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(({ className, ...props }, ref) =>
    React.createElement(Tag, { ref, className: cn(name, className), ...props }),
  );

export const Card = part("ui-card", "article");
export const CardHeader = part("ui-card__header", "div");
export const CardTitle = part("ui-card__title", "h3");
export const CardDescription = part("ui-card__description", "p");
export const CardAction = part("ui-card__action", "div");
export const CardContent = part("ui-card__content", "div");
export const CardFooter = part("ui-card__footer", "div");
