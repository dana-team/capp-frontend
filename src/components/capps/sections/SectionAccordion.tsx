import React from 'react'
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'

interface SectionAccordionProps {
  value: string
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}

export const SectionAccordion: React.FC<SectionAccordionProps> = ({ value, title, icon, children }) => (
  <AccordionItem value={value} className="border-border rounded-xl border bg-card overflow-hidden last:border-b">
    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-card rounded-lg">
      <div className="flex items-center gap-2 text-sm font-medium text-text">
        {icon}
        {title}
      </div>
    </AccordionTrigger>
    <AccordionContent className="px-4 pb-4">
      {children}
    </AccordionContent>
  </AccordionItem>
)
