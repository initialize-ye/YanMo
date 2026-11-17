import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/grade", "/mistakes", "/history", "/settings", "/report", "/account"];
const AUTH_PAGES = ["/login"];

function publicOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto") ??
    (request.nextUrl.protocol ? request.nextUrl.protocol.replace(":", "") : "https");
  if (!host) return request.nextUrl.origin;
  return `${proto}://${host}`;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get("yanmo_session")?.value);
  const isProtected =
    pathname === "/" || PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isProtected && !hasSession) {
    const url = new URL("/login", publicOrigin(request));
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (AUTH_PAGES.includes(pathname) && hasSession) {
    return NextResponse.redirect(new URL("/", publicOrigin(request)));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/grade/:path*",
    "/mistakes/:path*",
    "/history/:path*",
    "/settings/:path*",
    "/report/:path*",
    "/account/:path*",
    "/login"
  ]
};
