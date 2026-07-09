package com.openframe.api.dto.audit;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;


@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LogFilterCriteria {

    private LocalDate startDate;
    private LocalDate endDate;
    private Instant timestampFrom;
    private Instant timestampTo;
    private List<String> eventTypes;
    private List<String> toolTypes;
    private List<String> severities;
    private List<String> organizationIds;
    private String deviceId;


}