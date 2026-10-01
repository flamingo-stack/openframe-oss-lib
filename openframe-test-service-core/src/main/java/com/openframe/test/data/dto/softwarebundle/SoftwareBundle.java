package com.openframe.test.data.dto.softwarebundle;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.schedule.ScheduleDeviceConnection;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// A software bundle; the two pickers are only filled by SoftwareBundleQueries.GET_SOFTWARE_BUNDLE_DEVICES and are null otherwise.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class SoftwareBundle {
    private String id;
    private String status;
    private String action;
    private String mode;
    private List<SoftwareBundlePackage> packages;
    private Integer deviceCount;
    private String startAt;
    private String scheduleId;
    private List<String> executionIds;
    private String createdBy;
    private String createdAt;
    private String updatedAt;
    private String completedAt;
    private ScheduleDeviceConnection assignedDevices;
    private ScheduleDeviceConnection availableDevices;
}
