package com.openframe.management.migration;

import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.rmm.Script;
import com.openframe.data.service.TenantIdProvider;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.List;

/**
 * One-off rename of the {@code OsType} enum value {@code MACOS} → {@code MAC_OS} inside every
 * {@link Script}'s {@code supportedPlatforms} array. The enum was renamed to match the shape the
 * Rust agent already sends; existing documents keep the old {@code "MACOS"} string until this
 * migration rewrites them.
 *
 * <p>Runs on the raw collection (not through the {@link Script} mapper) because the entity's
 * {@code OsType} enum no longer contains {@code MACOS} — deserialising the legacy value would fail.
 * The positional array filter {@code supportedPlatforms.$[e]} replaces only the matching entries,
 * leaving {@code "WINDOWS"} and any future values untouched. Idempotent: a document without any
 * {@code MACOS} entries is skipped by the {@code $eq} pre-filter.
 *
 * <p>Rollback is intentionally empty — restoring {@code "MACOS"} would re-introduce a value the
 * enum has since dropped, breaking every downstream read.
 */
@Slf4j
@ChangeUnit(id = "rename-os-type-macos-to-mac-os-in-scripts", order = "009", author = "openframe")
public class RenameOsTypeMacosToMacOsInScriptsChangeUnit {

    private static final String COLLECTION = "scripts";
    private static final String TENANT_ID_FIELD = "tenantId";
    private static final String SUPPORTED_PLATFORMS_FIELD = "supportedPlatforms";
    private static final String LEGACY_VALUE = "MACOS";
    private static final String CANONICAL_VALUE = "MAC_OS";

    @Execution
    public void execution(MongoTemplate mongoTemplate, TenantIdProvider tenantIdProvider) {
        String tenantId = tenantIdProvider.getTenantId();
        UpdateResult result = mongoTemplate.getCollection(COLLECTION).updateMany(
                new Document(TENANT_ID_FIELD, tenantId).append(SUPPORTED_PLATFORMS_FIELD, LEGACY_VALUE),
                new Document("$set", new Document(SUPPORTED_PLATFORMS_FIELD + ".$[e]", CANONICAL_VALUE)),
                new UpdateOptions().arrayFilters(List.of(new Document("e", LEGACY_VALUE)))
        );
        log.info("Renamed {} → {} in supportedPlatforms of {} script(s), tenantId={}",
                LEGACY_VALUE, CANONICAL_VALUE, result.getModifiedCount(), tenantId);
    }

    @RollbackExecution
    public void rollback() {
    }
}
