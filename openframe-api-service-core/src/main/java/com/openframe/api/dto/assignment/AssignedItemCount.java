package com.openframe.api.dto.assignment;

import com.openframe.data.document.assignment.AssignmentTargetType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssignedItemCount {
    private AssignmentTargetType targetType;
    private int count;
}
