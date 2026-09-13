package com.openframe.test.data.dto.notification;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Filter for {@code notifications(...)}: {@code read} null lists everything, true/false one side. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class NotificationFilterInput {
    private Boolean read;
}
