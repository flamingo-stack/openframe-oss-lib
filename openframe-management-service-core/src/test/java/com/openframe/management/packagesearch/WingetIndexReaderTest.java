package com.openframe.management.packagesearch;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class WingetIndexReaderTest {

    private static final String UPGRADE_CODE = "{0b36e3b7-0042-452d-b376-57e0c07addbb}";

    @Test
    void readsPackagesFromMsixZip(@TempDir Path tempDir) throws Exception {
        Path db = indexWithFirefox(tempDir);

        List<WingetEntry> entries = new WingetIndexReader().read(msix("Public/index.db", Files.readAllBytes(db)));

        assertEquals(1, entries.size());
        WingetEntry entry = entries.getFirst();
        assertEquals("Mozilla.Firefox", entry.getId());
        assertEquals("Mozilla Firefox", entry.getName());
        assertEquals("firefox", entry.getMoniker());
        assertEquals("154.0.1", entry.getLatestVersion());
        assertEquals("baf85eaa", entry.getHashPrefix());
    }

    @Test
    void read_packageWithMatchingKeys_keysAndDisplayVersionRead(@TempDir Path tempDir) throws Exception {
        // setup
        Path db = indexWithFirefox(tempDir);
        byte[] index = Files.readAllBytes(db);
        byte[] msix = msix("Public/index.db", index);

        // execution
        List<WingetEntry> entries = new WingetIndexReader().read(msix);

        // verifications
        assertThat(entries)
                .extracting(WingetEntry::getLatestDisplayVersion, WingetEntry::getProductCodes, WingetEntry::getUpgradeCodes,
                        WingetEntry::getNormalizedNames, WingetEntry::getNormalizedPublishers, WingetEntry::getPackageFamilyNames)
                .containsExactly(tuple("154.0.1.9001", List.of("mozilla firefox 154.0.1 (x64 en-us)"), List.of(UPGRADE_CODE),
                        List.of("mozillafirefox", "mozillafirefox(X64)"), List.of("mozilla"), List.of("mozilla.firefox_n80bbvh6b1yt2")));
    }

    @Test
    void read_packageWithoutMatchingKeys_emptyKeys(@TempDir Path tempDir) throws Exception {
        // setup
        Path db = tempDir.resolve("index.db");
        createIndex(db);
        insertPackage(db, "7zip.7zip");
        byte[] index = Files.readAllBytes(db);
        byte[] msix = msix("Public/index.db", index);

        // execution
        List<WingetEntry> entries = new WingetIndexReader().read(msix);

        // verifications
        assertThat(entries)
                .extracting(WingetEntry::getProductCodes, WingetEntry::getUpgradeCodes, WingetEntry::getNormalizedNames,
                        WingetEntry::getNormalizedPublishers)
                .containsExactly(tuple(List.of(), List.of(), List.of(), List.of()));
    }

    @Test
    void failsWhenIndexEntryMissing() throws Exception {
        byte[] zipWithoutIndex = msix("AppxManifest.xml", "<x/>".getBytes(StandardCharsets.UTF_8));

        assertThrows(UncheckedIOException.class, () -> new WingetIndexReader().read(zipWithoutIndex));
    }

    private static Path indexWithFirefox(Path tempDir) throws SQLException {
        Path db = tempDir.resolve("index.db");
        createIndex(db);
        insertPackage(db, "Mozilla.Firefox");
        try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + db);
             Statement statement = connection.createStatement()) {
            statement.execute("INSERT INTO upgradecodes2(upgradecode, package) VALUES ('" + UPGRADE_CODE + "', 1)");
            statement.execute("INSERT INTO norm_names2(norm_name, package) VALUES ('mozillafirefox', 1)");
            statement.execute("INSERT INTO norm_names2(norm_name, package) VALUES ('mozillafirefox(X64)', 1)");
            statement.execute("INSERT INTO productcodes2(productcode, package) VALUES ('mozilla firefox 154.0.1 (x64 en-us)', 1)");
            statement.execute("INSERT INTO norm_publishers2(norm_publisher, package) VALUES ('mozilla', 1)");
            statement.execute("INSERT INTO pfns2(pfn, package) VALUES ('mozilla.firefox_n80bbvh6b1yt2', 1)");
        }
        return db;
    }

    private static void createIndex(Path db) throws SQLException {
        try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + db);
             Statement statement = connection.createStatement()) {
            statement.execute("CREATE TABLE packages(rowid INTEGER PRIMARY KEY, id TEXT NOT NULL, "
                    + "name TEXT NOT NULL, moniker TEXT, latest_version TEXT NOT NULL, "
                    + "arp_min_version TEXT, arp_max_version TEXT, hash BLOB)");
            statement.execute("CREATE TABLE upgradecodes2(upgradecode TEXT NOT NULL, package INT64 NOT NULL, "
                    + "PRIMARY KEY(upgradecode, package)) WITHOUT ROWID");
            statement.execute("CREATE TABLE norm_names2(norm_name TEXT NOT NULL, package INT64 NOT NULL, "
                    + "PRIMARY KEY(norm_name, package)) WITHOUT ROWID");
            statement.execute("CREATE TABLE productcodes2(productcode TEXT NOT NULL, package INT64 NOT NULL, "
                    + "PRIMARY KEY(productcode, package)) WITHOUT ROWID");
            statement.execute("CREATE TABLE norm_publishers2(norm_publisher TEXT NOT NULL, package INT64 NOT NULL, "
                    + "PRIMARY KEY(norm_publisher, package)) WITHOUT ROWID");
            statement.execute("CREATE TABLE pfns2(pfn TEXT NOT NULL, package INT64 NOT NULL, "
                    + "PRIMARY KEY(pfn, package)) WITHOUT ROWID");
        }
    }

    private static void insertPackage(Path db, String id) throws SQLException {
        try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + db);
             PreparedStatement insert = connection.prepareStatement("INSERT INTO packages(id, name, moniker, "
                     + "latest_version, arp_max_version, hash) VALUES (?, ?, ?, ?, ?, ?)")) {
            insert.setString(1, id);
            insert.setString(2, "Mozilla Firefox");
            insert.setString(3, "firefox");
            insert.setString(4, "154.0.1");
            insert.setString(5, "154.0.1.9001");
            insert.setBytes(6, new byte[]{(byte) 0xBA, (byte) 0xF8, 0x5E, (byte) 0xAA, 0x11, 0x22});
            insert.executeUpdate();
        }
    }

    private static byte[] msix(String entryName, byte[] content) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            zip.putNextEntry(new ZipEntry(entryName));
            zip.write(content);
            zip.closeEntry();
        }
        return bytes.toByteArray();
    }
}
