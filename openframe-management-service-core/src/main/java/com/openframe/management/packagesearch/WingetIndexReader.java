package com.openframe.management.packagesearch;

import lombok.AllArgsConstructor;
import lombok.Getter;
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
    private static final String PRODUCT_CODES_QUERY = "SELECT package, productcode FROM productcodes2";
    private static final String NORMALIZED_PUBLISHERS_QUERY = "SELECT package, norm_publisher FROM norm_publishers2";
    private static final String PACKAGE_FAMILY_NAMES_QUERY = "SELECT package, pfn FROM pfns2";

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
            MatchingKeys keys = new MatchingKeys(
                    readValuesByPackage(connection, PRODUCT_CODES_QUERY),
                    readValuesByPackage(connection, UPGRADE_CODES_QUERY),
                    readValuesByPackage(connection, NORMALIZED_NAMES_QUERY),
                    readValuesByPackage(connection, NORMALIZED_PUBLISHERS_QUERY),
                    readValuesByPackage(connection, PACKAGE_FAMILY_NAMES_QUERY));
            return readEntries(connection, keys);
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

    private static List<WingetEntry> readEntries(Connection connection, MatchingKeys keys) throws SQLException {
        List<WingetEntry> entries = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(PACKAGES_QUERY)) {
            while (resultSet.next()) {
                long rowId = resultSet.getLong(1);
                WingetEntry entry = toEntry(resultSet, keys, rowId);
                entries.add(entry);
            }
        }
        return entries;
    }

    private static WingetEntry toEntry(ResultSet resultSet, MatchingKeys keys, long rowId) throws SQLException {
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
                .productCodes(keys.of(keys.getProductCodes(), rowId))
                .upgradeCodes(keys.of(keys.getUpgradeCodes(), rowId))
                .normalizedNames(keys.of(keys.getNormalizedNames(), rowId))
                .normalizedPublishers(keys.of(keys.getNormalizedPublishers(), rowId))
                .packageFamilyNames(keys.of(keys.getPackageFamilyNames(), rowId))
                .build();
    }

    // what winget matches an installed program by, per package row id
    @Getter
    @AllArgsConstructor
    private static class MatchingKeys {
        private final Map<Long, List<String>> productCodes;
        private final Map<Long, List<String>> upgradeCodes;
        private final Map<Long, List<String>> normalizedNames;
        private final Map<Long, List<String>> normalizedPublishers;
        private final Map<Long, List<String>> packageFamilyNames;

        List<String> of(Map<Long, List<String>> keysByPackage, long rowId) {
            return keysByPackage.getOrDefault(rowId, List.of());
        }
    }
}
