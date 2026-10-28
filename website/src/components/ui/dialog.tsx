import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
export const DialogOverlay = React.forwardRef<React.ComponentRef<typeof DialogPrimitive.Overlay>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>>(
  ({ className, ...props }, ref) => <DialogPrimitive.Overlay ref={ref} className={cn("ui-dialog__overlay", className)} {...props} />,
);
export const DialogContent = React.forwardRef<React.ComponentRef<typeof DialogPrimitive.Content>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>>(
  ({ className, children, ...props }, ref) => <DialogPortal><DialogOverlay /><DialogPrimitive.Content ref={ref} className={cn("ui-dialog__content", className)} {...props}>{children}</DialogPrimitive.Content></DialogPortal>,
);
export function DialogHeader(props: React.HTMLAttributes<HTMLDivElement>) { return <div {...props} className={cn("ui-dialog__header", props.className)} />; }
export function DialogFooter(props: React.HTMLAttributes<HTMLDivElement>) { return <div {...props} className={cn("ui-dialog__footer", props.className)} />; }
DialogOverlay.displayName = "DialogOverlay";
DialogContent.displayName = "DialogContent";
