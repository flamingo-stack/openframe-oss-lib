package com.openframe.data.config;

import com.openframe.data.document.rmm.script.ScriptStatus;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.PartialIndexFilter;
import org.springframework.data.mongodb.core.query.Criteria;

@Slf4j
@Configuration
public class MongoIndexConfig {

    /**
     * Partial-unique name index on {@code scripts}. Explicitly named so it
     * survives redeploys and can be dropped/recreated cleanly.
     */
    private static final String SCRIPTS_NAME_UNIQUE_INDEX = "scripts_tenant_name_notDeleted_unique";

    /**
     * Partial-unique name index on {@code script_schedules}. Same rationale as
     * {@link #SCRIPTS_NAME_UNIQUE_INDEX}: uniqueness ignores soft-deleted rows.
     */
    private static final String SCRIPT_SCHEDULES_NAME_UNIQUE_INDEX = "script_schedules_tenant_name_notDeleted_unique";

    /**
     * Partial-unique index on {@code tenant_keys}: at most one ACTIVE signing key per tenant.
     * Inactive (rotated-out) keys are excluded so they can pile up freely.
     */
    private static final String TENANT_KEYS_ACTIVE_UNIQUE_INDEX = "tenant_keys_tenant_active_unique";

    @Autowired
    private MongoTemplate mongoTemplate;

    @PostConstruct
    public void initIndexes() {
        // Load-bearing: the (provider, subject) unique index IS the enforcement of the
        // one-SSO-account-one-user invariant (registration guards rely on it, and
        // findByProviderAndSubject assumes at most one match). Created explicitly here so a single
        // missing auto-index-creation config in a new environment cannot silently drop it. Shares
        // the EXACT name of the @CompoundIndex on SsoIdentity — same name + same keys + same
        // options makes the two idempotent (Mongo would reject a second name for these keys with
        // IndexOptionsConflict/85).
        mongoTemplate.indexOps("sso_identities")
            .ensureIndex(new Index().on("provider", Sort.Direction.ASC)
                                    .on("subject", Sort.Direction.ASC)
                                    .unique()
                                    .named("sso_identities_provider_subject_unique"));

        mongoTemplate.indexOps("application_events")
            .ensureIndex(new Index().on("userId", Sort.Direction.ASC)
                                  .on("timestamp", Sort.Direction.DESC));

        mongoTemplate.indexOps("application_events")
            .ensureIndex(new Index().on("type", Sort.Direction.ASC)
                                  .on("metadata.tags", Sort.Direction.ASC));

        // Drop stale 'name' unique index from tags collection (legacy schema)
        dropStaleIndex("tags", "name");

        // Drop legacy org-scoped indexes — tags are now tenant-wide and uniqueness is
        // enforced by {key, entityType} via 'key_entity_idx'.
        dropStaleIndex("tags", "key_org_idx");
        dropStaleIndex("tags", "key_org_entity_idx");

        // Scripts: name uniqueness IGNORES soft-deleted rows so a user can
        // reuse the name of a script they previously deleted. The legacy
        // {tenantId, name} unique index (auto-named "tenantId_1_name_1") did
        // not filter status — drop it and recreate as a PARTIAL unique index
        // scoped to the non-deleted statuses.
        //
        // NOTE: the filter is expressed as {status: {$in: [ACTIVE, ARCHIVED]}}
        // rather than {status: {$ne: DELETED}}. MongoDB partial indexes reject
        // $ne (it rewrites to an unsupported $not) — see error 67
        // "Expression not supported in partial index: $not". $in is supported
        // (MongoDB 6.3+; server is 7.x). Keep this list in sync with every
        // non-DELETED value of ScriptStatus.
        dropStaleIndex("scripts", "tenantId_1_name_1");
        mongoTemplate.indexOps("scripts").ensureIndex(
                new Index().on("tenantId", Sort.Direction.ASC)
                        .on("name", Sort.Direction.ASC)
                        .unique()
                        .named(SCRIPTS_NAME_UNIQUE_INDEX)
                        .partial(PartialIndexFilter.of(Criteria.where("status")
                                .in(ScriptStatus.ACTIVE.name(), ScriptStatus.ARCHIVED.name()))));

        // Script schedules: same partial-unique name semantics as scripts —
        // (tenantId, name) unique, scoped to non-DELETED statuses so a deleted
        // schedule's name can be reused.
        mongoTemplate.indexOps("script_schedules").ensureIndex(
                new Index().on("tenantId", Sort.Direction.ASC)
                        .on("name", Sort.Direction.ASC)
                        .unique()
                        .named(SCRIPT_SCHEDULES_NAME_UNIQUE_INDEX)
                        .partial(PartialIndexFilter.of(Criteria.where("status")
                                .in(ScriptStatus.ACTIVE.name(), ScriptStatus.ARCHIVED.name()))));

        // Tenant signing keys: TenantKeyService creates a key on first use with a check-then-insert,
        // so concurrent first requests used to create two active keys (kid mismatches). This index
        // makes the loser's insert fail with DuplicateKeyException, which the service handles.
        // Guarded: a database that still holds duplicates must not fail startup — it logs instead,
        // and the index is created on the first boot after the duplicates are deactivated.
        try {
            mongoTemplate.indexOps("tenant_keys").ensureIndex(
                    new Index().on("tenantId", Sort.Direction.ASC)
                            .unique()
                            .named(TENANT_KEYS_ACTIVE_UNIQUE_INDEX)
                            .partial(PartialIndexFilter.of(Criteria.where("active").is(true))));
        } catch (Exception e) {
            log.error("Could not create unique index '{}' on tenant_keys - deactivate duplicate active keys per tenant: {}",
                    TENANT_KEYS_ACTIVE_UNIQUE_INDEX, e.getMessage());
        }
    }

    private void dropStaleIndex(String collection, String indexName) {
        try {
            mongoTemplate.indexOps(collection).dropIndex(indexName);
            log.info("Dropped stale index '{}' from collection '{}'", indexName, collection);
        } catch (Exception e) {
            // Index doesn't exist — nothing to do
            log.debug("Index '{}' not found on collection '{}', skipping", indexName, collection);
        }
    }
}