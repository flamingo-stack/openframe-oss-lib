package com.openframe.api.service;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.device.DeviceFilterCriteria;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import com.openframe.api.service.processor.DeviceStatusProcessor;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.validation.annotation.Validated;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@Validated
@RequiredArgsConstructor
public class DeviceService {

    private static final String MACHINE_ID_FIELD = "machineId";
    
    private final MachineRepository machineRepository;
    private final TagRepository tagRepository;
    private final TagAssignmentRepository tagAssignmentRepository;
    private final DeviceStatusProcessor deviceStatusProcessor;

    public Optional<Machine> findByMachineId(@NotBlank String machineId) {
        log.debug("Finding machine by ID: {}", machineId);
        Optional<Machine> result = machineRepository.findByMachineId(machineId);
        log.debug("Found machine: {}", result.isPresent());
        return result;
    }

    public CountedGenericQueryResult<Machine> queryDevices(DeviceFilterCriteria filterOptions,
                                                  CursorPaginationCriteria paginationCriteria,
                                                  String search,
                                                  SortInput sort) {
        log.debug("Querying devices with filter: {}, pagination: {}, search: {}, sort: {}",
                filterOptions, paginationCriteria, search, sort);

        CursorPaginationCriteria normalizedPagination = paginationCriteria.normalize();
        Query query = buildDeviceQuery(filterOptions, search);

        String sortField = validateSortField(sort != null ? sort.getField() : null);
        SortDirection sortDirection = (sort != null && sort.getDirection() != null) ?
            sort.getDirection() : SortDirection.DESC;

        long totalFilteredCount = machineRepository.countMachines(query);

        List<Machine> pageItems = fetchPageItems(query, normalizedPagination, sortField, sortDirection);
        boolean hasNextPage = pageItems.size() == normalizedPagination.getLimit();

        PageInfo pageInfo = buildPageInfo(pageItems, hasNextPage, normalizedPagination.hasCursor());

        return CountedGenericQueryResult.<Machine>builder()
                .items(pageItems)
                .pageInfo(pageInfo)
                .filteredCount((int) totalFilteredCount)
                .build();
    }
    
    private List<Machine> fetchPageItems(@NotNull Query query, CursorPaginationCriteria criteria,
                                          String sortField, SortDirection sortDirection) {
        List<Machine> machines = machineRepository.findMachinesWithCursor(
            query, criteria.getCursor(), criteria.getLimit() + 1, sortField, sortDirection.name());
        return machines.size() > criteria.getLimit() 
            ? machines.subList(0, criteria.getLimit())
            : machines;
    }
    
    private PageInfo buildPageInfo(List<Machine> pageItems, boolean hasNextPage, boolean hasPreviousPage) {
        String startCursor = pageItems.isEmpty() ? null : CursorCodec.encode(pageItems.getFirst().getId());
        String endCursor = pageItems.isEmpty() ? null : CursorCodec.encode(pageItems.getLast().getId());

        return PageInfo.builder()
                .hasNextPage(hasNextPage)
                .hasPreviousPage(hasPreviousPage)
                .startCursor(startCursor)
                .endCursor(endCursor)
                .build();
    }

    private Query buildDeviceQuery(DeviceFilterCriteria filter, String search) {
        MachineQueryFilter queryFilter = mapToMachineQueryFilter(filter);
        Query query = machineRepository.buildDeviceQuery(queryFilter, search);

        if (filter != null) {
            List<String> machineIds = resolveTagFilterToMachineIds(filter);
            if (machineIds != null) {
                if (!machineIds.isEmpty()) {
                    query.addCriteria(Criteria.where(MACHINE_ID_FIELD).in(machineIds));
                } else {
                    // No machines match the tag filter — return empty results
                    query.addCriteria(Criteria.where(MACHINE_ID_FIELD).exists(false));
                }
            }
        }
        return query;
    }

