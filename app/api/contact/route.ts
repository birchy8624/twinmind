import { NextResponse } from 'next/server'

export async function POST(req: Request){
  const payload = await req.json().catch(()=>null)
  console.log('Contact form submission:', payload)
  // TODO: integrate with email service or database (e.g., Resend, Postmark, Supabase)
  return NextResponse.json({ ok: true })
}
