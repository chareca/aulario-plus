"""Make the PNG icons of the extension. This script does not use external packages."""
import struct
import sys
import zlib
from pathlib import Path

BG = (16, 82, 78, 255)
RING = (126, 226, 200, 255)
CORE = (236, 252, 247, 255)


def pixel(x, y, size):
    c = (size - 1) / 2
    d2 = (x - c) ** 2 + (y - c) ** 2
    if d2 <= (size * 0.16) ** 2:
        return CORE
    if (size * 0.27) ** 2 <= d2 <= (size * 0.36) ** 2:
        return RING
    return BG


def png(size):
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            raw += bytes(pixel(x, y, size))

    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xFFFFFFFF)

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')


if __name__ == '__main__':
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    for size in (16, 48, 128):
        (out / f'icon{size}.png').write_bytes(png(size))
    print(f'The icons are in {out}')