    /**
     * Resolves tag-based filters (tagKeys, tagValues) to a set of machineIds.
     * Returns null if no tag filters are applied, meaning no restriction needed.
     * Returns an empty list if tag filters are applied but no machines match.
     */
    private List<String> resolveTagFilterToMachineIds(DeviceFilterCriteria filter) {
        boolean hasTagKeys = filter.getTagKeys() != null && !filter.getTagKeys().isEmpty();
        boolean hasTagValues = filter.getTagValues() != null && !filter.getTagValues().isEmpty();

        if (!hasTagKeys && !hasTagValues) {
            return null; // No tag filter applied
        }

        // 1. Resolve tag IDs from tag keys
        Set<String> resolvedTagIds = new HashSet<>();

        if (hasTagKeys) {
            List<Tag> tagsByKey = tagRepository.findByKeyInAndEntityType(filter.getTagKeys(), TagEntityType.DEVICE);
            tagsByKey.forEach(tag -> resolvedTagIds.add(tag.getId()));
        }

        if (resolvedTagIds.isEmpty() && hasTagKeys) {
            return new ArrayList<>(); // Tag filters applied but nothing matched
        }

        // 3. Get tag assignments with value filtering pushed to the query layer, scoped to DEVICE entity type
        List<TagAssignment> assignments;
        if (!resolvedTagIds.isEmpty() && hasTagValues) {
            assignments = tagAssignmentRepository.findByTagIdInAndValuesContainingAnyAndEntityType(
                    new ArrayList<>(resolvedTagIds), filter.getTagValues(), TagEntityType.DEVICE);
        } else if (!resolvedTagIds.isEmpty()) {
            assignments = tagAssignmentRepository.findByTagIdInAndEntityType(
                    new ArrayList<>(resolvedTagIds), TagEntityType.DEVICE);
        } else if (hasTagValues) {
            assignments = tagAssignmentRepository.findByValuesContainingAnyAndEntityType(
                    filter.getTagValues(), TagEntityType.DEVICE);
        } else {
            return new ArrayList<>();
        }

        // 4. Return distinct machineIds (entityId for DEVICE assignments)
        return assignments.stream()
                .map(TagAssignment::getEntityId)
                .distinct()
                .collect(Collectors.toList());
    }

    private MachineQueryFilter mapToMachineQueryFilter(DeviceFilterCriteria filter) {
        if (filter == null) {
            return new MachineQueryFilter();
        }
        MachineQueryFilter queryFilter = new MachineQueryFilter();
        queryFilter.setStatuses(filter.getStatuses() != null ?
                filter.getStatuses().stream().map(Enum::name).collect(Collectors.toList()) : null);
        queryFilter.setDeviceTypes(filter.getDeviceTypes() != null ?
                filter.getDeviceTypes().stream().map(Enum::name).collect(Collectors.toList()) : null);
        queryFilter.setOsTypes(filter.getOsTypes());
        queryFilter.setOrganizationIds(filter.getOrganizationIds());
        return queryFilter;
    }

    public void updateStatusByMachineId(@NotBlank String machineId, @NotNull DeviceStatus status) {
        log.info("Updating device status. machineId={}, newStatus={}", machineId, status);
        Machine machine = machineRepository.findByMachineId(machineId)
                .orElseThrow(() -> new DeviceNotFoundException("Device not found: " + machineId));
        if (machine.getStatus() == status) {
            log.info("Device {} already has status {}", machineId, status);
            return;
        }
        machine.setStatus(status);
        machine.setUpdatedAt(Instant.now());
        machineRepository.save(machine);
        log.info("Device {} status updated to {}", machineId, status);
        try {
            deviceStatusProcessor.postProcessStatusUpdated(machine);
        } catch (Exception e) {
            log.error("Post-processor failed for machineId={}: {}", machineId, e.getMessage(), e);
        }
    }
    
    private String validateSortField(String field) {
        if (field == null || field.trim().isEmpty()) {
            return machineRepository.getDefaultSortField();
        }
        String trimmedField = field.trim();
        if (!machineRepository.isSortableField(trimmedField)) {
            log.warn("Invalid sort field requested for devices: {}, using default", field);
            return machineRepository.getDefaultSortField();
        }
        return trimmedField;
    }
} 