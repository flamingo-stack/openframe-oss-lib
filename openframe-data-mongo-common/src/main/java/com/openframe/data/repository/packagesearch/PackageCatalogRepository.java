package com.openframe.data.repository.packagesearch;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Collection;
import java.util.List;

public interface PackageCatalogRepository extends MongoRepository<PackageCatalogEntry, String> {

    // searchBlob is pre-lowered by the sync side, so the fragment must arrive lower-cased
    List<PackageCatalogEntry> findByManagerAndSearchBlobContaining(String manager, String searchBlobFragment);

    List<PackageCatalogEntry> findByIdIn(Collection<String> entryIds);
}
