import Image from 'next/image';

export default function DonateGrid() {
  return (
    <section id="donate" className="mt-16">
      <h2 className="text-2xl font-bold">Donate</h2>
      <p className="mt-2 text-gray-600">Pixelock is a small indie project. If you’d like to support hosting and development, thank you! 🙏</p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <a className="card p-4 hover:shadow" href="https://buymeacoffee.com/7pt5" target="_blank">
          <div className="flex items-center gap-3">
            <Image src="/buymeacoffee_logo.png" alt="Buy Me a Coffee" width={40} height={40} />
            <div>
              <div className="font-semibold">Buy Me a Coffee</div>
              <div className="text-sm text-gray-600">Quick one-time tip</div>
            </div>
          </div>
        </a>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <Image src="/bluewallet_qr.png" alt="Bitcoin QR" width={40} height={40} />
            <div>
              <div className="font-semibold">Bitcoin</div>
              <div className="text-xs text-gray-600 break-all">bc1qx6dnzmj6updqlz0xfztfra60dpjjtfkf90fwuv</div>
            </div>
          </div>
        </div>
        <a className="card p-4 hover:shadow" href="https://x.com/returnEric" target="_blank">
          <div className="flex items-center gap-3">
            <Image src="/twitterX_logo.png" alt="X" width={40} height={40} />
            <div className="font-semibold">Follow me on X</div>
          </div>
        </a>
        <a className="card p-4 hover:shadow" href="mailto:eric@7pt5.com">
          <div className="flex items-center gap-3">
            <Image src="/pixelock_email_me.png" alt="Email" width={40} height={40} />
            <div className="font-semibold">Email me</div>
          </div>
        </a>
      </div>
      <a href="https://buymeacoffee.com/7pt5" target="_blank" className="mt-4 inline-block btn-primary">Donate now</a>
    </section>
  );
}
