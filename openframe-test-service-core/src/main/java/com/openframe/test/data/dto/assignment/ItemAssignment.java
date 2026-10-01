package com.openframe.test.data.dto.assignment;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ItemAssignment {
    private String id;
    private AssignmentItemType itemType;
    private AssignmentTargetType targetType;
    private String displayName;
    private String createdAt;
    private AssignmentTarget target;
}
