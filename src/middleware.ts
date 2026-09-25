import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Langsung arahkan root dan login ke halaman dashboard /ringkasan
  if (pathname === '/' || pathname.startsWith('/login')) {
    const ringkasanUrl = request.nextUrl.clone();
    ringkasanUrl.pathname = '/ringkasan';
    return NextResponse.redirect(ringkasanUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
