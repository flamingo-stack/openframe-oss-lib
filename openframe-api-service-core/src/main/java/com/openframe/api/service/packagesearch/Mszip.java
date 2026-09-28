package com.openframe.api.service.packagesearch;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Arrays;
import java.util.zip.DataFormatException;
import java.util.zip.Inflater;

// Windows Compression API framing used by winget's versionData.mszyml: 28-byte header (uncompressed
// size at offset 8), then 'CK'-prefixed raw-deflate blocks where each block after the first uses the
// previous output as its dictionary — a single Inflater pass breaks on multi-block files.
final class Mszip {

    private static final int HEADER_SIZE = 28;
    private static final int UNCOMPRESSED_SIZE_OFFSET = 8;
    private static final int BLOCK_MAGIC_SIZE = 2;
    private static final int DICTIONARY_SIZE = 32768;
    private static final int INFLATE_BUFFER_SIZE = 8192;
    private static final long MAX_UNCOMPRESSED_SIZE = 64L * 1024 * 1024;

    private Mszip() {
    }

    static byte[] decompress(byte[] data) {
        long declaredSize = readDeclaredSize(data);
        ByteArrayOutputStream out = new ByteArrayOutputStream((int) declaredSize);
        int pos = HEADER_SIZE;
        while (pos + BLOCK_MAGIC_SIZE <= data.length && out.size() < declaredSize) {
            requireBlockMagic(data, pos);
            pos = inflateBlock(data, pos + BLOCK_MAGIC_SIZE, out);
        }
        requireExactSize(out, declaredSize);
        return out.toByteArray();
    }

    private static long readDeclaredSize(byte[] data) {
        if (data.length < HEADER_SIZE + BLOCK_MAGIC_SIZE) {
            throw new IllegalArgumentException("mszyml payload too short: " + data.length + " bytes");
        }
        long declaredSize = ByteBuffer.wrap(data, UNCOMPRESSED_SIZE_OFFSET, 8)
                .order(ByteOrder.LITTLE_ENDIAN)
                .getLong();
        if (declaredSize <= 0 || declaredSize > MAX_UNCOMPRESSED_SIZE) {
            throw new IllegalArgumentException("implausible mszyml uncompressed size: " + declaredSize);
        }
        return declaredSize;
    }

    private static void requireBlockMagic(byte[] data, int pos) {
        if (data[pos] != 'C' || data[pos + 1] != 'K') {
            throw new IllegalArgumentException("bad MSZIP block magic at offset " + pos);
        }
    }

    private static int inflateBlock(byte[] data, int blockStart, ByteArrayOutputStream out) {
        Inflater inflater = new Inflater(true);
        try {
            int remaining = data.length - blockStart;
            inflater.setInput(data, blockStart, remaining);
            byte[] dictionary = dictionaryWindow(out);
            if (dictionary.length > 0) {
                inflater.setDictionary(dictionary);
            }
            byte[] buffer = new byte[INFLATE_BUFFER_SIZE];
            while (!inflater.finished()) {
                int inflated = inflater.inflate(buffer);
                if (inflated == 0) {
                    break;
                }
                out.write(buffer, 0, inflated);
            }
            long consumed = inflater.getBytesRead();
            return blockStart + (int) consumed;
        } catch (DataFormatException e) {
            throw new IllegalArgumentException("corrupt MSZIP stream", e);
        } finally {
            inflater.end();
        }
    }

    private static byte[] dictionaryWindow(ByteArrayOutputStream out) {
        byte[] produced = out.toByteArray();
        if (produced.length <= DICTIONARY_SIZE) {
            return produced;
        }
        return Arrays.copyOfRange(produced, produced.length - DICTIONARY_SIZE, produced.length);
    }

    private static void requireExactSize(ByteArrayOutputStream out, long declaredSize) {
        if (out.size() != declaredSize) {
            throw new IllegalArgumentException(
                    "MSZIP decompressed to " + out.size() + " bytes, expected " + declaredSize);
        }
    }
}
