package com.openframe.api.service.rmm;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.script.CreateScriptInput;
import com.openframe.api.dto.script.ScriptResponse;
import com.openframe.api.dto.script.UpdateScriptInput;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.mapper.ScriptMapper;
import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.rmm.Script;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/**
 * Application-level operations on RMM scripts.
 *
 * <p>Tenant scoping is resolved internally via {@link TenantIdProvider} — the
 * pod's physical tenant id (DB-per-tenant architecture). Callers do not pass
 * tenantId; we deliberately do NOT trust JWT claims for tenant scoping because
 * a super-admin token can carry a foreign tenant id but writes still have to
 * land in this pod's tenant data. Mirrors the {@code LogService} /
 * {@code DeviceFilterService} pattern.
 *
 * <p>All reads and writes go through {@link ScriptRepository} (every call is
 * tenant-scoped via the resolved id). Document &harr; DTO translation is
 * delegated to {@link ScriptMapper}. This service enforces name uniqueness
 * within the tenant on create / update, and treats
 * {@link ScriptStatus#DELETED} as "doesn't exist" for {@link #get(String)} and
 * {@link #update(String, UpdateScriptInput)} — soft-deleted scripts are
 * invisible from the standard API surface but the documents remain so
 * historic execution records keep resolving.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScriptService {

    private final ScriptRepository scriptRepository;
    private final ScriptMapper scriptMapper;
    private final TenantIdProvider tenantIdProvider;

    /**
     * Create a new script in the current pod's tenant.
     *
     * @throws ConflictException if a script with the same name already exists
     *         in the tenant.
     */
    public ScriptResponse create(CreateScriptInput input) {
        String tenantId = tenantIdProvider.getTenantId();

        if (scriptRepository.existsByTenantIdAndName(tenantId, input.getName())) {
            throw new ConflictException(
                    "Script with name '" + input.getName() + "' already exists in this tenant");
        }

        Script entity = scriptMapper.toEntity(tenantId, input);
        Script saved = scriptRepository.save(entity);
        log.info("Created script id={} name='{}' tenantId={}", saved.getId(), saved.getName(), tenantId);
        return scriptMapper.toResponse(saved);
    }

    /**
     * Get a single script by id within the current pod's tenant.
     *
     * @throws NotFoundException if the script does not exist, belongs to a
     *         different tenant, or has been soft-deleted.
     */
    public ScriptResponse get(String id) {
        Script entity = loadVisibleOrThrow(tenantIdProvider.getTenantId(), id);
        return scriptMapper.toResponse(entity);
    }

    /**
     * Cursor-paginated list of scripts in the current pod's tenant.
     *
     * <p>Default order is newest-first (by {@code _id} desc). Uses the standard
     * "fetch limit + 1" trick to detect {@code hasNextPage} / {@code hasPreviousPage}
     * without an extra count query.
     */
    public GenericQueryResult<ScriptResponse> list(CursorPaginationCriteria pagination) {
        String tenantId = tenantIdProvider.getTenantId();
        CursorPaginationCriteria normalized = pagination.normalize();
        int limit = normalized.getLimit();

        List<Script> page = scriptRepository.findPageForTenant(
                tenantId, normalized.getCursor(), normalized.isBackward(), limit + 1);

        boolean hasMore = page.size() > limit;
        List<Script> items = hasMore ? page.subList(0, limit) : page;

        if (normalized.isBackward()) {
            items = items.reversed();
        }

        List<ScriptResponse> views = items.stream().map(scriptMapper::toResponse).toList();

        return GenericQueryResult.<ScriptResponse>builder()
                .items(views)
                .pageInfo(buildPageInfo(views, hasMore, normalized))
                .build();
    }

    /**
     * Full replacement of an existing script (PUT semantics).
     *
     * @throws NotFoundException if the script does not exist or has been
     *         soft-deleted in the tenant.
     * @throws ConflictException if the supplied name collides with another
     *         script in the same tenant.
     */
    public ScriptResponse update(String id, UpdateScriptInput input) {
        String tenantId = tenantIdProvider.getTenantId();
        Script existing = loadVisibleOrThrow(tenantId, id);

        if (!input.getName().equals(existing.getName())
                && scriptRepository.existsByTenantIdAndNameAndIdNot(tenantId, input.getName(), id)) {
            throw new ConflictException(
                    "Script with name '" + input.getName() + "' already exists in this tenant");
        }

        scriptMapper.updateEntity(existing, input);
        Script saved = scriptRepository.save(existing);
        log.info("Updated script id={} tenantId={}", saved.getId(), tenantId);
        return scriptMapper.toResponse(saved);
    }

    /**
     * Soft-delete a script: transition status to {@link ScriptStatus#DELETED}
     * and stamp {@code statusChangedAt}. The document itself remains so that
     * historic execution records continue to resolve.
     *
     * <p>Idempotent on already-deleted scripts (no-op + debug log).
     *
     * @throws NotFoundException if the script id does not exist in the tenant.
     */
    public void delete(String id) {
        String tenantId = tenantIdProvider.getTenantId();
        Script existing = loadOrThrow(tenantId, id);

        if (existing.getStatus() == ScriptStatus.DELETED) {
            log.debug("Script id={} tenantId={} already soft-deleted, no-op", id, tenantId);
            return;
        }

        existing.setStatus(ScriptStatus.DELETED);
        existing.setStatusChangedAt(Instant.now());
        scriptRepository.save(existing);
        log.info("Soft-deleted script id={} tenantId={}", id, tenantId);
    }

    /** Load by id regardless of status — used by {@link #delete(String)}. */
    private Script loadOrThrow(String tenantId, String id) {
        return scriptRepository.findByTenantIdAndId(tenantId, id)
                .orElseThrow(() -> new NotFoundException("Script not found: " + id));
    }

    /**
     * Load by id, treating {@link ScriptStatus#DELETED} documents as not
     * found. Used by {@link #get(String)} and
     * {@link #update(String, UpdateScriptInput)} so soft-deleted scripts are
     * invisible from the standard API surface.
     */
    private Script loadVisibleOrThrow(String tenantId, String id) {
        Script script = loadOrThrow(tenantId, id);
        if (script.getStatus() == ScriptStatus.DELETED) {
            throw new NotFoundException("Script not found: " + id);
        }
        return script;
    }

    private static PageInfo buildPageInfo(List<ScriptResponse> items, boolean hasMore,
                                          CursorPaginationCriteria criteria) {
        String startCursor = items.isEmpty() ? null : CursorCodec.encode(items.getFirst().getId());
        String endCursor = items.isEmpty() ? null : CursorCodec.encode(items.getLast().getId());

        boolean hasNextPage = criteria.isBackward() ? criteria.hasCursor() : hasMore;
        boolean hasPreviousPage = criteria.isBackward() ? hasMore : criteria.hasCursor();

        return PageInfo.builder()
                .hasNextPage(hasNextPage)
                .hasPreviousPage(hasPreviousPage)
                .startCursor(startCursor)
                .endCursor(endCursor)
                .build();
    }
}
