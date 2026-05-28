package com.openframe.api.service.rmm;

import com.openframe.api.dto.script.CreateScriptInput;
import com.openframe.api.dto.script.ScriptPageResponse;
import com.openframe.api.dto.script.ScriptResponse;
import com.openframe.api.dto.script.UpdateScriptInput;
import com.openframe.api.mapper.ScriptMapper;
import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.rmm.Script;
import com.openframe.data.repository.rmm.ScriptRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

/**
 * Application-level operations on RMM scripts.
 *
 * <p>Tenant scoping is explicit in every signature: the caller (a GraphQL
 * resolver or REST controller) is responsible for extracting {@code tenantId}
 * from the authenticated principal and passing it in. This keeps the service
 * layer free of security-context coupling and makes it trivially unit-testable.
 *
 * <p>Reads and writes go through {@link ScriptRepository} (every call is
 * tenant-scoped). All document &harr; DTO translation is delegated to
 * {@link ScriptMapper}. This service enforces name uniqueness within the
 * tenant on create / update.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScriptService {

    private final ScriptRepository scriptRepository;
    private final ScriptMapper scriptMapper;

    /**
     * Create a new script in the given tenant.
     *
     * @throws ConflictException if a script with the same name already exists
     *         in the tenant.
     */
    public ScriptResponse create(String tenantId, CreateScriptInput input) {
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
     * Get a single script by id within the tenant.
     *
     * @throws NotFoundException if the script does not exist or belongs to a
     *         different tenant.
     */
    public ScriptResponse get(String tenantId, String id) {
        Script entity = loadOrThrow(tenantId, id);
        return scriptMapper.toResponse(entity);
    }

    /**
     * Paginated list of all scripts in the tenant.
     */
    public ScriptPageResponse list(String tenantId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Script> result = scriptRepository.findAllByTenantId(tenantId, pageable);
        return scriptMapper.toPageResponse(result);
    }

    /**
     * Apply a partial update to an existing script. Only non-null fields on
     * {@code input} are persisted (PATCH semantics).
     *
     * @throws NotFoundException if the script does not exist in the tenant.
     * @throws ConflictException if the supplied name collides with another
     *         script in the same tenant.
     */
    public ScriptResponse update(String tenantId, String id, UpdateScriptInput input) {
        Script existing = loadOrThrow(tenantId, id);

        if (input.getName() != null
                && !input.getName().equals(existing.getName())
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
     * Permanently remove a script from the tenant. Idempotent: a no-op when
     * the script does not exist in this tenant (the call simply logs and
     * returns).
     */
    public void delete(String tenantId, String id) {
        long removed = scriptRepository.deleteByTenantIdAndId(tenantId, id);
        if (removed == 0) {
            log.debug("Delete script id={} tenantId={} — nothing removed (not found)", id, tenantId);
        } else {
            log.info("Deleted script id={} tenantId={}", id, tenantId);
        }
    }

    private Script loadOrThrow(String tenantId, String id) {
        return scriptRepository.findByTenantIdAndId(tenantId, id)
                .orElseThrow(() -> new NotFoundException("Script not found: " + id));
    }
}
