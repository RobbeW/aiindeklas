import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;
export const DrawerTitle = DialogPrimitive.Title;
export const DrawerDescription = DialogPrimitive.Description;
export const DrawerContent = React.forwardRef<React.ComponentRef<typeof DialogPrimitive.Content>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>>(
  ({ className, children, ...props }, ref) => <DialogPrimitive.Portal><DialogPrimitive.Overlay className="ui-dialog__overlay ui-drawer__overlay" /><DialogPrimitive.Content ref={ref} className={cn("ui-drawer__content", className)} {...props}>{children}</DialogPrimitive.Content></DialogPrimitive.Portal>,
);
export function DrawerHeader(props: React.HTMLAttributes<HTMLDivElement>) { return <div {...props} className={cn("ui-drawer__header", props.className)} />; }
export function DrawerFooter(props: React.HTMLAttributes<HTMLDivElement>) { return <div {...props} className={cn("ui-drawer__footer", props.className)} />; }
DrawerContent.displayName = "DrawerContent";
