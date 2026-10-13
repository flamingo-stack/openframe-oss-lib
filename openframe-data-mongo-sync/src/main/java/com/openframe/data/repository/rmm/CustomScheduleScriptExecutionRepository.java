package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.schedule.ScheduleScriptExecution;
import com.openframe.data.document.rmm.filter.ScheduleRunQueryFilter;
import org.springframework.data.domain.Sort;

import java.util.Collection;
import java.util.List;
import java.util.Map;

// Custom MongoTemplate-backed queries for cursor pagination on the Schedule Runs tab and batch aggregation over the leaf collection.
public interface CustomScheduleScriptExecutionRepository {

    // Cursor is the boundary row's raw ObjectId hex from the previous page; an invalid cursor throws BadRequestException. Pass limit + 1 to detect a next page.
    List<ScheduleScriptExecution> findPageForSchedule(String tenantId,
                                                     String scriptScheduleId,
                                                     ScheduleRunQueryFilter filter,
                                                     String search,
                                                     String sortField,
                                                     Sort.Direction sortDirection,
                                                     String cursor,
                                                     boolean backward,
                                                     int limit);

    boolean isSortableField(String field);

    String getDefaultSortField();

    // Raw id for _id sort, else epochMillis|id.
    String encodeCursor(ScheduleScriptExecution run, String sortField);

    long countForSchedule(String tenantId,
                          String scriptScheduleId,
                          ScheduleRunQueryFilter filter,
                          String search);

    // One aggregation pipeline for the whole page to avoid N+1; executions with zero responded devices are absent from the map.
    Map<String, Long> countRespondedDevicesByExecutionIds(String tenantId, Collection<String> executionIds);

    Map<String, Integer> facet(String tenantId,
                               String scriptScheduleId,
                               ScheduleRunQueryFilter filter,
                               String search,
                               String field);
}
