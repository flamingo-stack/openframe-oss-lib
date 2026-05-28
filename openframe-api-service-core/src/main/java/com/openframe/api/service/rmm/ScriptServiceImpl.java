package com.openframe.api.service.rmm;

import com.openframe.api.dto.script.CreateScriptInput;
import com.openframe.api.dto.script.ScriptEnvVarDto;
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

import java.util.List;

/**
 * Default implementation of {@link ScriptService}.
 *
 * <p>Reads and writes go through {@link ScriptRepository} (every call is
 * tenant-scoped). All document &harr; DTO translation is delegated to
 * {@link ScriptMapper}. The service layer is responsible for:
 * <ul>
 *   <li>uniqueness validation on name (create + update)</li>
 *   <li>rejecting secret env vars until the secret pipeline lands</li>
 *   <li>soft-delete bookkeeping (status + statusChangedAt)</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScriptServiceImpl implements ScriptService {

    private final ScriptRepository scriptRepository;
    private final ScriptMapper scriptMapper;

    @Override
    public ScriptResponse create(String tenantId, CreateScriptInput input) {
        rejectSecretEnvVars(input.getEnvVars());

        if (scriptRepository.existsByTenantIdAndName(tenantId, input.getName())) {
            throw new ConflictException(
                    "Script with name '" + input.getName() + "' already exists in this tenant");
        }

        Script entity = scriptMapper.toEntity(tenantId, input);
        Script saved = scriptRepository.save(entity);
        log.info("Created script id={} name='{}' tenantId={}", saved.getId(), saved.getName(), tenantId);
        return scriptMapper.toResponse(saved);
    }

    @Override
    public ScriptResponse get(String tenantId, String id) {
        Script entity = loadOrThrow(tenantId, id);
        return scriptMapper.toResponse(entity);
    }

    @Override
    public ScriptPageResponse list(String tenantId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Script> result = scriptRepository.findAllByTenantId(tenantId, pageable);
        return scriptMapper.toPageResponse(result);
    }

    @Override
    public ScriptResponse update(String tenantId, String id, UpdateScriptInput input) {
        rejectSecretEnvVars(input.getEnvVars());

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

    @Override
    public void delete(String tenantId, String id) {
        scriptRepository.deleteByTenantIdAndId(tenantId, id);
        log.info("Soft-deleted script id={} tenantId={}", id, tenantId);
    }

    private Script loadOrThrow(String tenantId, String id) {
        return scriptRepository.findByTenantIdAndId(tenantId, id)
                .orElseThrow(() -> new NotFoundException("Script not found: " + id));
    }

    /**
     * Until secret-management (encryption + secure delivery) is implemented we
     * refuse to accept env vars flagged as secret rather than silently storing
     * plaintext "secrets" in MongoDB.
     */
    private void rejectSecretEnvVars(List<ScriptEnvVarDto> envVars) {
        if (envVars == null) {
            return;
        }
        boolean hasSecret = envVars.stream().anyMatch(ScriptEnvVarDto::isSecret);
        if (hasSecret) {
            throw new IllegalArgumentException(
                    "Secret environment variables are not yet supported. "
                            + "Set secret=false or omit the variable until the "
                            + "secret-management story lands.");
        }
    }
}
