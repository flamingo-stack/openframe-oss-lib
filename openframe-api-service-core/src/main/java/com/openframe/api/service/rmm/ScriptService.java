package com.openframe.api.service.rmm;

import com.openframe.api.dto.script.CreateScriptInput;
import com.openframe.api.dto.script.ScriptPageResponse;
import com.openframe.api.dto.script.ScriptResponse;
import com.openframe.api.dto.script.UpdateScriptInput;

/**
 * Application-level operations on RMM scripts.
 *
 * <p>Tenant scoping is explicit in every signature: the caller (a GraphQL
 * resolver or REST controller) is responsible for extracting {@code tenantId}
 * from the authenticated principal and passing it in. This keeps the service
 * layer free of security-context coupling and makes it trivially unit-testable.
 *
 * <p>Soft delete is the default removal semantics — see {@link #delete(String, String)}.
 */
public interface ScriptService {

    /**
     * Create a new script in the given tenant.
     *
     * @throws com.openframe.core.exception.ConflictException if a script with
     *         the same name already exists in the tenant.
     */
    ScriptResponse create(String tenantId, CreateScriptInput input);

    /**
     * Get a single script by id within the tenant.
     *
     * @throws com.openframe.core.exception.NotFoundException if the script
     *         does not exist or belongs to a different tenant.
     */
    ScriptResponse get(String tenantId, String id);

    /**
     * Paginated list of all scripts in the tenant, including soft-deleted
     * ones. Status-based filtering will be added when the UI requires it.
     */
    ScriptPageResponse list(String tenantId, int page, int size);

    /**
     * Apply a partial update to an existing script. Only non-null fields on
     * {@code input} are persisted (PATCH semantics).
     *
     * @throws com.openframe.core.exception.NotFoundException if the script
     *         does not exist in the tenant.
     * @throws com.openframe.core.exception.ConflictException if the supplied
     *         name collides with another script in the same tenant.
     */
    ScriptResponse update(String tenantId, String id, UpdateScriptInput input);

    /**
     * Soft-delete a script: status is transitioned to {@code DELETED} and
     * {@code statusChangedAt} is set, but the document itself remains so that
     * historic execution records continue to resolve.
     *
     * <p>Hard delete (physical removal) is intentionally not exposed here yet —
     * the repository supports it for future admin / tenant-cleanup tooling.
     *
     * @throws com.openframe.core.exception.NotFoundException if the script
     *         does not exist in the tenant.
     */
    void delete(String tenantId, String id);
}
