package com.openframe.api.service.device;

import com.openframe.api.config.DeviceLogProperties;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.device.DeviceLogEntry;
import com.openframe.api.dto.device.DeviceLogFilterCriteria;
import com.openframe.api.dto.device.DeviceLogLevel;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.service.tenant.TenantDomainService;
import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;
import com.openframe.core.logs.AgentLogBucket;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.loki.client.LogQl;
import com.openframe.data.loki.client.LokiClient;
import com.openframe.data.loki.model.LokiDirection;
import com.openframe.data.loki.model.LokiLogEntry;
import com.openframe.data.repository.organization.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

import static java.util.stream.Collectors.joining;
import static java.util.stream.Collectors.toSet;

/**
 * Device agent logs, read from Loki where {@code openframe-saas-logs-stream} writes them as
 * {@code {job="agent-logs", tenant_domain, level}} streams with {@code machine_id}, {@code organization_id},
 * {@code hostname}, {@code agent_ts} and {@code count} as structured metadata.
 * <p>
 * The tenant domain that pins the stream selector comes from {@link TenantDomainService}, never from a caller, so no
 * argument reaching this service can widen the query past its own tenant. The same domain is declared as the Loki
 * scheduler actor: Loki has no multi-tenancy here, so without it every tenant shares one queue and one tenant's heavy
 * queries hold up everyone else's small ones.
 */
@Service
@Slf4j
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.loki.enabled", havingValue = "true")
public class DeviceLogService {

    static final int DEFAULT_PAGE_SIZE = 100;
    static final int MAX_PAGE_SIZE = 500;
    // Loki's max_entries_limit_per_query on prod
    static final int MAX_LINES_PER_TIMESTAMP = 5000;

    private static final String AGENT_LOGS_JOB = "agent-logs";
    private static final String CASE_INSENSITIVE = "(?i)";
    private static final DeviceLogArgumentContract ARGUMENT_CONTRACT = new DeviceLogArgumentContract();

    private final LokiClient lokiClient;
    private final DeviceService deviceService;
    private final TenantDomainService tenantDomainService;
    private final DeviceLogProperties properties;
    private final OrganizationRepository organizationRepository;

    /**
     * Logs of one device, newest first. Shorthand for {@link #queryLogs(List, DeviceLogFilterCriteria,
     * CursorPaginationCriteria)} with a single device.
     */
    public GenericQueryResult<DeviceLogEntry> queryDeviceLogs(String machineId,
                                                              DeviceLogFilterCriteria filter,
                                                              CursorPaginationCriteria pagination) {
        return queryLogs(Collections.singletonList(machineId), filter, pagination);
    }

    /**
     * Agent logs of this tenant, newest first, narrowed to {@code machineIds} or covering every device when that
     * list is null.
     * <p>
     * Tenant isolation does not rely on anything in the request: every named device must be visible to this tenant,
     * and the stream selector is pinned to this tenant's own domain from the {@code tenants} collection. Whether a
     * device is named only adds a metadata filter on top of that selector, so it can never widen the scope.
     */
    public GenericQueryResult<DeviceLogEntry> queryLogs(List<String> machineIds,
                                                        DeviceLogFilterCriteria filter,
                                                        CursorPaginationCriteria pagination) {
        return queryLogs(machineIds, null, filter, pagination);
    }

    /**
     * Agent logs of this tenant, newest first, narrowed to {@code machineIds} and to devices of
     * {@code organizationIds}; a null list leaves that dimension open, and both together keep the lines that match
     * both (their intersection).
     * <p>
     * The organization filter relies on the {@code organization_id} metadata the agent sends with each batch, so it
     * only matches lines written since agents started sending it. Organizations are checked against this tenant like
     * devices are, so an id from another tenant is a 404 rather than an empty page; the stream selector keeps the
     * query on this tenant either way.
     */
    public GenericQueryResult<DeviceLogEntry> queryLogs(List<String> machineIds,
                                                        List<String> organizationIds,
                                                        DeviceLogFilterCriteria filter,
                                                        CursorPaginationCriteria pagination) {
        List<String> devices = ARGUMENT_CONTRACT.normalizeMachineIds(machineIds);
        List<String> organizations = ARGUMENT_CONTRACT.normalizeOrganizationIds(organizationIds);
        verifyDevicesExist(devices);
        verifyOrganizationsExist(organizations);

        DeviceLogFilterCriteria criteria = filter != null ? filter : new DeviceLogFilterCriteria();
        CursorPaginationCriteria page = pagination != null ? pagination : new CursorPaginationCriteria();
        DeviceLogQueryArguments arguments = queryArguments(machineIds, organizationIds, criteria, page);
        Instant now = Instant.now();
        DeviceLogArgumentContract.PreparedQuery prepared = ARGUMENT_CONTRACT.prepare(arguments, now);
        Instant from = prepared.from();
        Long cursorNanos = prepared.cursorNanos();
        DeviceLogCursor after = cursorNanos == null ? null : new DeviceLogCursor(cursorNanos);
        long startNanos = prepared.startNanos();
        long endNanos = prepared.endNanos();
        if (after != null) {
            if (after.timestampNanos() <= startNanos) {
                return result(List.of(), false, true);
            }
            endNanos = Math.min(endNanos, after.timestampNanos());
        }

        String tenantDomain = tenantDomainService.getTenantDomain();
        String query = buildQuery(tenantDomain, devices, organizations, criteria, bucketed(from));
        int pageSize = pageSize(page.getLimit());
        log.debug("Querying device logs for machineIds: {}, organizationIds: {}, query: {}, start: {}, end: {}",
                devices, organizations, query, startNanos, endNanos);

        // One extra line tells whether there is a next page
        int queryLimit = pageSize + 1;
        List<LokiLogEntry> entries = lokiClient.queryRange(query, startNanos, endNanos, queryLimit,
                LokiDirection.BACKWARD, tenantDomain);
        List<LokiLogEntry> pageEntries = wholeTimestampsOnly(entries, pageSize, query, tenantDomain);
        List<DeviceLogEntry> items = toItems(pageEntries);
        boolean hasNextPage = entries.size() > pageSize;
        boolean hasPreviousPage = after != null;

        return result(items, hasNextPage, hasPreviousPage);
    }

