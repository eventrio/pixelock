// Server Component: alias /img/<token> → /render/<token>
import { redirect } from "next/navigation";
import type { PageProps } from "next";

export default function ImgAliasPage(
  { params }: PageProps<{ token: string }>
) {
  const token = params.token;
  redirect(`/render/${encodeURIComponent(token)}`);
}
