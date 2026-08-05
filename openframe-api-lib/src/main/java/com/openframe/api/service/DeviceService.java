package com.openframe.api.service;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.device.DeviceFilterCriteria;
import com.openframe.api.dto.device.DeviceFilters;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.service.processor.DeviceStatusProcessor;
import com.openframe.api.service.rmm.ScriptScheduleDeviceService;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.validation.annotation.Validated;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Slf4j
@Validated
@RequiredArgsConstructor
public class DeviceService {

    private static final String FACET_STATUS = "status";
    private static final String FACET_TYPE = "type";
    private static final String FACET_OS_TYPE = "osType";
    private static final String FACET_ORGANIZATION_ID = "organizationId";

    private final MachineRepository machineRepository;
    private final TagRepository tagRepository;
    private final TagAssignmentRepository tagAssignmentRepository;
    private final DeviceStatusProcessor deviceStatusProcessor;
    private final ScriptScheduleDeviceService scriptScheduleDeviceService;
    private final DeviceFilterOptionMapper deviceFilterOptionMapper;

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
        return paginate(machineFilter(filterOptions, null, null), search, paginationCriteria, sort);
    }

    /**
     * Same as {@link #queryDevices} but restricted to a fixed set of machineIds (e.g. the
     * devices assigned to a script schedule). A {@code null}/empty set yields an empty page;
     * the restriction is intersected with any tag filter.
     */
    public CountedGenericQueryResult<Machine> queryAssignedDevices(Collection<String> machineIds,
                                                  DeviceFilterCriteria filterOptions,
                                                  CursorPaginationCriteria paginationCriteria,
                                                  String search,
                                                  SortInput sort) {
        Collection<String> scope = machineIds == null ? List.of() : machineIds;
        return paginate(machineFilter(filterOptions, null, scope), search, paginationCriteria, sort);
    }

    public CountedGenericQueryResult<Machine> queryDevicesForPlatforms(Collection<String> platformNames,
                                                  DeviceFilterCriteria filterOptions,
                                                  CursorPaginationCriteria paginationCriteria,
                                                  String search,
                                                  SortInput sort) {
        return paginate(machineFilter(filterOptions, platformNames, null), search, paginationCriteria, sort);
    }

    public CountedGenericQueryResult<Machine> queryAvailableDevicesForSchedule(Collection<String> platformNames,
                                                  Collection<String> assignedMachineIds,
                                                  DeviceFilterCriteria filterOptions,
                                                  CursorPaginationCriteria paginationCriteria,
                                                  String search) {
        MachineQueryFilter filter = machineFilter(filterOptions, platformNames, null);
        CursorPaginationCriteria normalized = paginationCriteria.normalize();

        long totalFilteredCount = machineRepository.countMachines(filter, search);
        List<Machine> page = machineRepository.findAvailableForScheduleWithCursor(
                filter, search, assignedMachineIds, normalized.getCursor(), normalized.getLimit() + 1);
        boolean hasNextPage = page.size() > normalized.getLimit();
        if (hasNextPage) {
            page = page.subList(0, normalized.getLimit());
        }

        PageInfo pageInfo = PageInfo.builder()
                .hasNextPage(hasNextPage)
                .hasPreviousPage(normalized.hasCursor())
                .build();   // startCursor/endCursor (compound bucket|id) filled in by the mapper
        return CountedGenericQueryResult.<Machine>builder()
                .items(page)
                .pageInfo(pageInfo)
                .filteredCount((int) totalFilteredCount)
                .build();
    }

    public DeviceFilters getAssignedDeviceFilters(Collection<String> machineIds,
                                                  DeviceFilterCriteria filterOptions, String search) {
        Collection<String> scope = machineIds == null ? List.of() : machineIds;
        return deviceFilters(machineFilter(filterOptions, null, scope), search);
    }

    public DeviceFilters getAvailableDeviceFilters(Collection<String> platformNames,
                                                   DeviceFilterCriteria filterOptions, String search) {
        return deviceFilters(machineFilter(filterOptions, platformNames, null), search);
    }

    private DeviceFilters deviceFilters(MachineQueryFilter filter, String search) {
        return DeviceFilters.builder()
                .statuses(deviceFilterOptionMapper.selfLabeled(machineRepository.facet(filter, search, FACET_STATUS)))
                .deviceTypes(deviceFilterOptionMapper.selfLabeled(machineRepository.facet(filter, search, FACET_TYPE)))
                .osTypes(deviceFilterOptionMapper.selfLabeled(machineRepository.facet(filter, search, FACET_OS_TYPE)))
                .organizationIds(deviceFilterOptionMapper.organizationLabeled(machineRepository.facet(filter, search, FACET_ORGANIZATION_ID)))
                .tagKeys(List.of())
                .filteredCount((int) machineRepository.countMachines(filter, search))
                .build();
    }

    /**
     * All machineIds of devices matching {@code filter}/{@code search} within the given platforms —
     * backs "Add all devices" for a schedule (resolve the whole filtered set at once, unpaginated).
     */
    public List<String> findDeviceIdsForPlatforms(Collection<String> platformNames,
                                                  DeviceFilterCriteria filterOptions, String search) {
        return machineRepository.findMachineIds(machineFilter(filterOptions, platformNames, null), search);
    }

    /**
     * Of the given machineIds, those matching {@code filter}/{@code search} — backs "Remove all
     * devices" (the assigned set narrowed by the Selected-tab filter). Empty/null in → empty out.
     */
    public List<String> findAssignedDeviceIds(Collection<String> machineIds,
                                              DeviceFilterCriteria filterOptions, String search) {
        if (machineIds == null || machineIds.isEmpty()) {
            return List.of();
        }
        if (filterOptions == null && (search == null || search.isBlank())) {
            return List.copyOf(machineIds);
        }
        return machineRepository.findMachineIds(machineFilter(filterOptions, null, machineIds), search);
    }

    private CountedGenericQueryResult<Machine> paginate(MachineQueryFilter filter, String search,
                                                        CursorPaginationCriteria paginationCriteria,
                                                        SortInput sort) {
        CursorPaginationCriteria normalizedPagination = paginationCriteria.normalize();
        String sortField = validateSortField(sort != null ? sort.getField() : null);
        SortDirection sortDirection = (sort != null && sort.getDirection() != null) ?
                sort.getDirection() : SortDirection.DESC;

        long totalFilteredCount = machineRepository.countMachines(filter, search);

        List<Machine> allWithOne = machineRepository.findMachinesWithCursor(filter, search,
                normalizedPagination.getCursor(), normalizedPagination.getLimit() + 1,
                sortField, sortDirection.name());
        List<Machine> pageItems = allWithOne.size() > normalizedPagination.getLimit()
                ? allWithOne.subList(0, normalizedPagination.getLimit())
                : allWithOne;
        boolean hasNextPage = pageItems.size() == normalizedPagination.getLimit();

        PageInfo pageInfo = buildPageInfo(pageItems, hasNextPage, normalizedPagination.hasCursor());

        return CountedGenericQueryResult.<Machine>builder()
                .items(pageItems)
                .pageInfo(pageInfo)
                .filteredCount((int) totalFilteredCount)
                .build();
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

    private MachineQueryFilter machineFilter(DeviceFilterCriteria filter,
                                             Collection<String> platformNames,
                                             Collection<String> restrictToMachineIds) {
        MachineQueryFilter out = new MachineQueryFilter();
        if (filter != null) {
            out.setStatuses(filter.getStatuses() != null ? filter.getStatuses().stream().map(Enum::name).collect(Collectors.toList()) : null);
            out.setDeviceTypes(filter.getDeviceTypes() != null ? filter.getDeviceTypes().stream().map(Enum::name).collect(Collectors.toList()) : null);
            out.setOsTypes(filter.getOsTypes());
            out.setOrganizationIds(filter.getOrganizationIds());
        }
        if (platformNames != null && !platformNames.isEmpty()) {
            out.setPlatformNames(new ArrayList<>(platformNames));
        }
        List<String> tagMachineIds = filter != null ? resolveTagFilterToMachineIds(filter) : null;
        out.setRestrictToMachineIds(intersectMachineIds(tagMachineIds, restrictToMachineIds));

        return out;
    }

    /**
     * Combine the tag-filter machineId restriction with an explicit caller restriction into a
     * single {@code $in} set. {@code null} on a side means "no restriction from that side";
     * when both are present the result is their intersection (possibly empty).
     */
    private static Collection<String> intersectMachineIds(List<String> tagMachineIds, Collection<String> restrict) {
        if (tagMachineIds == null && restrict == null) {
            return null;
        }
        if (tagMachineIds == null) {
            return restrict;
        }
        if (restrict == null) {
            return tagMachineIds;
        }
        Set<String> restrictSet = new HashSet<>(restrict);
        return tagMachineIds.stream().filter(restrictSet::contains).collect(Collectors.toList());
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
            return null;
        }

        Set<String> resolvedTagIds = new HashSet<>();
        if (hasTagKeys) {
            List<Tag> tagsByKey = tagRepository.findByKeyInAndEntityType(filter.getTagKeys(), TagEntityType.DEVICE);
            tagsByKey.forEach(tag -> resolvedTagIds.add(tag.getId()));
        }
        if (resolvedTagIds.isEmpty() && hasTagKeys) {
            return new ArrayList<>();
        }

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

        return assignments.stream()
                .map(TagAssignment::getEntityId)
                .distinct()
                .collect(Collectors.toList());
    }

    public void updateStatusByMachineId(@NotBlank String machineId, @NotNull DeviceStatus status) {
        log.info("Updating device status. machineId={}, newStatus={}", machineId, status);
        Machine machine = machineRepository.findByMachineId(machineId)
                .orElseThrow(() -> new DeviceNotFoundException("Device not found: " + machineId));
        if (machine.getStatus() == status) {
            log.info("Device {} already has status {}", machineId, status);
            return;
        }
        if (status == DeviceStatus.DELETED) {
            scriptScheduleDeviceService.removeDeviceFromAllSchedules(machine.getTenantId(), machineId);
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

    public Machine updateNickname(@NotBlank String machineId, String nickname) {
        log.info("Updating device nickname. machineId={}", machineId);
        Machine machine = machineRepository.findByMachineId(machineId)
                .orElseThrow(() -> new DeviceNotFoundException("Device not found: " + machineId));
        machine.setNickname(normalizeNickname(nickname));
        machine.setUpdatedAt(Instant.now());
        Machine saved = machineRepository.save(machine);
        log.info("Device {} nickname updated", machineId);
        return saved;
    }

    /**
     * Trim the nickname; a blank or null value clears it (stored as null).
     */
    private String normalizeNickname(String nickname) {
        if (nickname == null) {
            return null;
        }
        String trimmed = nickname.trim();
        return trimmed.isEmpty() ? null : trimmed;
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
