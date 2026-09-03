package com.openframe.api.service.packagesearch;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.zip.Deflater;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MszipTest {

    @Test
    void decompressesSingleBlock() {
        byte[] payload = "sV: 1.0\nvD:\n- v: 154.0.1\n  rP: manifests/m/Mozilla/Firefox/154.0.1/f1d3\n"
                .getBytes(StandardCharsets.UTF_8);
        byte[] framed = frame(payload.length, deflateRaw(payload, null));

        assertArrayEquals(payload, Mszip.decompress(framed));
    }

    @Test
    void decompressesMultipleBlocksWithDictionary() {
        byte[] payload = new byte[50_000];
        for (int i = 0; i < payload.length; i++) {
            payload[i] = (byte) ((i * 31 + 7) % 251);
        }
        byte[] firstBlock = Arrays.copyOfRange(payload, 0, 32768);
        byte[] secondBlock = Arrays.copyOfRange(payload, 32768, payload.length);
        byte[] framed = frame(payload.length,
                deflateRaw(firstBlock, null),
                deflateRaw(secondBlock, firstBlock));

        assertArrayEquals(payload, Mszip.decompress(framed));
    }

    @Test
    void rejectsBadBlockMagic() {
        byte[] framed = frame(10, deflateRaw("0123456789".getBytes(StandardCharsets.UTF_8), null));
        framed[28] = 'X';

        assertThrows(IllegalArgumentException.class, () -> Mszip.decompress(framed));
    }

    @Test
    void rejectsTruncatedPayload() {
        assertThrows(IllegalArgumentException.class, () -> Mszip.decompress(new byte[10]));
    }

    private static byte[] frame(long uncompressedSize, byte[]... deflatedBlocks) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] header = new byte[28];
        ByteBuffer.wrap(header).order(ByteOrder.LITTLE_ENDIAN).putLong(8, uncompressedSize);
        out.writeBytes(header);
        for (byte[] block : deflatedBlocks) {
            out.write('C');
            out.write('K');
            out.writeBytes(block);
        }
        return out.toByteArray();
    }

    private static byte[] deflateRaw(byte[] data, byte[] dictionary) {
        Deflater deflater = new Deflater(Deflater.DEFAULT_COMPRESSION, true);
        try {
            if (dictionary != null) {
                deflater.setDictionary(dictionary);
            }
            deflater.setInput(data);
            deflater.finish();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            while (!deflater.finished()) {
                out.write(buffer, 0, deflater.deflate(buffer));
            }
            return out.toByteArray();
        } finally {
            deflater.end();
        }
    }
}
