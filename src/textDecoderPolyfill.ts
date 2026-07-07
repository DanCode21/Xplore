// Hermes' TextDecoder only supports utf-8, but h3-js (Emscripten-compiled)
// runs `new TextDecoder('utf-16le')` at import time, which throws
// `RangeError: Unknown encoding: utf-16le`. Wrap the global so utf-16le
// requests get a manual little-endian decoder; all other encodings pass
// through to the native implementation. Must be imported before h3-js.

type TextDecoderInput = ArrayBuffer | ArrayBufferView;

const NativeTextDecoder = (globalThis as any).TextDecoder;

function nativeSupportsUtf16le(): boolean {
  try {
    new NativeTextDecoder('utf-16le');
    return true;
  } catch {
    return false;
  }
}

function toBytes(input?: TextDecoderInput): Uint8Array {
  if (!input) return new Uint8Array(0);
  if (input instanceof Uint8Array) return input;
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  return new Uint8Array(input);
}

function decodeUtf16le(input?: TextDecoderInput): string {
  const bytes = toBytes(input);
  const codeUnits: number[] = [];
  const parts: string[] = [];
  const CHUNK = 4096;
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    codeUnits.push(bytes[i] | (bytes[i + 1] << 8));
    if (codeUnits.length === CHUNK) {
      parts.push(String.fromCharCode(...codeUnits));
      codeUnits.length = 0;
    }
  }
  if (codeUnits.length > 0) parts.push(String.fromCharCode(...codeUnits));
  return parts.join('');
}

if (NativeTextDecoder && !nativeSupportsUtf16le()) {
  class PatchedTextDecoder {
    readonly encoding: string;
    readonly fatal = false;
    readonly ignoreBOM = false;
    private native: any = null;

    constructor(label = 'utf-8', options?: unknown) {
      const enc = String(label).toLowerCase();
      if (enc === 'utf-16le' || enc === 'utf-16') {
        this.encoding = 'utf-16le';
      } else {
        this.native = new NativeTextDecoder(label, options);
        this.encoding = this.native.encoding;
      }
    }

    decode(input?: TextDecoderInput): string {
      if (this.native) return this.native.decode(input);
      return decodeUtf16le(input);
    }
  }

  (globalThis as any).TextDecoder = PatchedTextDecoder;
}