    /**
     * True only once the whole window is known to carry the {@code bucket} label. A window that starts before the
     * cutover is queried unbucketed in full rather than split into a bucketed and an unbucketed half: the cursor is a
     * timestamp alone and paging assumes one Loki result set, so merging two would reopen the gap-and-duplicate bug
     * that whole-timestamp paging exists to prevent.
     */
    private boolean bucketed(Instant from) {
        Instant cutover = properties.getBucketCutover();
        return cutover != null && !from.isBefore(cutover);
    }

    static String buildQuery(String tenantDomain, List<String> machineIds, DeviceLogFilterCriteria criteria,
                             boolean bucketed) {
        return buildQuery(tenantDomain, machineIds, List.of(), criteria, bucketed);
    }

    static String buildQuery(String tenantDomain, List<String> machineIds, List<String> organizationIds,
                             DeviceLogFilterCriteria criteria, boolean bucketed) {
        StringBuilder query = new StringBuilder("{job=").append(LogQl.quote(AGENT_LOGS_JOB))
                .append(", tenant_domain=").append(LogQl.quote(tenantDomain));
        List<DeviceLogLevel> levels = criteria.getLevels();
        if (levels != null && !levels.isEmpty()) {
            String alternatives = levels.stream().distinct().map(Enum::name).collect(joining("|"));
            query.append(", level=~").append(LogQl.quote(alternatives));
        }
        if (bucketed) {
            appendBucketMatcher(query, machineIds);
        }
        query.append('}');
        // Line filters before the metadata filter: the cheapest stage runs first
        appendTermFilters(query, " |~ ", criteria.getContains());
        appendTermFilters(query, " !~ ", criteria.getExcludes());
        appendDeviceFilter(query, machineIds);
        appendMetadataFilter(query, "organization_id", organizationIds);
        return query.toString();
    }

    /**
     * The one part of the selector the index can use to skip a device's logs. Named devices hash to at most as many
     * buckets as there are devices, so a handful of devices reads a fraction of the tenant's data; a set spanning every
     * bucket, or no devices at all, adds nothing and is left off.
     */
    private static void appendBucketMatcher(StringBuilder query, List<String> machineIds) {
        if (machineIds.isEmpty()) {
            return;
        }
        Set<String> buckets = new TreeSet<>();
        for (String machineId : machineIds) {
            buckets.add(AgentLogBucket.label(machineId));
        }
        if (buckets.size() >= AgentLogBucket.BUCKET_COUNT) {
            return;
        }
        query.append(", bucket=~").append(LogQl.quote(String.join("|", buckets)));
    }

    /**
     * {@code machine_id} is structured metadata rather than a stream label, so the selector above already spans every
     * device of the tenant and naming devices only drops lines from the result. An empty list therefore needs no
     * filter at all. Several devices chain with {@code or} instead of a regex alternation: no escaping, and no
     * dependence on how Loki anchors a label-filter regex.
     */
    private static void appendDeviceFilter(StringBuilder query, List<String> machineIds) {
        appendMetadataFilter(query, "machine_id", machineIds);
    }

