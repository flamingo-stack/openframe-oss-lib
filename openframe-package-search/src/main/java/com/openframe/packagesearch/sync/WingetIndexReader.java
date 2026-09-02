package com.openframe.packagesearch.sync;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

final class WingetIndexReader {

    private static final String INDEX_ENTRY_NAME = "Public/index.db";

    @Getter
    @AllArgsConstructor
    static final class WingetEntry {
        private final String id;
        private final String name;
        private final String moniker;
        private final String latestVersion;
        // first 8 hex chars of the package hash, lower-cased — a CDN path segment that 404s on upper-case
        private final String hashPrefix;
    }

    private WingetIndexReader() {
    }

    static List<WingetEntry> read(byte[] msixBytes) {
        Path tempMsix;
        Path tempDb;
        try {
            tempMsix = Files.createTempFile("winget-source", ".msix");
            tempDb = Files.createTempFile("winget-index", ".db");
        } catch (IOException e) {
            throw new UncheckedIOException("failed to create winget temp files", e);
        }
        try {
            Files.write(tempMsix, msixBytes);
            extractIndexDb(tempMsix, tempDb);
            return readPackages(tempDb);
        } catch (IOException e) {
            throw new UncheckedIOException("failed to read winget source index", e);
        } catch (SQLException e) {
            throw new IllegalStateException("failed to read winget index database", e);
        } finally {
            deleteQuietly(tempMsix);
            deleteQuietly(tempDb);
        }
    }

    private static void deleteQuietly(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // temp-file cleanup must never mask the real outcome
        }
    }

    // MSIX entries carry data descriptors that break the streaming ZipInputStream, hence ZipFile
    private static void extractIndexDb(Path msix, Path target) throws IOException {
        File msixFile = msix.toFile();
        try (ZipFile zip = new ZipFile(msixFile)) {
            ZipEntry entry = zip.getEntry(INDEX_ENTRY_NAME);
            if (entry == null) {
                throw new IOException(INDEX_ENTRY_NAME + " not found in winget source index");
            }
            try (InputStream in = zip.getInputStream(entry)) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
        }
    }

    private static List<WingetEntry> readPackages(Path db) throws SQLException {
        Path absoluteDb = db.toAbsolutePath();
        String jdbcUrl = "jdbc:sqlite:" + absoluteDb;
        List<WingetEntry> entries = new ArrayList<>();
        try (Connection connection = DriverManager.getConnection(jdbcUrl);
             Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(
                     "SELECT id, name, moniker, latest_version, lower(substr(hex(hash), 1, 8)) FROM packages")) {
            while (resultSet.next()) {
                String id = resultSet.getString(1);
                String name = resultSet.getString(2);
                String moniker = resultSet.getString(3);
                String latestVersion = resultSet.getString(4);
                String hashPrefix = resultSet.getString(5);
                WingetEntry entry = new WingetEntry(id, name, moniker, latestVersion, hashPrefix);
                entries.add(entry);
            }
        }
        return entries;
    }
}
