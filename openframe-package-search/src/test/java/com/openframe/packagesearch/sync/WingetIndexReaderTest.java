package com.openframe.packagesearch.sync;

import com.openframe.packagesearch.sync.WingetIndexReader.WingetEntry;
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
import java.sql.Statement;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class WingetIndexReaderTest {

    @Test
    void readsPackagesFromMsixZip(@TempDir Path tempDir) throws Exception {
        Path db = tempDir.resolve("index.db");
        try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + db)) {
            try (Statement statement = connection.createStatement()) {
                statement.execute("CREATE TABLE packages(rowid INTEGER PRIMARY KEY, id TEXT NOT NULL, "
                        + "name TEXT NOT NULL, moniker TEXT, latest_version TEXT NOT NULL, "
                        + "arp_min_version TEXT, arp_max_version TEXT, hash BLOB)");
            }
            try (PreparedStatement insert = connection.prepareStatement(
                    "INSERT INTO packages(id, name, moniker, latest_version, hash) VALUES (?, ?, ?, ?, ?)")) {
                insert.setString(1, "Mozilla.Firefox");
                insert.setString(2, "Mozilla Firefox");
                insert.setString(3, "firefox");
                insert.setString(4, "154.0.1");
                insert.setBytes(5, new byte[]{(byte) 0xBA, (byte) 0xF8, 0x5E, (byte) 0xAA, 0x11, 0x22});
                insert.executeUpdate();
            }
        }

        List<WingetEntry> entries = WingetIndexReader.read(msix("Public/index.db", Files.readAllBytes(db)));

        assertEquals(1, entries.size());
        WingetEntry entry = entries.getFirst();
        assertEquals("Mozilla.Firefox", entry.getId());
        assertEquals("Mozilla Firefox", entry.getName());
        assertEquals("firefox", entry.getMoniker());
        assertEquals("154.0.1", entry.getLatestVersion());
        assertEquals("baf85eaa", entry.getHashPrefix());
    }

    @Test
    void failsWhenIndexEntryMissing() throws Exception {
        byte[] zipWithoutIndex = msix("AppxManifest.xml", "<x/>".getBytes(StandardCharsets.UTF_8));

        assertThrows(UncheckedIOException.class, () -> WingetIndexReader.read(zipWithoutIndex));
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
