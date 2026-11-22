import { GeistSans } from 'geist/font/sans';
import './globals.css';

export const metadata = {
  title: "Sipiki — Biashara Mkononi",
  description: "Soko la mtandaoni la wauzaji wa Kitanzania. Nunua na uza kote Tanzania.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="sw" className={GeistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
