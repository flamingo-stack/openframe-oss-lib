package com.openframe.test.util;

import lombok.experimental.UtilityClass;
import org.apache.commons.lang3.RandomStringUtils;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

@UtilityClass
public class FileUtils {

    private final Path UPLOAD_DIR = Path.of("target", "files", "upload");

    public Path createRandomFile(long size) {
        try {
            Files.createDirectories(UPLOAD_DIR);
            Path file = Files.createTempFile(UPLOAD_DIR, "upload-", ".txt");
            Files.writeString(file, RandomStringUtils.randomAscii((int) size), StandardCharsets.US_ASCII);
            return file;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}