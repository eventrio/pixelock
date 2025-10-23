// src/app/img/[token]/page.tsx
// Server Component: alias /img/<token> → /render/<token>
import { redirect } from "next/navigation";

export default function ImgAliasPage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token;
  redirect(`/render/${encodeURIComponent(token)}`);
}
