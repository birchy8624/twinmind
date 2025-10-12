'use client'
import { ReactNode } from 'react'
import { motion } from 'framer-motion'

export default function Section({ id, children, muted=false, className='' }:{ id?:string; children:ReactNode; muted?:boolean; className?:string }){
  return (
    <section id={id} className={`section ${muted ? 'bg-base-800/30' : ''} ${className}`}>
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
        >
          {children}
        </motion.div>
      </div>
    </section>
  )
}
