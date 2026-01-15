declare module "qrcode" {
  export function toString(
    text: string,
    options: { type: string; small?: boolean },
    callback: (err: Error | null | undefined, qrCode: string) => void
  ): void;

  export function toDataURL(
    text: string,
    callback: (err: Error | null | undefined, url: string) => void
  ): void;

  export function toDataURL(
    text: string,
    options: object,
    callback: (err: Error | null | undefined, url: string) => void
  ): void;

  export function toFile(
    path: string,
    text: string,
    callback: (err: Error | null | undefined) => void
  ): void;

  export function toFile(
    path: string,
    text: string,
    options: object,
    callback: (err: Error | null | undefined) => void
  ): void;
}
