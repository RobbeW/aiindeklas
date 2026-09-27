import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { cn } from "@/lib/utils";

export const Accordion = AccordionPrimitive.Root;
export const AccordionItem = React.forwardRef<React.ComponentRef<typeof AccordionPrimitive.Item>, React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>>(
  ({ className, ...props }, ref) => <AccordionPrimitive.Item ref={ref} className={cn("ui-accordion", className)} {...props} />,
);
export const AccordionTrigger = React.forwardRef<React.ComponentRef<typeof AccordionPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>>(
  ({ className, children, ...props }, ref) => <AccordionPrimitive.Header className="ui-accordion__header"><AccordionPrimitive.Trigger ref={ref} className={cn("ui-accordion__trigger", className)} {...props}>{children}<span aria-hidden="true" className="ui-accordion__indicator">+</span></AccordionPrimitive.Trigger></AccordionPrimitive.Header>,
);
export const AccordionContent = React.forwardRef<React.ComponentRef<typeof AccordionPrimitive.Content>, React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>>(
  ({ className, children, ...props }, ref) => <AccordionPrimitive.Content ref={ref} className={cn("ui-accordion__content", className)} {...props}><div className="ui-accordion__content-inner">{children}</div></AccordionPrimitive.Content>,
);
AccordionItem.displayName = "AccordionItem";
AccordionTrigger.displayName = "AccordionTrigger";
AccordionContent.displayName = "AccordionContent";
