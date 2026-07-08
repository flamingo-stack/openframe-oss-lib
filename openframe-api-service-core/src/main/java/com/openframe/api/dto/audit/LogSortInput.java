package com.openframe.api.dto.audit;

import com.openframe.api.dto.shared.SortDirection;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LogSortInput {

    private LogSortField field;

    private SortDirection direction;
}
