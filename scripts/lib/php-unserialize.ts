/**
 * PHP serialize() format parser.
 * Handles: string, int, float, bool, null, array, object.
 * Objects are returned as plain records (class name ignored).
 * Protected property prefixes (\0*\0) are stripped from keys.
 */

type PhpValue = string | number | boolean | null | PhpArray;
interface PhpArray {
  [key: string]: PhpValue;
}

class PhpReader {
  private pos = 0;
  constructor(private s: string) {}

  peek(): string {
    return this.s[this.pos];
  }
  read(n = 1): string {
    const r = this.s.substring(this.pos, this.pos + n);
    this.pos += n;
    return r;
  }
  expect(ch: string): void {
    const c = this.read();
    if (c !== ch) throw new Error(`Expected '${ch}' got '${c}' at pos ${this.pos - 1}`);
  }
  readUntil(ch: string): string {
    const i = this.s.indexOf(ch, this.pos);
    if (i === -1) throw new Error(`Expected '${ch}' not found after pos ${this.pos}`);
    const r = this.s.substring(this.pos, i);
    this.pos = i + 1;
    return r;
  }
  atEnd(): boolean {
    return this.pos >= this.s.length;
  }

  parse(): PhpValue {
    const type = this.read();
    switch (type) {
      case 'N':
        this.expect(';');
        return null;

      case 'b': {
        this.expect(':');
        const v = this.readUntil(';');
        return v === '1';
      }

      case 'i': {
        this.expect(':');
        const v = this.readUntil(';');
        return parseInt(v, 10);
      }

      case 'd': {
        this.expect(':');
        const v = this.readUntil(';');
        return parseFloat(v);
      }

      case 's': {
        this.expect(':');
        const len = parseInt(this.readUntil(':'), 10);
        this.expect('"');
        const raw = this.read(len);
        this.expect('"');
        this.expect(';');
        return raw;
      }

      case 'a': {
        this.expect(':');
        const count = parseInt(this.readUntil(':'), 10);
        this.expect('{');
        const obj: PhpArray = {};
        for (let i = 0; i < count; i++) {
          const key = this.parse();
          const val = this.parse();
          const k = stripNulPrefix(String(key));
          obj[k] = val;
        }
        this.expect('}');
        return obj;
      }

      case 'O': {
        this.expect(':');
        const classLen = parseInt(this.readUntil(':'), 10);
        this.expect('"');
        this.read(classLen); // class name — discard
        this.expect('"');
        this.expect(':');
        const propCount = parseInt(this.readUntil(':'), 10);
        this.expect('{');
        const obj: PhpArray = {};
        for (let i = 0; i < propCount; i++) {
          const key = this.parse();
          const val = this.parse();
          const k = stripNulPrefix(String(key));
          obj[k] = val;
        }
        this.expect('}');
        return obj;
      }

      default:
        throw new Error(`Unknown PHP type '${type}' at pos ${this.pos - 1}`);
    }
  }
}

function stripNulPrefix(key: string): string {
  // PHP protected: \0*\0propName → propName
  // PHP private:   \0ClassName\0propName → propName
  const nulIdx = key.lastIndexOf('\0');
  if (nulIdx >= 0) return key.substring(nulIdx + 1);
  // SQL dump may escape NUL as literal backslash-zero
  const escaped = key.replace(/\\0\*\\0/g, '').replace(/\\0[^\\]*\\0/g, '');
  return escaped;
}

export function phpUnserialize(s: string): PhpValue {
  if (!s || s.length === 0) return null;
  // Normalize escaped NUL bytes from SQL dumps: literal \0 → actual NUL char
  // Only do this if the string contains \0 but no actual NUL
  let normalized = s;
  if (s.includes('\\0') && !s.includes('\0')) {
    normalized = s.replace(/\\0/g, '\0');
  }
  try {
    const reader = new PhpReader(normalized);
    return reader.parse();
  } catch {
    return null;
  }
}

export type { PhpValue, PhpArray };
