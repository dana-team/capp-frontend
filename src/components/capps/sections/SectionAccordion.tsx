import React from 'react'
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Sheet } from '@/components/layout/Sheet'

interface SectionAccordionProps {
  value: string
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}

/** One collapsible sheet per form section; `section-<value>` is the anchor id. */
export const SectionAccordion: React.FC<SectionAccordionProps> = ({ value, title, icon, children }) => (
  <Sheet as="div" id={`section-${value}`} className="scroll-mt-24 overflow-hidden">
    <AccordionItem value={value} className="border-0">
      <AccordionTrigger className="px-5 py-3.5 hover:no-underline hover:text-text">
        <div className="flex items-center gap-2 font-display text-lg font-medium tracking-tight text-text">
          {icon}
          {title}
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-t border-border-subtle px-5 pb-5 pt-5">
        {children}
      </AccordionContent>
    </AccordionItem>
  </Sheet>
)
