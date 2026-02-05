package com.openframe.test.data.db.collections;

import com.mongodb.client.model.Filters;
import com.openframe.test.data.dto.tenant.Tenant;

import static com.openframe.test.data.db.MongoDB.getCollection;

public class TenantsCollection {

    public static Tenant findTenantByDomain(String domain) {
        return findTenant("domain", domain);
    }

    public static Tenant findTenant(String field, String value) {
        return getCollection("tenants", Tenant.class).find(Filters.eq(field, value)).first();
    }

}
