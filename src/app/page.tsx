import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-8 space-y-6">
      <h1 className="text-2xl font-semibold">PIXELock</h1>
      <p className="text-sm text-gray-600">
        Secure, time-limited image sharing. Use the uploader to add a new image.
      </p>

      <div>
        <Link
          href="/upload"
          className="inline-block rounded bg-black px-4 py-2 text-white"
        >
          Go to Upload
        </Link>
      </div>
    </main>
  );
}
