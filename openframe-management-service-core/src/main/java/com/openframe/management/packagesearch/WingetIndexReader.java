package com.openframe.management.packagesearch;

import org.springframework.stereotype.Component;

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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

@Component
class WingetIndexReader {

    private static final String INDEX_ENTRY_NAME = "Public/index.db";
    private static final String PACKAGES_QUERY = "SELECT rowid, id, name, moniker, latest_version, arp_max_version, "
            + "lower(substr(hex(hash), 1, 8)) FROM packages";
    private static final String UPGRADE_CODES_QUERY = "SELECT package, upgradecode FROM upgradecodes2";
    private static final String NORMALIZED_NAMES_QUERY = "SELECT package, norm_name FROM norm_names2";

    List<WingetEntry> read(byte[] msixBytes) {
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
        try (Connection connection = DriverManager.getConnection(jdbcUrl)) {
            Map<Long, List<String>> upgradeCodes = readValuesByPackage(connection, UPGRADE_CODES_QUERY);
            Map<Long, List<String>> normalizedNames = readValuesByPackage(connection, NORMALIZED_NAMES_QUERY);
            return readEntries(connection, upgradeCodes, normalizedNames);
        }
    }

    private static Map<Long, List<String>> readValuesByPackage(Connection connection, String query)
            throws SQLException {
        Map<Long, List<String>> valuesByPackage = new HashMap<>();
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(query)) {
            while (resultSet.next()) {
                long packageRowId = resultSet.getLong(1);
                String value = resultSet.getString(2);
                List<String> values = valuesByPackage.computeIfAbsent(packageRowId, rowId -> new ArrayList<>());
                values.add(value);
            }
        }
        return valuesByPackage;
    }

    private static List<WingetEntry> readEntries(Connection connection, Map<Long, List<String>> upgradeCodes,
                                                 Map<Long, List<String>> normalizedNames) throws SQLException {
        List<WingetEntry> entries = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(PACKAGES_QUERY)) {
            while (resultSet.next()) {
                long rowId = resultSet.getLong(1);
                List<String> packageUpgradeCodes = upgradeCodes.getOrDefault(rowId, List.of());
                List<String> packageNormalizedNames = normalizedNames.getOrDefault(rowId, List.of());
                WingetEntry entry = toEntry(resultSet, packageUpgradeCodes, packageNormalizedNames);
                entries.add(entry);
            }
        }
        return entries;
    }

    private static WingetEntry toEntry(ResultSet resultSet, List<String> upgradeCodes, List<String> normalizedNames)
            throws SQLException {
        String id = resultSet.getString(2);
        String name = resultSet.getString(3);
        String moniker = resultSet.getString(4);
        String latestVersion = resultSet.getString(5);
        String latestDisplayVersion = resultSet.getString(6);
        String hashPrefix = resultSet.getString(7);
        return WingetEntry.builder()
                .id(id)
                .name(name)
                .moniker(moniker)
                .latestVersion(latestVersion)
                .latestDisplayVersion(latestDisplayVersion)
                .hashPrefix(hashPrefix)
                .upgradeCodes(upgradeCodes)
                .normalizedNames(normalizedNames)
                .build();
    }
}
