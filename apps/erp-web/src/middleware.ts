export { auth as middleware } from "./lib/auth/config.js";

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login).*)"],
};
