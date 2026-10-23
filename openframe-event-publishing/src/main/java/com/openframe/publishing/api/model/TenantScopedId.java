package com.openframe.publishing.api.model;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;

// A document id inside its tenant: a reconcile batch reads several tenants at once, and an id is unique only in one.
@Getter
@EqualsAndHashCode
@AllArgsConstructor
public class TenantScopedId {

    private final String tenantId;
    private final String id;
}
