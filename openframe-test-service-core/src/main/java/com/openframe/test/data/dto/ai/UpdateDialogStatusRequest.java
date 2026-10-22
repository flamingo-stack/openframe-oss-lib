package com.openframe.test.data.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// Body for PATCH chat/api/v1/dialogs/{id}/status (UpdateDialogStatusRequest in the ai-agent).
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateDialogStatusRequest {
    private String status;
}
