// import { addYears } from 'date-fns'
import { NextRequest, NextResponse } from 'next/server'

export const config = {
  matcher:[
    // match every page except api, static and favicon.ico
    '/((?!api|static|favicon.ico).*)',
  ]
}

export function middleware(req) {
  if (process.env.VERCEL_ENV === 'preview'){
    const basicAuth = req.headers.get('authorization')
    const url = req.nextUrl

    if (basicAuth) {
      const authValue = basicAuth.split(' ')[1]
      const [user, pwd] = atob(authValue, 'base64').split(':')
  
      if (user === process.env.BASIC_AUTH_USERNAME && pwd === process.env.BASIC_AUTH_PASSWORD) {
        return NextResponse.next()
      }
    }
  
    url.pathname='/api/devauth'
    return NextResponse.rewrite(url)
  }else {
    return NextResponse.next()
  }
}