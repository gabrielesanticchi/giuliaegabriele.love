import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production"
  });
  const pathname = request.nextUrl.pathname;

  if (!token?.adminId || token.invalid) {
    const login = new URL("/admin/login", request.url);
    login.searchParams.set(
      "callbackUrl",
      `${pathname}${request.nextUrl.search}`
    );
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/((?!login).*)"]
};
