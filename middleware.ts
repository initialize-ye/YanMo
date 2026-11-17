import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/", "/grade", "/mistakes", "/history", "/settings", "/report"];
const AUTH_PAGES = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get("yanmo_session")?.value);

  const isProtected =
    pathname === "/" || PROTECTED.some((prefix) => prefix !== "/" && pathname.startsWith(prefix));

  if (isProtected && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (AUTH_PAGES.includes(pathname) && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/grade/:path*", "/mistakes/:path*", "/history/:path*", "/settings/:path*", "/report/:path*", "/login"]
};
