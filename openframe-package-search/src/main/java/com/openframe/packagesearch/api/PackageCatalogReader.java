package com.openframe.packagesearch.api;

import com.openframe.packagesearch.PackageCatalogEntry;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.packagesearch.PackageManagerType;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.List;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
public class PackageCatalogReader {

    // PackageCatalogEntry is deliberately not TenantScoped (public data, one copy per tenant DB);
    // the tenant-aware template is the house-mandated injection point either way
    private final TenantAwareMongoTemplate mongoTemplate;

    List<PackageCatalogEntry> findCandidates(PackageManagerType manager, String queryLower) {
        String quotedQuery = Pattern.quote(queryLower);
        String managerName = manager.name();
        Criteria criteria = Criteria.where("manager").is(managerName).and("searchBlob").regex(quotedQuery);
        return mongoTemplate.find(new Query(criteria), PackageCatalogEntry.class);
    }

    List<PackageCatalogEntry> findByEntryIds(Collection<String> entryIds) {
        Criteria byIds = Criteria.where("_id").in(entryIds);
        return mongoTemplate.find(new Query(byIds), PackageCatalogEntry.class);
    }
}
