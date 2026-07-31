package com.openframe.test.data.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Body for {@code POST chat/api/v1/approval-requests/{id}/approve}. The same endpoint approves and
 * rejects — {@code approve=false} rejects.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApproveCommandRequest {
    private boolean approve;
}
