package com.openframe.management.packagesearch;

import com.openframe.data.config.PackageManagerProperties;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChocoCatalogFetcherFetchAllTest {

    private static final String CATALOG_PATH = "/choco/catalog.json";
    private static final String SEARCH_PATH = "/choco/search/query";
    private static final String JSON = "application/json";
    private static final String OCTET_STREAM = "application/octet-stream";
    private static final String WINGET_ID = "7zip.7zip";
    private static final String CATALOG_JSON = """
            {"source":"x","generated":"2026-11-20T05:32:07Z","packages":[
              {"id":"7zip","version":"26.6.0","reason":"curated","file":"7zip.26.6.0.nupkg","sha256":"320c",
               "winget_id":"7zip.7zip","dependencies":[{"id":"7zip.install","range":"[26.6.0]"}]},
              {"id":"7zip.install","version":"26.6.0","reason":"dependency of 7zip"},
              {"id":"GoogleChrome","version":"159.0.8154.13","reason":"curated"},
              {"id":"chocolatey","version":"2.7.5","reason":"curated"},
              {"id":"openframe-client","version":"1.7.34","reason":"own"}]}
            """;
    private static final String SEARCH_JSON = """
            {"totalHits":2,"data":[
              {"id":"GoogleChrome","title":"Google Chrome","description":"Chrome is a fast browser",
               "projectUrl":"https://www.google.com/chrome/browser/","iconUrl":"","version":"159.0.8154.13"},
              {"id":"7zip","title":"7-Zip","description":"7-Zip is a file archiver",
               "projectUrl":"https://www.7-zip.org/","version":"26.6.0"}]}
            """;

    @Mock private PackageCatalogRepository catalogRepository;

    private final List<String> requestedPaths = new CopyOnWriteArrayList<>();

    private HttpServer feed;
    private ChocoCatalogFetcher fetcher;

    @BeforeEach
    void setUp() throws IOException {
        InetSocketAddress anyLocalPort = new InetSocketAddress(InetAddress.getLoopbackAddress(), 0);
        feed = HttpServer.create(anyLocalPort, 0);
        feed.start();
        PackageManagerProperties properties = new PackageManagerProperties();
        properties.getChoco().setFeedUrl("http://127.0.0.1:" + feed.getAddress().getPort() + "/choco/index.json");
        fetcher = new ChocoCatalogFetcher(properties, catalogRepository);
    }

    @AfterEach
    void tearDown() {
        feed.stop(0);
    }

    @Test
    void fetchAll_catalogAndSearchServedByTheFeed_curatedEntriesWithSearchTitlesAndWingetKeys() {
        // setup
        serve(CATALOG_PATH, JSON, CATALOG_JSON);
        serve(SEARCH_PATH, OCTET_STREAM, SEARCH_JSON);
        when(catalogRepository.findByManagerAndPackageIdIgnoreCase(PackageManagerType.WINGET, WINGET_ID))
                .thenReturn(List.of(wingetEntry()));

        // execution
        List<PackageCatalogEntry> entries = fetcher.fetchAll();

        // verifications
        assertThat(entries)
                .extracting(PackageCatalogEntry::getManager, PackageCatalogEntry::getPackageId,
                        PackageCatalogEntry::getVersion, PackageCatalogEntry::getName,
                        PackageCatalogEntry::getDescription, PackageCatalogEntry::getHomepage,
                        PackageCatalogEntry::getProductCodes)
                .containsExactly(
                        tuple(PackageManagerType.CHOCO, "7zip", "26.6.0", "7-Zip", "7-Zip is a file archiver",
                                "https://www.7-zip.org/", List.of("{23170f69-40c1-2702-2600-000001000000}")),
                        tuple(PackageManagerType.CHOCO, "GoogleChrome", "159.0.8154.13", "Google Chrome",
                                "Chrome is a fast browser", "https://www.google.com/chrome/browser/", null));
    }

    @Test
    void fetchAll_feedUrlOfTheIndexFile_catalogAndSearchReadNextToIt() {
        // setup
        serve(CATALOG_PATH, JSON, CATALOG_JSON);
        serve(SEARCH_PATH, OCTET_STREAM, SEARCH_JSON);

        // execution
        fetcher.fetchAll();

        // verifications
        assertThat(requestedPaths).containsExactly(CATALOG_PATH, SEARCH_PATH);
    }

    @Test
    void fetchAll_catalogWithAWingetId_wingetEntryLookedUpByThatIdIgnoringCase() {
        // setup
        serve(CATALOG_PATH, JSON, CATALOG_JSON);
        serve(SEARCH_PATH, OCTET_STREAM, SEARCH_JSON);

        // execution
        fetcher.fetchAll();

        // verifications
        verify(catalogRepository).findByManagerAndPackageIdIgnoreCase(PackageManagerType.WINGET, WINGET_ID);
        verifyNoMoreInteractions(catalogRepository);
    }

    @Test
    void fetchAll_wingetIdWithoutAWingetEntry_entryWithoutMatchingKeys() {
        // setup
        serve(CATALOG_PATH, JSON, CATALOG_JSON);
        serve(SEARCH_PATH, OCTET_STREAM, SEARCH_JSON);
        when(catalogRepository.findByManagerAndPackageIdIgnoreCase(PackageManagerType.WINGET, WINGET_ID))
                .thenReturn(List.of());

        // execution
        List<PackageCatalogEntry> entries = fetcher.fetchAll();

        // verifications
        assertThat(entries)
                .extracting(PackageCatalogEntry::getPackageId, PackageCatalogEntry::getProductCodes)
                .containsExactly(tuple("7zip", null), tuple("GoogleChrome", null));
    }

    @Test
    void fetchAll_emptyCatalogBody_illegalState() {
        // setup
        serve(CATALOG_PATH, JSON, "");
        serve(SEARCH_PATH, OCTET_STREAM, SEARCH_JSON);

        // execution
        IllegalStateException failed = assertThrows(IllegalStateException.class, () -> fetcher.fetchAll());

        // verifications
        assertThat(failed.getMessage()).contains("/catalog.json");
        verifyNoInteractions(catalogRepository);
    }

    @Test
    void fetchAll_emptySearchBody_illegalState() {
        // setup
        serve(CATALOG_PATH, JSON, CATALOG_JSON);
        serve(SEARCH_PATH, OCTET_STREAM, "");

        // execution
        IllegalStateException failed = assertThrows(IllegalStateException.class, () -> fetcher.fetchAll());

        // verifications
        assertThat(failed.getMessage()).contains("/search/query");
        verifyNoInteractions(catalogRepository);
    }

    private void serve(String path, String contentType, String body) {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        feed.createContext(path, exchange -> respond(exchange, contentType, bytes));
    }

    private void respond(HttpExchange exchange, String contentType, byte[] bytes) throws IOException {
        requestedPaths.add(exchange.getRequestURI().getPath());
        exchange.getResponseHeaders().add("Content-Type", contentType);
        if (bytes.length == 0) {
            exchange.sendResponseHeaders(200, -1);
            exchange.close();
            return;
        }
        exchange.sendResponseHeaders(200, bytes.length);
        try (OutputStream responseBody = exchange.getResponseBody()) {
            responseBody.write(bytes);
        }
    }

    private static PackageCatalogEntry wingetEntry() {
        return PackageCatalogEntry.builder()
                .manager(PackageManagerType.WINGET)
                .packageId(WINGET_ID)
                .name("7-Zip (winget)")
                .version("26.06")
                .productCodes(List.of("{23170f69-40c1-2702-2600-000001000000}"))
                .upgradeCodes(List.of("{23170f69-40c1-2702-0000-000004000000}"))
                .packageFamilyNames(List.of("7zip.7zip_8wekyb3d8bbwe"))
                .normalizedNames(List.of("7-zip", "7-zip(x64)"))
                .normalizedPublishers(List.of("igorpavlov"))
                .build();
    }
}
