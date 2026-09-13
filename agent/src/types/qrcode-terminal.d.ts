declare module "qrcode-terminal" {
  interface GenerateOptions {
    small?: boolean;
    [key: string]: unknown;
  }

  interface QRCodeTerminal {
    generate(
      text: string,
      opts?: GenerateOptions,
      callback?: (qr: string) => void
    ): void;

    setErrorLevel(level: "L" | "M" | "Q" | "H"): void;
  }

  const qrcode: QRCodeTerminal;
  export = qrcode;
}