    /**
     * One {@code |} stage per metadata key, its values chained with {@code or}. Separate stages AND together, so naming
     * devices and organizations keeps only lines that match both.
     */
    private static void appendMetadataFilter(StringBuilder query, String key, List<String> values) {
        if (values.isEmpty()) {
            return;
        }
        query.append(" | ");
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                query.append(" or ");
            }
            query.append(key).append('=').append(LogQl.quote(values.get(i)));
        }
    }

    private static DeviceLogQueryArguments queryArguments(List<String> machineIds, List<String> organizationIds,
                                                          DeviceLogFilterCriteria criteria, CursorPaginationCriteria page) {
        List<String> contains = criteria.getContains();
        List<String> excludes = criteria.getExcludes();
        Instant from = criteria.getFrom();
        Instant to = criteria.getTo();
        String cursor = page.getCursor();
        return new DeviceLogQueryArguments(machineIds, organizationIds, contains, excludes, from, to, cursor);
    }

    /**
     * {@link Organization} is tenant-scoped, so the lookup only sees this tenant's organizations: an id from another
     * tenant is a 404 here, the same as a typo.
     */
    private void verifyOrganizationsExist(List<String> organizationIds) {
        if (organizationIds.isEmpty()) {
            return;
        }
        Set<String> found = organizationRepository.findByOrganizationIdIn(new LinkedHashSet<>(organizationIds)).stream()
                .map(Organization::getOrganizationId)
                .collect(toSet());
        for (String organizationId : organizationIds) {
            if (!found.contains(organizationId)) {
                throw new NotFoundException(ErrorCode.ORGANIZATION_NOT_FOUND, "Organization not found: " + organizationId);
            }
        }
    }

    /**
     * One lookup for the whole set. Tenant isolation does not depend on this check - the stream selector does that -
     * but it turns a typo into a 404 instead of an empty page.
     */
    private void verifyDevicesExist(List<String> machineIds) {
        if (machineIds.isEmpty()) {
            return;
        }
        Set<String> found = deviceService.findByMachineIds(machineIds).stream()
                .map(Machine::getMachineId)
                .collect(toSet());
        for (String machineId : machineIds) {
            if (!found.contains(machineId)) {
                throw new DeviceNotFoundException("Machine not found: " + machineId);
            }
        }
    }

    /**
     * One line filter per term, so several terms narrow the result instead of being matched as one phrase.
     */
    private static void appendTermFilters(StringBuilder query, String operator, List<String> terms) {
        if (terms == null) {
            return;
        }
        for (String term : terms) {
            if (StringUtils.hasText(term)) {
                query.append(operator).append(LogQl.quote(CASE_INSENSITIVE + LogQl.regexLiteral(term)));
            }
        }
    }

    /**
     * Loki cuts a result at the limit without regard to timestamps, and does not guarantee which of the lines sharing
     * the cut timestamp it keeps. The page therefore ends before that timestamp, and the next page starts with all of
     * its lines. When one timestamp fills the whole page, its lines are fetched in full instead.
     */
    private List<LokiLogEntry> wholeTimestampsOnly(List<LokiLogEntry> entries, int pageSize, String query,
                                                  String tenantDomain) {
        if (entries.size() <= pageSize) {
            return entries;
        }
        long cutNanos = entries.get(pageSize).timestampNanos();
        int end = pageSize;
        while (end > 0 && entries.get(end - 1).timestampNanos() == cutNanos) {
            end--;
        }
        if (end > 0) {
            return entries.subList(0, end);
        }
        return lokiClient.queryRange(query, cutNanos, cutNanos + 1, MAX_LINES_PER_TIMESTAMP, LokiDirection.BACKWARD,
                tenantDomain);
    }

    private static List<DeviceLogEntry> toItems(List<LokiLogEntry> entries) {
        List<DeviceLogEntry> items = new ArrayList<>(entries.size());
        for (LokiLogEntry entry : entries) {
            items.add(DeviceLogEntry.builder()
                    .timestamp(entry.timestamp())
                    .agentTimestamp(parseInstant(entry.labels().get("agent_ts")))
                    .level(entry.labels().get("level"))
                    .message(entry.line())
                    .machineId(entry.labels().get("machine_id"))
                    .organizationId(entry.labels().get("organization_id"))
                    .hostname(entry.labels().get("hostname"))
                    .count(parseLong(entry.labels().get("count")))
                    .cursor(new DeviceLogCursor(entry.timestampNanos()).encode())
                    .build());
        }
        return items;
    }

    private static GenericQueryResult<DeviceLogEntry> result(List<DeviceLogEntry> items, boolean hasNextPage,
                                                             boolean hasPreviousPage) {
        return GenericQueryResult.<DeviceLogEntry>builder()
                .items(items)
                .pageInfo(PageInfo.builder()
                        .hasNextPage(hasNextPage)
                        .hasPreviousPage(hasPreviousPage)
                        .startCursor(items.isEmpty() ? null : items.get(0).getCursor())
                        .endCursor(items.isEmpty() ? null : items.get(items.size() - 1).getCursor())
                        .build())
                .build();
    }

    /**
     * Larger than the shared 100-item cap: the agent ships up to 50 lines a minute per device, so 100 lines cover
     * only a couple of minutes of a busy device.
     */
    private static int pageSize(Integer requested) {
        if (requested == null) {
            return DEFAULT_PAGE_SIZE;
        }
        int atLeastOneLine = Math.max(requested, 1);
        return Math.min(atLeastOneLine, MAX_PAGE_SIZE);
    }

    private static Instant parseInstant(String value) {
        if (value == null) {
            return null;
        }
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static Long parseLong(String value) {
        if (value == null) {
            return null;
        }
        try {
            return Long.valueOf(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
