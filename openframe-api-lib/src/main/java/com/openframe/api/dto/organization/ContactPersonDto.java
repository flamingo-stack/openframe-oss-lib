package com.openframe.api.dto.organization;

import lombok.Builder;

/**
 * DTO for contact person information.
 */
@Builder
public record ContactPersonDto(
        String contactName,
        String title,
        String phone,
        String email
) {
}
