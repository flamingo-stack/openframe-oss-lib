package com.openframe.api.service.rmm.script;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.rmm.script.CreateScriptInput;
import com.openframe.api.dto.rmm.script.ScriptFilterInput;
import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.api.dto.rmm.script.UpdateScriptInput;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.ScriptMapper;
import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.rmm.bootstrap.SystemScriptCode;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.document.rmm.script.ScriptType;
import com.openframe.data.document.rmm.software.SoftwareScriptCode;
import com.openframe.data.document.rmm.filter.ScriptQueryFilter;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScriptService {

    private static final List<ScriptStatus> NAME_UNIQUE_STATUSES =
            List.of(ScriptStatus.ACTIVE, ScriptStatus.ARCHIVED);

    private final ScriptRepository scriptRepository;
    private final ScriptMapper scriptMapper;
    private final TenantIdProvider tenantIdProvider;
    private final ScriptTagService scriptTagService;
    private final ScriptTimeoutValidator timeoutValidator;

    public ScriptResponse create(CreateScriptInput input, String createdBy) {
        String tenantId = tenantIdProvider.getTenantId();

        timeoutValidator.validate(input.getDefaultTimeoutSeconds());

        if (scriptRepository.existsByTenantIdAndNameAndStatusIn(tenantId, input.getName(), NAME_UNIQUE_STATUSES)) {
            throw new ConflictException(
                    "Script with name '" + input.getName() + "' already exists");
        }

        Script entity = scriptMapper.toEntity(tenantId, input);
        entity.setCreatedBy(createdBy);
        Script saved = scriptRepository.save(entity);
        scriptTagService.replaceTags(saved.getId(), input.getTagIds());
        log.info("Created script id={} name='{}' tenantId={}", saved.getId(), saved.getName(), tenantId);
        return scriptMapper.toResponse(saved);
    }

    public ScriptResponse get(String id) {
        Script entity = loadVisibleOrThrow(tenantIdProvider.getTenantId(), id);
        return scriptMapper.toResponse(entity);
    }

    public Optional<ScriptResponse> findById(String id) {
        return scriptRepository.findByTenantIdAndId(tenantIdProvider.getTenantId(), id)
                .filter(script -> script.getStatus() != ScriptStatus.DELETED)
                .map(scriptMapper::toResponse);
    }

    public List<ScriptResponse> getScriptsByIds(Collection<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        return scriptRepository.findByTenantIdAndIdIn(tenantIdProvider.getTenantId(), ids).stream()
                .map(scriptMapper::toResponse)
                .toList();
    }

    public ScriptResponse getSystemScript(SystemScriptCode code) {
        String tenantId = tenantIdProvider.getTenantId();
        return scriptRepository.findByTenantIdAndNameAndType(tenantId, code.canonicalName(), ScriptType.SYSTEM)
                .map(scriptMapper::toResponse)
                .orElseThrow(() -> new NotFoundException(
                        "System script not provisioned for this tenant: " + code.canonicalName()));
    }

    public ScriptResponse getSoftwareScript(SoftwareScriptCode code) {
        String tenantId = tenantIdProvider.getTenantId();
        return scriptRepository.findByTenantIdAndNameAndType(tenantId, code.canonicalName(), ScriptType.SOFTWARE)
                .map(scriptMapper::toResponse)
                .orElseThrow(() -> new NotFoundException(
                        "Software script not provisioned for this tenant: " + code.canonicalName()));
    }

    public CountedGenericQueryResult<ScriptResponse> list(ScriptFilterInput filter,
                                                          String search,
                                                          SortInput sort,
                                                          CursorPaginationCriteria pagination) {
        String tenantId = tenantIdProvider.getTenantId();
        CursorPaginationCriteria normalized = pagination.normalize();
        int limit = normalized.getLimit();

        String sortField = resolveSortField(sort);
        Sort.Direction sortDirection = resolveSortDirection(sort);
        ScriptQueryFilter queryFilter = toQueryFilter(filter);

        // Full matching total (tenant + filter + search), independent of the page —
        // lets the UI show the count up front while items load page by page.
        long filteredCount = scriptRepository.countForTenant(tenantId, queryFilter, search);

        List<Script> page = scriptRepository.findPageForTenant(
                tenantId, queryFilter, search, sortField, sortDirection,
                normalized.getCursor(), normalized.isBackward(), limit + 1);

        boolean hasMore = page.size() > limit;
        List<Script> items = hasMore ? page.subList(0, limit) : page;

        if (normalized.isBackward()) {
            items = items.reversed();
        }

        List<ScriptResponse> views = items.stream().map(scriptMapper::toResponse).toList();

        return CountedGenericQueryResult.<ScriptResponse>builder()
                .items(views)
                .pageInfo(buildPageInfo(views, hasMore, normalized))
                .filteredCount((int) filteredCount)
                .build();
    }

    private String resolveSortField(SortInput sort) {
        if (sort == null || sort.getField() == null || sort.getField().isBlank()) {
            return scriptRepository.getDefaultSortField();
        }

        String requested = sort.getField().trim();
        if (!scriptRepository.isSortableField(requested)) {
            log.warn("Invalid sort field requested for scripts: '{}' — falling back to default", requested);
            return scriptRepository.getDefaultSortField();
        }

        return requested;
    }

    private static Sort.Direction resolveSortDirection(SortInput sort) {
        if (sort != null && sort.getDirection() == SortDirection.ASC) {
            return Sort.Direction.ASC;
        }

        return Sort.Direction.DESC;
    }

    private static ScriptQueryFilter toQueryFilter(ScriptFilterInput input) {
        if (input == null) {
            return null;
        }

        return ScriptQueryFilter.builder()
                .shells(input.getShells())
                .statuses(input.getStatuses())
                .supportedPlatforms(input.getSupportedPlatforms())
                .tagIds(input.getTagIds())
                .createdByIds(input.getAuthorIds())
                .build();
    }

    public ScriptResponse update(UpdateScriptInput input) {
        String id = input.getId();
        String tenantId = tenantIdProvider.getTenantId();

        timeoutValidator.validate(input.getDefaultTimeoutSeconds());

        Script existing = loadVisibleOrThrow(tenantId, id);
        requireUserScript(existing);

        if (!input.getName().equals(existing.getName())
                && scriptRepository.existsByTenantIdAndNameAndIdNotAndStatusIn(
                        tenantId, input.getName(), id, NAME_UNIQUE_STATUSES)) {
            throw new ConflictException(
                    "Script with name '" + input.getName() + "' already exists");
        }

        scriptMapper.updateEntity(existing, input);
        Script saved = scriptRepository.save(existing);
        scriptTagService.replaceTags(saved.getId(), input.getTagIds());
        log.info("Updated script id={} tenantId={}", saved.getId(), tenantId);
        return scriptMapper.toResponse(saved);
    }

    public String delete(String id) {
        String tenantId = tenantIdProvider.getTenantId();
        Script existing = loadOrThrow(tenantId, id);
        requireUserScript(existing);

        if (existing.getStatus() == ScriptStatus.DELETED) {
            log.debug("Script id={} tenantId={} already soft-deleted, no-op", id, tenantId);
            return existing.getId();
        }

        existing.setStatus(ScriptStatus.DELETED);
        existing.setStatusChangedAt(Instant.now());
        scriptRepository.save(existing);
        log.info("Soft-deleted script id={} tenantId={}", id, tenantId);
        return existing.getId();
    }

    public ScriptResponse archive(String id) {
        return transitionTo(id, ScriptStatus.ARCHIVED);
    }

    public ScriptResponse unarchive(String id) {
        return transitionTo(id, ScriptStatus.ACTIVE);
    }

    private ScriptResponse transitionTo(String id, ScriptStatus target) {
        String tenantId = tenantIdProvider.getTenantId();
        Script existing = loadVisibleOrThrow(tenantId, id);
        requireUserScript(existing);

        if (existing.getStatus() == target) {
            log.debug("Script id={} tenantId={} already {}, no-op", id, tenantId, target);
            return scriptMapper.toResponse(existing);
        }

        existing.setStatus(target);
        existing.setStatusChangedAt(Instant.now());
        Script saved = scriptRepository.save(existing);
        log.info("Script id={} tenantId={} status changed to {}", id, tenantId, target);
        return scriptMapper.toResponse(saved);
    }

    private static void requireUserScript(Script script) {
        if (script.getType() != ScriptType.USER) {
            throw new IllegalArgumentException(
                    "Managed scripts (system / software) are provisioned by OpenFrame and cannot be modified or deleted");
        }
    }

    private Script loadOrThrow(String tenantId, String id) {
        return scriptRepository.findByTenantIdAndId(tenantId, id)
                .orElseThrow(() -> new NotFoundException("Script not found: " + id));
    }

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
