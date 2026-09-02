package com.openframe.management.packagesearch;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.core.rest.PackageSearchRestClientFactory;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.management.packagesearch.WingetIndexReader.WingetEntry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
public class WingetCatalogFetcher {

    private static final String INDEX_PATH = "/cache/source2.msix";

    private final RestClient restClient;

    public WingetCatalogFetcher(PackageCatalogSyncProperties properties) {
        PackageCatalogSyncProperties.Winget winget = properties.getWinget();
        this.restClient = PackageSearchRestClientFactory.create(winget.getBaseUrl(), winget.getTimeout());
    }

    public List<PackageCatalogEntry> fetchAll() {
        byte[] msix = restClient.get().uri(INDEX_PATH).retrieve().body(byte[].class);
        if (msix == null) {
            throw new IllegalStateException("empty winget index response");
        }
        List<WingetEntry> indexEntries = WingetIndexReader.read(msix);
        List<PackageCatalogEntry> entries = new ArrayList<>();
        for (WingetEntry indexEntry : indexEntries) {
            if (shouldSkip(indexEntry)) {
                continue;
            }
            entries.add(toEntry(indexEntry));
        }
        log.info("Fetched winget package index: {} entries", entries.size());
        return entries;
    }

    // a row without id or name cannot be rendered or installed; name is non-null in GraphQL
    private static boolean shouldSkip(WingetEntry indexEntry) {
        return indexEntry.getId() == null || indexEntry.getName() == null;
    }

    private static PackageCatalogEntry toEntry(WingetEntry indexEntry) {
        String id = indexEntry.getId();
        String name = indexEntry.getName();
        String moniker = indexEntry.getMoniker();
        List<String> aliases = moniker == null || moniker.isBlank() ? List.of() : List.of(moniker);
        String blob = SearchBlob.of(id, name, null, aliases);
        return PackageCatalogEntry.builder()
                .manager(PackageManagerType.WINGET.name())
                .packageId(id)
                .name(name)
                .version(indexEntry.getLatestVersion())
                .publisher(publisherFromId(id))
                .hashPrefix(indexEntry.getHashPrefix())
                .aliases(aliases)
                .searchBlob(blob)
                .build();
    }

    private static String publisherFromId(String packageId) {
        int dot = packageId.indexOf('.');
        return dot > 0 ? packageId.substring(0, dot) : null;
    }
}
