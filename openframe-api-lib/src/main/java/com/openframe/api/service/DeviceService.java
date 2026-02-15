package com.openframe.api.service;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.device.DeviceFilterOptions;
import com.openframe.api.dto.shared.CursorPageInfo;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.MachineTag;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.document.tool.Tag;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.device.MachineTagRepository;
import com.openframe.data.repository.tool.TagRepository;
import com.openframe.api.service.processor.DeviceStatusProcessor;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.validation.annotation.Validated;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import static java.time.Instant.now;

@Service
@Slf4j
@Validated
@RequiredArgsConstructor
public class DeviceService {

    private static final String MACHINE_ID_FIELD = "machineId";
    
    private final MachineRepository machineRepository;
    private final TagRepository tagRepository;
    private final MachineTagRepository machineTagRepository;
    private final DeviceStatusProcessor deviceStatusProcessor;

    public Optional<Machine> findByMachineId(@NotBlank String machineId) {
        log.debug("Finding machine by ID: {}", machineId);
        Optional<Machine> result = machineRepository.findByMachineId(machineId);
        log.debug("Found machine: {}", result.isPresent());
        return result;
    }

    public CountedGenericQueryResult<Machine> queryDevices(DeviceFilterOptions filterOptions,
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

        CursorPageInfo pageInfo = buildPageInfo(pageItems, hasNextPage, normalizedPagination.hasCursor());

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
    
    private CursorPageInfo buildPageInfo(List<Machine> pageItems, boolean hasNextPage, boolean hasPreviousPage) {
        String startCursor = pageItems.isEmpty() ? null : pageItems.getFirst().getId();
        String endCursor = pageItems.isEmpty() ? null : pageItems.getLast().getId();
        
        return CursorPageInfo.builder()
                .hasNextPage(hasNextPage)
                .hasPreviousPage(hasPreviousPage)
                .startCursor(startCursor)
                .endCursor(endCursor)
                .build();
    }

    private Query buildDeviceQuery(DeviceFilterOptions filter, String search) {
        MachineQueryFilter queryFilter = mapToMachineQueryFilter(filter);
        Query query = machineRepository.buildDeviceQuery(queryFilter, search);

        if (filter != null && filter.getTagNames() != null && !filter.getTagNames().isEmpty()) {
            List<String> machineIds = resolveTagNamesToMachineIds(filter.getTagNames());
            if (!machineIds.isEmpty()) {
                query.addCriteria(Criteria.where(MACHINE_ID_FIELD).in(machineIds));
            } else {
                query.addCriteria(Criteria.where(MACHINE_ID_FIELD).exists(false));
            }
        }
        return query;
    }

    private List<String> resolveTagNamesToMachineIds(List<String> tagNames) {
        List<Tag> tags = tagRepository.findByNameIn(tagNames);
        List<String> tagIds = tags.stream()
                .map(Tag::getId)
                .collect(Collectors.toList());
        if (tagIds.isEmpty()) {
            return new ArrayList<>();
        }
        List<MachineTag> machineTags = machineTagRepository.findByTagIdIn(tagIds);
        return machineTags.stream()
                .map(MachineTag::getMachineId)
                .distinct()
                .collect(Collectors.toList());
    }

    private MachineQueryFilter mapToMachineQueryFilter(DeviceFilterOptions filter) {
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
        queryFilter.setTagNames(filter.getTagNames());
        return queryFilter;
    }

    public void softDeleteByMachineId(@NotBlank String machineId) {
        log.info("Soft deleting device with machineId={}", machineId);
        Machine machine = machineRepository.findByMachineId(machineId)
                .orElseThrow(() -> new DeviceNotFoundException("Device not found: " + machineId));

        if (machine.getStatus() != DeviceStatus.DELETED) {
            machine.setStatus(DeviceStatus.DELETED);
            machineRepository.save(machine);
            log.info("Device {} marked as DELETED", machineId);
        } else {
            log.warn("Device {} is already DELETED", machineId);
        }
    }

    public void updateStatusByMachineId(@NotBlank String machineId, @NotNull DeviceStatus status) {
        log.info("Updating device status. machineId={}, newStatus={}", machineId, status);
        Machine machine = machineRepository.findByMachineId(machineId)
                .orElseThrow(() -> new DeviceNotFoundException("Device not found: " + machineId));
        DeviceStatus previousStatus = machine.getStatus();
        if (previousStatus == status) {
            log.info("Device {} already has status {}", machineId, status);
            return;
        }
        machine.setStatus(status);
        machine.setUpdatedAt(now());
        machineRepository.save(machine);
        deviceStatusProcessor.postProcessStatusUpdated(machine, previousStatus);
        log.info("Device {} status updated to {}", machineId, status);
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