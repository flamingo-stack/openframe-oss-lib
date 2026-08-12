package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.ScheduleScriptExecution;
import com.openframe.data.document.rmm.filter.ScheduleRunQueryFilter;
import org.springframework.data.domain.Sort;

import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * Custom MongoTemplate-backed queries for {@link ScheduleScriptExecution} that don't fit
 * the derived-method / {@code @Query+@Update} mould: cursor pagination for the
 * "Schedule Runs" tab and batch aggregation over the leaf collection.
 */
public interface CustomScheduleScriptExecutionRepository {

    /**
     * One page of fires for a single schedule, tenant-scoped, sorted by {@code _id} DESC
     * (newest first). {@code filter} narrows by status subset + inclusive
     * {@code dispatchedAt} range; {@code search} is a case-insensitive substring match on
     * {@code executionId}. Cursor is the raw {@code ObjectId} hex of the boundary row of
     * the previous page — an invalid cursor throws {@code BadRequestException}. Pass
     * {@code limit + 1} to detect a next page.
     */
    List<ScheduleScriptExecution> findPageForSchedule(String tenantId,
                                                     String scriptScheduleId,
                                                     ScheduleRunQueryFilter filter,
                                                     String search,
                                                     String sortField,
                                                     Sort.Direction sortDirection,
                                                     String cursor,
                                                     boolean backward,
                                                     int limit);

    /** Whether {@code field} may back a {@code sort} on the Schedule Runs tab ({@code _id} / {@code dispatchedAt}). */
    boolean isSortableField(String field);

    /** Default sort field when the caller supplies none or an unknown one. */
    String getDefaultSortField();

    /** Cursor for a boundary row under the active sort: raw id for {@code _id}, else {@code epochMillis|id}. */
    String encodeCursor(ScheduleScriptExecution run, String sortField);

    /**
     * Full matching count for the {@code (tenantId, scheduleId, filter, search)} tuple,
     * ignoring pagination. Backs the connection's {@code filteredCount}.
     */
    long countForSchedule(String tenantId,
                          String scriptScheduleId,
                          ScheduleRunQueryFilter filter,
                          String search);

    /**
     * For every {@code executionId} in {@code executionIds}, count how many DISTINCT machines
     * have at least one terminal leaf (i.e. have "responded" — we've received and processed
     * a result from that device via Kafka). Backs the "80 / 150 devices" progress ratio on
     * the Schedule Runs list.
     *
     * <p>One aggregation pipeline for the whole page — no N+1. Executions with zero responded
     * devices are absent from the map (caller treats missing as {@code 0}).
     */
    Map<String, Long> countRespondedDevicesByExecutionIds(String tenantId, Collection<String> executionIds);

    /**
     * Faceted {@code value → count} map for one field of the "Schedule Runs" filter panel, over the
     * same {@code (tenantId, scheduleId, filter, search)} scope as {@link #countForSchedule} (the
     * whole filter is applied, mirroring the Execution-History facets). {@code field} is the raw
     * document field to group by ({@code status} or {@code initiatedBy}); the returned keys are that
     * field's raw values (status name / raw initiator user id).
     */
    Map<String, Integer> facet(String tenantId,
                               String scriptScheduleId,
                               ScheduleRunQueryFilter filter,
                               String search,
                               String field);
}
