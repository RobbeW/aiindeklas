import * as React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";

export default function ParticipantAccordion({ items }: { items: Array<{ title: string; body: string }> }) {
  return <Accordion type="multiple" className="participant-accordion">
    {items.map((item, index) => <AccordionItem value={`item-${index}`} key={`${item.title}-${index}`}>
      <AccordionTrigger>{item.title}</AccordionTrigger><AccordionContent><div dangerouslySetInnerHTML={{ __html: item.body }} /></AccordionContent>
    </AccordionItem>)}
  </Accordion>;
}
