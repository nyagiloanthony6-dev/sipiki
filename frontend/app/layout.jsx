import './globals.css';

export const metadata = {
  title: "Sipiki — Biashara Mkononi",
  description: "Soko la mtandaoni la wauzaji wa Kitanzania. Nunua na uza kote Tanzania.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="sw">
      <body>{children}</body>
    </html>
  );
}
